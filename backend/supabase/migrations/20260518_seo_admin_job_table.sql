-- =============================================================================
-- ADR-072 PR 2D-3 — Admin job audit table
-- =============================================================================
--
-- Persistent audit + state-machine for admin-triggered long-running jobs
-- (initial scope : R8 snapshot seed runs). Replaces the "ad-hoc one-shot
-- script" anti-pattern with a fully traceable, idempotent surface.
--
-- Canonical pattern (mirrors AWS Step Functions execution history, Temporal
-- Workflow Executions, Cadence). Single source of truth for any admin job :
-- consumers (UI, CI gate, observability) read the same row.
--
-- Why a dedicated table and not __seo_outbox_event :
--   - Outbox is "events to publish downstream", not "jobs awaiting an
--     operator". Mixing them couples concerns and complicates retention.
--   - Admin jobs need a UNIQUE idempotency contract that survives even when
--     the BullMQ run never ran (idempotency check happens BEFORE enqueue).
--   - Admin jobs carry richer state (input snapshot, report, error,
--     actor identity) than the outbox event payload normally holds.
-- =============================================================================

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE IF NOT EXISTS public.__seo_admin_job (
  job_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type          TEXT NOT NULL,                                -- 'r8_seed_run' for PR 2D-3
  idempotency_key   TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN
                       ('pending', 'running', 'completed', 'failed', 'cancelled')),
  input             JSONB NOT NULL DEFAULT '{}'::JSONB,
  result            JSONB,                                        -- populated on completion
  error             TEXT,                                         -- populated on failure
  actor             TEXT NOT NULL,                                -- admin identity (email/user-id)
  trace_id          TEXT,                                         -- OTel correlation
  accepted_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at        TIMESTAMPTZ,
  finished_at       TIMESTAMPTZ,
  -- Idempotency : (job_type, idempotency_key) uniquely identifies a logical run.
  CONSTRAINT __seo_admin_job_idempotency_uq
    UNIQUE (job_type, idempotency_key)
);

COMMENT ON TABLE public.__seo_admin_job IS
  'ADR-072 PR 2D-3 — Persistent audit + state-machine for admin-triggered long-running jobs. Pattern mirror : AWS Step Functions execution history, Temporal Workflow Executions. UNIQUE(job_type, idempotency_key) makes admin endpoints replay-safe — same key → same job row returned. status enum : pending (accepted, awaiting worker) → running (worker started) → completed | failed | cancelled.';

COMMENT ON COLUMN public.__seo_admin_job.idempotency_key IS
  'Client-provided unique key per logical run. RFC-7240 / Stripe Idempotent Requests pattern. UUID v4 recommended; any 16-64 char alphanumeric+dash accepted.';

COMMENT ON COLUMN public.__seo_admin_job.actor IS
  'Admin identity (email or stable user-id). Required for audit-trail and dashboards. NEVER service-role generic ; always a real human or named system account.';

CREATE INDEX IF NOT EXISTS idx_admin_job_status_accepted
  ON public.__seo_admin_job (status, accepted_at DESC)
  WHERE status IN ('pending', 'running');

CREATE INDEX IF NOT EXISTS idx_admin_job_type_recent
  ON public.__seo_admin_job (job_type, accepted_at DESC);

ALTER TABLE public.__seo_admin_job ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.__seo_admin_job TO service_role;
-- No DELETE grant : audit-trail conservé (archive cold storage déférée V2).

-- =============================================================================
-- Helper RPC : atomic accept (idempotent insert)
-- =============================================================================
--
-- Returns the existing row (idempotent hit) OR inserts a new one and returns
-- it. Single-roundtrip semantics — no application-side TOCTOU race between
-- "SELECT idempotency_key" and "INSERT".
-- =============================================================================
CREATE OR REPLACE FUNCTION public.__seo_admin_job_accept(
  p_job_type        TEXT,
  p_idempotency_key TEXT,
  p_input           JSONB,
  p_actor           TEXT,
  p_trace_id        TEXT DEFAULT NULL
) RETURNS TABLE (
  job_id          UUID,
  status          TEXT,
  idempotent_hit  BOOLEAN,
  accepted_at     TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing  public.__seo_admin_job%ROWTYPE;
  v_new_id    UUID;
BEGIN
  -- Validate inputs
  IF p_job_type IS NULL OR LENGTH(p_job_type) = 0 THEN
    RAISE EXCEPTION 'admin_job_accept_invalid_job_type';
  END IF;
  IF p_idempotency_key IS NULL OR LENGTH(p_idempotency_key) < 8 THEN
    RAISE EXCEPTION 'admin_job_accept_invalid_idempotency_key';
  END IF;
  IF p_actor IS NULL OR LENGTH(p_actor) = 0 THEN
    RAISE EXCEPTION 'admin_job_accept_missing_actor';
  END IF;

  -- Lookup existing (idempotent path)
  SELECT * INTO v_existing
  FROM public.__seo_admin_job j
  WHERE j.job_type = p_job_type
    AND j.idempotency_key = p_idempotency_key;

  IF FOUND THEN
    RETURN QUERY SELECT
      v_existing.job_id,
      v_existing.status,
      true AS idempotent_hit,
      v_existing.accepted_at;
    RETURN;
  END IF;

  -- Insert new
  INSERT INTO public.__seo_admin_job (
    job_type, idempotency_key, input, actor, trace_id
  ) VALUES (
    p_job_type, p_idempotency_key, p_input, p_actor, p_trace_id
  )
  RETURNING __seo_admin_job.job_id INTO v_new_id;

  RETURN QUERY SELECT
    v_new_id AS job_id,
    'pending'::TEXT AS status,
    false AS idempotent_hit,
    NOW() AS accepted_at;
END;
$$;

COMMENT ON FUNCTION public.__seo_admin_job_accept IS
  'ADR-072 PR 2D-3 — Atomic idempotent admin-job accept. Returns existing row on conflict (job_type, idempotency_key) instead of raising — Stripe-style idempotent semantics.';

REVOKE ALL ON FUNCTION public.__seo_admin_job_accept(
  TEXT, TEXT, JSONB, TEXT, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.__seo_admin_job_accept(
  TEXT, TEXT, JSONB, TEXT, TEXT
) TO service_role;

-- =============================================================================
-- Helper RPC : transition (started_at / finished_at / status / result / error)
-- =============================================================================
--
-- Constrains state-machine transitions :
--   pending  → running    (sets started_at)
--   running  → completed  (sets finished_at, result)
--   running  → failed     (sets finished_at, error)
--   *        → cancelled  (admin override, sets finished_at)
--
-- Disallowed transitions raise an exception — protects against double-publish
-- and processor race conditions.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.__seo_admin_job_transition(
  p_job_id     UUID,
  p_new_status TEXT,
  p_result     JSONB DEFAULT NULL,
  p_error      TEXT  DEFAULT NULL
) RETURNS public.__seo_admin_job
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current  public.__seo_admin_job%ROWTYPE;
  v_updated  public.__seo_admin_job%ROWTYPE;
BEGIN
  SELECT * INTO v_current FROM public.__seo_admin_job WHERE job_id = p_job_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'admin_job_not_found:%', p_job_id;
  END IF;

  -- Validate state-machine transitions
  IF v_current.status = p_new_status THEN
    -- idempotent re-call (e.g. worker retried after partial commit)
    RETURN v_current;
  END IF;

  IF p_new_status = 'running' AND v_current.status != 'pending' THEN
    RAISE EXCEPTION 'admin_job_invalid_transition:%->%', v_current.status, p_new_status;
  END IF;
  IF p_new_status IN ('completed', 'failed') AND v_current.status NOT IN ('pending', 'running') THEN
    RAISE EXCEPTION 'admin_job_invalid_transition:%->%', v_current.status, p_new_status;
  END IF;
  IF p_new_status NOT IN ('running', 'completed', 'failed', 'cancelled') THEN
    RAISE EXCEPTION 'admin_job_invalid_target_status:%', p_new_status;
  END IF;

  UPDATE public.__seo_admin_job
  SET status      = p_new_status,
      result      = COALESCE(p_result, result),
      error       = COALESCE(p_error, error),
      started_at  = CASE WHEN p_new_status = 'running' AND started_at IS NULL THEN NOW() ELSE started_at END,
      finished_at = CASE WHEN p_new_status IN ('completed', 'failed', 'cancelled') THEN NOW() ELSE finished_at END
  WHERE job_id = p_job_id
  RETURNING * INTO v_updated;

  RETURN v_updated;
END;
$$;

COMMENT ON FUNCTION public.__seo_admin_job_transition IS
  'ADR-072 PR 2D-3 — Atomic state-machine transition with enforced graph: pending→running→completed|failed, + cancelled escape hatch. Idempotent on same-status re-call.';

REVOKE ALL ON FUNCTION public.__seo_admin_job_transition(UUID, TEXT, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.__seo_admin_job_transition(UUID, TEXT, JSONB, TEXT) TO service_role;

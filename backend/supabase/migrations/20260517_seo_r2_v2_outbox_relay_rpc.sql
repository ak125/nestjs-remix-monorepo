-- squawk-ignore-file prefer-text-field
-- squawk-ignore-file prefer-bigint-over-int
--
-- Rationale (ADR-072 PR 2D-2) :
--   Both rules fire on PL/pgSQL function definitions where the parameter list
--   reuses native PostgreSQL identifiers (TEXT, INT). The functions only own
--   their parameters — no new persistent columns are introduced, so the
--   project-wide TEXT/BIGINT canon (MEMORY vehicle-ops anti-patterns) does
--   not apply.
--
-- =============================================================================
-- ADR-072 — RPC helpers : __seo_r8_publish_snapshot + __seo_outbox_claim_batch
-- =============================================================================
--
-- Two atomic SQL helpers consumed by PR 2D-2 services :
--
--   1. __seo_r8_publish_snapshot      — INSERT snapshot + UPDATE pages pointer
--                                       + INSERT outbox event in one tx.
--                                       Idempotent on UNIQUE(version_sha).
--   2. __seo_outbox_claim_batch       — FOR UPDATE SKIP LOCKED claim of N
--                                       pending events. Flips published_at to
--                                       NOW() and returns the rows so the
--                                       relay can push them to BullMQ.
--
-- Canon : Confluent Kafka outbox pattern, Microservices.io transactional
-- outbox, Vercel ISR background regen.
-- =============================================================================

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- =============================================================================
-- 1. __seo_r8_publish_snapshot
-- =============================================================================

CREATE OR REPLACE FUNCTION public.__seo_r8_publish_snapshot(
  p_type_id                  BIGINT,
  p_version_sha              TEXT,
  p_disambiguation_signature JSONB,
  p_enrichment_status        TEXT,
  p_source_lineage           JSONB,
  p_event_reason             TEXT
) RETURNS TABLE (
  snapshot_id            BIGINT,
  inserted               BOOLEAN,
  pages_pointer_updated  BOOLEAN,
  outbox_event_id        BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snapshot_id      BIGINT;
  v_inserted         BOOLEAN := false;
  v_pages_updated    BOOLEAN := false;
  v_event_id         BIGINT;
BEGIN
  -- 1) Snapshot INSERT — idempotent on UNIQUE(version_sha).
  INSERT INTO public.__seo_r8_snapshot_store (
    type_id,
    version_sha,
    disambiguation_signature,
    enrichment_status,
    source_lineage
  ) VALUES (
    p_type_id,
    p_version_sha,
    p_disambiguation_signature,
    p_enrichment_status,
    p_source_lineage
  )
  ON CONFLICT (version_sha) DO NOTHING
  RETURNING id INTO v_snapshot_id;

  IF v_snapshot_id IS NOT NULL THEN
    v_inserted := true;
  ELSE
    SELECT id INTO v_snapshot_id
    FROM public.__seo_r8_snapshot_store
    WHERE version_sha = p_version_sha;
  END IF;

  IF v_snapshot_id IS NULL THEN
    RAISE EXCEPTION
      'r8_publish_snapshot_lookup_failed for version_sha=%', p_version_sha;
  END IF;

  -- 2) Pages pointer UPDATE — INSERT if row missing (idempotent).
  --    We avoid ON CONFLICT here because __seo_r8_pages may have a different
  --    UNIQUE shape across environments; rely on the type_id check instead.
  WITH updated AS (
    UPDATE public.__seo_r8_pages
    SET current_snapshot_id = v_snapshot_id
    WHERE type_id = p_type_id
      AND (current_snapshot_id IS DISTINCT FROM v_snapshot_id)
    RETURNING id
  )
  SELECT EXISTS (SELECT 1 FROM updated) INTO v_pages_updated;

  -- 3) Outbox event INSERT. We always emit, even on idempotent snapshot
  --    re-runs, so downstream consumers can observe the trigger source.
  INSERT INTO public.__seo_outbox_event (
    aggregate_type,
    aggregate_id,
    event_type,
    payload,
    occurred_at
  ) VALUES (
    'R8VehicleSnapshot',
    p_type_id::TEXT,
    'R8SnapshotUpdated',
    jsonb_build_object(
      'typeId', p_type_id,
      'versionSha', p_version_sha,
      'enrichmentStatus', p_enrichment_status,
      'reason', p_event_reason,
      'snapshotInserted', v_inserted,
      'pagesPointerUpdated', v_pages_updated
    ),
    NOW()
  )
  RETURNING id INTO v_event_id;

  RETURN QUERY SELECT v_snapshot_id, v_inserted, v_pages_updated, v_event_id;
END;
$$;

COMMENT ON FUNCTION public.__seo_r8_publish_snapshot IS
  'ADR-072 PR 2D-2 — atomic publish of a R8 snapshot version : INSERT __seo_r8_snapshot_store ON CONFLICT(version_sha) DO NOTHING, repoint __seo_r8_pages.current_snapshot_id, INSERT __seo_outbox_event R8SnapshotUpdated. SECURITY DEFINER so service_role calls inherit table privileges without granting INSERT on outbox to broader roles.';

REVOKE ALL ON FUNCTION public.__seo_r8_publish_snapshot(
  BIGINT, TEXT, JSONB, TEXT, JSONB, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.__seo_r8_publish_snapshot(
  BIGINT, TEXT, JSONB, TEXT, JSONB, TEXT
) TO service_role;

-- =============================================================================
-- 2. __seo_outbox_claim_batch
-- =============================================================================
--
-- Atomic FOR UPDATE SKIP LOCKED claim. Marks published_at = NOW() and returns
-- the rows so the BullMQ relay can dispatch them to downstream queues.
-- Concurrent relay workers are safe : each call claims a disjoint set.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.__seo_outbox_claim_batch(
  p_limit INTEGER
) RETURNS TABLE (
  id              BIGINT,
  aggregate_type  TEXT,
  aggregate_id    TEXT,
  event_type      TEXT,
  payload         JSONB,
  trace_id        TEXT,
  occurred_at     TIMESTAMPTZ,
  attempts        BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INTEGER := GREATEST(1, LEAST(p_limit, 500));
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT e.id
    FROM public.__seo_outbox_event e
    WHERE e.published_at IS NULL
    ORDER BY e.occurred_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT v_limit
  ),
  updated AS (
    UPDATE public.__seo_outbox_event evt
    SET published_at = NOW()
    FROM claimed
    WHERE evt.id = claimed.id
    RETURNING
      evt.id,
      evt.aggregate_type,
      evt.aggregate_id,
      evt.event_type,
      evt.payload,
      evt.trace_id,
      evt.occurred_at,
      evt.attempts
  )
  SELECT * FROM updated;
END;
$$;

COMMENT ON FUNCTION public.__seo_outbox_claim_batch IS
  'ADR-072 PR 2D-2 — atomic FOR UPDATE SKIP LOCKED claim of pending outbox rows. Flips published_at to NOW() and returns the claimed rows. Safe under concurrent BullMQ relay workers; concurrency target is 1 but multi-instance backend pods stay correct.';

REVOKE ALL ON FUNCTION public.__seo_outbox_claim_batch(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.__seo_outbox_claim_batch(INTEGER) TO service_role;

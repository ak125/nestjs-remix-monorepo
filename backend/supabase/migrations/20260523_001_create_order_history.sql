-- =====================================================
-- ___xtr_order_history (event stream, append-only)
-- Date: 2026-05-23
-- Refs: plans/utiliser-superpower-p0-modular-brooks.md (PR-B)
--       governance-vault ADR-079 (Commerce Runtime Authority canon)
--       Vault #301 résidus F3 deeper rot (createStatusHistory broken)
-- =====================================================
-- Schema event-stream extensible: V1 uses 3 event_types (ORDER_CREATED,
-- STATUS_CHANGED, ORDER_CANCELLED) ; V1.5+ extends via ALTER CHECK additive.
-- Single entry point for writes: RPC append_order_event (idempotent, RLS-safe).
-- Causality preserved from day 1 (correlation_id obligatoire) — enables future
-- event lineage / replay / Operational Knowledge Graph without retro backfill.
-- =====================================================

-- squawk-ignore-file require-concurrent-index-creation
-- Justification: ___xtr_order is small (~1.7k rows / ~2 MB) and the new history
-- table is empty at migration time. CONCURRENTLY would force non-transactional,
-- losing atomicity. Revisit if history grows past ~1M rows.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE IF NOT EXISTS public.___xtr_order_history (
  hist_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ord_id         TEXT NOT NULL,
  event_type     TEXT NOT NULL,
  from_status    TEXT,
  to_status      TEXT,
  payload        JSONB NOT NULL DEFAULT '{}'::jsonb,
  source         TEXT NOT NULL DEFAULT 'system',
  correlation_id UUID NOT NULL,
  user_id        BIGINT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- FKs (NOT VALID skips existing-row scan — table is empty at migration time).
ALTER TABLE public.___xtr_order_history
  DROP CONSTRAINT IF EXISTS fk_order_history_ord_id;
ALTER TABLE public.___xtr_order_history
  ADD CONSTRAINT fk_order_history_ord_id
  FOREIGN KEY (ord_id) REFERENCES public.___xtr_order(ord_id)
  ON DELETE RESTRICT
  NOT VALID;

ALTER TABLE public.___xtr_order_history
  DROP CONSTRAINT IF EXISTS fk_order_history_from_status;
ALTER TABLE public.___xtr_order_history
  ADD CONSTRAINT fk_order_history_from_status
  FOREIGN KEY (from_status) REFERENCES public.___xtr_order_status(ords_id)
  ON DELETE RESTRICT
  NOT VALID;

ALTER TABLE public.___xtr_order_history
  DROP CONSTRAINT IF EXISTS fk_order_history_to_status;
ALTER TABLE public.___xtr_order_history
  ADD CONSTRAINT fk_order_history_to_status
  FOREIGN KEY (to_status) REFERENCES public.___xtr_order_status(ords_id)
  ON DELETE RESTRICT
  NOT VALID;

-- Canon event_type enum (extensible: V1.5+ adds via ALTER CHECK additive).
ALTER TABLE public.___xtr_order_history
  DROP CONSTRAINT IF EXISTS chk_order_history_event_type;
ALTER TABLE public.___xtr_order_history
  ADD CONSTRAINT chk_order_history_event_type
  CHECK (event_type IN (
    'ORDER_CREATED',
    'ORDER_CANCELLED',
    'STATUS_CHANGED',
    'NOTE_UPDATED',
    'ADDRESS_UPDATED',
    'PAYMENT_CONFIRMED'
  ));

-- Indexes optimized for common read paths:
--   1. order detail timeline (ord_id, created_at DESC)
--   2. global event monitoring (event_type, created_at DESC)
--   3. correlation lineage (correlation_id) — partial to skip NULLs (none expected,
--      but kept as belt-and-suspenders to allow future migration loosening NOT NULL).
CREATE INDEX IF NOT EXISTS idx_order_history_ord_id_created
  ON public.___xtr_order_history (ord_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_history_event_type_created
  ON public.___xtr_order_history (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_history_correlation
  ON public.___xtr_order_history (correlation_id);

-- RLS enabled — append-only via RPC only.
-- Pas de policy INSERT direct côté authenticated : tous les appels passent par
-- la RPC append_order_event (SECURITY DEFINER) déclarée plus bas, qui est elle
-- même restreinte aux modules orders.* via ast-grep commerce-no-rpc-without-authority.
ALTER TABLE public.___xtr_order_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_history_admin_read" ON public.___xtr_order_history;
CREATE POLICY "order_history_admin_read"
  ON public.___xtr_order_history
  FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON TABLE public.___xtr_order_history IS
  'Event stream append-only pour le cycle de vie commande. Canon: .spec/00-canon/commerce-runtime/authority-graph.yaml#rpc_authority. Writes via RPC append_order_event uniquement (atomique avec create_order_atomic / cancel_order_atomic).';

-- =====================================================
-- RPC append_order_event
-- Single entry point for INSERT into ___xtr_order_history.
-- Called from inside cancel_order_atomic / create_order_atomic for atomic audit,
-- and from OrderStatusService.createStatusHistory for standalone events.
-- =====================================================

CREATE OR REPLACE FUNCTION public.append_order_event(
  p_ord_id         TEXT,
  p_event_type     TEXT,
  p_from_status    TEXT,
  p_to_status      TEXT,
  p_payload        JSONB,
  p_source         TEXT,
  p_correlation_id UUID,
  p_user_id        BIGINT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_hist_id BIGINT;
BEGIN
  IF p_ord_id IS NULL OR p_ord_id = '' THEN
    RAISE EXCEPTION 'append_order_event: p_ord_id is required';
  END IF;

  IF p_event_type IS NULL OR p_event_type = '' THEN
    RAISE EXCEPTION 'append_order_event: p_event_type is required';
  END IF;

  IF p_correlation_id IS NULL THEN
    RAISE EXCEPTION 'append_order_event: p_correlation_id is required (causality preserved from day 1)';
  END IF;

  INSERT INTO public.___xtr_order_history (
    ord_id, event_type, from_status, to_status,
    payload, source, correlation_id, user_id
  ) VALUES (
    p_ord_id, p_event_type, p_from_status, p_to_status,
    COALESCE(p_payload, '{}'::jsonb), COALESCE(p_source, 'system'),
    p_correlation_id, p_user_id
  )
  RETURNING hist_id INTO v_hist_id;

  RETURN v_hist_id;
END;
$function$;

COMMENT ON FUNCTION public.append_order_event(TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, UUID, BIGINT) IS
  'Single entry point for ___xtr_order_history INSERTs. Called from cancel_order_atomic / create_order_atomic (atomic audit) and from OrderStatusService.createStatusHistory (standalone). Owner: OrderStatusService.createStatusHistory per authority-graph.yaml#rpc_authority.rpcs.append_order_event.';

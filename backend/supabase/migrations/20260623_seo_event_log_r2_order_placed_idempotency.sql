-- Migration: idempotency guard for server-side r2_order_placed funnel emission
-- Commerce-Loop V1 — PR-A (server-side funnel emission).
--
-- Context: __seo_event_log has NO unique constraint (only PK on id). When
-- r2_order_placed moves from the lossy client beacon to a guaranteed SERVER-side
-- emission (OrderFunnelListener @OnEvent(ORDER_EVENTS.PAID)), the source already
-- gives exactly-once semantics via mark_order_paid_atomic.wasPaid. This index is
-- DEFENSE-IN-DEPTH: it makes a double-emit (event redelivery, retried callback)
-- a benign no-op instead of a duplicated sale.
--
-- Design:
--   - PARTIAL: only r2_order_placed rows are constrained (other event_types and
--     the existing 6k+ rows are untouched — zero behavior change for them).
--   - EXPRESSION key = payload->>'order_id' (the natural idempotency key).
--   - NULL order_id is treated as distinct (default) — never blocks; the listener
--     always sets order_id, malformed rows are not silently merged.
--   - Plain (non-CONCURRENTLY) build: the constrained subset has 0 rows today, so
--     the index builds in milliseconds; no meaningful write-lock window.
--   - Additive + reversible (see .down.sql). Forward-only, no data rewrite.
--
-- The application layer (FunnelEventsService.recordOnce) treats the 23505
-- unique_violation raised by this index as a benign idempotent skip, NOT a
-- silent failure (real insert errors still surface) — CLAUDE.md no-silent-fallback.

CREATE UNIQUE INDEX IF NOT EXISTS uq_seo_event_log_r2_order_placed_order_id
  ON public.__seo_event_log ((payload ->> 'order_id'))
  WHERE event_type = 'r2_order_placed';

COMMENT ON INDEX public.uq_seo_event_log_r2_order_placed_order_id IS
  'Idempotency for server-side r2_order_placed emission (Commerce-Loop V1 PR-A): one funnel event per order_id. Defense-in-depth behind mark_order_paid_atomic.wasPaid exactly-once.';

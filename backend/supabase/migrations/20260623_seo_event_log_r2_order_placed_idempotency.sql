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
--   - Additive + reversible (see .down.sql). Forward-only, no data rewrite.
--
-- The application layer (FunnelEventsService.recordOnce) treats the 23505
-- unique_violation raised by this index as a benign idempotent skip, NOT a
-- silent failure (real insert errors still surface) — CLAUDE.md no-silent-fallback.
-- ⚠️ NON auto-appliquée à la DB partagée (deployment.md axe 4) : revue owner + apply_migration manuel.

-- squawk-ignore-file require-concurrent-index-creation
--   assume_in_transaction=true (.squawk.toml) → CONCURRENTLY interdit en transaction ; le sous-ensemble
--   partiel (event_type = 'r2_order_placed') compte 0 ligne aujourd'hui → build en millisecondes,
--   fenêtre de write-lock négligeable. Pattern identique à 20260619_adr059_pr6_seo_projection_schema.sql.
-- Transaction gérée par l'outil de migration (assume_in_transaction=true). Timeouts requis (require-timeout-settings) :
SET lock_timeout = '5s';
SET statement_timeout = '60s';

CREATE UNIQUE INDEX IF NOT EXISTS uq_seo_event_log_r2_order_placed_order_id
  ON public.__seo_event_log ((payload ->> 'order_id'))
  WHERE event_type = 'r2_order_placed';

COMMENT ON INDEX public.uq_seo_event_log_r2_order_placed_order_id IS
  'Idempotency for server-side r2_order_placed emission (Commerce-Loop V1 PR-A): one funnel event per order_id. Defense-in-depth behind mark_order_paid_atomic.wasPaid exactly-once.';

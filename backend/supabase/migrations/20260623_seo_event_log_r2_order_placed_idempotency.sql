-- @non_transactional
-- squawk-ignore-file ban-concurrent-index-creation-in-transaction
--   assume_in_transaction=true (.squawk.toml) : CONCURRENTLY est interdit DANS une
--   transaction, et le marqueur ci-dessus fait exécuter ce fichier en autocommit par
--   l'engine. Les deux vont ensemble — le gate A5 (reconciliation marqueur ↔
--   statements, `--lint-markers` en CI) échoue si l'un manque.
--
-- Migration: idempotency guard for r2_order_placed funnel emission
-- Commerce-Loop V1 — PR-A (server-side funnel emission), step 1 of 3.
--
-- Context: __seo_event_log has NO unique constraint (only PK on id). When
-- r2_order_placed moves from the lossy client beacon to a guaranteed SERVER-side
-- emission (OrderFunnelListener @OnEvent(ORDER_EVENTS.PAID)), the source already
-- gives exactly-once semantics via mark_order_paid_atomic.wasPaid. This index is
-- DEFENSE-IN-DEPTH: it makes a double-emit (event redelivery, retried callback,
-- client beacon re-firing on a return to the confirmation page) a benign no-op
-- instead of a duplicated sale.
--
-- État mesuré (2026-09-04, re-vérifié 2026-09-07, lecture seule) : 15 lignes
-- r2_order_placed / 7 order_id, dont 2 order_id dupliqués par le beacon client
-- (954687 ×7 du 08-08 au 08-25 ; 9S6209586J404615P ×3 du 07-22 au 07-27), dernier
-- doublon le 2026-08-25, aucune ligne depuis le 2026-09-04. L'index UNIQUE sans
-- plancher échouerait donc au build (23505). L'historique des VENTES n'est jamais
-- réécrit (décision owner 2026-09-07, option B du brief
-- audit/ledger-tail-owner-decisions-2026-09-04.md) : le prédicat partiel porte un
-- PLANCHER DE DATE strictement postérieur au dernier doublon — les doublons passés
-- restent visibles (CA fantôme à corriger séparément, jamais en silence), la garde
-- protège tout ce qui s'écrit à partir du plancher, beacon comme émetteur serveur.
--
-- Design:
--   - PARTIAL: event_type = 'r2_order_placed' AND created_at >= '2026-09-01' —
--     les autres event_types et les lignes antérieures sont hors périmètre.
--   - EXPRESSION key = payload->>'order_id' (the natural idempotency key).
--   - NULL order_id is treated as distinct (default) — never blocks; the listener
--     always sets order_id, malformed rows are not silently merged.
--   - CONCURRENTLY : __seo_event_log = 476 MB / 628 k lignes (2026-09-07) et reçoit
--     des écritures en continu ; un CREATE INDEX classique poserait un verrou SHARE
--     (écritures bloquées) pendant le scan. Deux scans concurrents de 33 k pages :
--     quelques secondes, zéro écriture bloquée.
--   - Retry-safe : un build CONCURRENTLY interrompu laisse un index INVALIDE que
--     `IF NOT EXISTS` sauterait en silence → DROP CONCURRENTLY IF EXISTS d'abord
--     (leçon 20260529, incident 2026-09-04).
--   - Timeouts EXPLICITES à 0 : omis, un GUC hérite du défaut du rôle (60 s sur ce
--     projet, cause de l'incident 20260529). Le job CI (`timeout-minutes`) borne
--     le run. lock_timeout = 0 : les attentes internes de CONCURRENTLY comptent
--     contre lock_timeout, et tout bloqueur potentiel est lui-même borné par le
--     statement_timeout de son rôle.
--   - Additive + reversible (see .down.sql). Forward-only, no data rewrite.
--
-- The application layer treats the 23505 unique_violation raised by this index
-- as a benign idempotent skip on BOTH paths — FunnelEventsService.recordOnce()
-- (server listener) and record() (client beacon, aligned in the same PR) — NOT a
-- silent failure (real insert errors still surface) — CLAUDE.md no-silent-fallback.
--
SET lock_timeout = 0;
SET statement_timeout = 0;

DROP INDEX CONCURRENTLY IF EXISTS public.uq_seo_event_log_r2_order_placed_order_id;

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_seo_event_log_r2_order_placed_order_id
  ON public.__seo_event_log ((payload ->> 'order_id'))
  WHERE event_type = 'r2_order_placed'
    AND created_at >= '2026-09-01 00:00:00+00';

COMMENT ON INDEX public.uq_seo_event_log_r2_order_placed_order_id IS
  'Idempotency for r2_order_placed funnel emission (Commerce-Loop V1 PR-A): one funnel event per order_id from 2026-09-01 (date floor = sales history before it is untouched; 2 order_ids duplicated by the client beacon in 07-08/2026 stay visible). Defense-in-depth behind mark_order_paid_atomic.wasPaid exactly-once.';

-- =============================================================================
-- Migration : REVOKE anon/PUBLIC EXECUTE on the 4 order/payment atomics
-- Date      : 2026-06-17
-- Severity  : HIGH exposure — anon could invoke order/payment MUTATIONS
-- =============================================================================
--
-- PROBLEM
-- -------
-- 4 SECURITY DEFINER order/payment functions were executable by anon/authenticated
-- (via the Postgres-default PUBLIC grant). A holder of the public SUPABASE_ANON_KEY
-- could POST /rest/v1/rpc/<fn> and create / cancel / mark-paid an order, bypassing RLS
-- (a DEFINER function runs with the owner's rights). This was the payments.md carveout
-- deliberately deferred from vague-5 (PR #1012) for nominative owner authorization.
--
-- OWNER AUTHORIZATION : nominative, 2026-06-17 (« oui, ferme le paiement »).
--
-- SAFETY (verified 2026-06-17)
-- ----------------------------
-- All 4 are WRITE-path, called only server-side:
--   create_order_atomic     → orders.service.ts:417 (checkout)
--   cancel_order_atomic      → orders.service.ts:761
--   mark_order_paid_atomic   → payments/repositories/payment-data.service.ts:245
--   append_order_event       → orders/services/order-status.service.ts:54
-- PROD backend = service_role (direct EXECUTE grant kept → checkout/payment unaffected).
-- PREPROD READ_ONLY = anon but never executes order writes. → revoke = closes the
-- attacker surface with zero runtime impact. Reversible.
--
-- APPLIED to prod via mcp apply_migration on 2026-06-17 due to the active anon
-- order-mutation surface (same apply-first-then-PR pattern as the 2026-04-23 emergency
-- 20260423_drop_critical_anon_leak_policies.sql). This file is the repo record for
-- review/replay. Post-apply verified : anon_exec=false, service_role_exec=true on all 4.
--
-- IDEMPOTENT : REVOKE on an already-revoked grant is a no-op. squawk-safe (no explicit
-- BEGIN/COMMIT — tool-managed transaction ; lock/statement timeouts set).
--   ROLLBACK : GRANT EXECUTE ON FUNCTION public.<fn>(<args>) TO PUBLIC;  -- (restore default)
-- =============================================================================
SET lock_timeout = '2s';
SET statement_timeout = '15s';

REVOKE EXECUTE ON FUNCTION public.create_order_atomic(p_order jsonb, p_lines jsonb, p_correlation_id uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.create_order_atomic(p_order jsonb, p_lines jsonb, p_correlation_id uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.cancel_order_atomic(p_ord_id text, p_reason text, p_user_id bigint, p_correlation_id uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.cancel_order_atomic(p_ord_id text, p_reason text, p_user_id bigint, p_correlation_id uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.mark_order_paid_atomic(p_ord_id text, p_date_pay text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.mark_order_paid_atomic(p_ord_id text, p_date_pay text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.append_order_event(p_ord_id text, p_event_type text, p_from_status text, p_to_status text, p_payload jsonb, p_source text, p_correlation_id uuid, p_user_id bigint) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.append_order_event(p_ord_id text, p_event_type text, p_from_status text, p_to_status text, p_payload jsonb, p_source text, p_correlation_id uuid, p_user_id bigint) TO service_role;

-- Post-apply verification (already run on prod 2026-06-17):
--   SELECT proname, has_function_privilege('anon', oid, 'EXECUTE') AS anon_exec,
--          has_function_privilege('service_role', oid, 'EXECUTE') AS svc_exec
--   FROM pg_proc WHERE proname IN
--     ('create_order_atomic','cancel_order_atomic','mark_order_paid_atomic','append_order_event');
--   -- expected : anon_exec=false (all), svc_exec=true (all)
-- =============================================================================

-- =============================================================================
-- Migration : Enable RLS + revoke public grants on order_idempotency / order_resume_tokens
-- Date      : 2026-04-22
-- Severity  : CRITICAL (Supabase advisor — rls_disabled_in_public)
-- Scope     : Vague 1 / 5 — security hardening of payment/order tables
-- Author    : Security advisor remediation (PR security/rls-order-tables-vague1-20260422)
-- =============================================================================
--
-- Problem (before this migration)
-- -------------------------------
-- Tables `public.order_idempotency` and `public.order_resume_tokens` were
-- exposed via PostgREST with FULL grants (DELETE, INSERT, SELECT, UPDATE,
-- TRUNCATE) for both `anon` and `authenticated` roles, and Row Level Security
-- was off.
--
-- Concretely : any caller possessing the public `SUPABASE_ANON_KEY` could
--   - read/steal `order_resume_tokens` (cart/order resumption tokens, 2h TTL)
--   - read/forge `order_idempotency` keys (bypass payment double-charge guard)
--   - TRUNCATE the tables (denial of service on order processing)
--
-- Backend impact
-- --------------
-- The orders module accesses both tables exclusively via
-- `OrdersService.getSupabaseClient()`, which returns a `SUPABASE_SERVICE_ROLE_KEY`
-- client (cf. `backend/src/database/services/supabase-base.service.ts`).
-- The `service_role` Postgres role has `BYPASSRLS`, so enabling RLS does NOT
-- affect backend behavior. We still add an explicit policy for defense in
-- depth and audit traceability.
--
-- Strategy (defense in depth)
-- ---------------------------
--   1. REVOKE all grants from `anon` and `authenticated` (kill the public surface).
--   2. ENABLE ROW LEVEL SECURITY (lock the table even if grants regress).
--   3. Add explicit `service_role` ALL policy (documentation + safety net if
--      the bypass attribute is ever removed).
--
-- We deliberately do NOT use `FORCE ROW LEVEL SECURITY` here, to avoid
-- breaking future migrations that run under the `postgres` owner role.
--
-- Idempotency strategy
-- --------------------
-- Policies are created via `DO $$ BEGIN IF NOT EXISTS (…) THEN CREATE POLICY …
-- END IF; END $$;` blocks. Idempotent without destructive policy removal —
-- passes CI Migration Safety gate without any `-- APPROVED:` overrides.
--
-- This migration was applied to prod via `mcp__supabase__apply_migration` on
-- 2026-04-22 (with an earlier DROP+CREATE form). The file is the canonical
-- source of truth for the change and supports replay.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) order_idempotency
-- -----------------------------------------------------------------------------

REVOKE ALL ON TABLE public.order_idempotency FROM anon, authenticated;

ALTER TABLE public.order_idempotency ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = 'order_idempotency' AND policyname = 'order_idempotency_service_role_all') THEN
    CREATE POLICY order_idempotency_service_role_all
      ON public.order_idempotency
      AS PERMISSIVE
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE public.order_idempotency IS
  'Payment idempotency keys (24h TTL). RLS enabled 2026-04-22 — service_role only. '
  'See migration 20260422_enable_rls_order_critical_tables.sql.';

-- -----------------------------------------------------------------------------
-- 2) order_resume_tokens
-- -----------------------------------------------------------------------------

REVOKE ALL ON TABLE public.order_resume_tokens FROM anon, authenticated;

ALTER TABLE public.order_resume_tokens ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = 'order_resume_tokens' AND policyname = 'order_resume_tokens_service_role_all') THEN
    CREATE POLICY order_resume_tokens_service_role_all
      ON public.order_resume_tokens
      AS PERMISSIVE
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE public.order_resume_tokens IS
  'Order resumption tokens (2h TTL, single-use). RLS enabled 2026-04-22 — service_role only. '
  'See migration 20260422_enable_rls_order_critical_tables.sql.';

COMMIT;

-- =============================================================================
-- Post-migration verification (run manually after apply)
-- =============================================================================
--
--   SELECT relname, relrowsecurity
--   FROM   pg_class
--   WHERE  relname IN ('order_idempotency', 'order_resume_tokens');
--   -- expected : relrowsecurity = true for both
--
--   SELECT grantee, table_name, privilege_type
--   FROM   information_schema.role_table_grants
--   WHERE  table_name IN ('order_idempotency', 'order_resume_tokens')
--     AND  grantee IN ('anon', 'authenticated');
--   -- expected : 0 rows
--
--   -- Re-run Supabase advisor : the two `rls_disabled_in_public` rows for
--   -- order_idempotency / order_resume_tokens MUST disappear.
--
-- =============================================================================

-- =============================================================================
-- Migration : EMERGENCY — drop public USING(true) policies leaking admin creds
-- Date      : 2026-04-23
-- Severity  : CRITICAL (admin credentials) / HIGH (payment history) / MEDIUM (config)
-- Scope     : Vague 4b-critical — 4 tables with sensitive data exposed via anon key
-- =============================================================================
--
-- DISCOVERY
-- ---------
-- During Vague 4b audit (callsite review of 77 USING(true) policies on
-- legitimately-public tables), 4 tables turned out to NOT be legitimate
-- catalog/SEO content but actual admin/payment/config data with sensitive
-- columns left fully readable to any caller holding the public anon key:
--
--   - ___config_admin   (11 rows)   columns: cnfa_login, cnfa_pswd, cnfa_keylog,
--                                   cnfa_level — admin authentication credentials
--   - ic_postback       (5914 rows) columns: orderid, transactionid, amount,
--                                   currency, paymentmethod, ip — full payment
--                                   history with PII
--   - ___config         (1 row)     company info (mail, tva, address, owner_*)
--   - ___config_ip      (3 rows)    IP allowlist (infrastructure leak)
--
-- The exposure was via the policy `Enable read access for all users` granting
-- `{public} SELECT USING (true)`. Combined with anon-role grants on the table,
-- any caller could `GET /rest/v1/___config_admin` via PostgREST and retrieve
-- ALL admin password hashes.
--
-- BACKEND IMPACT
-- --------------
-- Zero. Verified via grep on backend/src — all callsites use the
-- SUPABASE_SERVICE_ROLE_KEY (cf. auth.service.ts:117, payment-data.service.ts,
-- gamme-seo-thresholds.service.ts, database-config.service.ts). No frontend
-- supabase-js direct call. service_role policy is created below to preserve
-- access while satisfying the `rls_enabled_no_policy` advisor.
--
-- APPLY ORDER
-- -----------
-- Migration was applied to prod via `mcp__supabase__apply_migration` BEFORE
-- this PR was opened, due to the active credential leak (admin password
-- hashes were readable by anyone with the anon key). The PR exists for code
-- traceability and review.
--
-- Smoke-tested in transaction (BEGIN/ROLLBACK) before apply:
--   4 tables: 1 service_role policy each, 0 public_grants.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Drop the leaking policies (4) — each individually approved
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Enable read access for all users" ON public.___config_admin; -- APPROVED: CRITICAL — policy exposed cnfa_pswd (admin password hashes) to anon role via PostgREST. Backend uses SUPABASE_SERVICE_ROLE_KEY only (auth.service.ts:117 verified). Replaced by service_role-only policy below.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.ic_postback; -- APPROVED: HIGH — policy exposed full payment history (orderid, amount, currency, IP) to anon. Backend uses service_role via .from('ic_postback') in payment-data.service.ts. Replaced by service_role-only policy below.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.___config; -- APPROVED: MEDIUM — policy exposed company config (mail, tva, owner) to anon. Backend uses service_role via gamme-seo-thresholds.service.ts and database-config.service.ts. Replaced by service_role-only policy below.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.___config_ip; -- APPROVED: MEDIUM — policy exposed IP allowlist (infrastructure leak) to anon. Zero code usage detected. Replaced by service_role-only policy below.

-- -----------------------------------------------------------------------------
-- 2. Create service_role policies (idempotent via DO block, no DROP needed)
-- -----------------------------------------------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
    AND tablename='___config_admin' AND policyname='___config_admin_service_role_all') THEN
    CREATE POLICY ___config_admin_service_role_all ON public.___config_admin
      AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
    AND tablename='ic_postback' AND policyname='ic_postback_service_role_all') THEN
    CREATE POLICY ic_postback_service_role_all ON public.ic_postback
      AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
    AND tablename='___config' AND policyname='___config_service_role_all') THEN
    CREATE POLICY ___config_service_role_all ON public.___config
      AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
    AND tablename='___config_ip' AND policyname='___config_ip_service_role_all') THEN
    CREATE POLICY ___config_ip_service_role_all ON public.___config_ip
      AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 3. Defense in depth — explicit REVOKE on anon/authenticated grants
-- -----------------------------------------------------------------------------

REVOKE ALL ON public.___config_admin FROM anon, authenticated;
REVOKE ALL ON public.ic_postback     FROM anon, authenticated;
REVOKE ALL ON public.___config       FROM anon, authenticated;
REVOKE ALL ON public.___config_ip    FROM anon, authenticated;

COMMIT;

-- =============================================================================
-- Post-apply verification (already run on prod)
-- =============================================================================
--   SELECT relname, COUNT(*) FROM pg_class c JOIN pg_policies p ON p.tablename=c.relname
--   WHERE c.relname IN ('___config_admin','ic_postback','___config','___config_ip')
--   GROUP BY relname;
--   -- expected : exactly 1 service_role policy per table
--
--   SELECT grantee, table_name FROM information_schema.role_table_grants
--   WHERE table_name IN ('___config_admin','ic_postback','___config','___config_ip')
--     AND grantee IN ('anon','authenticated');
--   -- expected : 0 rows
--
-- =============================================================================

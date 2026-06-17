-- =============================================================================
-- Migration : Anti-regression — auto-harden RLS on new internal partitions (Vague 5)
-- Date      : 2026-06-16
-- Severity  : ERROR-prevention (stops rls_disabled_in_public from re-appearing)
-- Scope     : Vague 5 — root-cause fix for partition-rotation drift.
-- =============================================================================
--
-- WHY
-- ---
-- 10 partition-maintenance functions create new partitions WITHOUT enabling RLS
-- (verified 2026-06-16: hardens_rls=false for all). They are driven by 11 pg_cron
-- jobs (nightly 02:20-03:10 + monthly) plus on-demand pricing/supplier imports.
-- So every rotation re-introduces an unprotected internal table → the Supabase
-- advisor re-flags it and the one-time vague-5 lockdown would need periodic replay.
-- This is the structural "snapshot-partition-rotation-sensitive" drift.
--
-- DESIGN (robust, low blast radius, extends existing mechanism)
-- ------------------------------------------------------------
-- Instead of editing 10 diverse function bodies (a mistake there silently breaks
-- partition rotation — a known incident class), add ONE idempotent reconciler and
-- schedule it on the EXISTING pg_cron. It is:
--   • additive-only  — it only ENABLEs RLS + REVOKEs anon grants + creates the
--     service_role policy; it never disables RLS nor touches a non-internal table;
--   • allowlist-scoped — same explicit prefix allowlist as the lockdown migration;
--   • not anon-callable — SECURITY DEFINER, EXECUTE revoked from public/anon/authd,
--     search_path pinned (so it does NOT itself trip the advisor it serves);
--   • observable — RAISE NOTICE on every table it hardens (captured by
--     cron.job_run_details).
--
-- Exposure window for a freshly-created partition is ≤ ~1h (hourly reconcile),
-- acceptable for internal ops tables and far better than indefinite drift.
-- A future option (tighter, 0-window) is to call __rls_lock_internal_table()
-- inline at the end of each maintain_*_partitions function — deferred to avoid
-- touching rotation logic in this PR.
-- =============================================================================

BEGIN;

-- 1) Reusable per-table hardening helper (canonical vague-2d block, parameterized)
CREATE OR REPLACE FUNCTION public.__rls_lock_internal_table(p_relname text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $fn$
DECLARE
  v_policy text := p_relname || '_service_role_all';
BEGIN
  -- bound the ENABLE RLS (ACCESS EXCLUSIVE) lock wait so the hourly reconcile never
  -- queues behind a long-running on-demand import on the same table.
  SET LOCAL lock_timeout = '3s';

  -- operate only on an existing public base/partition table
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = p_relname AND c.relkind IN ('r','p')
  ) THEN
    RETURN;
  END IF;

  EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', p_relname);
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', p_relname);

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = p_relname AND policyname = v_policy
  ) THEN
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true)',
      v_policy, p_relname);
  END IF;
END;
$fn$;

REVOKE ALL ON FUNCTION public.__rls_lock_internal_table(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.__rls_lock_internal_table(text) TO service_role;
COMMENT ON FUNCTION public.__rls_lock_internal_table(text) IS
  'Vague 5: idempotently REVOKE anon/authd + ENABLE RLS + service_role policy on one internal table/partition.';

-- 2) Reconciler — finds any rls-disabled internal table (allowlist) and locks it
CREATE OR REPLACE FUNCTION public.__rls_reconcile_internal_tables()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $fn$
DECLARE
  r        record;
  v_count  integer := 0;
  v_failed integer := 0;
BEGIN
  FOR r IN
    SELECT c.relname
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r','p') AND NOT c.relrowsecurity
      AND c.relname ~ '^(__seo_|__soft_404_events|pieces_price_history|pieces_display_history|pieces_gamme_display_history|pieces_gamme_link_history|pieces_media_img_|pricing_|price_import_|supplier_|catalog_pricing_baseline|audit_vlevel_)'
  LOOP
    -- isolate each table: a lock_timeout / transient error on one must not abort the
    -- whole reconcile — the next hourly run retries it.
    BEGIN
      PERFORM public.__rls_lock_internal_table(r.relname);
      v_count := v_count + 1;
      RAISE NOTICE '[rls-reconcile] hardened public.%', r.relname;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      RAISE WARNING '[rls-reconcile] skipped public.% (%) — retry next run', r.relname, SQLERRM;
    END;
  END LOOP;
  IF v_count > 0 THEN
    RAISE NOTICE '[rls-reconcile] locked % drift-tail internal table(s)', v_count;
  END IF;
  -- no-silent-fallback (CLAUDE.md [CRITICAL]): a SYSTEMIC failure (≥1 error AND nothing
  -- locked) fails the cron job loudly → surfaces in cron.job_run_details. Transient
  -- per-table skips (some locked, some errored) self-heal on the next hourly run.
  IF v_failed > 0 AND v_count = 0 THEN
    RAISE EXCEPTION '[rls-reconcile] systemic failure: % table(s) errored, 0 locked', v_failed;
  ELSIF v_failed > 0 THEN
    RAISE WARNING '[rls-reconcile] % table(s) skipped this run (transient) — retry next run', v_failed;
  END IF;
  RETURN v_count;
END;
$fn$;

REVOKE ALL ON FUNCTION public.__rls_reconcile_internal_tables() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.__rls_reconcile_internal_tables() TO service_role;
COMMENT ON FUNCTION public.__rls_reconcile_internal_tables() IS
  'Vague 5: hourly anti-regression — RLS-locks any new internal partition created by rotation cron / imports.';

-- 3) Schedule on the existing pg_cron (idempotent: cron.schedule upserts by name).
--    Minute 15 every hour → catches the 02:20-03:10 nightly rotation window by 03:15.
SELECT cron.schedule('rls-reconcile-internal-tables', '15 * * * *',
  $cron$ SELECT public.__rls_reconcile_internal_tables(); $cron$);

COMMIT;

-- =============================================================================
-- Post-apply verification
-- =============================================================================
--   SELECT public.__rls_reconcile_internal_tables();           -- expected : 0 (after vague-5 lockdown applied)
--   SELECT jobname, schedule, active FROM cron.job WHERE jobname='rls-reconcile-internal-tables';
--   SELECT proname, prosecdef, proconfig FROM pg_proc
--     WHERE proname IN ('__rls_lock_internal_table','__rls_reconcile_internal_tables');
--   -- expected : prosecdef=t, proconfig contains search_path=public, pg_catalog
--
-- ROLLBACK
-- --------
--   SELECT cron.unschedule('rls-reconcile-internal-tables');
--   DROP FUNCTION IF EXISTS public.__rls_reconcile_internal_tables();
--   DROP FUNCTION IF EXISTS public.__rls_lock_internal_table(text);
-- =============================================================================

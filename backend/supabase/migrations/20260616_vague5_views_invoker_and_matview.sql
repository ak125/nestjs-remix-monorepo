-- =============================================================================
-- Migration : SECURITY DEFINER views → INVOKER + matview anon REVOKE (Vague 5)
-- Date      : 2026-06-16
-- Severity  : ERROR (security_definer_view ×2) + WARN (materialized_view_in_api ×1)
-- Scope     : Vague 5 — same pattern as 20260422_views_invoker_kg.sql (Vague 3a).
-- =============================================================================
--
-- PROBLEM
-- -------
-- 2 views are SECURITY DEFINER → they run with the creator's rights (postgres,
-- BYPASSRLS) instead of the caller's, so a holder of SUPABASE_ANON_KEY could read
-- the underlying internal data via PostgREST, bypassing the RLS this vague adds.
-- 1 materialized view is selectable by anon/authenticated (matviews cannot carry
-- RLS — the only lever is REVOKE of the public-role grants).
--
--   public.__seo_content_assets_current_v   SELECT __seo_content_events  (DEFINER)
--   public.v_soft_404_demand_30d            SELECT __soft_404_events     (DEFINER)
--   public.mv_equipementier_article_counts  matview, anon-selectable
--
-- BACKEND / FRONTEND AUDIT (2026-06-16)
-- -------------------------------------
-- All consumers are backend service_role (BYPASSRLS) — the SEO content pipeline
-- and the soft-404 demand cron. Zero @supabase/supabase-js / direct .from() in
-- the frontend (only account_.orders.$orderId.invoice.tsx uses anon, on
-- ___xtr_* order tables — unrelated). → zero runtime impact.
--
-- STRATEGY (identical to Vague 3a)
-- --------------------------------
--   1. ALTER VIEW … SET (security_invoker = true) → view respects the caller's
--      RLS on the underlying table (which this vague locks down).
--   2. REVOKE ALL FROM anon, authenticated → close the public surface
--      (defense in depth, in addition to underlying-table RLS).
--   3. service_role keeps access via BYPASSRLS + existing table service_role
--      policies. An explicit GRANT SELECT TO service_role is added for clarity.
--
-- IDEMPOTENCY : ALTER VIEW SET option + GRANT/REVOKE are idempotent / no-op on
-- replay. No destructive DROP → passes the CI Migration Safety gate.
--
-- NOT auto-applied: shared DEV/PREPROD/PROD DB → owner-gated apply (runbook in
-- docs/security/vague5-rls-drift-tail-20260616.md).
-- =============================================================================

BEGIN;

-- 1) Convert the 2 SECURITY DEFINER views to SECURITY INVOKER ------------------
ALTER VIEW public.__seo_content_assets_current_v SET (security_invoker = true);
ALTER VIEW public.v_soft_404_demand_30d          SET (security_invoker = true);

-- 2) Close the public surface (defense in depth) ------------------------------
REVOKE ALL ON public.__seo_content_assets_current_v FROM anon, authenticated;
REVOKE ALL ON public.v_soft_404_demand_30d          FROM anon, authenticated;
GRANT SELECT ON public.__seo_content_assets_current_v TO service_role;
GRANT SELECT ON public.v_soft_404_demand_30d          TO service_role;

-- 3) Materialized view : matviews can't carry RLS → REVOKE public-role grants --
REVOKE ALL ON public.mv_equipementier_article_counts FROM anon, authenticated;
GRANT SELECT ON public.mv_equipementier_article_counts TO service_role;

COMMIT;

-- =============================================================================
-- Post-apply verification
-- =============================================================================
--   -- views now invoker, 0 anon/authd grants:
--   SELECT relname, array_to_string(reloptions, ',') AS opts
--   FROM pg_class WHERE relname IN
--     ('__seo_content_assets_current_v','v_soft_404_demand_30d') AND relkind='v';
--   -- expected : 'security_invoker=true'
--
--   SELECT grantee, table_name FROM information_schema.role_table_grants
--   WHERE table_name IN ('__seo_content_assets_current_v','v_soft_404_demand_30d',
--                        'mv_equipementier_article_counts')
--     AND grantee IN ('anon','authenticated');
--   -- expected : 0 rows
--
--   -- Re-run Supabase advisor (security): the 2 security_definer_view rows and
--   -- the materialized_view_in_api row must disappear.
--
-- ROLLBACK (reversible)
-- ---------------------
--   ALTER VIEW public.__seo_content_assets_current_v SET (security_invoker = false);
--   ALTER VIEW public.v_soft_404_demand_30d          SET (security_invoker = false);
--   -- grants are NOT auto-restored; re-GRANT only if a legit anon need is proven.
-- =============================================================================

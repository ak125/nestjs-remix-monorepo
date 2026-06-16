-- =============================================================================
-- Migration : Enable RLS on drift-tail internal tables (Vague 5)
-- Date      : 2026-06-16
-- Severity  : ERROR (Supabase advisor — rls_disabled_in_public ×207
--                    + sensitive_columns_exposed ×6 [__seo_cwv_raw_* / session_id])
-- Scope     : Vague 5 — 216 internal/ops tables created or rotated AFTER the
--             2026-04-22/23 hardening waves (2d/3a/4b). Same canonical pattern as
--             20260422_enable_rls_internal_tables.sql — extended, not reinvented.
-- =============================================================================
--
-- WHY (the drift tail)
-- --------------------
-- 411 public tables still carry the Supabase-default FULL anon/authenticated
-- grants (SELECT+INSERT+UPDATE+DELETE). For the 216 tables below, RLS was OFF,
-- so anyone holding the public SUPABASE_ANON_KEY could read AND write them via
-- PostgREST (GET/POST /rest/v1/<table>). These are NOT user-facing data — they
-- are internal analytics / governance / backup tables, several of which hold
-- competitively-sensitive data:
--   • pricing_*, supplier_*, catalog_pricing_baseline*, pieces_price_history*,
--     price_import_* ........ purchase prices / margin logic / supplier feeds
--   • __seo_cwv_raw_p2026061x  session_id (the 6 sensitive_columns_exposed rows)
--   • __seo_event_log, __seo_gsc/ga4/cwv_* mirrors, snapshots, audit findings
--   • pieces_media_img_*backup/recover* .... media-recovery backups
--
-- Families covered (216): __seo_* (logs, GSC/GA4/CWV mirrors + monthly/daily/
-- hourly partitions, synthetic+RUM snapshots, quality history, reality/audit),
-- __soft_404_events, audit_vlevel_*snapshot, catalog_pricing_baseline(+_meta),
-- pieces_display_history, pieces_gamme_display_history, pieces_gamme_link_history,
-- pieces_media_img_(backup|recover)_*, pieces_price_history(+partitions),
-- price_import_batch(_chunks|es), pricing_decision_snapshot(+partitions),
-- pricing_rules, supplier_import_raw, supplier_offer_snapshot(+partitions),
-- supplier_price_profiles.
--
-- FRONTEND / BACKEND AUDIT (runtime safety — verified 2026-06-16)
-- --------------------------------------------------------------
--   • Frontend: ZERO @supabase/supabase-js clients, ZERO direct .from() calls.
--     The only anon-key usage is account_.orders.$orderId.invoice.tsx, which
--     reads ___xtr_order / ___xtr_customer / ___xtr_order_line via PostgREST —
--     NONE of those tables is in this migration (they already have RLS).
--   • Backend (DEV + PROD): SUPABASE_SERVICE_ROLE_KEY → BYPASSRLS. Unaffected.
--   • PREPROD (READ_ONLY=true, ADR-028 Option D): connects as anon, but the
--     E2E-smoke/Lighthouse paths do not read these internal tables; the April
--     vague-2d wave already locked __seo_keyword_results / __seo_gamme_links the
--     same way with zero PREPROD breakage.
--   • Invoker RPCs reading these tables (rpc_seo_*, search_references_*, pricing_*,
--     catalog_*) are invoked server-side as service_role (BYPASSRLS) → unaffected.
--     Direct anon invocation of a pricing/catalog MUTATION RPC is now blocked at
--     the table by RLS (previously it would have written — closed here).
--
-- ANTI-REGRESSION (root cause)
-- ----------------------------
-- 10 partition-maintenance functions create new partitions WITHOUT enabling RLS,
-- so every rotation re-introduces an unprotected table. Companion migration
-- 20260616_vague5_harden_partition_maintenance.sql patches them so new partitions
-- are born locked. Without it, this migration would need periodic replay.
--
-- IDEMPOTENCY
-- -----------
-- REVOKE on already-empty grants = no-op. ENABLE RLS is idempotent. Policies are
-- created via `DO $b$ ... IF NOT EXISTS ... CREATE POLICY ... END $b$` blocks
-- (no destructive DROP) → replays cleanly, passes the CI Migration Safety gate
-- with no `-- APPROVED:` overrides.
--
-- PROD SAFETY
-- -----------
-- ENABLE RLS / REVOKE / CREATE POLICY are catalog-only (no table rewrite). A
-- bounded lock_timeout fails the migration fast rather than queuing behind a
-- long read on a hot internal table (fail-closed, atomic rollback, re-runnable).
-- NOT auto-applied: shared DEV/PREPROD/PROD database → owner-gated apply (see
-- docs/security/vague5-rls-drift-tail-20260616.md runbook).
-- =============================================================================

BEGIN;

-- SET LOCAL = transaction-scoped: the timeout does NOT leak into the Supabase
-- connection pooler (PgBouncer transaction mode reuses connections).
SET LOCAL lock_timeout = '4s';
SET LOCAL statement_timeout = '120s';

REVOKE ALL ON TABLE public.__seo_audit_findings FROM anon, authenticated;
ALTER TABLE public.__seo_audit_findings ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_audit_findings' AND policyname='__seo_audit_findings_service_role_all') THEN
    CREATE POLICY __seo_audit_findings_service_role_all ON public.__seo_audit_findings AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_cannibalization_recommendations FROM anon, authenticated;
ALTER TABLE public.__seo_cannibalization_recommendations ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_cannibalization_recommendations' AND policyname='__seo_cannibalization_recommendations_service_role_all') THEN
    CREATE POLICY __seo_cannibalization_recommendations_service_role_all ON public.__seo_cannibalization_recommendations AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_canon_runtime_flags FROM anon, authenticated;
ALTER TABLE public.__seo_canon_runtime_flags ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_canon_runtime_flags' AND policyname='__seo_canon_runtime_flags_service_role_all') THEN
    CREATE POLICY __seo_canon_runtime_flags_service_role_all ON public.__seo_canon_runtime_flags AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_cwv_daily FROM anon, authenticated;
ALTER TABLE public.__seo_cwv_daily ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_cwv_daily' AND policyname='__seo_cwv_daily_service_role_all') THEN
    CREATE POLICY __seo_cwv_daily_service_role_all ON public.__seo_cwv_daily AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_cwv_daily_2026_04 FROM anon, authenticated;
ALTER TABLE public.__seo_cwv_daily_2026_04 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_cwv_daily_2026_04' AND policyname='__seo_cwv_daily_2026_04_service_role_all') THEN
    CREATE POLICY __seo_cwv_daily_2026_04_service_role_all ON public.__seo_cwv_daily_2026_04 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_cwv_daily_2026_05 FROM anon, authenticated;
ALTER TABLE public.__seo_cwv_daily_2026_05 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_cwv_daily_2026_05' AND policyname='__seo_cwv_daily_2026_05_service_role_all') THEN
    CREATE POLICY __seo_cwv_daily_2026_05_service_role_all ON public.__seo_cwv_daily_2026_05 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_cwv_daily_2026_06 FROM anon, authenticated;
ALTER TABLE public.__seo_cwv_daily_2026_06 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_cwv_daily_2026_06' AND policyname='__seo_cwv_daily_2026_06_service_role_all') THEN
    CREATE POLICY __seo_cwv_daily_2026_06_service_role_all ON public.__seo_cwv_daily_2026_06 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_cwv_daily_2026_07 FROM anon, authenticated;
ALTER TABLE public.__seo_cwv_daily_2026_07 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_cwv_daily_2026_07' AND policyname='__seo_cwv_daily_2026_07_service_role_all') THEN
    CREATE POLICY __seo_cwv_daily_2026_07_service_role_all ON public.__seo_cwv_daily_2026_07 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_cwv_daily_2026_08 FROM anon, authenticated;
ALTER TABLE public.__seo_cwv_daily_2026_08 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_cwv_daily_2026_08' AND policyname='__seo_cwv_daily_2026_08_service_role_all') THEN
    CREATE POLICY __seo_cwv_daily_2026_08_service_role_all ON public.__seo_cwv_daily_2026_08 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_cwv_daily_2026_09 FROM anon, authenticated;
ALTER TABLE public.__seo_cwv_daily_2026_09 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_cwv_daily_2026_09' AND policyname='__seo_cwv_daily_2026_09_service_role_all') THEN
    CREATE POLICY __seo_cwv_daily_2026_09_service_role_all ON public.__seo_cwv_daily_2026_09 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_cwv_daily_2026_10 FROM anon, authenticated;
ALTER TABLE public.__seo_cwv_daily_2026_10 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_cwv_daily_2026_10' AND policyname='__seo_cwv_daily_2026_10_service_role_all') THEN
    CREATE POLICY __seo_cwv_daily_2026_10_service_role_all ON public.__seo_cwv_daily_2026_10 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_cwv_daily_2026_11 FROM anon, authenticated;
ALTER TABLE public.__seo_cwv_daily_2026_11 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_cwv_daily_2026_11' AND policyname='__seo_cwv_daily_2026_11_service_role_all') THEN
    CREATE POLICY __seo_cwv_daily_2026_11_service_role_all ON public.__seo_cwv_daily_2026_11 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_cwv_daily_2026_12 FROM anon, authenticated;
ALTER TABLE public.__seo_cwv_daily_2026_12 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_cwv_daily_2026_12' AND policyname='__seo_cwv_daily_2026_12_service_role_all') THEN
    CREATE POLICY __seo_cwv_daily_2026_12_service_role_all ON public.__seo_cwv_daily_2026_12 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_cwv_daily_rum_2026_05 FROM anon, authenticated;
ALTER TABLE public.__seo_cwv_daily_rum_2026_05 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_cwv_daily_rum_2026_05' AND policyname='__seo_cwv_daily_rum_2026_05_service_role_all') THEN
    CREATE POLICY __seo_cwv_daily_rum_2026_05_service_role_all ON public.__seo_cwv_daily_rum_2026_05 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_cwv_daily_rum_2026_06 FROM anon, authenticated;
ALTER TABLE public.__seo_cwv_daily_rum_2026_06 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_cwv_daily_rum_2026_06' AND policyname='__seo_cwv_daily_rum_2026_06_service_role_all') THEN
    CREATE POLICY __seo_cwv_daily_rum_2026_06_service_role_all ON public.__seo_cwv_daily_rum_2026_06 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_cwv_daily_rum_2026_07 FROM anon, authenticated;
ALTER TABLE public.__seo_cwv_daily_rum_2026_07 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_cwv_daily_rum_2026_07' AND policyname='__seo_cwv_daily_rum_2026_07_service_role_all') THEN
    CREATE POLICY __seo_cwv_daily_rum_2026_07_service_role_all ON public.__seo_cwv_daily_rum_2026_07 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_cwv_daily_rum_2026_08 FROM anon, authenticated;
ALTER TABLE public.__seo_cwv_daily_rum_2026_08 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_cwv_daily_rum_2026_08' AND policyname='__seo_cwv_daily_rum_2026_08_service_role_all') THEN
    CREATE POLICY __seo_cwv_daily_rum_2026_08_service_role_all ON public.__seo_cwv_daily_rum_2026_08 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_cwv_daily_rum_2026_09 FROM anon, authenticated;
ALTER TABLE public.__seo_cwv_daily_rum_2026_09 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_cwv_daily_rum_2026_09' AND policyname='__seo_cwv_daily_rum_2026_09_service_role_all') THEN
    CREATE POLICY __seo_cwv_daily_rum_2026_09_service_role_all ON public.__seo_cwv_daily_rum_2026_09 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_cwv_hourly_p20260602 FROM anon, authenticated;
ALTER TABLE public.__seo_cwv_hourly_p20260602 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_cwv_hourly_p20260602' AND policyname='__seo_cwv_hourly_p20260602_service_role_all') THEN
    CREATE POLICY __seo_cwv_hourly_p20260602_service_role_all ON public.__seo_cwv_hourly_p20260602 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_cwv_hourly_p20260603 FROM anon, authenticated;
ALTER TABLE public.__seo_cwv_hourly_p20260603 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_cwv_hourly_p20260603' AND policyname='__seo_cwv_hourly_p20260603_service_role_all') THEN
    CREATE POLICY __seo_cwv_hourly_p20260603_service_role_all ON public.__seo_cwv_hourly_p20260603 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_cwv_hourly_p20260604 FROM anon, authenticated;
ALTER TABLE public.__seo_cwv_hourly_p20260604 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_cwv_hourly_p20260604' AND policyname='__seo_cwv_hourly_p20260604_service_role_all') THEN
    CREATE POLICY __seo_cwv_hourly_p20260604_service_role_all ON public.__seo_cwv_hourly_p20260604 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_cwv_hourly_p20260605 FROM anon, authenticated;
ALTER TABLE public.__seo_cwv_hourly_p20260605 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_cwv_hourly_p20260605' AND policyname='__seo_cwv_hourly_p20260605_service_role_all') THEN
    CREATE POLICY __seo_cwv_hourly_p20260605_service_role_all ON public.__seo_cwv_hourly_p20260605 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_cwv_hourly_p20260606 FROM anon, authenticated;
ALTER TABLE public.__seo_cwv_hourly_p20260606 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_cwv_hourly_p20260606' AND policyname='__seo_cwv_hourly_p20260606_service_role_all') THEN
    CREATE POLICY __seo_cwv_hourly_p20260606_service_role_all ON public.__seo_cwv_hourly_p20260606 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_cwv_hourly_p20260607 FROM anon, authenticated;
ALTER TABLE public.__seo_cwv_hourly_p20260607 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_cwv_hourly_p20260607' AND policyname='__seo_cwv_hourly_p20260607_service_role_all') THEN
    CREATE POLICY __seo_cwv_hourly_p20260607_service_role_all ON public.__seo_cwv_hourly_p20260607 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_cwv_hourly_p20260608 FROM anon, authenticated;
ALTER TABLE public.__seo_cwv_hourly_p20260608 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_cwv_hourly_p20260608' AND policyname='__seo_cwv_hourly_p20260608_service_role_all') THEN
    CREATE POLICY __seo_cwv_hourly_p20260608_service_role_all ON public.__seo_cwv_hourly_p20260608 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_cwv_hourly_p20260609 FROM anon, authenticated;
ALTER TABLE public.__seo_cwv_hourly_p20260609 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_cwv_hourly_p20260609' AND policyname='__seo_cwv_hourly_p20260609_service_role_all') THEN
    CREATE POLICY __seo_cwv_hourly_p20260609_service_role_all ON public.__seo_cwv_hourly_p20260609 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_cwv_hourly_p20260610 FROM anon, authenticated;
ALTER TABLE public.__seo_cwv_hourly_p20260610 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_cwv_hourly_p20260610' AND policyname='__seo_cwv_hourly_p20260610_service_role_all') THEN
    CREATE POLICY __seo_cwv_hourly_p20260610_service_role_all ON public.__seo_cwv_hourly_p20260610 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_cwv_hourly_p20260611 FROM anon, authenticated;
ALTER TABLE public.__seo_cwv_hourly_p20260611 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_cwv_hourly_p20260611' AND policyname='__seo_cwv_hourly_p20260611_service_role_all') THEN
    CREATE POLICY __seo_cwv_hourly_p20260611_service_role_all ON public.__seo_cwv_hourly_p20260611 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_cwv_hourly_p20260612 FROM anon, authenticated;
ALTER TABLE public.__seo_cwv_hourly_p20260612 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_cwv_hourly_p20260612' AND policyname='__seo_cwv_hourly_p20260612_service_role_all') THEN
    CREATE POLICY __seo_cwv_hourly_p20260612_service_role_all ON public.__seo_cwv_hourly_p20260612 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_cwv_hourly_p20260613 FROM anon, authenticated;
ALTER TABLE public.__seo_cwv_hourly_p20260613 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_cwv_hourly_p20260613' AND policyname='__seo_cwv_hourly_p20260613_service_role_all') THEN
    CREATE POLICY __seo_cwv_hourly_p20260613_service_role_all ON public.__seo_cwv_hourly_p20260613 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_cwv_hourly_p20260614 FROM anon, authenticated;
ALTER TABLE public.__seo_cwv_hourly_p20260614 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_cwv_hourly_p20260614' AND policyname='__seo_cwv_hourly_p20260614_service_role_all') THEN
    CREATE POLICY __seo_cwv_hourly_p20260614_service_role_all ON public.__seo_cwv_hourly_p20260614 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_cwv_hourly_p20260615 FROM anon, authenticated;
ALTER TABLE public.__seo_cwv_hourly_p20260615 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_cwv_hourly_p20260615' AND policyname='__seo_cwv_hourly_p20260615_service_role_all') THEN
    CREATE POLICY __seo_cwv_hourly_p20260615_service_role_all ON public.__seo_cwv_hourly_p20260615 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_cwv_hourly_p20260616 FROM anon, authenticated;
ALTER TABLE public.__seo_cwv_hourly_p20260616 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_cwv_hourly_p20260616' AND policyname='__seo_cwv_hourly_p20260616_service_role_all') THEN
    CREATE POLICY __seo_cwv_hourly_p20260616_service_role_all ON public.__seo_cwv_hourly_p20260616 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_cwv_hourly_p20260617 FROM anon, authenticated;
ALTER TABLE public.__seo_cwv_hourly_p20260617 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_cwv_hourly_p20260617' AND policyname='__seo_cwv_hourly_p20260617_service_role_all') THEN
    CREATE POLICY __seo_cwv_hourly_p20260617_service_role_all ON public.__seo_cwv_hourly_p20260617 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_cwv_hourly_p20260618 FROM anon, authenticated;
ALTER TABLE public.__seo_cwv_hourly_p20260618 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_cwv_hourly_p20260618' AND policyname='__seo_cwv_hourly_p20260618_service_role_all') THEN
    CREATE POLICY __seo_cwv_hourly_p20260618_service_role_all ON public.__seo_cwv_hourly_p20260618 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_cwv_hourly_p20260619 FROM anon, authenticated;
ALTER TABLE public.__seo_cwv_hourly_p20260619 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_cwv_hourly_p20260619' AND policyname='__seo_cwv_hourly_p20260619_service_role_all') THEN
    CREATE POLICY __seo_cwv_hourly_p20260619_service_role_all ON public.__seo_cwv_hourly_p20260619 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_cwv_raw_p20260614 FROM anon, authenticated;
ALTER TABLE public.__seo_cwv_raw_p20260614 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_cwv_raw_p20260614' AND policyname='__seo_cwv_raw_p20260614_service_role_all') THEN
    CREATE POLICY __seo_cwv_raw_p20260614_service_role_all ON public.__seo_cwv_raw_p20260614 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_cwv_raw_p20260615 FROM anon, authenticated;
ALTER TABLE public.__seo_cwv_raw_p20260615 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_cwv_raw_p20260615' AND policyname='__seo_cwv_raw_p20260615_service_role_all') THEN
    CREATE POLICY __seo_cwv_raw_p20260615_service_role_all ON public.__seo_cwv_raw_p20260615 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_cwv_raw_p20260616 FROM anon, authenticated;
ALTER TABLE public.__seo_cwv_raw_p20260616 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_cwv_raw_p20260616' AND policyname='__seo_cwv_raw_p20260616_service_role_all') THEN
    CREATE POLICY __seo_cwv_raw_p20260616_service_role_all ON public.__seo_cwv_raw_p20260616 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_cwv_raw_p20260617 FROM anon, authenticated;
ALTER TABLE public.__seo_cwv_raw_p20260617 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_cwv_raw_p20260617' AND policyname='__seo_cwv_raw_p20260617_service_role_all') THEN
    CREATE POLICY __seo_cwv_raw_p20260617_service_role_all ON public.__seo_cwv_raw_p20260617 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_cwv_raw_p20260618 FROM anon, authenticated;
ALTER TABLE public.__seo_cwv_raw_p20260618 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_cwv_raw_p20260618' AND policyname='__seo_cwv_raw_p20260618_service_role_all') THEN
    CREATE POLICY __seo_cwv_raw_p20260618_service_role_all ON public.__seo_cwv_raw_p20260618 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_cwv_raw_p20260619 FROM anon, authenticated;
ALTER TABLE public.__seo_cwv_raw_p20260619 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_cwv_raw_p20260619' AND policyname='__seo_cwv_raw_p20260619_service_role_all') THEN
    CREATE POLICY __seo_cwv_raw_p20260619_service_role_all ON public.__seo_cwv_raw_p20260619 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_event_log FROM anon, authenticated;
ALTER TABLE public.__seo_event_log ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_event_log' AND policyname='__seo_event_log_service_role_all') THEN
    CREATE POLICY __seo_event_log_service_role_all ON public.__seo_event_log AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_ga4_daily FROM anon, authenticated;
ALTER TABLE public.__seo_ga4_daily ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_ga4_daily' AND policyname='__seo_ga4_daily_service_role_all') THEN
    CREATE POLICY __seo_ga4_daily_service_role_all ON public.__seo_ga4_daily AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_ga4_daily_2026_04 FROM anon, authenticated;
ALTER TABLE public.__seo_ga4_daily_2026_04 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_ga4_daily_2026_04' AND policyname='__seo_ga4_daily_2026_04_service_role_all') THEN
    CREATE POLICY __seo_ga4_daily_2026_04_service_role_all ON public.__seo_ga4_daily_2026_04 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_ga4_daily_2026_05 FROM anon, authenticated;
ALTER TABLE public.__seo_ga4_daily_2026_05 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_ga4_daily_2026_05' AND policyname='__seo_ga4_daily_2026_05_service_role_all') THEN
    CREATE POLICY __seo_ga4_daily_2026_05_service_role_all ON public.__seo_ga4_daily_2026_05 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_ga4_daily_2026_06 FROM anon, authenticated;
ALTER TABLE public.__seo_ga4_daily_2026_06 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_ga4_daily_2026_06' AND policyname='__seo_ga4_daily_2026_06_service_role_all') THEN
    CREATE POLICY __seo_ga4_daily_2026_06_service_role_all ON public.__seo_ga4_daily_2026_06 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_ga4_daily_2026_07 FROM anon, authenticated;
ALTER TABLE public.__seo_ga4_daily_2026_07 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_ga4_daily_2026_07' AND policyname='__seo_ga4_daily_2026_07_service_role_all') THEN
    CREATE POLICY __seo_ga4_daily_2026_07_service_role_all ON public.__seo_ga4_daily_2026_07 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_ga4_daily_2026_08 FROM anon, authenticated;
ALTER TABLE public.__seo_ga4_daily_2026_08 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_ga4_daily_2026_08' AND policyname='__seo_ga4_daily_2026_08_service_role_all') THEN
    CREATE POLICY __seo_ga4_daily_2026_08_service_role_all ON public.__seo_ga4_daily_2026_08 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_ga4_daily_2026_09 FROM anon, authenticated;
ALTER TABLE public.__seo_ga4_daily_2026_09 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_ga4_daily_2026_09' AND policyname='__seo_ga4_daily_2026_09_service_role_all') THEN
    CREATE POLICY __seo_ga4_daily_2026_09_service_role_all ON public.__seo_ga4_daily_2026_09 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_ga4_daily_2026_10 FROM anon, authenticated;
ALTER TABLE public.__seo_ga4_daily_2026_10 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_ga4_daily_2026_10' AND policyname='__seo_ga4_daily_2026_10_service_role_all') THEN
    CREATE POLICY __seo_ga4_daily_2026_10_service_role_all ON public.__seo_ga4_daily_2026_10 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_ga4_daily_2026_11 FROM anon, authenticated;
ALTER TABLE public.__seo_ga4_daily_2026_11 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_ga4_daily_2026_11' AND policyname='__seo_ga4_daily_2026_11_service_role_all') THEN
    CREATE POLICY __seo_ga4_daily_2026_11_service_role_all ON public.__seo_ga4_daily_2026_11 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_ga4_daily_2026_12 FROM anon, authenticated;
ALTER TABLE public.__seo_ga4_daily_2026_12 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_ga4_daily_2026_12' AND policyname='__seo_ga4_daily_2026_12_service_role_all') THEN
    CREATE POLICY __seo_ga4_daily_2026_12_service_role_all ON public.__seo_ga4_daily_2026_12 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_gsc_daily FROM anon, authenticated;
ALTER TABLE public.__seo_gsc_daily ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_gsc_daily' AND policyname='__seo_gsc_daily_service_role_all') THEN
    CREATE POLICY __seo_gsc_daily_service_role_all ON public.__seo_gsc_daily AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_gsc_daily_2026_04 FROM anon, authenticated;
ALTER TABLE public.__seo_gsc_daily_2026_04 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_gsc_daily_2026_04' AND policyname='__seo_gsc_daily_2026_04_service_role_all') THEN
    CREATE POLICY __seo_gsc_daily_2026_04_service_role_all ON public.__seo_gsc_daily_2026_04 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_gsc_daily_2026_05 FROM anon, authenticated;
ALTER TABLE public.__seo_gsc_daily_2026_05 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_gsc_daily_2026_05' AND policyname='__seo_gsc_daily_2026_05_service_role_all') THEN
    CREATE POLICY __seo_gsc_daily_2026_05_service_role_all ON public.__seo_gsc_daily_2026_05 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_gsc_daily_2026_06 FROM anon, authenticated;
ALTER TABLE public.__seo_gsc_daily_2026_06 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_gsc_daily_2026_06' AND policyname='__seo_gsc_daily_2026_06_service_role_all') THEN
    CREATE POLICY __seo_gsc_daily_2026_06_service_role_all ON public.__seo_gsc_daily_2026_06 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_gsc_daily_2026_07 FROM anon, authenticated;
ALTER TABLE public.__seo_gsc_daily_2026_07 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_gsc_daily_2026_07' AND policyname='__seo_gsc_daily_2026_07_service_role_all') THEN
    CREATE POLICY __seo_gsc_daily_2026_07_service_role_all ON public.__seo_gsc_daily_2026_07 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_gsc_daily_2026_08 FROM anon, authenticated;
ALTER TABLE public.__seo_gsc_daily_2026_08 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_gsc_daily_2026_08' AND policyname='__seo_gsc_daily_2026_08_service_role_all') THEN
    CREATE POLICY __seo_gsc_daily_2026_08_service_role_all ON public.__seo_gsc_daily_2026_08 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_gsc_daily_2026_09 FROM anon, authenticated;
ALTER TABLE public.__seo_gsc_daily_2026_09 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_gsc_daily_2026_09' AND policyname='__seo_gsc_daily_2026_09_service_role_all') THEN
    CREATE POLICY __seo_gsc_daily_2026_09_service_role_all ON public.__seo_gsc_daily_2026_09 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_gsc_daily_2026_10 FROM anon, authenticated;
ALTER TABLE public.__seo_gsc_daily_2026_10 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_gsc_daily_2026_10' AND policyname='__seo_gsc_daily_2026_10_service_role_all') THEN
    CREATE POLICY __seo_gsc_daily_2026_10_service_role_all ON public.__seo_gsc_daily_2026_10 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_gsc_daily_2026_11 FROM anon, authenticated;
ALTER TABLE public.__seo_gsc_daily_2026_11 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_gsc_daily_2026_11' AND policyname='__seo_gsc_daily_2026_11_service_role_all') THEN
    CREATE POLICY __seo_gsc_daily_2026_11_service_role_all ON public.__seo_gsc_daily_2026_11 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_gsc_daily_2026_12 FROM anon, authenticated;
ALTER TABLE public.__seo_gsc_daily_2026_12 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_gsc_daily_2026_12' AND policyname='__seo_gsc_daily_2026_12_service_role_all') THEN
    CREATE POLICY __seo_gsc_daily_2026_12_service_role_all ON public.__seo_gsc_daily_2026_12 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_gsc_daily_pages FROM anon, authenticated;
ALTER TABLE public.__seo_gsc_daily_pages ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_gsc_daily_pages' AND policyname='__seo_gsc_daily_pages_service_role_all') THEN
    CREATE POLICY __seo_gsc_daily_pages_service_role_all ON public.__seo_gsc_daily_pages AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_gsc_daily_pages_2026_06 FROM anon, authenticated;
ALTER TABLE public.__seo_gsc_daily_pages_2026_06 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_gsc_daily_pages_2026_06' AND policyname='__seo_gsc_daily_pages_2026_06_service_role_all') THEN
    CREATE POLICY __seo_gsc_daily_pages_2026_06_service_role_all ON public.__seo_gsc_daily_pages_2026_06 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_gsc_daily_pages_2026_07 FROM anon, authenticated;
ALTER TABLE public.__seo_gsc_daily_pages_2026_07 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_gsc_daily_pages_2026_07' AND policyname='__seo_gsc_daily_pages_2026_07_service_role_all') THEN
    CREATE POLICY __seo_gsc_daily_pages_2026_07_service_role_all ON public.__seo_gsc_daily_pages_2026_07 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_gsc_daily_pages_2026_08 FROM anon, authenticated;
ALTER TABLE public.__seo_gsc_daily_pages_2026_08 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_gsc_daily_pages_2026_08' AND policyname='__seo_gsc_daily_pages_2026_08_service_role_all') THEN
    CREATE POLICY __seo_gsc_daily_pages_2026_08_service_role_all ON public.__seo_gsc_daily_pages_2026_08 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_gsc_daily_pages_2026_09 FROM anon, authenticated;
ALTER TABLE public.__seo_gsc_daily_pages_2026_09 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_gsc_daily_pages_2026_09' AND policyname='__seo_gsc_daily_pages_2026_09_service_role_all') THEN
    CREATE POLICY __seo_gsc_daily_pages_2026_09_service_role_all ON public.__seo_gsc_daily_pages_2026_09 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_gsc_daily_pages_2026_10 FROM anon, authenticated;
ALTER TABLE public.__seo_gsc_daily_pages_2026_10 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_gsc_daily_pages_2026_10' AND policyname='__seo_gsc_daily_pages_2026_10_service_role_all') THEN
    CREATE POLICY __seo_gsc_daily_pages_2026_10_service_role_all ON public.__seo_gsc_daily_pages_2026_10 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_gsc_daily_pages_2026_11 FROM anon, authenticated;
ALTER TABLE public.__seo_gsc_daily_pages_2026_11 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_gsc_daily_pages_2026_11' AND policyname='__seo_gsc_daily_pages_2026_11_service_role_all') THEN
    CREATE POLICY __seo_gsc_daily_pages_2026_11_service_role_all ON public.__seo_gsc_daily_pages_2026_11 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_gsc_daily_pages_2026_12 FROM anon, authenticated;
ALTER TABLE public.__seo_gsc_daily_pages_2026_12 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_gsc_daily_pages_2026_12' AND policyname='__seo_gsc_daily_pages_2026_12_service_role_all') THEN
    CREATE POLICY __seo_gsc_daily_pages_2026_12_service_role_all ON public.__seo_gsc_daily_pages_2026_12 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_gsc_daily_property_total FROM anon, authenticated;
ALTER TABLE public.__seo_gsc_daily_property_total ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_gsc_daily_property_total' AND policyname='__seo_gsc_daily_property_total_service_role_all') THEN
    CREATE POLICY __seo_gsc_daily_property_total_service_role_all ON public.__seo_gsc_daily_property_total AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_gsc_daily_property_total_2026_06 FROM anon, authenticated;
ALTER TABLE public.__seo_gsc_daily_property_total_2026_06 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_gsc_daily_property_total_2026_06' AND policyname='__seo_gsc_daily_property_total_2026_06_service_role_all') THEN
    CREATE POLICY __seo_gsc_daily_property_total_2026_06_service_role_all ON public.__seo_gsc_daily_property_total_2026_06 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_gsc_daily_property_total_2026_07 FROM anon, authenticated;
ALTER TABLE public.__seo_gsc_daily_property_total_2026_07 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_gsc_daily_property_total_2026_07' AND policyname='__seo_gsc_daily_property_total_2026_07_service_role_all') THEN
    CREATE POLICY __seo_gsc_daily_property_total_2026_07_service_role_all ON public.__seo_gsc_daily_property_total_2026_07 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_gsc_daily_property_total_2026_08 FROM anon, authenticated;
ALTER TABLE public.__seo_gsc_daily_property_total_2026_08 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_gsc_daily_property_total_2026_08' AND policyname='__seo_gsc_daily_property_total_2026_08_service_role_all') THEN
    CREATE POLICY __seo_gsc_daily_property_total_2026_08_service_role_all ON public.__seo_gsc_daily_property_total_2026_08 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_gsc_daily_property_total_2026_09 FROM anon, authenticated;
ALTER TABLE public.__seo_gsc_daily_property_total_2026_09 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_gsc_daily_property_total_2026_09' AND policyname='__seo_gsc_daily_property_total_2026_09_service_role_all') THEN
    CREATE POLICY __seo_gsc_daily_property_total_2026_09_service_role_all ON public.__seo_gsc_daily_property_total_2026_09 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_gsc_daily_property_total_2026_10 FROM anon, authenticated;
ALTER TABLE public.__seo_gsc_daily_property_total_2026_10 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_gsc_daily_property_total_2026_10' AND policyname='__seo_gsc_daily_property_total_2026_10_service_role_all') THEN
    CREATE POLICY __seo_gsc_daily_property_total_2026_10_service_role_all ON public.__seo_gsc_daily_property_total_2026_10 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_gsc_daily_property_total_2026_11 FROM anon, authenticated;
ALTER TABLE public.__seo_gsc_daily_property_total_2026_11 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_gsc_daily_property_total_2026_11' AND policyname='__seo_gsc_daily_property_total_2026_11_service_role_all') THEN
    CREATE POLICY __seo_gsc_daily_property_total_2026_11_service_role_all ON public.__seo_gsc_daily_property_total_2026_11 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_gsc_daily_property_total_2026_12 FROM anon, authenticated;
ALTER TABLE public.__seo_gsc_daily_property_total_2026_12 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_gsc_daily_property_total_2026_12' AND policyname='__seo_gsc_daily_property_total_2026_12_service_role_all') THEN
    CREATE POLICY __seo_gsc_daily_property_total_2026_12_service_role_all ON public.__seo_gsc_daily_property_total_2026_12 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_gsc_daily_totals FROM anon, authenticated;
ALTER TABLE public.__seo_gsc_daily_totals ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_gsc_daily_totals' AND policyname='__seo_gsc_daily_totals_service_role_all') THEN
    CREATE POLICY __seo_gsc_daily_totals_service_role_all ON public.__seo_gsc_daily_totals AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_gsc_daily_totals_2026_06 FROM anon, authenticated;
ALTER TABLE public.__seo_gsc_daily_totals_2026_06 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_gsc_daily_totals_2026_06' AND policyname='__seo_gsc_daily_totals_2026_06_service_role_all') THEN
    CREATE POLICY __seo_gsc_daily_totals_2026_06_service_role_all ON public.__seo_gsc_daily_totals_2026_06 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_gsc_daily_totals_2026_07 FROM anon, authenticated;
ALTER TABLE public.__seo_gsc_daily_totals_2026_07 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_gsc_daily_totals_2026_07' AND policyname='__seo_gsc_daily_totals_2026_07_service_role_all') THEN
    CREATE POLICY __seo_gsc_daily_totals_2026_07_service_role_all ON public.__seo_gsc_daily_totals_2026_07 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_gsc_daily_totals_2026_08 FROM anon, authenticated;
ALTER TABLE public.__seo_gsc_daily_totals_2026_08 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_gsc_daily_totals_2026_08' AND policyname='__seo_gsc_daily_totals_2026_08_service_role_all') THEN
    CREATE POLICY __seo_gsc_daily_totals_2026_08_service_role_all ON public.__seo_gsc_daily_totals_2026_08 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_gsc_daily_totals_2026_09 FROM anon, authenticated;
ALTER TABLE public.__seo_gsc_daily_totals_2026_09 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_gsc_daily_totals_2026_09' AND policyname='__seo_gsc_daily_totals_2026_09_service_role_all') THEN
    CREATE POLICY __seo_gsc_daily_totals_2026_09_service_role_all ON public.__seo_gsc_daily_totals_2026_09 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_gsc_daily_totals_2026_10 FROM anon, authenticated;
ALTER TABLE public.__seo_gsc_daily_totals_2026_10 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_gsc_daily_totals_2026_10' AND policyname='__seo_gsc_daily_totals_2026_10_service_role_all') THEN
    CREATE POLICY __seo_gsc_daily_totals_2026_10_service_role_all ON public.__seo_gsc_daily_totals_2026_10 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_gsc_daily_totals_2026_11 FROM anon, authenticated;
ALTER TABLE public.__seo_gsc_daily_totals_2026_11 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_gsc_daily_totals_2026_11' AND policyname='__seo_gsc_daily_totals_2026_11_service_role_all') THEN
    CREATE POLICY __seo_gsc_daily_totals_2026_11_service_role_all ON public.__seo_gsc_daily_totals_2026_11 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_gsc_daily_totals_2026_12 FROM anon, authenticated;
ALTER TABLE public.__seo_gsc_daily_totals_2026_12 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_gsc_daily_totals_2026_12' AND policyname='__seo_gsc_daily_totals_2026_12_service_role_all') THEN
    CREATE POLICY __seo_gsc_daily_totals_2026_12_service_role_all ON public.__seo_gsc_daily_totals_2026_12 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_gsc_links_weekly FROM anon, authenticated;
ALTER TABLE public.__seo_gsc_links_weekly ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_gsc_links_weekly' AND policyname='__seo_gsc_links_weekly_service_role_all') THEN
    CREATE POLICY __seo_gsc_links_weekly_service_role_all ON public.__seo_gsc_links_weekly AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_quality_history_2026_05 FROM anon, authenticated;
ALTER TABLE public.__seo_quality_history_2026_05 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_quality_history_2026_05' AND policyname='__seo_quality_history_2026_05_service_role_all') THEN
    CREATE POLICY __seo_quality_history_2026_05_service_role_all ON public.__seo_quality_history_2026_05 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_quality_history_2026_06 FROM anon, authenticated;
ALTER TABLE public.__seo_quality_history_2026_06 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_quality_history_2026_06' AND policyname='__seo_quality_history_2026_06_service_role_all') THEN
    CREATE POLICY __seo_quality_history_2026_06_service_role_all ON public.__seo_quality_history_2026_06 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_quality_history_2026_07 FROM anon, authenticated;
ALTER TABLE public.__seo_quality_history_2026_07 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_quality_history_2026_07' AND policyname='__seo_quality_history_2026_07_service_role_all') THEN
    CREATE POLICY __seo_quality_history_2026_07_service_role_all ON public.__seo_quality_history_2026_07 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_reality_audit FROM anon, authenticated;
ALTER TABLE public.__seo_reality_audit ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_reality_audit' AND policyname='__seo_reality_audit_service_role_all') THEN
    CREATE POLICY __seo_reality_audit_service_role_all ON public.__seo_reality_audit AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_cf_rum_p20260521 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_cf_rum_p20260521 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_cf_rum_p20260521' AND policyname='__seo_snapshot_cf_rum_p20260521_service_role_all') THEN
    CREATE POLICY __seo_snapshot_cf_rum_p20260521_service_role_all ON public.__seo_snapshot_cf_rum_p20260521 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_cf_rum_p20260522 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_cf_rum_p20260522 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_cf_rum_p20260522' AND policyname='__seo_snapshot_cf_rum_p20260522_service_role_all') THEN
    CREATE POLICY __seo_snapshot_cf_rum_p20260522_service_role_all ON public.__seo_snapshot_cf_rum_p20260522 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_cf_rum_p20260523 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_cf_rum_p20260523 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_cf_rum_p20260523' AND policyname='__seo_snapshot_cf_rum_p20260523_service_role_all') THEN
    CREATE POLICY __seo_snapshot_cf_rum_p20260523_service_role_all ON public.__seo_snapshot_cf_rum_p20260523 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_cf_rum_p20260524 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_cf_rum_p20260524 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_cf_rum_p20260524' AND policyname='__seo_snapshot_cf_rum_p20260524_service_role_all') THEN
    CREATE POLICY __seo_snapshot_cf_rum_p20260524_service_role_all ON public.__seo_snapshot_cf_rum_p20260524 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_cf_rum_p20260525 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_cf_rum_p20260525 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_cf_rum_p20260525' AND policyname='__seo_snapshot_cf_rum_p20260525_service_role_all') THEN
    CREATE POLICY __seo_snapshot_cf_rum_p20260525_service_role_all ON public.__seo_snapshot_cf_rum_p20260525 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_cf_rum_p20260526 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_cf_rum_p20260526 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_cf_rum_p20260526' AND policyname='__seo_snapshot_cf_rum_p20260526_service_role_all') THEN
    CREATE POLICY __seo_snapshot_cf_rum_p20260526_service_role_all ON public.__seo_snapshot_cf_rum_p20260526 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_cf_rum_p20260527 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_cf_rum_p20260527 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_cf_rum_p20260527' AND policyname='__seo_snapshot_cf_rum_p20260527_service_role_all') THEN
    CREATE POLICY __seo_snapshot_cf_rum_p20260527_service_role_all ON public.__seo_snapshot_cf_rum_p20260527 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_cf_rum_p20260528 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_cf_rum_p20260528 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_cf_rum_p20260528' AND policyname='__seo_snapshot_cf_rum_p20260528_service_role_all') THEN
    CREATE POLICY __seo_snapshot_cf_rum_p20260528_service_role_all ON public.__seo_snapshot_cf_rum_p20260528 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_cf_rum_p20260529 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_cf_rum_p20260529 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_cf_rum_p20260529' AND policyname='__seo_snapshot_cf_rum_p20260529_service_role_all') THEN
    CREATE POLICY __seo_snapshot_cf_rum_p20260529_service_role_all ON public.__seo_snapshot_cf_rum_p20260529 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_cf_rum_p20260530 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_cf_rum_p20260530 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_cf_rum_p20260530' AND policyname='__seo_snapshot_cf_rum_p20260530_service_role_all') THEN
    CREATE POLICY __seo_snapshot_cf_rum_p20260530_service_role_all ON public.__seo_snapshot_cf_rum_p20260530 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_cf_rum_p20260531 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_cf_rum_p20260531 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_cf_rum_p20260531' AND policyname='__seo_snapshot_cf_rum_p20260531_service_role_all') THEN
    CREATE POLICY __seo_snapshot_cf_rum_p20260531_service_role_all ON public.__seo_snapshot_cf_rum_p20260531 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_cf_rum_p20260601 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_cf_rum_p20260601 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_cf_rum_p20260601' AND policyname='__seo_snapshot_cf_rum_p20260601_service_role_all') THEN
    CREATE POLICY __seo_snapshot_cf_rum_p20260601_service_role_all ON public.__seo_snapshot_cf_rum_p20260601 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_cf_rum_p20260602 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_cf_rum_p20260602 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_cf_rum_p20260602' AND policyname='__seo_snapshot_cf_rum_p20260602_service_role_all') THEN
    CREATE POLICY __seo_snapshot_cf_rum_p20260602_service_role_all ON public.__seo_snapshot_cf_rum_p20260602 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_cf_rum_p20260603 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_cf_rum_p20260603 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_cf_rum_p20260603' AND policyname='__seo_snapshot_cf_rum_p20260603_service_role_all') THEN
    CREATE POLICY __seo_snapshot_cf_rum_p20260603_service_role_all ON public.__seo_snapshot_cf_rum_p20260603 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_cf_rum_p20260604 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_cf_rum_p20260604 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_cf_rum_p20260604' AND policyname='__seo_snapshot_cf_rum_p20260604_service_role_all') THEN
    CREATE POLICY __seo_snapshot_cf_rum_p20260604_service_role_all ON public.__seo_snapshot_cf_rum_p20260604 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_cf_rum_p20260605 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_cf_rum_p20260605 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_cf_rum_p20260605' AND policyname='__seo_snapshot_cf_rum_p20260605_service_role_all') THEN
    CREATE POLICY __seo_snapshot_cf_rum_p20260605_service_role_all ON public.__seo_snapshot_cf_rum_p20260605 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_cf_rum_p20260606 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_cf_rum_p20260606 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_cf_rum_p20260606' AND policyname='__seo_snapshot_cf_rum_p20260606_service_role_all') THEN
    CREATE POLICY __seo_snapshot_cf_rum_p20260606_service_role_all ON public.__seo_snapshot_cf_rum_p20260606 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_cf_rum_p20260607 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_cf_rum_p20260607 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_cf_rum_p20260607' AND policyname='__seo_snapshot_cf_rum_p20260607_service_role_all') THEN
    CREATE POLICY __seo_snapshot_cf_rum_p20260607_service_role_all ON public.__seo_snapshot_cf_rum_p20260607 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_cf_rum_p20260608 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_cf_rum_p20260608 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_cf_rum_p20260608' AND policyname='__seo_snapshot_cf_rum_p20260608_service_role_all') THEN
    CREATE POLICY __seo_snapshot_cf_rum_p20260608_service_role_all ON public.__seo_snapshot_cf_rum_p20260608 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_cf_rum_p20260609 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_cf_rum_p20260609 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_cf_rum_p20260609' AND policyname='__seo_snapshot_cf_rum_p20260609_service_role_all') THEN
    CREATE POLICY __seo_snapshot_cf_rum_p20260609_service_role_all ON public.__seo_snapshot_cf_rum_p20260609 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_cf_rum_p20260610 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_cf_rum_p20260610 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_cf_rum_p20260610' AND policyname='__seo_snapshot_cf_rum_p20260610_service_role_all') THEN
    CREATE POLICY __seo_snapshot_cf_rum_p20260610_service_role_all ON public.__seo_snapshot_cf_rum_p20260610 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_cf_rum_p20260611 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_cf_rum_p20260611 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_cf_rum_p20260611' AND policyname='__seo_snapshot_cf_rum_p20260611_service_role_all') THEN
    CREATE POLICY __seo_snapshot_cf_rum_p20260611_service_role_all ON public.__seo_snapshot_cf_rum_p20260611 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_cf_rum_p20260612 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_cf_rum_p20260612 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_cf_rum_p20260612' AND policyname='__seo_snapshot_cf_rum_p20260612_service_role_all') THEN
    CREATE POLICY __seo_snapshot_cf_rum_p20260612_service_role_all ON public.__seo_snapshot_cf_rum_p20260612 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_cf_rum_p20260613 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_cf_rum_p20260613 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_cf_rum_p20260613' AND policyname='__seo_snapshot_cf_rum_p20260613_service_role_all') THEN
    CREATE POLICY __seo_snapshot_cf_rum_p20260613_service_role_all ON public.__seo_snapshot_cf_rum_p20260613 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_cf_rum_p20260614 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_cf_rum_p20260614 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_cf_rum_p20260614' AND policyname='__seo_snapshot_cf_rum_p20260614_service_role_all') THEN
    CREATE POLICY __seo_snapshot_cf_rum_p20260614_service_role_all ON public.__seo_snapshot_cf_rum_p20260614 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_cf_rum_p20260615 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_cf_rum_p20260615 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_cf_rum_p20260615' AND policyname='__seo_snapshot_cf_rum_p20260615_service_role_all') THEN
    CREATE POLICY __seo_snapshot_cf_rum_p20260615_service_role_all ON public.__seo_snapshot_cf_rum_p20260615 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_cf_rum_p20260616 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_cf_rum_p20260616 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_cf_rum_p20260616' AND policyname='__seo_snapshot_cf_rum_p20260616_service_role_all') THEN
    CREATE POLICY __seo_snapshot_cf_rum_p20260616_service_role_all ON public.__seo_snapshot_cf_rum_p20260616 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_cf_rum_p20260617 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_cf_rum_p20260617 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_cf_rum_p20260617' AND policyname='__seo_snapshot_cf_rum_p20260617_service_role_all') THEN
    CREATE POLICY __seo_snapshot_cf_rum_p20260617_service_role_all ON public.__seo_snapshot_cf_rum_p20260617 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_cf_rum_p20260618 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_cf_rum_p20260618 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_cf_rum_p20260618' AND policyname='__seo_snapshot_cf_rum_p20260618_service_role_all') THEN
    CREATE POLICY __seo_snapshot_cf_rum_p20260618_service_role_all ON public.__seo_snapshot_cf_rum_p20260618 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_cf_rum_p20260619 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_cf_rum_p20260619 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_cf_rum_p20260619' AND policyname='__seo_snapshot_cf_rum_p20260619_service_role_all') THEN
    CREATE POLICY __seo_snapshot_cf_rum_p20260619_service_role_all ON public.__seo_snapshot_cf_rum_p20260619 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_cf_rum_p20260620 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_cf_rum_p20260620 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_cf_rum_p20260620' AND policyname='__seo_snapshot_cf_rum_p20260620_service_role_all') THEN
    CREATE POLICY __seo_snapshot_cf_rum_p20260620_service_role_all ON public.__seo_snapshot_cf_rum_p20260620 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_cf_rum_p20260621 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_cf_rum_p20260621 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_cf_rum_p20260621' AND policyname='__seo_snapshot_cf_rum_p20260621_service_role_all') THEN
    CREATE POLICY __seo_snapshot_cf_rum_p20260621_service_role_all ON public.__seo_snapshot_cf_rum_p20260621 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_cf_rum_p20260622 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_cf_rum_p20260622 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_cf_rum_p20260622' AND policyname='__seo_snapshot_cf_rum_p20260622_service_role_all') THEN
    CREATE POLICY __seo_snapshot_cf_rum_p20260622_service_role_all ON public.__seo_snapshot_cf_rum_p20260622 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_cf_rum_p20260623 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_cf_rum_p20260623 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_cf_rum_p20260623' AND policyname='__seo_snapshot_cf_rum_p20260623_service_role_all') THEN
    CREATE POLICY __seo_snapshot_cf_rum_p20260623_service_role_all ON public.__seo_snapshot_cf_rum_p20260623 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_cf_rum_p20260624 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_cf_rum_p20260624 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_cf_rum_p20260624' AND policyname='__seo_snapshot_cf_rum_p20260624_service_role_all') THEN
    CREATE POLICY __seo_snapshot_cf_rum_p20260624_service_role_all ON public.__seo_snapshot_cf_rum_p20260624 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_cf_rum_p20260625 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_cf_rum_p20260625 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_cf_rum_p20260625' AND policyname='__seo_snapshot_cf_rum_p20260625_service_role_all') THEN
    CREATE POLICY __seo_snapshot_cf_rum_p20260625_service_role_all ON public.__seo_snapshot_cf_rum_p20260625 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_cf_rum_p20260626 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_cf_rum_p20260626 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_cf_rum_p20260626' AND policyname='__seo_snapshot_cf_rum_p20260626_service_role_all') THEN
    CREATE POLICY __seo_snapshot_cf_rum_p20260626_service_role_all ON public.__seo_snapshot_cf_rum_p20260626 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_cf_rum_p20260627 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_cf_rum_p20260627 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_cf_rum_p20260627' AND policyname='__seo_snapshot_cf_rum_p20260627_service_role_all') THEN
    CREATE POLICY __seo_snapshot_cf_rum_p20260627_service_role_all ON public.__seo_snapshot_cf_rum_p20260627 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_cf_rum_p20260628 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_cf_rum_p20260628 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_cf_rum_p20260628' AND policyname='__seo_snapshot_cf_rum_p20260628_service_role_all') THEN
    CREATE POLICY __seo_snapshot_cf_rum_p20260628_service_role_all ON public.__seo_snapshot_cf_rum_p20260628 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_cf_rum_p20260629 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_cf_rum_p20260629 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_cf_rum_p20260629' AND policyname='__seo_snapshot_cf_rum_p20260629_service_role_all') THEN
    CREATE POLICY __seo_snapshot_cf_rum_p20260629_service_role_all ON public.__seo_snapshot_cf_rum_p20260629 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_cf_rum_p20260630 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_cf_rum_p20260630 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_cf_rum_p20260630' AND policyname='__seo_snapshot_cf_rum_p20260630_service_role_all') THEN
    CREATE POLICY __seo_snapshot_cf_rum_p20260630_service_role_all ON public.__seo_snapshot_cf_rum_p20260630 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_synthetic_p20260514 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_synthetic_p20260514 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_synthetic_p20260514' AND policyname='__seo_snapshot_synthetic_p20260514_service_role_all') THEN
    CREATE POLICY __seo_snapshot_synthetic_p20260514_service_role_all ON public.__seo_snapshot_synthetic_p20260514 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_synthetic_p20260515 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_synthetic_p20260515 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_synthetic_p20260515' AND policyname='__seo_snapshot_synthetic_p20260515_service_role_all') THEN
    CREATE POLICY __seo_snapshot_synthetic_p20260515_service_role_all ON public.__seo_snapshot_synthetic_p20260515 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_synthetic_p20260516 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_synthetic_p20260516 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_synthetic_p20260516' AND policyname='__seo_snapshot_synthetic_p20260516_service_role_all') THEN
    CREATE POLICY __seo_snapshot_synthetic_p20260516_service_role_all ON public.__seo_snapshot_synthetic_p20260516 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_synthetic_p20260517 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_synthetic_p20260517 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_synthetic_p20260517' AND policyname='__seo_snapshot_synthetic_p20260517_service_role_all') THEN
    CREATE POLICY __seo_snapshot_synthetic_p20260517_service_role_all ON public.__seo_snapshot_synthetic_p20260517 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_synthetic_p20260518 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_synthetic_p20260518 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_synthetic_p20260518' AND policyname='__seo_snapshot_synthetic_p20260518_service_role_all') THEN
    CREATE POLICY __seo_snapshot_synthetic_p20260518_service_role_all ON public.__seo_snapshot_synthetic_p20260518 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_synthetic_p20260519 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_synthetic_p20260519 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_synthetic_p20260519' AND policyname='__seo_snapshot_synthetic_p20260519_service_role_all') THEN
    CREATE POLICY __seo_snapshot_synthetic_p20260519_service_role_all ON public.__seo_snapshot_synthetic_p20260519 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_synthetic_p20260520 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_synthetic_p20260520 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_synthetic_p20260520' AND policyname='__seo_snapshot_synthetic_p20260520_service_role_all') THEN
    CREATE POLICY __seo_snapshot_synthetic_p20260520_service_role_all ON public.__seo_snapshot_synthetic_p20260520 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_synthetic_p20260521 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_synthetic_p20260521 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_synthetic_p20260521' AND policyname='__seo_snapshot_synthetic_p20260521_service_role_all') THEN
    CREATE POLICY __seo_snapshot_synthetic_p20260521_service_role_all ON public.__seo_snapshot_synthetic_p20260521 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_synthetic_p20260522 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_synthetic_p20260522 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_synthetic_p20260522' AND policyname='__seo_snapshot_synthetic_p20260522_service_role_all') THEN
    CREATE POLICY __seo_snapshot_synthetic_p20260522_service_role_all ON public.__seo_snapshot_synthetic_p20260522 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_synthetic_p20260523 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_synthetic_p20260523 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_synthetic_p20260523' AND policyname='__seo_snapshot_synthetic_p20260523_service_role_all') THEN
    CREATE POLICY __seo_snapshot_synthetic_p20260523_service_role_all ON public.__seo_snapshot_synthetic_p20260523 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_synthetic_p20260524 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_synthetic_p20260524 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_synthetic_p20260524' AND policyname='__seo_snapshot_synthetic_p20260524_service_role_all') THEN
    CREATE POLICY __seo_snapshot_synthetic_p20260524_service_role_all ON public.__seo_snapshot_synthetic_p20260524 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_synthetic_p20260525 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_synthetic_p20260525 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_synthetic_p20260525' AND policyname='__seo_snapshot_synthetic_p20260525_service_role_all') THEN
    CREATE POLICY __seo_snapshot_synthetic_p20260525_service_role_all ON public.__seo_snapshot_synthetic_p20260525 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_synthetic_p20260526 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_synthetic_p20260526 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_synthetic_p20260526' AND policyname='__seo_snapshot_synthetic_p20260526_service_role_all') THEN
    CREATE POLICY __seo_snapshot_synthetic_p20260526_service_role_all ON public.__seo_snapshot_synthetic_p20260526 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_synthetic_p20260527 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_synthetic_p20260527 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_synthetic_p20260527' AND policyname='__seo_snapshot_synthetic_p20260527_service_role_all') THEN
    CREATE POLICY __seo_snapshot_synthetic_p20260527_service_role_all ON public.__seo_snapshot_synthetic_p20260527 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_synthetic_p20260528 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_synthetic_p20260528 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_synthetic_p20260528' AND policyname='__seo_snapshot_synthetic_p20260528_service_role_all') THEN
    CREATE POLICY __seo_snapshot_synthetic_p20260528_service_role_all ON public.__seo_snapshot_synthetic_p20260528 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_synthetic_p20260529 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_synthetic_p20260529 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_synthetic_p20260529' AND policyname='__seo_snapshot_synthetic_p20260529_service_role_all') THEN
    CREATE POLICY __seo_snapshot_synthetic_p20260529_service_role_all ON public.__seo_snapshot_synthetic_p20260529 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_synthetic_p20260530 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_synthetic_p20260530 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_synthetic_p20260530' AND policyname='__seo_snapshot_synthetic_p20260530_service_role_all') THEN
    CREATE POLICY __seo_snapshot_synthetic_p20260530_service_role_all ON public.__seo_snapshot_synthetic_p20260530 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_synthetic_p20260531 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_synthetic_p20260531 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_synthetic_p20260531' AND policyname='__seo_snapshot_synthetic_p20260531_service_role_all') THEN
    CREATE POLICY __seo_snapshot_synthetic_p20260531_service_role_all ON public.__seo_snapshot_synthetic_p20260531 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_synthetic_p20260601 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_synthetic_p20260601 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_synthetic_p20260601' AND policyname='__seo_snapshot_synthetic_p20260601_service_role_all') THEN
    CREATE POLICY __seo_snapshot_synthetic_p20260601_service_role_all ON public.__seo_snapshot_synthetic_p20260601 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_synthetic_p20260602 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_synthetic_p20260602 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_synthetic_p20260602' AND policyname='__seo_snapshot_synthetic_p20260602_service_role_all') THEN
    CREATE POLICY __seo_snapshot_synthetic_p20260602_service_role_all ON public.__seo_snapshot_synthetic_p20260602 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_synthetic_p20260603 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_synthetic_p20260603 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_synthetic_p20260603' AND policyname='__seo_snapshot_synthetic_p20260603_service_role_all') THEN
    CREATE POLICY __seo_snapshot_synthetic_p20260603_service_role_all ON public.__seo_snapshot_synthetic_p20260603 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_synthetic_p20260604 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_synthetic_p20260604 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_synthetic_p20260604' AND policyname='__seo_snapshot_synthetic_p20260604_service_role_all') THEN
    CREATE POLICY __seo_snapshot_synthetic_p20260604_service_role_all ON public.__seo_snapshot_synthetic_p20260604 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_synthetic_p20260605 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_synthetic_p20260605 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_synthetic_p20260605' AND policyname='__seo_snapshot_synthetic_p20260605_service_role_all') THEN
    CREATE POLICY __seo_snapshot_synthetic_p20260605_service_role_all ON public.__seo_snapshot_synthetic_p20260605 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_synthetic_p20260606 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_synthetic_p20260606 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_synthetic_p20260606' AND policyname='__seo_snapshot_synthetic_p20260606_service_role_all') THEN
    CREATE POLICY __seo_snapshot_synthetic_p20260606_service_role_all ON public.__seo_snapshot_synthetic_p20260606 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_synthetic_p20260607 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_synthetic_p20260607 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_synthetic_p20260607' AND policyname='__seo_snapshot_synthetic_p20260607_service_role_all') THEN
    CREATE POLICY __seo_snapshot_synthetic_p20260607_service_role_all ON public.__seo_snapshot_synthetic_p20260607 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_synthetic_p20260608 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_synthetic_p20260608 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_synthetic_p20260608' AND policyname='__seo_snapshot_synthetic_p20260608_service_role_all') THEN
    CREATE POLICY __seo_snapshot_synthetic_p20260608_service_role_all ON public.__seo_snapshot_synthetic_p20260608 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_synthetic_p20260609 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_synthetic_p20260609 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_synthetic_p20260609' AND policyname='__seo_snapshot_synthetic_p20260609_service_role_all') THEN
    CREATE POLICY __seo_snapshot_synthetic_p20260609_service_role_all ON public.__seo_snapshot_synthetic_p20260609 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_synthetic_p20260610 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_synthetic_p20260610 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_synthetic_p20260610' AND policyname='__seo_snapshot_synthetic_p20260610_service_role_all') THEN
    CREATE POLICY __seo_snapshot_synthetic_p20260610_service_role_all ON public.__seo_snapshot_synthetic_p20260610 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_synthetic_p20260611 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_synthetic_p20260611 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_synthetic_p20260611' AND policyname='__seo_snapshot_synthetic_p20260611_service_role_all') THEN
    CREATE POLICY __seo_snapshot_synthetic_p20260611_service_role_all ON public.__seo_snapshot_synthetic_p20260611 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_synthetic_p20260612 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_synthetic_p20260612 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_synthetic_p20260612' AND policyname='__seo_snapshot_synthetic_p20260612_service_role_all') THEN
    CREATE POLICY __seo_snapshot_synthetic_p20260612_service_role_all ON public.__seo_snapshot_synthetic_p20260612 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_synthetic_p20260613 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_synthetic_p20260613 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_synthetic_p20260613' AND policyname='__seo_snapshot_synthetic_p20260613_service_role_all') THEN
    CREATE POLICY __seo_snapshot_synthetic_p20260613_service_role_all ON public.__seo_snapshot_synthetic_p20260613 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_synthetic_p20260614 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_synthetic_p20260614 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_synthetic_p20260614' AND policyname='__seo_snapshot_synthetic_p20260614_service_role_all') THEN
    CREATE POLICY __seo_snapshot_synthetic_p20260614_service_role_all ON public.__seo_snapshot_synthetic_p20260614 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_synthetic_p20260615 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_synthetic_p20260615 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_synthetic_p20260615' AND policyname='__seo_snapshot_synthetic_p20260615_service_role_all') THEN
    CREATE POLICY __seo_snapshot_synthetic_p20260615_service_role_all ON public.__seo_snapshot_synthetic_p20260615 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_synthetic_p20260616 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_synthetic_p20260616 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_synthetic_p20260616' AND policyname='__seo_snapshot_synthetic_p20260616_service_role_all') THEN
    CREATE POLICY __seo_snapshot_synthetic_p20260616_service_role_all ON public.__seo_snapshot_synthetic_p20260616 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_synthetic_p20260617 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_synthetic_p20260617 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_synthetic_p20260617' AND policyname='__seo_snapshot_synthetic_p20260617_service_role_all') THEN
    CREATE POLICY __seo_snapshot_synthetic_p20260617_service_role_all ON public.__seo_snapshot_synthetic_p20260617 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_synthetic_p20260618 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_synthetic_p20260618 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_synthetic_p20260618' AND policyname='__seo_snapshot_synthetic_p20260618_service_role_all') THEN
    CREATE POLICY __seo_snapshot_synthetic_p20260618_service_role_all ON public.__seo_snapshot_synthetic_p20260618 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_synthetic_p20260619 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_synthetic_p20260619 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_synthetic_p20260619' AND policyname='__seo_snapshot_synthetic_p20260619_service_role_all') THEN
    CREATE POLICY __seo_snapshot_synthetic_p20260619_service_role_all ON public.__seo_snapshot_synthetic_p20260619 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_synthetic_p20260620 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_synthetic_p20260620 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_synthetic_p20260620' AND policyname='__seo_snapshot_synthetic_p20260620_service_role_all') THEN
    CREATE POLICY __seo_snapshot_synthetic_p20260620_service_role_all ON public.__seo_snapshot_synthetic_p20260620 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_synthetic_p20260621 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_synthetic_p20260621 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_synthetic_p20260621' AND policyname='__seo_snapshot_synthetic_p20260621_service_role_all') THEN
    CREATE POLICY __seo_snapshot_synthetic_p20260621_service_role_all ON public.__seo_snapshot_synthetic_p20260621 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_synthetic_p20260622 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_synthetic_p20260622 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_synthetic_p20260622' AND policyname='__seo_snapshot_synthetic_p20260622_service_role_all') THEN
    CREATE POLICY __seo_snapshot_synthetic_p20260622_service_role_all ON public.__seo_snapshot_synthetic_p20260622 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_synthetic_p20260623 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_synthetic_p20260623 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_synthetic_p20260623' AND policyname='__seo_snapshot_synthetic_p20260623_service_role_all') THEN
    CREATE POLICY __seo_snapshot_synthetic_p20260623_service_role_all ON public.__seo_snapshot_synthetic_p20260623 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_synthetic_p20260624 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_synthetic_p20260624 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_synthetic_p20260624' AND policyname='__seo_snapshot_synthetic_p20260624_service_role_all') THEN
    CREATE POLICY __seo_snapshot_synthetic_p20260624_service_role_all ON public.__seo_snapshot_synthetic_p20260624 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_synthetic_p20260625 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_synthetic_p20260625 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_synthetic_p20260625' AND policyname='__seo_snapshot_synthetic_p20260625_service_role_all') THEN
    CREATE POLICY __seo_snapshot_synthetic_p20260625_service_role_all ON public.__seo_snapshot_synthetic_p20260625 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_synthetic_p20260626 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_synthetic_p20260626 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_synthetic_p20260626' AND policyname='__seo_snapshot_synthetic_p20260626_service_role_all') THEN
    CREATE POLICY __seo_snapshot_synthetic_p20260626_service_role_all ON public.__seo_snapshot_synthetic_p20260626 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_synthetic_p20260627 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_synthetic_p20260627 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_synthetic_p20260627' AND policyname='__seo_snapshot_synthetic_p20260627_service_role_all') THEN
    CREATE POLICY __seo_snapshot_synthetic_p20260627_service_role_all ON public.__seo_snapshot_synthetic_p20260627 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_synthetic_p20260628 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_synthetic_p20260628 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_synthetic_p20260628' AND policyname='__seo_snapshot_synthetic_p20260628_service_role_all') THEN
    CREATE POLICY __seo_snapshot_synthetic_p20260628_service_role_all ON public.__seo_snapshot_synthetic_p20260628 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_synthetic_p20260629 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_synthetic_p20260629 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_synthetic_p20260629' AND policyname='__seo_snapshot_synthetic_p20260629_service_role_all') THEN
    CREATE POLICY __seo_snapshot_synthetic_p20260629_service_role_all ON public.__seo_snapshot_synthetic_p20260629 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__seo_snapshot_synthetic_p20260630 FROM anon, authenticated;
ALTER TABLE public.__seo_snapshot_synthetic_p20260630 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_snapshot_synthetic_p20260630' AND policyname='__seo_snapshot_synthetic_p20260630_service_role_all') THEN
    CREATE POLICY __seo_snapshot_synthetic_p20260630_service_role_all ON public.__seo_snapshot_synthetic_p20260630 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.__soft_404_events FROM anon, authenticated;
ALTER TABLE public.__soft_404_events ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__soft_404_events' AND policyname='__soft_404_events_service_role_all') THEN
    CREATE POLICY __soft_404_events_service_role_all ON public.__soft_404_events AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.audit_vlevel_pg424_snapshot_20260608 FROM anon, authenticated;
ALTER TABLE public.audit_vlevel_pg424_snapshot_20260608 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='audit_vlevel_pg424_snapshot_20260608' AND policyname='audit_vlevel_pg424_snapshot_20260608_service_role_all') THEN
    CREATE POLICY audit_vlevel_pg424_snapshot_20260608_service_role_all ON public.audit_vlevel_pg424_snapshot_20260608 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.catalog_pricing_baseline FROM anon, authenticated;
ALTER TABLE public.catalog_pricing_baseline ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='catalog_pricing_baseline' AND policyname='catalog_pricing_baseline_service_role_all') THEN
    CREATE POLICY catalog_pricing_baseline_service_role_all ON public.catalog_pricing_baseline AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.catalog_pricing_baseline_meta FROM anon, authenticated;
ALTER TABLE public.catalog_pricing_baseline_meta ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='catalog_pricing_baseline_meta' AND policyname='catalog_pricing_baseline_meta_service_role_all') THEN
    CREATE POLICY catalog_pricing_baseline_meta_service_role_all ON public.catalog_pricing_baseline_meta AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.pieces_display_history FROM anon, authenticated;
ALTER TABLE public.pieces_display_history ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pieces_display_history' AND policyname='pieces_display_history_service_role_all') THEN
    CREATE POLICY pieces_display_history_service_role_all ON public.pieces_display_history AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.pieces_gamme_display_history FROM anon, authenticated;
ALTER TABLE public.pieces_gamme_display_history ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pieces_gamme_display_history' AND policyname='pieces_gamme_display_history_service_role_all') THEN
    CREATE POLICY pieces_gamme_display_history_service_role_all ON public.pieces_gamme_display_history AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.pieces_gamme_link_history FROM anon, authenticated;
ALTER TABLE public.pieces_gamme_link_history ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pieces_gamme_link_history' AND policyname='pieces_gamme_link_history_service_role_all') THEN
    CREATE POLICY pieces_gamme_link_history_service_role_all ON public.pieces_gamme_link_history AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.pieces_media_img_backup_pm3040_20260610 FROM anon, authenticated;
ALTER TABLE public.pieces_media_img_backup_pm3040_20260610 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pieces_media_img_backup_pm3040_20260610' AND policyname='pieces_media_img_backup_pm3040_20260610_service_role_all') THEN
    CREATE POLICY pieces_media_img_backup_pm3040_20260610_service_role_all ON public.pieces_media_img_backup_pm3040_20260610 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.pieces_media_img_backup_pm3410_20260610 FROM anon, authenticated;
ALTER TABLE public.pieces_media_img_backup_pm3410_20260610 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pieces_media_img_backup_pm3410_20260610' AND policyname='pieces_media_img_backup_pm3410_20260610_service_role_all') THEN
    CREATE POLICY pieces_media_img_backup_pm3410_20260610_service_role_all ON public.pieces_media_img_backup_pm3410_20260610 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.pieces_media_img_p1_backup_20260523 FROM anon, authenticated;
ALTER TABLE public.pieces_media_img_p1_backup_20260523 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pieces_media_img_p1_backup_20260523' AND policyname='pieces_media_img_p1_backup_20260523_service_role_all') THEN
    CREATE POLICY pieces_media_img_p1_backup_20260523_service_role_all ON public.pieces_media_img_p1_backup_20260523 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.pieces_media_img_recover_flips_pm3040_20260610 FROM anon, authenticated;
ALTER TABLE public.pieces_media_img_recover_flips_pm3040_20260610 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pieces_media_img_recover_flips_pm3040_20260610' AND policyname='pieces_media_img_recover_flips_pm3040_20260610_service_role_all') THEN
    CREATE POLICY pieces_media_img_recover_flips_pm3040_20260610_service_role_all ON public.pieces_media_img_recover_flips_pm3040_20260610 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.pieces_media_img_recover_flips_pm3410_20260610 FROM anon, authenticated;
ALTER TABLE public.pieces_media_img_recover_flips_pm3410_20260610 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pieces_media_img_recover_flips_pm3410_20260610' AND policyname='pieces_media_img_recover_flips_pm3410_20260610_service_role_all') THEN
    CREATE POLICY pieces_media_img_recover_flips_pm3410_20260610_service_role_all ON public.pieces_media_img_recover_flips_pm3410_20260610 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.pieces_media_img_recover_manifest_pm3040_20260610 FROM anon, authenticated;
ALTER TABLE public.pieces_media_img_recover_manifest_pm3040_20260610 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pieces_media_img_recover_manifest_pm3040_20260610' AND policyname='pieces_media_img_recover_manifest_pm3040_20260610_service_role_all') THEN
    CREATE POLICY pieces_media_img_recover_manifest_pm3040_20260610_service_role_all ON public.pieces_media_img_recover_manifest_pm3040_20260610 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.pieces_media_img_recover_manifest_pm3410_20260610 FROM anon, authenticated;
ALTER TABLE public.pieces_media_img_recover_manifest_pm3410_20260610 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pieces_media_img_recover_manifest_pm3410_20260610' AND policyname='pieces_media_img_recover_manifest_pm3410_20260610_service_role_all') THEN
    CREATE POLICY pieces_media_img_recover_manifest_pm3410_20260610_service_role_all ON public.pieces_media_img_recover_manifest_pm3410_20260610 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.pieces_media_img_tier_c_flipped_20260523 FROM anon, authenticated;
ALTER TABLE public.pieces_media_img_tier_c_flipped_20260523 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pieces_media_img_tier_c_flipped_20260523' AND policyname='pieces_media_img_tier_c_flipped_20260523_service_role_all') THEN
    CREATE POLICY pieces_media_img_tier_c_flipped_20260523_service_role_all ON public.pieces_media_img_tier_c_flipped_20260523 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.pieces_price_history FROM anon, authenticated;
ALTER TABLE public.pieces_price_history ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pieces_price_history' AND policyname='pieces_price_history_service_role_all') THEN
    CREATE POLICY pieces_price_history_service_role_all ON public.pieces_price_history AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.pieces_price_history_2026_05 FROM anon, authenticated;
ALTER TABLE public.pieces_price_history_2026_05 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pieces_price_history_2026_05' AND policyname='pieces_price_history_2026_05_service_role_all') THEN
    CREATE POLICY pieces_price_history_2026_05_service_role_all ON public.pieces_price_history_2026_05 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.pieces_price_history_2026_06 FROM anon, authenticated;
ALTER TABLE public.pieces_price_history_2026_06 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pieces_price_history_2026_06' AND policyname='pieces_price_history_2026_06_service_role_all') THEN
    CREATE POLICY pieces_price_history_2026_06_service_role_all ON public.pieces_price_history_2026_06 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.pieces_price_history_2026_07 FROM anon, authenticated;
ALTER TABLE public.pieces_price_history_2026_07 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pieces_price_history_2026_07' AND policyname='pieces_price_history_2026_07_service_role_all') THEN
    CREATE POLICY pieces_price_history_2026_07_service_role_all ON public.pieces_price_history_2026_07 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.pieces_price_history_default FROM anon, authenticated;
ALTER TABLE public.pieces_price_history_default ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pieces_price_history_default' AND policyname='pieces_price_history_default_service_role_all') THEN
    CREATE POLICY pieces_price_history_default_service_role_all ON public.pieces_price_history_default AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.price_import_batch_chunks FROM anon, authenticated;
ALTER TABLE public.price_import_batch_chunks ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='price_import_batch_chunks' AND policyname='price_import_batch_chunks_service_role_all') THEN
    CREATE POLICY price_import_batch_chunks_service_role_all ON public.price_import_batch_chunks AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.price_import_batches FROM anon, authenticated;
ALTER TABLE public.price_import_batches ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='price_import_batches' AND policyname='price_import_batches_service_role_all') THEN
    CREATE POLICY price_import_batches_service_role_all ON public.price_import_batches AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.pricing_decision_snapshot FROM anon, authenticated;
ALTER TABLE public.pricing_decision_snapshot ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pricing_decision_snapshot' AND policyname='pricing_decision_snapshot_service_role_all') THEN
    CREATE POLICY pricing_decision_snapshot_service_role_all ON public.pricing_decision_snapshot AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.pricing_decision_snapshot_2026_05 FROM anon, authenticated;
ALTER TABLE public.pricing_decision_snapshot_2026_05 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pricing_decision_snapshot_2026_05' AND policyname='pricing_decision_snapshot_2026_05_service_role_all') THEN
    CREATE POLICY pricing_decision_snapshot_2026_05_service_role_all ON public.pricing_decision_snapshot_2026_05 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.pricing_decision_snapshot_2026_06 FROM anon, authenticated;
ALTER TABLE public.pricing_decision_snapshot_2026_06 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pricing_decision_snapshot_2026_06' AND policyname='pricing_decision_snapshot_2026_06_service_role_all') THEN
    CREATE POLICY pricing_decision_snapshot_2026_06_service_role_all ON public.pricing_decision_snapshot_2026_06 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.pricing_decision_snapshot_2026_07 FROM anon, authenticated;
ALTER TABLE public.pricing_decision_snapshot_2026_07 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pricing_decision_snapshot_2026_07' AND policyname='pricing_decision_snapshot_2026_07_service_role_all') THEN
    CREATE POLICY pricing_decision_snapshot_2026_07_service_role_all ON public.pricing_decision_snapshot_2026_07 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.pricing_decision_snapshot_default FROM anon, authenticated;
ALTER TABLE public.pricing_decision_snapshot_default ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pricing_decision_snapshot_default' AND policyname='pricing_decision_snapshot_default_service_role_all') THEN
    CREATE POLICY pricing_decision_snapshot_default_service_role_all ON public.pricing_decision_snapshot_default AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.pricing_rules FROM anon, authenticated;
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pricing_rules' AND policyname='pricing_rules_service_role_all') THEN
    CREATE POLICY pricing_rules_service_role_all ON public.pricing_rules AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.supplier_import_raw FROM anon, authenticated;
ALTER TABLE public.supplier_import_raw ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='supplier_import_raw' AND policyname='supplier_import_raw_service_role_all') THEN
    CREATE POLICY supplier_import_raw_service_role_all ON public.supplier_import_raw AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.supplier_offer_snapshot FROM anon, authenticated;
ALTER TABLE public.supplier_offer_snapshot ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='supplier_offer_snapshot' AND policyname='supplier_offer_snapshot_service_role_all') THEN
    CREATE POLICY supplier_offer_snapshot_service_role_all ON public.supplier_offer_snapshot AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.supplier_offer_snapshot_2026_05 FROM anon, authenticated;
ALTER TABLE public.supplier_offer_snapshot_2026_05 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='supplier_offer_snapshot_2026_05' AND policyname='supplier_offer_snapshot_2026_05_service_role_all') THEN
    CREATE POLICY supplier_offer_snapshot_2026_05_service_role_all ON public.supplier_offer_snapshot_2026_05 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.supplier_offer_snapshot_2026_06 FROM anon, authenticated;
ALTER TABLE public.supplier_offer_snapshot_2026_06 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='supplier_offer_snapshot_2026_06' AND policyname='supplier_offer_snapshot_2026_06_service_role_all') THEN
    CREATE POLICY supplier_offer_snapshot_2026_06_service_role_all ON public.supplier_offer_snapshot_2026_06 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.supplier_offer_snapshot_2026_07 FROM anon, authenticated;
ALTER TABLE public.supplier_offer_snapshot_2026_07 ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='supplier_offer_snapshot_2026_07' AND policyname='supplier_offer_snapshot_2026_07_service_role_all') THEN
    CREATE POLICY supplier_offer_snapshot_2026_07_service_role_all ON public.supplier_offer_snapshot_2026_07 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.supplier_offer_snapshot_default FROM anon, authenticated;
ALTER TABLE public.supplier_offer_snapshot_default ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='supplier_offer_snapshot_default' AND policyname='supplier_offer_snapshot_default_service_role_all') THEN
    CREATE POLICY supplier_offer_snapshot_default_service_role_all ON public.supplier_offer_snapshot_default AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;

REVOKE ALL ON TABLE public.supplier_price_profiles FROM anon, authenticated;
ALTER TABLE public.supplier_price_profiles ENABLE ROW LEVEL SECURITY;
DO $b$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='supplier_price_profiles' AND policyname='supplier_price_profiles_service_role_all') THEN
    CREATE POLICY supplier_price_profiles_service_role_all ON public.supplier_price_profiles AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $b$;
COMMIT;

-- =============================================================================
-- Post-apply verification (run after apply)
-- =============================================================================
--   -- 1) Every target table now has RLS on + exactly its service_role policy:
--   SELECT count(*) AS rls_disabled_internal
--   FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
--   WHERE n.nspname='public' AND c.relkind IN ('r','p') AND NOT c.relrowsecurity
--     AND c.relname ~ '^(__seo_|__soft_404_events|pieces_price_history|pieces_display_history|pieces_gamme_display_history|pieces_gamme_link_history|pieces_media_img_|pricing_|price_import_|supplier_|catalog_pricing_baseline|audit_vlevel_)';
--   -- expected : 0
--
--   -- 2) No anon/authenticated grants remain on these tables:
--   SELECT count(*) FROM information_schema.role_table_grants
--   WHERE table_schema='public' AND grantee IN ('anon','authenticated')
--     AND table_name ~ '^(__seo_|__soft_404_events|pieces_price_history|pieces_display_history|pieces_gamme_display_history|pieces_gamme_link_history|pieces_media_img_|pricing_|price_import_|supplier_|catalog_pricing_baseline|audit_vlevel_)';
--   -- expected : 0
--
--   -- 3) Re-run Supabase advisor (security): the 207 rls_disabled_in_public and
--   --    6 sensitive_columns_exposed rows must disappear (215 → 2 errors left:
--   --    the 2 SECURITY DEFINER views handled by the companion views migration).
--
-- ROLLBACK (reversible)
-- ---------------------
--   For each table T in scope:
--     ALTER TABLE public.T DISABLE ROW LEVEL SECURITY;
--     -- (optionally) DROP POLICY IF EXISTS T_service_role_all ON public.T;
--     -- grants are NOT auto-restored; re-GRANT only if a legit anon need is proven.
-- =============================================================================

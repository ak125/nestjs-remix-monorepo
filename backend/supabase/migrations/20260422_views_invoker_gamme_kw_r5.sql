-- =============================================================================
-- Migration : Convert gamme dashboards + KW + R5 views to SECURITY INVOKER (Vague 3d)
-- Date      : 2026-04-22
-- Severity  : MEDIUM (Supabase advisor — security_definer_view)
-- Scope     : Vague 3d / 7 — 7 views + 1 matview
-- =============================================================================
--
-- Views covered (cf. .spec/reports/security/vague3-security-definer-views-audit-20260422.md)
--
-- A) Standard views (7) — ALTER VIEW + REVOKE
--   - v_conseil_pack_coverage    (__seo_gamme_conseil + pieces_gamme aggregate)
--   - v_gamme_content_orphans    (cross __seo_gamme* tables orphan check)
--   - v_gamme_readiness          (cross __seo_* + gamme_aggregates dashboard)
--   - v_kw_pipeline_status       (cross 21+ tables pipeline status snapshot)
--   - v_r5_consolidation_status  (__seo_gamme_conseil + __seo_observable)
--   - v_thresholds_by_family     (gate_thresholds aggregate)
--   - v_thresholds_comparison    (gate_thresholds aggregate)
--
-- B) Materialized view (1) — REVOKE only
--   - v_gamme_seo_dashboard      (snapshot of gamme_aggregates + pieces_gamme + __seo_*)
--
-- Why matview is REVOKE-only
-- --------------------------
-- Postgres does NOT support `security_invoker` reloption on materialized
-- views (only on regular views). The matview is a stored snapshot, accessed
-- like a table — the SECURITY DEFINER concept doesn't apply to SELECT on it
-- (that's just a normal table read). The advisor flag is technically a false
-- positive for matviews, but the public-grant exposure is real and needs
-- REVOKE to lock down anon/authenticated PostgREST access.
--
-- The REFRESH MATERIALIZED VIEW continues to work normally (executed by
-- service_role with BYPASSRLS, no DEFINER attribute needed).
--
-- Backend impact
-- --------------
-- Zero. All consumers are admin tooling / RPC backend (service_role).
-- Frontend has no direct supabase-js calls.
--
-- Smoke-tested in transaction on prod DB 2026-04-22:
--   7 views: options=security_invoker=true, public_grants=0
--   1 matview: public_grants=0
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- A) Standard views — ALTER + REVOKE
-- -----------------------------------------------------------------------------

ALTER VIEW public.v_conseil_pack_coverage      SET (security_invoker = true);
ALTER VIEW public.v_gamme_content_orphans      SET (security_invoker = true);
ALTER VIEW public.v_gamme_readiness            SET (security_invoker = true);
ALTER VIEW public.v_kw_pipeline_status         SET (security_invoker = true);
ALTER VIEW public.v_r5_consolidation_status    SET (security_invoker = true);
ALTER VIEW public.v_thresholds_by_family       SET (security_invoker = true);
ALTER VIEW public.v_thresholds_comparison      SET (security_invoker = true);

REVOKE ALL ON public.v_conseil_pack_coverage    FROM anon, authenticated;
REVOKE ALL ON public.v_gamme_content_orphans    FROM anon, authenticated;
REVOKE ALL ON public.v_gamme_readiness          FROM anon, authenticated;
REVOKE ALL ON public.v_kw_pipeline_status       FROM anon, authenticated;
REVOKE ALL ON public.v_r5_consolidation_status  FROM anon, authenticated;
REVOKE ALL ON public.v_thresholds_by_family     FROM anon, authenticated;
REVOKE ALL ON public.v_thresholds_comparison    FROM anon, authenticated;

-- -----------------------------------------------------------------------------
-- B) Materialized view — REVOKE only (security_invoker not supported on matview)
-- -----------------------------------------------------------------------------

REVOKE ALL ON public.v_gamme_seo_dashboard FROM anon, authenticated;

COMMIT;

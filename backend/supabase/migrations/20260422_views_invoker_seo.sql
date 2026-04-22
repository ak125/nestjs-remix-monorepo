-- =============================================================================
-- Migration : Convert SEO views from SECURITY DEFINER to SECURITY INVOKER (Vague 3b)
-- Date      : 2026-04-22
-- Severity  : MEDIUM (Supabase advisor — security_definer_view)
-- Scope     : Vague 3b / 7 — 11 SEO views (analytics + monitoring)
-- =============================================================================
--
-- Problem
-- -------
-- These 11 views are currently `SECURITY DEFINER`, bypassing the RLS we put
-- on `seo_link_*`, `__seo_*` tables in vagues 1-2e. Anyone with the anon key
-- could read SEO link analytics or scraping data via PostgREST through these
-- views.
--
-- Views covered (cf. .spec/reports/security/vague3-security-definer-views-audit-20260422.md)
--
-- A) SEO analytics & A/B testing (5)
--   - seo_link_ctr               (seo_link_clicks aggregate)
--   - seo_ab_testing_formula_ctr (seo_link_clicks aggregate)
--   - seo_ab_testing_top_formulas(seo_link_clicks + impressions aggregate)
--   - seo_ab_testing_verbs       (seo_link_clicks aggregate)
--   - seo_ab_testing_nouns       (seo_link_clicks aggregate)
--
-- B) SEO monitoring (6)
--   - v_seo_internal_link_stats        (__seo_internal_link aggregate)
--   - v_seo_crawl_stats_7d             (__seo_crawl_log aggregate)
--   - v_seo_last_googlebot_crawl       (__seo_crawl_log aggregate)
--   - v_seo_keywords_unmatched         (__seo_keywords filter)
--   - v_seo_interpolation_alerts_24h   (__seo_interpolation_alerts aggregate)
--   - v_seo_interpolation_alerts_weekly(__seo_interpolation_alerts + pieces_gamme)
--
-- Backend impact
-- --------------
-- Zero. All consumers are backend service_role (BYPASSRLS). Frontend has NO
-- direct supabase-js calls to these views.
--
-- Strategy : same as vague 3a.
--   1. ALTER VIEW … SET (security_invoker = true)
--   2. REVOKE ALL on anon, authenticated (defense in depth)
--   3. service_role keeps access via BYPASSRLS
--
-- Smoke-tested in transaction (BEGIN/ROLLBACK) on prod DB 2026-04-22:
--   options=security_invoker=true on all 11 views, public_grants=0.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- A) SEO analytics & A/B testing
-- -----------------------------------------------------------------------------

ALTER VIEW public.seo_link_ctr                  SET (security_invoker = true);
ALTER VIEW public.seo_ab_testing_formula_ctr    SET (security_invoker = true);
ALTER VIEW public.seo_ab_testing_top_formulas   SET (security_invoker = true);
ALTER VIEW public.seo_ab_testing_verbs          SET (security_invoker = true);
ALTER VIEW public.seo_ab_testing_nouns          SET (security_invoker = true);

REVOKE ALL ON public.seo_link_ctr                  FROM anon, authenticated;
REVOKE ALL ON public.seo_ab_testing_formula_ctr    FROM anon, authenticated;
REVOKE ALL ON public.seo_ab_testing_top_formulas   FROM anon, authenticated;
REVOKE ALL ON public.seo_ab_testing_verbs          FROM anon, authenticated;
REVOKE ALL ON public.seo_ab_testing_nouns          FROM anon, authenticated;

-- -----------------------------------------------------------------------------
-- B) SEO monitoring
-- -----------------------------------------------------------------------------

ALTER VIEW public.v_seo_internal_link_stats         SET (security_invoker = true);
ALTER VIEW public.v_seo_crawl_stats_7d              SET (security_invoker = true);
ALTER VIEW public.v_seo_last_googlebot_crawl        SET (security_invoker = true);
ALTER VIEW public.v_seo_keywords_unmatched          SET (security_invoker = true);
ALTER VIEW public.v_seo_interpolation_alerts_24h    SET (security_invoker = true);
ALTER VIEW public.v_seo_interpolation_alerts_weekly SET (security_invoker = true);

REVOKE ALL ON public.v_seo_internal_link_stats         FROM anon, authenticated;
REVOKE ALL ON public.v_seo_crawl_stats_7d              FROM anon, authenticated;
REVOKE ALL ON public.v_seo_last_googlebot_crawl        FROM anon, authenticated;
REVOKE ALL ON public.v_seo_keywords_unmatched          FROM anon, authenticated;
REVOKE ALL ON public.v_seo_interpolation_alerts_24h    FROM anon, authenticated;
REVOKE ALL ON public.v_seo_interpolation_alerts_weekly FROM anon, authenticated;

COMMIT;

-- =============================================================================
-- Verification
--   SELECT relname, array_to_string(reloptions, ',') FROM pg_class
--   WHERE relname IN (...above 11...) AND relkind = 'v';
-- =============================================================================

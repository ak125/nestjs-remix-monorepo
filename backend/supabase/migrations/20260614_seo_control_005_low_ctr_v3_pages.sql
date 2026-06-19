-- =====================================================
-- SEO Control — rpc_seo_low_ctr_v3 (source = grain `pages`, + couverture)
-- Date: 2026-06-14
-- Refs: plan PR1b · 20260613_seo_gsc_multilevel_grains.sql (tables grains)
--       20260518_seo_control_002_rpcs.sql (v2 baseline)
-- =====================================================
--
-- POURQUOI v3 : v2 lit `__seo_gsc_daily` (grain page+query+device) → la dimension
-- `query` anonymise → totaux page sous-capturés. v3 lit `__seo_gsc_daily_pages`
-- (grain page+country+device, SANS query) = donnée page plus complète, et n'a plus
-- besoin du filtre `_seo_is_synthetic_query` (aucune colonne query au grain pages).
--
-- Enveloppe = STRICTEMENT celle de v2 (rows/total_qualifying/data_from/data_to/
-- last_data_date/impact_score_version) + AJOUT `coverage_ratio`/`coverage_status`
-- (apparié au grain : Σpages.impr / property_total.impr sur la fenêtre). Le
-- consommateur (command-center-actions) bascule v3→v2→v1 (dégradation gracieuse).
--
-- Additive : v2 conservée (aucun changement de comportement). STABLE (read-only).
-- Pas de BEGIN/COMMIT explicite (squawk assume_in_transaction=true).
-- =====================================================

-- Squawk require-timeout-settings : CREATE OR REPLACE FUNCTION = op métadonnée → bornée.
set lock_timeout = '5s';
set statement_timeout = '60s';

CREATE OR REPLACE FUNCTION public.rpc_seo_low_ctr_v3(
    p_window_days integer,
    p_now timestamptz DEFAULT now(),
    p_min_impressions integer DEFAULT 100,
    p_max_ctr numeric DEFAULT 0.01,
    p_limit integer DEFAULT 50,
    p_coverage_min_ratio numeric DEFAULT 0.3  -- plancher gouverné (= SEO_GSC_COVERAGE_MIN_RATIO)
)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $function$
  WITH bounds AS (
    SELECT (p_now::DATE - p_window_days) AS from_d, p_now::DATE AS to_d
  ),
  agg AS (
    SELECT
      page,
      SUM(impressions)::BIGINT AS impressions,
      SUM(clicks)::BIGINT AS clicks,
      ROUND((SUM(clicks)::NUMERIC / NULLIF(SUM(impressions), 0)), 4)::FLOAT8 AS ctr,
      ROUND(AVG(position)::NUMERIC, 2)::FLOAT8 AS avg_position
    FROM __seo_gsc_daily_pages, bounds
    WHERE date >= bounds.from_d AND date < bounds.to_d
    GROUP BY page
    HAVING SUM(impressions) >= p_min_impressions
       AND (SUM(clicks)::NUMERIC / NULLIF(SUM(impressions), 0)) <= p_max_ctr
  ),
  scored AS (
    SELECT
      page,
      _seo_resolve_surface_key(page) AS surface_key,
      impressions, clicks, ctr, avg_position,
      CASE
        WHEN avg_position <= 5 THEN 'top5'
        WHEN avg_position <= 15 THEN 'top15'
        ELSE 'beyond' END AS position_band,
      ROUND(
        (impressions::NUMERIC
        * GREATEST(0::NUMERIC, (CASE
            WHEN avg_position <= 5 THEN 0.05
            WHEN avg_position <= 15 THEN 0.02
            ELSE 0.005 END)::NUMERIC - ctr::NUMERIC))::NUMERIC,
        2
      )::FLOAT8 AS business_impact_score,
      CASE
        WHEN avg_position <= 5 AND ctr < 0.005 THEN 'critical'
        WHEN avg_position <= 15 AND ctr < 0.005 THEN 'high'
        ELSE 'medium' END AS severity
    FROM agg
  ),
  coverage_dim AS (
    SELECT MIN(date) AS data_from, MAX(date) AS data_to
    FROM __seo_gsc_daily_pages, bounds
    WHERE date >= bounds.from_d AND date < bounds.to_d
  ),
  -- Invariant de couverture apparié au grain : Σpages vs property_total (global).
  cov AS (
    SELECT
      COALESCE((
        SELECT SUM(impressions) FROM __seo_gsc_daily_pages, bounds
        WHERE date >= bounds.from_d AND date < bounds.to_d
      ), 0)::BIGINT AS pages_impr,
      COALESCE((
        SELECT SUM(impressions) FROM __seo_gsc_daily_property_total, bounds
        WHERE date >= bounds.from_d AND date < bounds.to_d
      ), 0)::BIGINT AS prop_impr
  )
  SELECT jsonb_build_object(
    'rows', COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'page', s.page,
          'surface_key', s.surface_key,
          'impressions', s.impressions,
          'clicks', s.clicks,
          'ctr', s.ctr,
          'avg_position', s.avg_position,
          'position_band', s.position_band,
          'business_impact_score', s.business_impact_score,
          'impact_score_version', 'v1',
          'severity', s.severity
        )
        ORDER BY s.business_impact_score DESC
      )
      FROM (SELECT * FROM scored ORDER BY business_impact_score DESC LIMIT p_limit) s),
      '[]'::jsonb
    ),
    'total_qualifying', (SELECT COUNT(*) FROM agg),
    'data_from', (SELECT data_from FROM coverage_dim),
    'data_to', (SELECT data_to FROM coverage_dim),
    'last_data_date', (
      SELECT MAX(date) FROM __seo_gsc_daily_pages, bounds
      WHERE date >= bounds.from_d AND date < bounds.to_d
    ),
    'impact_score_version', 'v1',
    -- AJOUT v3 : couverture apparié au grain (Σpages.impr / property_total.impr).
    'coverage_ratio', (
      SELECT CASE WHEN prop_impr > 0
        THEN ROUND((pages_impr::NUMERIC / prop_impr), 4)::FLOAT8
        ELSE NULL END FROM cov
    ),
    'coverage_status', (
      SELECT CASE
        WHEN prop_impr <= 0 THEN 'insufficient_data'
        WHEN (pages_impr::NUMERIC / prop_impr) < p_coverage_min_ratio THEN 'coverage_gap'
        ELSE 'ok' END FROM cov
    )
  );
$function$;

COMMENT ON FUNCTION public.rpc_seo_low_ctr_v3(integer, timestamptz, integer, numeric, integer, numeric) IS
  'SEO low-CTR v3 — source grain pages (__seo_gsc_daily_pages, sans query) + couverture vs property_total. Enveloppe v2 + coverage_ratio/coverage_status. STABLE read-only. PR1b.';

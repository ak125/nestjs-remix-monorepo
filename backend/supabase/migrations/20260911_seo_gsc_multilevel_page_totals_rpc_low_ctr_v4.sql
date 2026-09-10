-- =====================================================
-- SEO Control — rpc_seo_low_ctr_v4 (grain page FIDÈLE + couverture jours ET clics)
-- Date: 2026-09-11
-- Refs: 20260911_seo_gsc_multilevel_page_totals.sql (table + commit_version, à appliquer AVANT)
--       20260614_seo_control_005_low_ctr_v3_pages.sql (enveloppe v3)
--       audit/seo-sept-leviers-2026-09-11.md (P1 : D2 grain lossy, D3 couverture, D8 surface_key)
-- =====================================================
--
-- POURQUOI v4 (constats 2026-09-10) :
--  1. v3 somme `__seo_gsc_daily_pages` (page+country+device) qui restitue ~7 % des
--     clics → CTR par page sous-estimé ~10× → faux « low CTR ». v4 lit le grain fidèle.
--  2. v3 ne teste que le ratio impressions : statut `ok` (0,438) sur une fenêtre de
--     28 j où 13 jours manquaient et où le ratio clics valait ~0,1. v4 publie les
--     jours attendus/présents/manquants et teste impressions ET clics.
--  3. v3 passe l'URL absolue à `_seo_resolve_surface_key` (motifs ancrés sur le
--     chemin) → `unknown` pour toutes les lignes. v4 lui passe le chemin.
--  4. position moyenne pondérée par les impressions (v3 : moyenne des positions
--     journalières, biaisée vers les jours à faible volume).
--
-- Jours pris en compte = jours COMMITÉS (`commit_version` non NULL) : un jour
-- partiellement importé n'entre ni dans le numérateur ni dans le dénominateur.
-- Jours attendus = [max(début de fenêtre, p_expected_from) .. dernier jour commité] ;
-- le retard de fraîcheur en queue de fenêtre est porté par `last_data_date`
-- (SLA consommateur), pas compté deux fois ici.
--
-- Enveloppe v3 conservée (rows/total_qualifying/data_from/data_to/last_data_date/
-- impact_score_version/coverage_ratio/coverage_status) + grain, days_expected,
-- days_present, missing_dates, clicks_coverage_ratio, impressions_coverage_ratio ;
-- coverage_status ∈ ok | coverage_gap | insufficient_data | incomplete_days.
-- Additive (v3 inchangée) · STABLE read-only · pas de BEGIN/COMMIT (squawk).
-- =====================================================

set lock_timeout = '5s';
set statement_timeout = '60s';

CREATE OR REPLACE FUNCTION public.rpc_seo_low_ctr_v4(
    p_window_days integer,
    p_now timestamptz DEFAULT now(),
    p_min_impressions integer DEFAULT 100,
    p_max_ctr numeric DEFAULT 0.01,
    p_limit integer DEFAULT 50,
    p_coverage_min_ratio numeric DEFAULT 0.9,  -- = SEO_GSC_PAGE_TOTALS_MIN_RATIO (le consommateur le passe toujours)
    p_expected_from date DEFAULT NULL          -- = SEO_GSC_BACKFILL_FLOOR_DATE : aucun jour n'est attendu avant
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $function$
  WITH bounds AS (
    SELECT (p_now::DATE - p_window_days) AS from_d, p_now::DATE AS to_d
  ),
  committed AS (
    SELECT pt.date, pt.clicks, pt.impressions
    FROM __seo_gsc_daily_property_total pt, bounds b
    WHERE pt.date >= b.from_d AND pt.date < b.to_d
      AND pt.commit_version IS NOT NULL
  ),
  day_bounds AS (
    SELECT MIN(date) AS data_from, MAX(date) AS data_to FROM committed
  ),
  expected AS (
    SELECT d::DATE AS date
    FROM bounds b
    CROSS JOIN day_bounds db
    -- timestamp (sans fuseau) explicite : date→timestamptz dépendrait du TimeZone de session
    CROSS JOIN LATERAL generate_series(
      GREATEST(b.from_d, COALESCE(p_expected_from, b.from_d))::TIMESTAMP,
      db.data_to::TIMESTAMP,
      INTERVAL '1 day'
    ) AS d
    WHERE db.data_to IS NOT NULL
  ),
  missing AS (
    SELECT e.date FROM expected e LEFT JOIN committed c USING (date)
    WHERE c.date IS NULL
  ),
  pages AS (
    SELECT p.page, p.clicks, p.impressions, p.position
    FROM __seo_gsc_daily_page_totals p
    JOIN committed c USING (date)
    CROSS JOIN bounds b
    WHERE p.date >= b.from_d AND p.date < b.to_d
  ),
  agg AS (
    SELECT
      page,
      SUM(impressions)::BIGINT AS impressions,
      SUM(clicks)::BIGINT AS clicks,
      ROUND((SUM(clicks)::NUMERIC / NULLIF(SUM(impressions), 0)), 4)::FLOAT8 AS ctr,
      ROUND((SUM(position::NUMERIC * impressions) / NULLIF(SUM(impressions), 0)), 2)::FLOAT8 AS avg_position
    FROM pages
    GROUP BY page
    HAVING SUM(impressions) >= p_min_impressions
       AND (SUM(clicks)::NUMERIC / NULLIF(SUM(impressions), 0)) <= p_max_ctr
  ),
  scored AS (
    SELECT
      page,
      _seo_resolve_surface_key(regexp_replace(page, '^https?://[^/]+', '')) AS surface_key,
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
  cov AS (
    SELECT
      COALESCE((SELECT SUM(clicks) FROM pages), 0)::BIGINT AS pages_clicks,
      COALESCE((SELECT SUM(impressions) FROM pages), 0)::BIGINT AS pages_impr,
      COALESCE((SELECT SUM(clicks) FROM committed), 0)::BIGINT AS prop_clicks,
      COALESCE((SELECT SUM(impressions) FROM committed), 0)::BIGINT AS prop_impr,
      (SELECT COUNT(*) FROM expected)::INT AS days_expected,
      (SELECT COUNT(*) FROM expected e JOIN committed c USING (date))::INT AS days_present,
      EXISTS (SELECT 1 FROM missing) AS has_missing
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
    'data_from', (SELECT data_from FROM day_bounds),
    'data_to', (SELECT data_to FROM day_bounds),
    'last_data_date', (SELECT data_to FROM day_bounds),
    'impact_score_version', 'v1',
    'grain', 'page_totals',
    'days_expected', (SELECT days_expected FROM cov),
    'days_present', (SELECT days_present FROM cov),
    'missing_dates', COALESCE((SELECT jsonb_agg(date ORDER BY date) FROM missing), '[]'::jsonb),
    'clicks_coverage_ratio', (
      SELECT CASE WHEN prop_clicks > 0
        THEN ROUND((pages_clicks::NUMERIC / prop_clicks), 4)::FLOAT8 END FROM cov
    ),
    'impressions_coverage_ratio', (
      SELECT CASE WHEN prop_impr > 0
        THEN ROUND((pages_impr::NUMERIC / prop_impr), 4)::FLOAT8 END FROM cov
    ),
    -- clé v3 conservée (= ratio impressions) pour les consommateurs existants
    'coverage_ratio', (
      SELECT CASE WHEN prop_impr > 0
        THEN ROUND((pages_impr::NUMERIC / prop_impr), 4)::FLOAT8 END FROM cov
    ),
    'coverage_status', (
      SELECT CASE
        WHEN prop_impr <= 0 THEN 'insufficient_data'
        WHEN (pages_impr::NUMERIC / prop_impr) < p_coverage_min_ratio
          OR (prop_clicks > 0 AND (pages_clicks::NUMERIC / prop_clicks) < p_coverage_min_ratio)
          THEN 'coverage_gap'
        WHEN has_missing THEN 'incomplete_days'
        ELSE 'ok' END FROM cov
    )
  );
$function$;

COMMENT ON FUNCTION public.rpc_seo_low_ctr_v4(integer, timestamptz, integer, numeric, integer, numeric, date) IS
  'SEO low-CTR v4 — grain page fidèle (__seo_gsc_daily_page_totals, jours commités) + couverture jours/clics/impressions + surface_key sur le chemin. Enveloppe v3 étendue. STABLE read-only. 2026-09-11.';

-- Nouvelle fonction : les privilèges par défaut Supabase accordent EXECUTE à anon/authenticated → retirés explicitement.
REVOKE ALL ON FUNCTION public.rpc_seo_low_ctr_v4(integer, timestamptz, integer, numeric, integer, numeric, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_seo_low_ctr_v4(integer, timestamptz, integer, numeric, integer, numeric, date) TO service_role;

-- =====================================================
-- Vérification post-apply (lecture seule)
-- =====================================================
--   SELECT rpc_seo_low_ctr_v4(28, now(), 100, 0.01, 50, 0.9, DATE '2026-06-01') - 'rows';
--   -- avant rattrapage : days_present = 0 (aucun jour commité) → insufficient_data, attendu
--   SELECT grantee, privilege_type FROM information_schema.routine_privileges
--     WHERE routine_name = 'rpc_seo_low_ctr_v4';   -- attendu : service_role (+ postgres propriétaire)
-- =====================================================

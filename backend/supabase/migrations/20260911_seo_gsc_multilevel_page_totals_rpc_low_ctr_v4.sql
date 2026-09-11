-- =====================================================
-- SEO Control — rpc_seo_low_ctr_v4 (grain page FIDÈLE, jours commités, récupération vs limite GSC)
-- Date: 2026-09-11
-- Refs: 20260911_seo_gsc_multilevel_page_totals.sql (table + commit_version, à appliquer AVANT)
--       20260614_seo_control_005_low_ctr_v3_pages.sql (enveloppe v3)
--       audit/seo-sept-leviers-2026-09-11.md (P1 : D2 grain lossy, D3 couverture, D8 surface_key)
-- =====================================================
--
-- POURQUOI v4 (constats 2026-09-10) :
--  1. v3 somme `__seo_gsc_daily_pages` (page+country+device) qui restitue ~7 % des
--     clics → CTR par page sous-estimé ~10× → faux « low CTR ». v4 lit le grain fidèle.
--  2. v3 ne juge la couverture que par un ratio impressions : statut `ok` (0,438) sur
--     une fenêtre de 28 j où 13 jours manquaient. Un ratio entre deux agrégations GSC
--     différentes (byPage vs propriété) ne prouve rien (≈ 1 n'est pas une preuve) et
--     ne doit pas imposer d'égalité. v4 publie SÉPARÉMENT :
--       a. couverture des jours importés : jours attendus / commités / manquants ;
--       b. récupération du grain demandé : jours commités avec impressions mais sans
--          ligne page (le fetcher refuse déjà ce cas ; contrôle de cohérence côté base) ;
--       c. limite GSC : ratios byPage/propriété, information NON bloquante.
--  3. v3 passe l'URL absolue à `_seo_resolve_surface_key` (motifs ancrés sur le
--     chemin) → `unknown` pour toutes les lignes. v4 lui passe le chemin.
--  4. position moyenne pondérée par les impressions (v3 : moyenne des positions
--     journalières, biaisée vers les jours à faible volume).
--  5. bornes de fenêtre en jours UTC explicites (v3 : jour du TimeZone de session).
--
-- Jours pris en compte = jours COMMITÉS (`commit_version` non NULL) : un jour
-- partiellement importé, ou en cours de réécriture (marqueur retiré par le fetcher
-- avant réécriture), n'entre ni dans le numérateur ni dans le dénominateur.
-- Jours attendus = [max(début de fenêtre, p_expected_from) .. dernier jour commité] ;
-- le retard de fraîcheur en queue de fenêtre est porté par `last_data_date`
-- (SLA consommateur), pas compté deux fois ici.
--
-- Enveloppe v3 conservée (rows/total_qualifying/data_from/data_to/last_data_date/
-- impact_score_version/coverage_status) + grain, days_expected, days_present,
-- missing_dates, retrieval_status, retrieval_gap_dates, gsc_aggregation.
-- coverage_status (synthèse consommateur, SANS ratio) :
--   insufficient_data (aucune impression commitée) > coverage_gap (récupération
--   incomplète) > incomplete_days (jours manquants) > ok.
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
    p_expected_from date DEFAULT NULL          -- = SEO_GSC_BACKFILL_FLOOR_DATE : aucun jour n'est attendu avant
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $function$
  WITH bounds AS (
    -- Jours UTC explicites : p_now::DATE dépendrait du TimeZone de la session
    -- (fenêtre décalée d'un jour en America/Los_Angeles, banc SQL S9).
    SELECT ((p_now AT TIME ZONE 'UTC')::DATE - p_window_days) AS from_d,
           (p_now AT TIME ZONE 'UTC')::DATE AS to_d
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
    SELECT p.date, p.page, p.clicks, p.impressions, p.position
    FROM __seo_gsc_daily_page_totals p
    JOIN committed c USING (date)
    CROSS JOIN bounds b
    WHERE p.date >= b.from_d AND p.date < b.to_d
  ),
  page_days AS (
    SELECT DISTINCT date FROM pages
  ),
  -- Jour commité avec impressions mais sans aucune ligne page : grain non récupéré.
  retrieval_gaps AS (
    SELECT c.date FROM committed c LEFT JOIN page_days pd USING (date)
    WHERE c.impressions > 0 AND pd.date IS NULL
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
      (SELECT COUNT(*) FROM committed)::INT AS days_committed,
      EXISTS (SELECT 1 FROM missing) AS has_missing,
      EXISTS (SELECT 1 FROM retrieval_gaps) AS has_retrieval_gap
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
    -- a. Couverture des jours importés (jours COMMITÉS)
    'days_expected', (SELECT days_expected FROM cov),
    'days_present', (SELECT days_present FROM cov),
    'missing_dates', COALESCE((SELECT jsonb_agg(date ORDER BY date) FROM missing), '[]'::jsonb),
    -- b. Récupération du grain demandé sur les jours commités
    'retrieval_status', (
      SELECT CASE
        WHEN days_committed = 0 THEN 'unknown'
        WHEN has_retrieval_gap THEN 'gap'
        ELSE 'complete' END FROM cov
    ),
    'retrieval_gap_dates', COALESCE((SELECT jsonb_agg(date ORDER BY date) FROM retrieval_gaps), '[]'::jsonb),
    -- c. Limite GSC : deux agrégations différentes, aucune égalité attendue (information)
    'gsc_aggregation', (
      SELECT jsonb_build_object(
        'page_vs_property_clicks_ratio',
          CASE WHEN prop_clicks > 0 THEN ROUND((pages_clicks::NUMERIC / prop_clicks), 4)::FLOAT8 END,
        'page_vs_property_impressions_ratio',
          CASE WHEN prop_impr > 0 THEN ROUND((pages_impr::NUMERIC / prop_impr), 4)::FLOAT8 END,
        'blocking', false
      ) FROM cov
    ),
    'coverage_status', (
      SELECT CASE
        WHEN prop_impr <= 0 THEN 'insufficient_data'
        WHEN has_retrieval_gap THEN 'coverage_gap'
        WHEN has_missing THEN 'incomplete_days'
        ELSE 'ok' END FROM cov
    )
  );
$function$;

COMMENT ON FUNCTION public.rpc_seo_low_ctr_v4(integer, timestamptz, integer, numeric, integer, date) IS
  'SEO low-CTR v4 — grain page fidèle (__seo_gsc_daily_page_totals, jours commités) ; couverture jours, récupération du grain et écart d''agrégation GSC publiés séparément (le ratio ne décide pas du statut) ; surface_key sur le chemin. STABLE read-only. 2026-09-11.';

-- Nouvelle fonction : les privilèges par défaut Supabase accordent EXECUTE à anon/authenticated → retirés explicitement.
REVOKE ALL ON FUNCTION public.rpc_seo_low_ctr_v4(integer, timestamptz, integer, numeric, integer, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_seo_low_ctr_v4(integer, timestamptz, integer, numeric, integer, date) TO service_role;

-- =====================================================
-- Vérification post-apply (lecture seule)
-- =====================================================
--   SELECT rpc_seo_low_ctr_v4(28, now(), 100, 0.01, 50, DATE '2026-06-01') - 'rows';
--   -- avant rattrapage : days_present = 0 (aucun jour commité) → insufficient_data, attendu
--   SELECT grantee, privilege_type FROM information_schema.routine_privileges
--     WHERE routine_name = 'rpc_seo_low_ctr_v4';   -- attendu : service_role (+ postgres propriétaire)
-- =====================================================

-- =====================================================
-- SEO GSC — filtre des requêtes synthétiques internes (^ai[0-9]+$)
-- Date: 2026-06-11
-- Refs: 20260518_seo_control_001_helpers.sql / 002_rpcs.sql (définitions d'origine)
--       20260521_seo_sitemap_freshness_001_alert_rpc.sql (baseline COURANTE de
--         rpc_seo_alerts_v1 — sources A+B+C ; reproduire 20260518 ici effacerait
--         silencieusement l'alerte SITEMAP_STALE_V1)
--       MEMORY feedback_gsc_ai_type_id_synthetic_query_pattern (« filtrer ai\d+ avant CTR »)
-- =====================================================
--
-- Problème mesuré (audit 2026-06-11) : __seo_gsc_daily contient des requêtes
-- synthétiques internes (type_id, pattern ^ai[0-9]+$ — 0 clic, impressions non
-- humaines). Aucune couche ne les filtrait : l'opportunité SEO n°1 du Command
-- Center (2 283 impressions, « ranke pos. 5.2 ») était 100 % synthétique, et
-- 5/50 pages de rpc_seo_low_ctr_v1 étaient des fantômes (+46 % d'impressions
-- sur le bucket produit).
--
-- Fix structurel :
--   1. _seo_is_synthetic_query(text) — prédicat unique (single source of truth).
--   2. CREATE OR REPLACE des 4 RPC + 1 helper lisant __seo_gsc_daily : même
--      corps, même signature, même forme de sortie — seul ajout = le filtre.
--      (OR REPLACE préserve les GRANTs existants.)
--   3. rpc_seo_low_ctr_v2 — enveloppe honnête {rows, total_qualifying,
--      data_from, data_to, last_data_date} pour divulguer le cap p_limit et la
--      couverture réelle des données (la v1 reste servie pour ses consommateurs).
--
-- La donnée brute reste intacte (aucune ligne supprimée) : le synthétique reste
-- requêtable pour le monitoring interne ; il est exclu des agrégats DÉCISIONNELS.

set lock_timeout = '2s';
set statement_timeout = '5s';

-- ─── Prédicat unique : requête GSC synthétique interne ───────────
CREATE OR REPLACE FUNCTION _seo_is_synthetic_query(p_query TEXT)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  -- type_id internes émis par les sondes (ex. ai62935) — jamais une requête humaine.
  -- NULL (ligne GSC anonymisée) = non-synthétique : on la garde.
  SELECT COALESCE(p_query ~ '^ai[0-9]+$', FALSE);
$$;
COMMENT ON FUNCTION _seo_is_synthetic_query(TEXT) IS
  'Prédicat unique requête GSC synthétique interne (^ai[0-9]+$, type_id sondes). Utilisé par les RPC d''agrégation __seo_gsc_daily pour exclure le trafic non humain des agrégats décisionnels. NULL → FALSE.';

-- ─── RPC 1 : Traffic Window — + filtre synthétique ───────────────
CREATE OR REPLACE FUNCTION rpc_seo_traffic_v1(
  p_window_days INT,
  p_now TIMESTAMPTZ DEFAULT NOW()
) RETURNS JSONB LANGUAGE sql STABLE AS $$
  WITH bounds AS (
    SELECT
      (p_now::DATE - p_window_days) AS from_d,
      p_now::DATE AS to_d,
      (p_now::DATE - p_window_days * 2) AS prev_from_d,
      (p_now::DATE - p_window_days) AS prev_to_d
  ),
  curr AS (
    SELECT
      COALESCE(SUM(clicks), 0)::BIGINT AS c,
      COALESCE(SUM(impressions), 0)::BIGINT AS i,
      AVG(position)::FLOAT8 AS pos,
      COUNT(DISTINCT page)::BIGINT AS pc
    FROM __seo_gsc_daily, bounds
    WHERE date >= bounds.from_d AND date < bounds.to_d
      AND NOT _seo_is_synthetic_query(query)
  ),
  prev AS (
    SELECT
      COALESCE(SUM(clicks), 0)::BIGINT AS c,
      COALESCE(SUM(impressions), 0)::BIGINT AS i
    FROM __seo_gsc_daily, bounds
    WHERE date >= bounds.prev_from_d AND date < bounds.prev_to_d
      AND NOT _seo_is_synthetic_query(query)
  )
  SELECT jsonb_build_object(
    'impact_score_version', 'v1',
    'clicks', curr.c,
    'impressions', curr.i,
    'ctr', CASE WHEN curr.i > 0
                THEN ROUND((curr.c::NUMERIC / curr.i) * 100, 2)::FLOAT8
                ELSE 0::FLOAT8 END,
    'avg_position', COALESCE(ROUND(curr.pos::NUMERIC, 2)::FLOAT8, 0::FLOAT8),
    'pages_count', curr.pc,
    'delta_vs_previous', jsonb_build_object(
      'clicks_pct', CASE WHEN prev.c > 0
                         THEN ROUND(((curr.c - prev.c)::NUMERIC / prev.c) * 100, 1)::FLOAT8
                         ELSE NULL END,
      'impressions_pct', CASE WHEN prev.i > 0
                              THEN ROUND(((curr.i - prev.i)::NUMERIC / prev.i) * 100, 1)::FLOAT8
                              ELSE NULL END,
      'direction', CASE
        WHEN prev.c = 0 THEN 'unknown'
        WHEN curr.c::NUMERIC > prev.c::NUMERIC * 1.05 THEN 'up'
        WHEN curr.c::NUMERIC < prev.c::NUMERIC * 0.95 THEN 'down'
        ELSE 'flat' END,
      'change_severity', CASE
        WHEN prev.c > 0 AND curr.c::NUMERIC < prev.c::NUMERIC * 0.80 THEN 'high'
        WHEN prev.c > 0 AND curr.c::NUMERIC < prev.c::NUMERIC * 0.90 THEN 'medium'
        ELSE 'info' END
    )
  ) FROM curr, prev;
$$;
COMMENT ON FUNCTION rpc_seo_traffic_v1(INT, TIMESTAMPTZ) IS
  'PR-SBD-1 v1 — Aggregated GSC traffic over window + delta vs previous window. Deterministic via p_now. impact_score_version=v1. 2026-06-11 : exclut les requêtes synthétiques (_seo_is_synthetic_query).';

-- ─── RPC 2 : Top Losers — + filtre synthétique ───────────────────
CREATE OR REPLACE FUNCTION rpc_seo_top_losers_v1(
  p_window_days INT,
  p_now TIMESTAMPTZ DEFAULT NOW(),
  p_limit INT DEFAULT 20
) RETURNS JSONB LANGUAGE sql STABLE AS $$
  WITH bounds AS (
    SELECT
      (p_now::DATE - p_window_days) AS from_d,
      p_now::DATE AS to_d,
      (p_now::DATE - p_window_days * 2) AS prev_from_d,
      (p_now::DATE - p_window_days) AS prev_to_d
  ),
  curr AS (
    SELECT
      page,
      SUM(clicks)::BIGINT AS clicks,
      SUM(impressions)::BIGINT AS impressions,
      AVG(position)::FLOAT8 AS position
    FROM __seo_gsc_daily, bounds
    WHERE date >= bounds.from_d AND date < bounds.to_d
      AND NOT _seo_is_synthetic_query(query)
    GROUP BY page
  ),
  prev AS (
    SELECT
      page,
      SUM(clicks)::BIGINT AS clicks,
      AVG(position)::FLOAT8 AS position
    FROM __seo_gsc_daily, bounds
    WHERE date >= bounds.prev_from_d AND date < bounds.prev_to_d
      AND NOT _seo_is_synthetic_query(query)
    GROUP BY page
  ),
  joined AS (
    SELECT
      curr.page,
      _seo_resolve_surface_key(curr.page) AS surface_key,
      curr.clicks AS clicks_current,
      COALESCE(prev.clicks, 0)::BIGINT AS clicks_previous,
      (curr.clicks - COALESCE(prev.clicks, 0))::BIGINT AS delta_clicks,
      CASE WHEN COALESCE(prev.clicks, 0) > 0
           THEN ROUND(((curr.clicks - prev.clicks)::NUMERIC / prev.clicks) * 100, 1)::FLOAT8
           ELSE NULL END AS delta_pct,
      curr.impressions AS impressions_current,
      COALESCE(ROUND(curr.position::NUMERIC, 2)::FLOAT8, NULL::FLOAT8) AS position_current,
      ROUND(COALESCE(curr.position - prev.position, 0)::NUMERIC, 2)::FLOAT8 AS position_delta,
      ROUND(
        (ABS(curr.clicks - COALESCE(prev.clicks, 0))::NUMERIC
        * GREATEST(0::NUMERIC, (11::NUMERIC - LEAST(COALESCE(curr.position, 50)::NUMERIC, 50::NUMERIC))) / 10.0::NUMERIC)::NUMERIC,
        2
      )::FLOAT8 AS business_impact_score,
      CASE
        WHEN curr.clicks::NUMERIC < COALESCE(prev.clicks, 0)::NUMERIC * 0.50 THEN 'critical'
        WHEN curr.clicks::NUMERIC < COALESCE(prev.clicks, 0)::NUMERIC * 0.75 THEN 'high'
        WHEN curr.clicks::NUMERIC < COALESCE(prev.clicks, 0)::NUMERIC * 0.90 THEN 'medium'
        ELSE 'low' END AS severity
    FROM curr LEFT JOIN prev USING (page)
    WHERE curr.clicks < COALESCE(prev.clicks, 0)
    ORDER BY business_impact_score DESC, delta_clicks ASC
    LIMIT p_limit
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'page', j.page,
        'surface_key', j.surface_key,
        'clicks_current', j.clicks_current,
        'clicks_previous', j.clicks_previous,
        'delta_clicks', j.delta_clicks,
        'delta_pct', j.delta_pct,
        'impressions_current', j.impressions_current,
        'position_current', j.position_current,
        'position_delta', j.position_delta,
        'business_impact_score', j.business_impact_score,
        'impact_score_version', 'v1',
        'severity', j.severity,
        'top_queries_sample', _seo_top_queries_for_page_jsonb(j.page, p_window_days, p_now, 3)
      )
      ORDER BY j.business_impact_score DESC
    ),
    '[]'::jsonb
  )
  FROM joined j;
$$;
COMMENT ON FUNCTION rpc_seo_top_losers_v1(INT, TIMESTAMPTZ, INT) IS
  'PR-SBD-1 v1 — Top N pages losing clicks vs previous window. Each row : surface_key, business_impact_score (pos-weighted), severity, top_queries_sample (≤3 LATERAL). 2026-06-11 : exclut les requêtes synthétiques (_seo_is_synthetic_query).';

-- ─── RPC 3 : Low CTR Opportunities — + filtre synthétique ────────
CREATE OR REPLACE FUNCTION rpc_seo_low_ctr_v1(
  p_window_days INT,
  p_now TIMESTAMPTZ DEFAULT NOW(),
  p_min_impressions INT DEFAULT 100,
  p_max_ctr NUMERIC DEFAULT 0.01,
  p_limit INT DEFAULT 50
) RETURNS JSONB LANGUAGE sql STABLE AS $$
  WITH bounds AS (
    SELECT
      (p_now::DATE - p_window_days) AS from_d,
      p_now::DATE AS to_d
  ),
  agg AS (
    SELECT
      page,
      SUM(impressions)::BIGINT AS impressions,
      SUM(clicks)::BIGINT AS clicks,
      ROUND((SUM(clicks)::NUMERIC / NULLIF(SUM(impressions), 0)), 4)::FLOAT8 AS ctr,
      ROUND(AVG(position)::NUMERIC, 2)::FLOAT8 AS avg_position
    FROM __seo_gsc_daily, bounds
    WHERE date >= bounds.from_d AND date < bounds.to_d
      AND NOT _seo_is_synthetic_query(query)
    GROUP BY page
    HAVING SUM(impressions) >= p_min_impressions
       AND (SUM(clicks)::NUMERIC / NULLIF(SUM(impressions), 0)) <= p_max_ctr
  ),
  scored AS (
    SELECT
      page,
      _seo_resolve_surface_key(page) AS surface_key,
      impressions,
      clicks,
      ctr,
      avg_position,
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
  )
  SELECT COALESCE(
    jsonb_agg(
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
    ),
    '[]'::jsonb
  )
  FROM (
    SELECT * FROM scored ORDER BY business_impact_score DESC LIMIT p_limit
  ) s;
$$;
COMMENT ON FUNCTION rpc_seo_low_ctr_v1(INT, TIMESTAMPTZ, INT, NUMERIC, INT) IS
  'PR-SBD-1 v1 — Pages with impressions but low CTR. impact_score = potential clicks lost (impressions × (expected_ctr_by_band - actual_ctr)). 2026-06-11 : exclut les requêtes synthétiques (_seo_is_synthetic_query).';

-- ─── RPC 3bis : Low CTR v2 — enveloppe honnête (cap + couverture) ─
-- Même filtre/score que v1, mais la sortie divulgue ce que la v1 cache :
--   total_qualifying  = nb de pages qualifiantes AVANT le LIMIT p_limit
--   data_from/data_to = couverture réelle des données dans la fenêtre demandée
--   last_data_date    = dernière date ingérée (check de fraîcheur consommateur)
CREATE OR REPLACE FUNCTION rpc_seo_low_ctr_v2(
  p_window_days INT,
  p_now TIMESTAMPTZ DEFAULT NOW(),
  p_min_impressions INT DEFAULT 100,
  p_max_ctr NUMERIC DEFAULT 0.01,
  p_limit INT DEFAULT 50
) RETURNS JSONB LANGUAGE sql STABLE AS $$
  WITH bounds AS (
    SELECT
      (p_now::DATE - p_window_days) AS from_d,
      p_now::DATE AS to_d
  ),
  agg AS (
    SELECT
      page,
      SUM(impressions)::BIGINT AS impressions,
      SUM(clicks)::BIGINT AS clicks,
      ROUND((SUM(clicks)::NUMERIC / NULLIF(SUM(impressions), 0)), 4)::FLOAT8 AS ctr,
      ROUND(AVG(position)::NUMERIC, 2)::FLOAT8 AS avg_position
    FROM __seo_gsc_daily, bounds
    WHERE date >= bounds.from_d AND date < bounds.to_d
      AND NOT _seo_is_synthetic_query(query)
    GROUP BY page
    HAVING SUM(impressions) >= p_min_impressions
       AND (SUM(clicks)::NUMERIC / NULLIF(SUM(impressions), 0)) <= p_max_ctr
  ),
  scored AS (
    SELECT
      page,
      _seo_resolve_surface_key(page) AS surface_key,
      impressions,
      clicks,
      ctr,
      avg_position,
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
  coverage AS (
    SELECT MIN(date) AS data_from, MAX(date) AS data_to
    FROM __seo_gsc_daily, bounds
    WHERE date >= bounds.from_d AND date < bounds.to_d
      AND NOT _seo_is_synthetic_query(query)
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
      FROM (
        SELECT * FROM scored ORDER BY business_impact_score DESC LIMIT p_limit
      ) s),
      '[]'::jsonb
    ),
    'total_qualifying', (SELECT COUNT(*) FROM agg),
    'data_from', (SELECT data_from FROM coverage),
    'data_to', (SELECT data_to FROM coverage),
    -- Borné à la fenêtre (partition pruning) : ingestion arrêtée au-delà de la
    -- fenêtre → NULL → freshness 'unknown' côté consommateur (dégradé, honnête).
    'last_data_date', (
      SELECT MAX(date) FROM __seo_gsc_daily, bounds
      WHERE date >= bounds.from_d AND date < bounds.to_d
    ),
    'impact_score_version', 'v1'
  );
$$;
COMMENT ON FUNCTION rpc_seo_low_ctr_v2(INT, TIMESTAMPTZ, INT, NUMERIC, INT) IS
  '2026-06-11 — Low CTR v2 : mêmes filtres/score que v1 (synthétique exclu) + enveloppe honnête {rows, total_qualifying (avant LIMIT), data_from/data_to (couverture réelle), last_data_date (fraîcheur)}. Consommateur : Command Center owner-action queue.';

REVOKE ALL ON FUNCTION rpc_seo_low_ctr_v2(INT, TIMESTAMPTZ, INT, NUMERIC, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rpc_seo_low_ctr_v2(INT, TIMESTAMPTZ, INT, NUMERIC, INT) TO service_role;

-- ─── RPC 4 : Alerts — + filtre synthétique (pondération trafic) ──
-- Baseline = 20260521_seo_sitemap_freshness_001_alert_rpc.sql (sources A+B+C,
-- définition la plus récente du repo — PAS 20260518 qui n'a que A+B).
CREATE OR REPLACE FUNCTION rpc_seo_alerts_v1(
  p_now TIMESTAMPTZ DEFAULT NOW(),
  p_limit INT DEFAULT 50
) RETURNS JSONB LANGUAGE sql STABLE AS $$
  WITH unified AS (
    -- Source A : audit findings unresolved (severity critical|high|medium)
    SELECT
      'audit_findings'::TEXT AS source,
      audit_type::TEXT AS alert_type,
      entity_url,
      severity::TEXT AS severity,
      detected_at,
      COALESCE(
        jsonb_strip_nulls(jsonb_build_object(
          'reason', payload->>'reason',
          'metric', payload->>'metric',
          'expected', payload->'expected'
        )),
        '{}'::jsonb
      ) AS payload_minimal
    FROM __seo_audit_findings
    WHERE resolved_at IS NULL
      AND severity IN ('critical', 'high', 'medium')
    UNION ALL
    -- Source B : event log unresolved (severity critical|high, anomalies+ingestion failures)
    SELECT
      'event_log'::TEXT,
      event_type::TEXT,
      entity_url,
      severity::TEXT,
      created_at,
      COALESCE(
        jsonb_strip_nulls(jsonb_build_object(
          'reason', payload->>'reason',
          'source', payload->>'source',
          'count', payload->'count'
        )),
        '{}'::jsonb
      )
    FROM __seo_event_log
    WHERE resolved_at IS NULL
      AND severity IN ('critical', 'high')
      AND event_type IN ('anomaly_detected', 'alert_sent', 'ingestion_run_failed')
    UNION ALL
    -- Source C : sitemap freshness — alert on ABSENCE of a completion heartbeat >26h
    -- (étape 2). Une seule ligne synthétique quand aucun `sitemap_generation_complete`
    -- récent n'existe. Réutilise __seo_event_log (#601), aucune surface externe.
    SELECT
      'sitemap_freshness'::TEXT,
      'SITEMAP_STALE_V1'::TEXT,
      NULL::TEXT,
      'high'::TEXT,
      p_now,
      jsonb_build_object(
        'reason', 'no sitemap_generation_complete heartbeat in last 26h',
        'threshold_hours', 26
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM __seo_event_log
      WHERE event_type = 'sitemap_generation_complete'
        AND created_at > p_now - INTERVAL '26 hours'
    )
  ),
  enriched AS (
    SELECT
      u.source,
      u.alert_type,
      u.entity_url,
      u.severity,
      u.detected_at,
      u.payload_minimal,
      _seo_resolve_operational_domain(u.alert_type) AS operational_domain,
      _seo_resolve_surface_key(u.entity_url) AS surface_key,
      ROUND(
        ((CASE u.severity
          WHEN 'critical' THEN 10
          WHEN 'high' THEN 5
          WHEN 'medium' THEN 2
          ELSE 1 END)::NUMERIC
        * (1 + COALESCE(LOG(GREATEST(1, COALESCE(gsc.clicks_7d, 0))), 0))::NUMERIC)::NUMERIC,
        2
      )::FLOAT8 AS business_impact_score
    FROM unified u
    LEFT JOIN LATERAL (
      SELECT SUM(clicks)::BIGINT AS clicks_7d
      FROM __seo_gsc_daily
      WHERE page = u.entity_url
        AND date >= p_now::DATE - 7
        AND date < p_now::DATE
        AND NOT _seo_is_synthetic_query(query)
    ) gsc ON TRUE
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'source', e.source,
        'alert_type', e.alert_type,
        'entity_url', e.entity_url,
        'surface_key', e.surface_key,
        'operational_domain', e.operational_domain,
        'severity', e.severity,
        'detected_at', e.detected_at,
        'payload_minimal', e.payload_minimal,
        'business_impact_score', e.business_impact_score,
        'impact_score_version', 'v1'
      )
      ORDER BY e.business_impact_score DESC, e.detected_at DESC
    ),
    '[]'::jsonb
  )
  FROM (
    SELECT *
    FROM enriched
    ORDER BY business_impact_score DESC, detected_at DESC
    LIMIT p_limit
  ) e;
$$;
COMMENT ON FUNCTION rpc_seo_alerts_v1(TIMESTAMPTZ, INT) IS
  'PR-SBD-1 v1 + étape 2 — Unresolved alerts UNION (audit_findings + event_log + sitemap freshness absence SITEMAP_STALE_V1) with operational_domain + surface_key + business_impact_score (severity weighted by page traffic). payload_minimal ≤ 3 keys (anti-bloat). 2026-06-11 : pondération trafic hors requêtes synthétiques (_seo_is_synthetic_query).';

-- CREATE OR REPLACE preserves privileges, but re-state them explicitly (canon 002_rpcs).
REVOKE ALL ON FUNCTION rpc_seo_alerts_v1(TIMESTAMPTZ, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rpc_seo_alerts_v1(TIMESTAMPTZ, INT) TO service_role;

-- ─── Helper : top queries per page — + filtre synthétique ────────
CREATE OR REPLACE FUNCTION _seo_top_queries_for_page_jsonb(
  p_page TEXT,
  p_window_days INT,
  p_now TIMESTAMPTZ,
  p_limit INT DEFAULT 3
) RETURNS JSONB LANGUAGE sql STABLE AS $$
  WITH bounds AS (
    SELECT
      (p_now::DATE - p_window_days) AS from_d,
      p_now::DATE AS to_d,
      (p_now::DATE - p_window_days * 2) AS prev_from_d,
      (p_now::DATE - p_window_days) AS prev_to_d
  ),
  curr AS (
    SELECT
      query,
      SUM(clicks)::INT AS c,
      SUM(impressions)::INT AS i,
      AVG(position)::FLOAT8 AS pos
    FROM __seo_gsc_daily, bounds
    WHERE page = p_page
      AND date >= bounds.from_d
      AND date < bounds.to_d
      AND query IS NOT NULL
      AND NOT _seo_is_synthetic_query(query)
    GROUP BY query
  ),
  prev AS (
    SELECT
      query,
      SUM(clicks)::INT AS c
    FROM __seo_gsc_daily, bounds
    WHERE page = p_page
      AND date >= bounds.prev_from_d
      AND date < bounds.prev_to_d
      AND query IS NOT NULL
      AND NOT _seo_is_synthetic_query(query)
    GROUP BY query
  ),
  joined AS (
    SELECT
      curr.query,
      (curr.c - COALESCE(prev.c, 0))::INT AS clicks_delta,
      ROUND(curr.pos::NUMERIC, 2)::FLOAT8 AS position_current
    FROM curr
    LEFT JOIN prev USING (query)
    ORDER BY ABS(curr.c - COALESCE(prev.c, 0)) DESC
    LIMIT p_limit
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'query', query,
        'clicks_delta', clicks_delta,
        'position_current', position_current
      )
      ORDER BY ABS(clicks_delta) DESC
    ),
    '[]'::jsonb
  )
  FROM joined;
$$;
COMMENT ON FUNCTION _seo_top_queries_for_page_jsonb(TEXT, INT, TIMESTAMPTZ, INT) IS
  'PR-SBD-1 v1 — Top N queries (delta clicks) for a page. Private helper (no GRANT). 2026-06-11 : exclut les requêtes synthétiques (_seo_is_synthetic_query).';

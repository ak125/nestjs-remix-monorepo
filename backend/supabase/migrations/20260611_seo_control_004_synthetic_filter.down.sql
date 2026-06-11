-- Down : restaure les définitions d'origine (sans filtre synthétique) des 4 RPC
-- + helper, et supprime rpc_seo_low_ctr_v2 + _seo_is_synthetic_query.
-- APPROVED: rollback only — down.sql is the inverse of the matching up.sql, never executed in normal flow
-- Sources des corps restaurés : 20260518_seo_control_001_helpers.sql / 002_rpcs.sql.

set lock_timeout = '2s';
set statement_timeout = '5s';

DROP FUNCTION IF EXISTS rpc_seo_low_ctr_v2(INT, TIMESTAMPTZ, INT, NUMERIC, INT);

-- ─── RPC 1 : Traffic Window (définition d'origine) ───────────────
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
  ),
  prev AS (
    SELECT
      COALESCE(SUM(clicks), 0)::BIGINT AS c,
      COALESCE(SUM(impressions), 0)::BIGINT AS i
    FROM __seo_gsc_daily, bounds
    WHERE date >= bounds.prev_from_d AND date < bounds.prev_to_d
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
  'PR-SBD-1 v1 — Aggregated GSC traffic over window + delta vs previous window. Deterministic via p_now. impact_score_version=v1.';

-- ─── RPC 2 : Top Losers (définition d'origine) ───────────────────
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
    GROUP BY page
  ),
  prev AS (
    SELECT
      page,
      SUM(clicks)::BIGINT AS clicks,
      AVG(position)::FLOAT8 AS position
    FROM __seo_gsc_daily, bounds
    WHERE date >= bounds.prev_from_d AND date < bounds.prev_to_d
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
  'PR-SBD-1 v1 — Top N pages losing clicks vs previous window. Each row : surface_key, business_impact_score (pos-weighted), severity, top_queries_sample (≤3 LATERAL).';

-- ─── RPC 3 : Low CTR Opportunities (définition d'origine) ────────
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
  'PR-SBD-1 v1 — Pages with impressions but low CTR. impact_score = potential clicks lost (impressions × (expected_ctr_by_band - actual_ctr)).';

-- ─── RPC 4 : Alerts (définition 20260521 — état antérieur à 20260611) ──
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
  'PR-SBD-1 v1 + étape 2 — Unresolved alerts UNION (audit_findings + event_log + sitemap freshness absence SITEMAP_STALE_V1) with operational_domain + surface_key + business_impact_score (severity weighted by page traffic). payload_minimal ≤ 3 keys (anti-bloat).';

-- CREATE OR REPLACE preserves privileges, but re-state them explicitly (canon 002_rpcs).
REVOKE ALL ON FUNCTION rpc_seo_alerts_v1(TIMESTAMPTZ, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rpc_seo_alerts_v1(TIMESTAMPTZ, INT) TO service_role;

-- ─── Helper : top queries per page (définition d'origine) ────────
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
  'PR-SBD-1 v1 — Top N (default 3) queries delta clicks for a page over a window. Used by rpc_seo_top_losers_v1 to provide diagnostic context (ranking vs CTR vs cannibalisation).';

DROP FUNCTION IF EXISTS _seo_is_synthetic_query(TEXT);

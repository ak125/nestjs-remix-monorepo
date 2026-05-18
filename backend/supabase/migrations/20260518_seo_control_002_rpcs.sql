-- =====================================================
-- PR-SBD-1 Task 1 Steps 4-10 — 5 public RPCs + wrapper + GRANT
-- Date: 2026-05-18
-- Refs: docs/seo/audit-orders-cart-link.md
--       .claude/plans/verifier-existant-avant-et-ethereal-firefly.md
--       backend/supabase/migrations/20260518_seo_control_001_helpers.sql
-- =====================================================
--
-- 5 deterministic STABLE RPCs (1 per dashboard block) + 1 aggregation wrapper
-- for synthetic monitoring / forensic replay. Runtime cache (Task 4) uses the
-- 5 individual RPCs (per-block cache), NOT the wrapper.
--
-- All return JSONB with bounded sizes :
--   topLosers ≤ 20 · lowCtr ≤ 50 · alerts ≤ 50 · conversion ≤ 20
--   top_queries_sample ≤ 3 · payload_minimal ≤ 3 keys
--
-- Numeric fields cast ::FLOAT8 (not NUMERIC) for supabase-js compatibility
-- (NUMERIC arrives as string in JS, FLOAT8 as number → Zod z.number() works).
--
-- impact_score_version='v1' embedded in every scored row for forensic replay
-- and future v2 scoring migration audit.
-- =====================================================

-- ─── RPC 1 : Traffic Window with delta vs previous ───────────────
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

-- ─── RPC 2 : Top Losers (page-level) ─────────────────────────────
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
        ABS(curr.clicks - COALESCE(prev.clicks, 0))::NUMERIC
        * GREATEST(0, (11 - LEAST(COALESCE(curr.position, 50)::NUMERIC, 50))) / 10.0,
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

-- ─── RPC 3 : Low CTR Opportunities ───────────────────────────────
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
        impressions::NUMERIC
        * GREATEST(0, (CASE
            WHEN avg_position <= 5 THEN 0.05
            WHEN avg_position <= 15 THEN 0.02
            ELSE 0.005 END) - ctr),
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

-- ─── RPC 4 : Technical Alerts (unresolved findings + critical events) ──
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
        (CASE u.severity
          WHEN 'critical' THEN 10
          WHEN 'high' THEN 5
          WHEN 'medium' THEN 2
          ELSE 1 END)::NUMERIC
        * (1 + COALESCE(LOG(GREATEST(1, COALESCE(gsc.clicks_7d, 0))), 0)),
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
  'PR-SBD-1 v1 — Unresolved alerts UNION (audit_findings + event_log) with operational_domain + surface_key + business_impact_score (severity weighted by page traffic). payload_minimal ≤ 3 keys (anti-bloat).';

-- ─── RPC 5 : Conversion Gap (sessions vs paid orders by URL) ─────
-- VERDICT GO confirmed in docs/seo/audit-orders-cart-link.md
-- JOIN __seo_ga4_daily.page ↔ ___xtr_order_line.orl_website_url filtered ord_is_pay='1'
CREATE OR REPLACE FUNCTION rpc_seo_conversion_v1(
  p_window_days INT,
  p_now TIMESTAMPTZ DEFAULT NOW(),
  p_limit INT DEFAULT 20
) RETURNS JSONB LANGUAGE sql STABLE AS $$
  WITH bounds AS (
    SELECT
      (p_now::DATE - p_window_days) AS from_d,
      p_now::DATE AS to_d
  ),
  traffic AS (
    SELECT
      page,
      SUM(sessions)::BIGINT AS sessions
    FROM __seo_ga4_daily, bounds
    WHERE date >= bounds.from_d AND date < bounds.to_d
    GROUP BY page
    HAVING SUM(sessions) > 50
  ),
  conv AS (
    -- Aggregated per URL (one order with N lines = N rows, intentional V1)
    SELECT
      ol.orl_website_url AS page,
      COUNT(DISTINCT ol.orl_ord_id)::BIGINT AS orders_count,
      COALESCE(SUM(NULLIF(ol.orl_art_price_sell_ttc, '')::NUMERIC), 0)::FLOAT8 AS revenue
    FROM ___xtr_order_line ol
    INNER JOIN ___xtr_order o ON o.ord_id = ol.orl_ord_id
    INNER JOIN bounds ON o.ord_date::DATE >= bounds.from_d AND o.ord_date::DATE < bounds.to_d
    WHERE o.ord_is_pay = '1'
      AND ol.orl_website_url IS NOT NULL
      AND ol.orl_website_url <> 'System'
    GROUP BY ol.orl_website_url
  ),
  joined AS (
    SELECT
      t.page,
      _seo_resolve_surface_key(t.page) AS surface_key,
      t.sessions,
      COALESCE(c.orders_count, 0)::BIGINT AS orders_count,
      CASE WHEN t.sessions > 0
           THEN ROUND(COALESCE(c.orders_count, 0)::NUMERIC / t.sessions * 100, 2)::FLOAT8
           ELSE 0::FLOAT8 END AS conversion_rate,
      COALESCE(c.revenue, 0)::FLOAT8 AS revenue,
      ROUND(
        t.sessions::NUMERIC
        * GREATEST(0, 0.01 - (COALESCE(c.orders_count, 0)::NUMERIC / NULLIF(t.sessions, 0))),
        2
      )::FLOAT8 AS business_impact_score,
      CASE
        WHEN COALESCE(c.orders_count, 0) = 0 AND t.sessions > 200 THEN 'critical'
        WHEN COALESCE(c.orders_count, 0) = 0 AND t.sessions > 100 THEN 'high'
        ELSE 'medium' END AS severity
    FROM traffic t
    LEFT JOIN conv c USING (page)
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'page', j.page,
        'surface_key', j.surface_key,
        'sessions', j.sessions,
        'orders_count', j.orders_count,
        'conversion_rate', j.conversion_rate,
        'revenue', j.revenue,
        'business_impact_score', j.business_impact_score,
        'impact_score_version', 'v1',
        'severity', j.severity
      )
      ORDER BY j.business_impact_score DESC
    ),
    '[]'::jsonb
  )
  FROM (
    SELECT *
    FROM joined
    ORDER BY business_impact_score DESC
    LIMIT p_limit
  ) j;
$$;
COMMENT ON FUNCTION rpc_seo_conversion_v1(INT, TIMESTAMPTZ, INT) IS
  'PR-SBD-1 v1 — Pages with GA4 sessions but low/zero paid orders. JOIN __seo_ga4_daily ↔ ___xtr_order_line.orl_website_url filter ord_is_pay=1. impact_score = sessions × (0.01 - actual_conv_rate). UI MASKED Phase A → activation Phase A.6 conditional Phase B signals.';

-- ─── Wrapper d'agrégation (synthetic monitoring + replay only) ────
-- NOT used by runtime cache layer (which fetches the 5 RPCs individually
-- for per-block cache with differentiated TTLs).
CREATE OR REPLACE FUNCTION rpc_seo_control_snapshot_v1(
  p_range TEXT DEFAULT '7d',
  p_now TIMESTAMPTZ DEFAULT NOW()
) RETURNS JSONB LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_days INT := CASE p_range WHEN '7d' THEN 7 WHEN '28d' THEN 28 ELSE 7 END;
BEGIN
  RETURN jsonb_build_object(
    'generated_at', p_now,
    'range', p_range,
    'window_days', v_days,
    'generated_from', jsonb_build_object(
      'wrapper', 'rpc_seo_control_snapshot_v1',
      'rpc_versions', jsonb_build_object(
        'traffic', 'v1',
        'losers', 'v1',
        'low_ctr', 'v1',
        'alerts', 'v1',
        'conversion', 'v1'
      ),
      'impact_score_version', 'v1'
    ),
    'trafficWindow', rpc_seo_traffic_v1(v_days, p_now),
    'topLosers', rpc_seo_top_losers_v1(v_days, p_now, 20),
    'lowCtrOpportunities', rpc_seo_low_ctr_v1(v_days, p_now, 100, 0.01, 50),
    'technicalAlerts', rpc_seo_alerts_v1(p_now, 50),
    'conversionGap', rpc_seo_conversion_v1(v_days, p_now, 20)
  );
END;
$$;
COMMENT ON FUNCTION rpc_seo_control_snapshot_v1(TEXT, TIMESTAMPTZ) IS
  'PR-SBD-1 v1 — Aggregation wrapper for synthetic monitoring (q15min) and forensic replay. NOT used by runtime cache (per-block strategy in Task 4). Returns generated_from with versions.';

-- ─── GRANT EXECUTE explicit (cf feedback_supabase_grant_explicit_for_new_projects) ──
REVOKE ALL ON FUNCTION rpc_seo_traffic_v1(INT, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION rpc_seo_top_losers_v1(INT, TIMESTAMPTZ, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION rpc_seo_low_ctr_v1(INT, TIMESTAMPTZ, INT, NUMERIC, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION rpc_seo_alerts_v1(TIMESTAMPTZ, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION rpc_seo_conversion_v1(INT, TIMESTAMPTZ, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION rpc_seo_control_snapshot_v1(TEXT, TIMESTAMPTZ) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION rpc_seo_traffic_v1(INT, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION rpc_seo_top_losers_v1(INT, TIMESTAMPTZ, INT) TO service_role;
GRANT EXECUTE ON FUNCTION rpc_seo_low_ctr_v1(INT, TIMESTAMPTZ, INT, NUMERIC, INT) TO service_role;
GRANT EXECUTE ON FUNCTION rpc_seo_alerts_v1(TIMESTAMPTZ, INT) TO service_role;
GRANT EXECUTE ON FUNCTION rpc_seo_conversion_v1(INT, TIMESTAMPTZ, INT) TO service_role;
GRANT EXECUTE ON FUNCTION rpc_seo_control_snapshot_v1(TEXT, TIMESTAMPTZ) TO service_role;

-- Helpers (_seo_*) are private : no GRANT (accessible only through wrapper RPCs above).

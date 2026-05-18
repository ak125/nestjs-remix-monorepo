-- =====================================================
-- PR-SBD-1 Task 1 Steps 1-3 — SQL helpers (private, IMMUTABLE/STABLE)
-- Date: 2026-05-18
-- Refs: docs/seo/audit-orders-cart-link.md
--       .claude/plans/verifier-existant-avant-et-ethereal-firefly.md
-- =====================================================
--
-- Three helpers used by rpc_seo_*_v1 RPCs :
--   1. _seo_resolve_surface_key(url) → R0..R8 / admin / unknown
--   2. _seo_resolve_operational_domain(alert_type) → seo|ingestion|infra|content|runtime
--   3. _seo_top_queries_for_page_jsonb(page, window_days, p_now, limit) → top N queries delta
--
-- All private (no GRANT). Accessed only through the v1 RPC wrappers.
-- =====================================================

-- ─── Helper 1 : URL → R-surface mapping ──────────────────────────
-- VERSION: v1 (PR-SBD-1)
-- Reference : docs/seo/legacy_to_monorepo_gap_matrix.md + frontend/app/routes/
CREATE OR REPLACE FUNCTION _seo_resolve_surface_key(p_url TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_url IS NULL OR p_url = '' THEN 'unknown'
    WHEN p_url = '/' OR p_url = '/index' THEN 'R0'
    -- R8 : véhicule (longue forme /pieces/gamme/marque/modele/type)
    WHEN p_url ~ '^/pieces/[^/]+/[^/]+/[^/]+/[^/]+' THEN 'R8'
    -- R8 : véhicule via constructeurs
    WHEN p_url ~ '^/constructeurs/[^/]+/[^/]+/[^/]+' THEN 'R8'
    -- R8 : véhicule via blog-pieces-auto/auto/marque/modele
    WHEN p_url ~ '^/blog-pieces-auto/auto/[^/]+/[^/]+' THEN 'R8'
    -- R7 : hub marque constructeurs
    WHEN p_url ~ '^/constructeurs/[^/]+' THEN 'R7'
    WHEN p_url ~ '^/blog-pieces-auto/auto/[^/]+' THEN 'R7'
    WHEN p_url ~ '^/blog-pieces-auto/auto(/?$|/_index)' THEN 'R7'
    -- R6 : blog article
    WHEN p_url ~ '^/blog-pieces-auto/article/' THEN 'R6'
    -- R3 : conseils gamme (advice gamme = R3 mapping canon)
    WHEN p_url ~ '^/blog-pieces-auto/conseils/' THEN 'R3'
    -- R1 : listing pieces (fiche simple ou listing slug)
    WHEN p_url ~ '^/pieces/' THEN 'R1'
    -- admin (exclus SEO public — tier excluded)
    WHEN p_url ~ '^/admin' THEN 'admin'
    WHEN p_url ~ '^/account' THEN 'admin'
    WHEN p_url ~ '^/auth' THEN 'admin'
    -- Fallback
    ELSE 'unknown'
  END;
$$;
COMMENT ON FUNCTION _seo_resolve_surface_key(TEXT) IS
  'PR-SBD-1 v1 — Maps URL path to R-surface (R0..R8 | admin | unknown). Source: docs/seo/legacy_to_monorepo_gap_matrix.md + frontend/app/routes/. IMMUTABLE pure mapping.';

-- ─── Helper 2 : alert_type → operational_domain ──────────────────
-- VERSION: v1 (PR-SBD-1) — anti alert-storm dilution
CREATE OR REPLACE FUNCTION _seo_resolve_operational_domain(p_alert_type TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    -- SEO content/structure issues
    WHEN p_alert_type IN ('canonical_conflict', 'schema_violation', 'image_seo',
                          'meta_experiment', 'internal_link_suggestion') THEN 'seo'
    -- Detection layer (anomalies + alerts from ingestion sources)
    WHEN p_alert_type IN ('anomaly_detected', 'alert_sent') THEN 'seo'
    -- Ingestion pipeline (GSC/GA4/CRuX)
    WHEN p_alert_type IN ('ingestion_run_failed', 'ingestion_run_started',
                          'ingestion_run_completed', 'credentials_expired') THEN 'ingestion'
    -- Runtime/availability
    WHEN p_alert_type IN ('runtime_error_5xx', 'health_check_failed',
                          'rate_limit_hit') THEN 'runtime'
    -- Content (digest, forecast, audit)
    WHEN p_alert_type IN ('content_audit_failed', 'forecast_generated',
                          'digest_sent') THEN 'content'
    -- Infra fallback
    ELSE 'infra'
  END;
$$;
COMMENT ON FUNCTION _seo_resolve_operational_domain(TEXT) IS
  'PR-SBD-1 v1 — Maps alert_type to operational domain (seo|ingestion|infra|content|runtime) for filtering and routing.';

-- ─── Helper 3 : Top N queries per page with delta ────────────────
-- VERSION: v1 (PR-SBD-1)
-- LATERAL on __seo_gsc_daily for query-level breakdown (max 3 to bound payload)
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

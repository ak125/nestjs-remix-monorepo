-- ============================================================================
-- MCP Validation Shadow Mode - Phase 1
-- ============================================================================
-- Creates table and indexes for MCP validation logging
-- Purpose: Track shadow validation results for analysis
-- Principle: L'IA NE CREE PAS LA VERITE (AI-COS Axiome Zero)
-- ============================================================================

-- Table for MCP validation logs
CREATE TABLE IF NOT EXISTS mcp_validation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Request identification
  request_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  http_method TEXT NOT NULL,

  -- Validation context
  data_type TEXT NOT NULL CHECK (data_type IN (
    'compatibility', 'price', 'stock', 'reference',
    'vehicle', 'diagnostic', 'page_role', 'content'
  )),
  validation_mode TEXT NOT NULL CHECK (validation_mode IN (
    'shadow', 'verification', 'gatekeeper', 'enforcement'
  )),

  -- Input hashes (for deduplication and privacy)
  input_hash TEXT,
  query_params_hash TEXT,

  -- Results
  mcp_result_hash TEXT,
  direct_result_hash TEXT,
  match_status TEXT NOT NULL CHECK (match_status IN (
    'match', 'mismatch', 'mcp_only', 'direct_only', 'error'
  )),

  -- Metrics
  confidence_score NUMERIC(5, 4),
  latency_mcp_ms INTEGER,
  latency_direct_ms INTEGER,
  latency_total_ms INTEGER NOT NULL,

  -- Context
  truth_level TEXT,
  source_type TEXT,
  cache_status TEXT CHECK (cache_status IN ('hit', 'miss', 'bypass')),

  -- Error handling
  error_message TEXT,
  error_code TEXT,

  -- Audit (anonymized)
  user_id TEXT,
  session_id TEXT,
  ip_hash TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Primary access patterns
CREATE INDEX idx_mcp_validation_created_at
  ON mcp_validation_log(created_at DESC);

CREATE INDEX idx_mcp_validation_endpoint
  ON mcp_validation_log(endpoint, created_at DESC);

CREATE INDEX idx_mcp_validation_data_type
  ON mcp_validation_log(data_type, created_at DESC);

CREATE INDEX idx_mcp_validation_match_status
  ON mcp_validation_log(match_status, created_at DESC);

-- For mismatch analysis
CREATE INDEX idx_mcp_validation_mismatches
  ON mcp_validation_log(data_type, endpoint, created_at DESC)
  WHERE match_status = 'mismatch';

-- For error tracking
CREATE INDEX idx_mcp_validation_errors
  ON mcp_validation_log(endpoint, created_at DESC)
  WHERE match_status = 'error';

-- ============================================================================
-- STATISTICS FUNCTIONS
-- ============================================================================

-- Get match rate by data type for a time period
CREATE OR REPLACE FUNCTION mcp_get_match_rate(
  p_data_type TEXT DEFAULT NULL,
  p_hours INTEGER DEFAULT 24
)
RETURNS TABLE (
  data_type TEXT,
  total_count BIGINT,
  match_count BIGINT,
  mismatch_count BIGINT,
  error_count BIGINT,
  match_rate NUMERIC(5, 2),
  avg_latency_ms NUMERIC(10, 2)
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    mvl.data_type,
    COUNT(*) AS total_count,
    COUNT(*) FILTER (WHERE mvl.match_status = 'match') AS match_count,
    COUNT(*) FILTER (WHERE mvl.match_status = 'mismatch') AS mismatch_count,
    COUNT(*) FILTER (WHERE mvl.match_status = 'error') AS error_count,
    ROUND(
      100.0 * COUNT(*) FILTER (WHERE mvl.match_status = 'match') / NULLIF(COUNT(*), 0),
      2
    ) AS match_rate,
    ROUND(AVG(mvl.latency_total_ms)::NUMERIC, 2) AS avg_latency_ms
  FROM mcp_validation_log mvl
  WHERE mvl.created_at > NOW() - (p_hours || ' hours')::INTERVAL
    AND (p_data_type IS NULL OR mvl.data_type = p_data_type)
  GROUP BY mvl.data_type
  ORDER BY total_count DESC;
END;
$$;

-- Get top endpoints with mismatches
CREATE OR REPLACE FUNCTION mcp_get_mismatch_endpoints(
  p_limit INTEGER DEFAULT 10,
  p_hours INTEGER DEFAULT 24
)
RETURNS TABLE (
  endpoint TEXT,
  data_type TEXT,
  mismatch_count BIGINT,
  total_count BIGINT,
  mismatch_rate NUMERIC(5, 2),
  latest_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    mvl.endpoint,
    mvl.data_type,
    COUNT(*) FILTER (WHERE mvl.match_status = 'mismatch') AS mismatch_count,
    COUNT(*) AS total_count,
    ROUND(
      100.0 * COUNT(*) FILTER (WHERE mvl.match_status = 'mismatch') / NULLIF(COUNT(*), 0),
      2
    ) AS mismatch_rate,
    MAX(mvl.created_at) AS latest_at
  FROM mcp_validation_log mvl
  WHERE mvl.created_at > NOW() - (p_hours || ' hours')::INTERVAL
  GROUP BY mvl.endpoint, mvl.data_type
  HAVING COUNT(*) FILTER (WHERE mvl.match_status = 'mismatch') > 0
  ORDER BY mismatch_count DESC
  LIMIT p_limit;
END;
$$;

-- Get dashboard summary
CREATE OR REPLACE FUNCTION mcp_get_dashboard_summary(
  p_hours INTEGER DEFAULT 24
)
RETURNS TABLE (
  period_hours INTEGER,
  total_validations BIGINT,
  match_rate NUMERIC(5, 2),
  avg_latency_ms NUMERIC(10, 2),
  p95_latency_ms INTEGER,
  critical_mismatches BIGINT,
  error_rate NUMERIC(5, 2)
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p_hours AS period_hours,
    COUNT(*) AS total_validations,
    ROUND(
      100.0 * COUNT(*) FILTER (WHERE match_status = 'match') / NULLIF(COUNT(*), 0),
      2
    ) AS match_rate,
    ROUND(AVG(latency_total_ms)::NUMERIC, 2) AS avg_latency_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_total_ms)::INTEGER AS p95_latency_ms,
    COUNT(*) FILTER (
      WHERE match_status = 'mismatch'
        AND data_type IN ('compatibility', 'price', 'stock')
    ) AS critical_mismatches,
    ROUND(
      100.0 * COUNT(*) FILTER (WHERE match_status = 'error') / NULLIF(COUNT(*), 0),
      2
    ) AS error_rate
  FROM mcp_validation_log
  WHERE created_at > NOW() - (p_hours || ' hours')::INTERVAL;
END;
$$;

-- ============================================================================
-- RETENTION POLICY
-- ============================================================================

-- Function to clean old logs (call periodically)
CREATE OR REPLACE FUNCTION mcp_cleanup_old_logs(
  p_retention_days INTEGER DEFAULT 30
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM mcp_validation_log
    WHERE created_at < NOW() - (p_retention_days || ' days')::INTERVAL
    RETURNING 1
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;

  RETURN deleted_count;
END;
$$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE mcp_validation_log IS
  'MCP validation logs for shadow mode analysis. Phase 1 of anti-hallucination architecture.';

COMMENT ON FUNCTION mcp_get_match_rate IS
  'Returns match rate statistics by data type for the specified time period.';

COMMENT ON FUNCTION mcp_get_mismatch_endpoints IS
  'Returns top endpoints with mismatches for investigation.';

COMMENT ON FUNCTION mcp_get_dashboard_summary IS
  'Returns dashboard summary for MCP validation monitoring.';

COMMENT ON FUNCTION mcp_cleanup_old_logs IS
  'Cleans up logs older than retention period. Call periodically via cron.';

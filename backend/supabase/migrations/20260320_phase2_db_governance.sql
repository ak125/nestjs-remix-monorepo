-- Phase 2 DB Governance: Monitoring table + 6 RPC functions (M1-M6)
-- Ref: .spec/00-canon/db-governance/phase-2-monitoring-rpc.md

-- ============================================================
-- 1. Snapshots table for historical M1-M6 results
-- ============================================================

CREATE TABLE IF NOT EXISTS __db_governance_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_id TEXT NOT NULL CHECK (metric_id IN ('M1','M2','M3','M4','M5','M6')),
  payload JSONB NOT NULL DEFAULT '[]'::jsonb,
  alerts JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gov_snapshots_metric_date
  ON __db_governance_snapshots (metric_id, created_at DESC);

ALTER TABLE __db_governance_snapshots ENABLE ROW LEVEL SECURITY;

-- Only service_role can access
CREATE POLICY "service_role_only" ON __db_governance_snapshots
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Auto-purge snapshots older than 12 months (optional, run manually)
-- DELETE FROM __db_governance_snapshots WHERE created_at < now() - interval '12 months';

-- ============================================================
-- 2. M1 — Top 20 tables by size
-- ============================================================

CREATE OR REPLACE FUNCTION __gov_m1_table_sizes()
RETURNS TABLE(
  schemaname name,
  table_name name,
  total_size text,
  data_size text,
  index_size text,
  n_live_tup bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.schemaname,
    s.relname AS table_name,
    pg_size_pretty(pg_total_relation_size(s.relid)) AS total_size,
    pg_size_pretty(pg_relation_size(s.relid)) AS data_size,
    pg_size_pretty(pg_total_relation_size(s.relid) - pg_relation_size(s.relid)) AS index_size,
    s.n_live_tup
  FROM pg_stat_user_tables s
  ORDER BY pg_total_relation_size(s.relid) DESC
  LIMIT 20;
$$;

-- ============================================================
-- 3. M2 — Top 20 indexes by size
-- ============================================================

CREATE OR REPLACE FUNCTION __gov_m2_index_sizes()
RETURNS TABLE(
  schemaname name,
  table_name name,
  index_name name,
  index_size text,
  idx_scan bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.schemaname,
    s.relname AS table_name,
    s.indexrelname AS index_name,
    pg_size_pretty(pg_relation_size(s.indexrelid)) AS index_size,
    s.idx_scan
  FROM pg_stat_user_indexes s
  ORDER BY pg_relation_size(s.indexrelid) DESC
  LIMIT 20;
$$;

-- ============================================================
-- 4. M3 — Stale stats (autoanalyze > 3 months)
-- ============================================================

CREATE OR REPLACE FUNCTION __gov_m3_stale_stats()
RETURNS TABLE(
  schemaname name,
  relname name,
  last_autoanalyze timestamptz,
  last_autovacuum timestamptz,
  n_live_tup bigint,
  size text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.schemaname,
    s.relname,
    s.last_autoanalyze,
    s.last_autovacuum,
    s.n_live_tup,
    pg_size_pretty(pg_relation_size(s.relid)) AS size
  FROM pg_stat_user_tables s
  WHERE s.last_autoanalyze < now() - interval '3 months'
     OR s.last_autoanalyze IS NULL
  ORDER BY pg_relation_size(s.relid) DESC
  LIMIT 20;
$$;

-- ============================================================
-- 5. M4 — Dead tuples
-- ============================================================

CREATE OR REPLACE FUNCTION __gov_m4_dead_tuples()
RETURNS TABLE(
  schemaname name,
  relname name,
  n_dead_tup bigint,
  n_live_tup bigint,
  dead_pct numeric,
  last_autovacuum timestamptz,
  size text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.schemaname,
    s.relname,
    s.n_dead_tup,
    s.n_live_tup,
    CASE WHEN s.n_live_tup > 0
      THEN round(100.0 * s.n_dead_tup / s.n_live_tup, 1)
      ELSE 0
    END AS dead_pct,
    s.last_autovacuum,
    pg_size_pretty(pg_relation_size(s.relid)) AS size
  FROM pg_stat_user_tables s
  WHERE s.n_dead_tup > 100000
  ORDER BY s.n_dead_tup DESC
  LIMIT 20;
$$;

-- ============================================================
-- 6. M5 — Seq scan anomalies
-- ============================================================

CREATE OR REPLACE FUNCTION __gov_m5_seq_scans()
RETURNS TABLE(
  schemaname name,
  relname name,
  seq_scan bigint,
  seq_tup_read bigint,
  idx_scan bigint,
  avg_rows_per_scan numeric,
  n_live_tup bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.schemaname,
    s.relname,
    s.seq_scan,
    s.seq_tup_read,
    s.idx_scan,
    CASE WHEN s.seq_scan > 0
      THEN round(s.seq_tup_read::numeric / s.seq_scan, 0)
      ELSE 0
    END AS avg_rows_per_scan,
    s.n_live_tup
  FROM pg_stat_user_tables s
  WHERE s.seq_scan > 1000
  ORDER BY s.seq_tup_read DESC
  LIMIT 20;
$$;

-- ============================================================
-- 7. M6 — Unused indexes (0-scan, > 1MB)
-- ============================================================

CREATE OR REPLACE FUNCTION __gov_m6_unused_indexes()
RETURNS TABLE(
  schemaname name,
  table_name name,
  index_name name,
  index_size text,
  idx_scan bigint,
  idx_tup_read bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.schemaname,
    s.relname AS table_name,
    s.indexrelname AS index_name,
    pg_size_pretty(pg_relation_size(s.indexrelid)) AS index_size,
    s.idx_scan,
    s.idx_tup_read
  FROM pg_stat_user_indexes s
  WHERE s.idx_scan = 0
    AND pg_relation_size(s.indexrelid) > 1048576
  ORDER BY pg_relation_size(s.indexrelid) DESC
  LIMIT 20;
$$;

-- =====================================================
-- SEO Quality History — Snapshot table + outlier detection RPC
-- Date: 2026-05-07
-- Refs: ADR-046 (R-stack canon Phase 0)
--       ADR-050 (Quality history & drift detection — Phase 0 baseline)
-- Plan: /home/deploy/.claude/plans/je-remarque-une-faiblesse-eventual-flamingo.md (PR-X1)
-- =====================================================
--
-- Pattern réutilisé de __seo_event_log (20260425) :
--   - Schéma JSONB-friendly avec metadata GIN-indexée
--   - RLS service_role / authenticated standard
--   - Snapshot kinds discriminés par texte borné (CHECK)
--
-- Spécificité : table PARTITIONED par RANGE (sampled_at) car le volume cumulé
-- (~10K rows/mois × 12 mois = 120K) bénéficie du partition pruning sur les
-- queries detect_quality_outliers (range filter sur sampled_at).
--
-- IMPORTANT PostgreSQL : sur table partitionnée, la PRIMARY KEY DOIT inclure
-- la clé de partition. D'où PK composite (id, sampled_at) au lieu de PK
-- simple (id) — cf. correction plan v12.
-- =====================================================

CREATE TABLE IF NOT EXISTS __seo_quality_history (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  pg_id TEXT NOT NULL,                              -- Slug ou identifiant fonctionnel par rôle
  role_id TEXT NOT NULL,                            -- ex: 'R1_ROUTER', 'R3_CONSEILS'
  metric_name TEXT NOT NULL,                        -- ex: 'char_count', 'gatekeeper_score', 'entropy_shannon'
  metric_value NUMERIC NOT NULL,
  sampled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  snapshot_kind TEXT NOT NULL CHECK (snapshot_kind IN (
    'monthly_cron',                                 -- Snapshot mensuel automatique cron
    'pre_batch',                                    -- Avant un batch enrich (PR-T pattern)
    'post_batch',                                   -- Après un batch enrich
    'on_demand'                                     -- Trigger manuel admin
  )),
  metadata JSONB DEFAULT '{}'::jsonb,               -- batch_id, agent, source_table, etc.
  PRIMARY KEY (id, sampled_at)                      -- composite PK requis par partitionnement RANGE
) PARTITION BY RANGE (sampled_at);

COMMENT ON TABLE __seo_quality_history IS
  'Quality metrics history per role for drift detection (ADR-050). Snapshots monthly cron + pre/post-batch.';

-- =====================================================
-- Partitions initiales (3 mois glissants)
-- =====================================================
CREATE TABLE IF NOT EXISTS __seo_quality_history_2026_05 PARTITION OF __seo_quality_history
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE IF NOT EXISTS __seo_quality_history_2026_06 PARTITION OF __seo_quality_history
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE IF NOT EXISTS __seo_quality_history_2026_07 PARTITION OF __seo_quality_history
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

-- =====================================================
-- Indexes (créés sur la table parent — propagés aux partitions)
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_seo_quality_history_pg_role
  ON __seo_quality_history (pg_id, role_id, sampled_at DESC);

CREATE INDEX IF NOT EXISTS idx_seo_quality_history_metric
  ON __seo_quality_history (metric_name, sampled_at DESC);

CREATE INDEX IF NOT EXISTS idx_seo_quality_history_metadata
  ON __seo_quality_history USING GIN (metadata);

-- =====================================================
-- RLS — pattern __seo_event_log
-- =====================================================
ALTER TABLE __seo_quality_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_all ON __seo_quality_history; -- APPROVED: idempotent re-create of RLS policy
CREATE POLICY service_role_all ON __seo_quality_history
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_read ON __seo_quality_history; -- APPROVED: idempotent re-create of RLS policy
CREATE POLICY authenticated_read ON __seo_quality_history
  FOR SELECT
  TO authenticated
  USING (true);

-- =====================================================
-- RPC: ensure_next_quality_history_partition
-- Auto-create future partition (idempotent, safe à appeler N fois/mois)
-- =====================================================
CREATE OR REPLACE FUNCTION ensure_next_quality_history_partition()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  next_month_start DATE := date_trunc('month', now() + INTERVAL '1 month')::date;
  next_month_end   DATE := date_trunc('month', now() + INTERVAL '2 months')::date;
  partition_name   TEXT := '__seo_quality_history_' || to_char(next_month_start, 'YYYY_MM');
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = partition_name AND n.nspname = 'public'
  ) THEN
    RETURN 'Partition ' || partition_name || ' already exists (no-op)';
  END IF;

  EXECUTE format(
    'CREATE TABLE %I PARTITION OF __seo_quality_history FOR VALUES FROM (%L) TO (%L)',
    partition_name, next_month_start, next_month_end
  );
  RETURN 'Created partition ' || partition_name || ' [' || next_month_start || ', ' || next_month_end || ')';
END;
$$;

GRANT EXECUTE ON FUNCTION ensure_next_quality_history_partition() TO authenticated, service_role;

COMMENT ON FUNCTION ensure_next_quality_history_partition() IS
  'Crée la partition du mois suivant si absente. Idempotent. À appeler le 25 de chaque mois.';

-- =====================================================
-- RPC: detect_quality_outliers
-- Détecte les pg_id dont une métrique a chuté >= drop_pct sur la fenêtre
-- =====================================================
CREATE OR REPLACE FUNCTION detect_quality_outliers(
  p_window_days   INT     DEFAULT 30,
  p_drop_pct      NUMERIC DEFAULT 0.15,
  p_role_id       TEXT    DEFAULT NULL,
  p_metric_name   TEXT    DEFAULT 'gatekeeper_score'
)
RETURNS TABLE (
  pg_id           TEXT,
  role_id         TEXT,
  metric_name     TEXT,
  baseline_value  NUMERIC,
  current_value   NUMERIC,
  drop_ratio      NUMERIC,
  baseline_at     TIMESTAMPTZ,
  current_at      TIMESTAMPTZ
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  WITH baseline AS (
    SELECT DISTINCT ON (h.pg_id, h.role_id, h.metric_name)
      h.pg_id, h.role_id, h.metric_name,
      h.metric_value AS baseline_value,
      h.sampled_at   AS baseline_at
    FROM __seo_quality_history h
    WHERE h.sampled_at < now() - (p_window_days || ' days')::INTERVAL
      AND (p_role_id IS NULL OR h.role_id = p_role_id)
      AND h.metric_name = p_metric_name
    ORDER BY h.pg_id, h.role_id, h.metric_name, h.sampled_at DESC
  ),
  current_snap AS (
    SELECT DISTINCT ON (h.pg_id, h.role_id, h.metric_name)
      h.pg_id, h.role_id, h.metric_name,
      h.metric_value AS current_value,
      h.sampled_at   AS current_at
    FROM __seo_quality_history h
    WHERE h.sampled_at >= now() - (p_window_days || ' days')::INTERVAL
      AND (p_role_id IS NULL OR h.role_id = p_role_id)
      AND h.metric_name = p_metric_name
    ORDER BY h.pg_id, h.role_id, h.metric_name, h.sampled_at DESC
  )
  SELECT
    b.pg_id, b.role_id, b.metric_name,
    b.baseline_value, c.current_value,
    CASE
      WHEN b.baseline_value = 0 THEN 0
      ELSE (b.baseline_value - c.current_value) / b.baseline_value
    END AS drop_ratio,
    b.baseline_at, c.current_at
  FROM baseline b
  JOIN current_snap c USING (pg_id, role_id, metric_name)
  WHERE b.baseline_value <> 0
    AND (b.baseline_value - c.current_value) / b.baseline_value >= p_drop_pct
  ORDER BY drop_ratio DESC;
$$;

GRANT EXECUTE ON FUNCTION detect_quality_outliers(INT, NUMERIC, TEXT, TEXT)
  TO authenticated, service_role;

COMMENT ON FUNCTION detect_quality_outliers(INT, NUMERIC, TEXT, TEXT) IS
  'Returns pg_id with metric drop >= drop_pct over the window (ADR-050).';

-- Migration : __seo_snapshot_runtime_logs — L1 Collector runtime errors table
-- ADR-064 SEO Production Control Plane, PR-2A-3 Runtime Logs Collector.
--
-- Rôle : agréger les rows de __error_logs (LOADER_5xx + LOADER_4xx) par
-- bucket 5-min × tier, pour servir de Source A du SLO multi-source L2.
-- Cf. canon feedback_slo_must_be_multi_source.
--
-- Squawk conformance (PR #517) :
--   - Pas de BEGIN/COMMIT (migration tool wrap).
--   - SET lock_timeout + SET statement_timeout.
--   - BIGINT pour counters (prefer-bigint-over-int).
--   - Partitionnement quotidien par bucket_start, TTL 90j.

SET lock_timeout = '2s';
SET statement_timeout = '60s';

CREATE TABLE IF NOT EXISTS public.__seo_snapshot_runtime_logs (
  id              BIGINT GENERATED ALWAYS AS IDENTITY,
  bucket_start    TIMESTAMPTZ NOT NULL,
  tier            TEXT        NOT NULL CHECK (tier IN ('tier0', 'tier1', 'tier2', 'total')),
  total_events    BIGINT      NOT NULL CHECK (total_events >= 0),
  http_4xx_count  BIGINT      NOT NULL CHECK (http_4xx_count >= 0),
  http_5xx_count  BIGINT      NOT NULL CHECK (http_5xx_count >= 0),
  subjects_breakdown JSONB    NOT NULL DEFAULT '{}'::JSONB,
  run_id          UUID        NOT NULL,
  fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, bucket_start)
)
PARTITION BY RANGE (bucket_start);

COMMENT ON TABLE public.__seo_snapshot_runtime_logs IS
  'PR-2A-3 ADR-064 — L1 runtime errors snapshot, 5-min buckets, partitioned daily, TTL 90j.';

CREATE INDEX IF NOT EXISTS idx_snap_runtime_bucket_tier
  ON public.__seo_snapshot_runtime_logs (bucket_start DESC, tier);

CREATE INDEX IF NOT EXISTS idx_snap_runtime_run_id
  ON public.__seo_snapshot_runtime_logs (run_id);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_snap_runtime_bucket_tier
  ON public.__seo_snapshot_runtime_logs (bucket_start, tier);

DO $$
DECLARE
  d DATE := CURRENT_DATE;
  next_d DATE;
  part_name TEXT;
BEGIN
  FOR i IN 0..7 LOOP
    next_d := d + INTERVAL '1 day';
    part_name := '__seo_snapshot_runtime_logs_p' || TO_CHAR(d, 'YYYYMMDD');
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.__seo_snapshot_runtime_logs FOR VALUES FROM (%L) TO (%L);',
      part_name, d::TEXT, next_d::TEXT
    );
    d := next_d;
  END LOOP;
END $$;

ALTER TABLE public.__seo_snapshot_runtime_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all"
  ON public.__seo_snapshot_runtime_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

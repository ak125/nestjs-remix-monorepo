-- Migration : __seo_snapshot_cf_analytics — L1 Collector edge analytics table
-- ADR-064 SEO Production Control Plane, PR-2A-2 Cloudflare Analytics Collector
--
-- Rôle : stocker les snapshots agrégés Cloudflare GraphQL Analytics
-- (httpRequestsAdaptiveGroups) par tier + bucket 5 min. Lu par L2 SLO engine
-- (Source C, edge analytics). Complémentaire de __seo_snapshot_synthetic
-- (Source B, ground-truth fetch) — la source CF capture le trafic Googlebot
-- réel + utilisateurs finaux + bots, le synthetic ne voit que notre propre crawler.
--
-- Partitionnement quotidien (RANGE par bucket_start::date) :
--   - INSERT-only per cron run (toutes les 5 min).
--   - Volume estimé : 4 tiers (tier0/1/2 + total) × 288 buckets/jour = 1 152 rows/jour.
--   - TTL 90 jours via DETACH+DROP, identique à __seo_snapshot_synthetic.
--   - Bien plus léger que synthetic (48k rows/jour vs ~1k) — partitionnement
--     conservé pour cohérence architecture L1.

BEGIN;

-- ── Parent table (partitioned) ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.__seo_snapshot_cf_analytics (
  id              BIGINT GENERATED ALWAYS AS IDENTITY,
  bucket_start    TIMESTAMPTZ NOT NULL,                   -- start of the 5-min bucket from CF GraphQL
  tier            TEXT        NOT NULL CHECK (tier IN ('tier0', 'tier1', 'tier2', 'total')),
  total_requests  BIGINT      NOT NULL CHECK (total_requests >= 0),
  http_2xx        BIGINT      NOT NULL CHECK (http_2xx >= 0),
  http_3xx        BIGINT      NOT NULL CHECK (http_3xx >= 0),
  http_4xx        BIGINT      NOT NULL CHECK (http_4xx >= 0),
  http_5xx        BIGINT      NOT NULL CHECK (http_5xx >= 0),
  -- Edge cache hit ratio captured at bucket granularity for drift detection.
  cache_hits      BIGINT      NOT NULL DEFAULT 0,
  cache_misses    BIGINT      NOT NULL DEFAULT 0,
  bytes_served    BIGINT      NOT NULL DEFAULT 0,
  -- p50/p95 origin response time (in ms), CF rounds to integer ms.
  origin_p50_ms   INTEGER     NULL,
  origin_p95_ms   INTEGER     NULL,
  -- Run-level audit-trail.
  run_id          UUID        NOT NULL,
  zone_tag        TEXT        NOT NULL,
  fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, bucket_start)
)
PARTITION BY RANGE (bucket_start);

COMMENT ON TABLE public.__seo_snapshot_cf_analytics IS
  'PR-2A-2 ADR-064 — L1 Cloudflare edge analytics, 5-min buckets, partitioned daily, TTL 90j.';

-- ── Indexes (propagated to child partitions) ────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_snap_cf_bucket_tier
  ON public.__seo_snapshot_cf_analytics (bucket_start DESC, tier);

CREATE INDEX IF NOT EXISTS idx_snap_cf_run_id
  ON public.__seo_snapshot_cf_analytics (run_id);

-- Anti-duplicate : (bucket_start, tier) unique per run.
-- CF GraphQL is idempotent for past buckets but we want to detect re-ingestion
-- of the same bucket (cron rerun, manual replay). UPSERT-on-conflict is the
-- caller's responsibility in the service layer.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_snap_cf_bucket_tier
  ON public.__seo_snapshot_cf_analytics (bucket_start, tier);

-- ── Initial partitions (today + next 7 days) ────────────────────────────────
-- Cron monthly (PR-2A-1.5 follow-up shared with __seo_snapshot_synthetic)
-- creates J+30 / drops J-90. Pre-create 7 partitions to absorb the gap.

DO $$
DECLARE
  d DATE := CURRENT_DATE;
  next_d DATE;
  part_name TEXT;
BEGIN
  FOR i IN 0..7 LOOP
    next_d := d + INTERVAL '1 day';
    part_name := '__seo_snapshot_cf_analytics_p' || TO_CHAR(d, 'YYYYMMDD');
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.__seo_snapshot_cf_analytics FOR VALUES FROM (%L) TO (%L);',
      part_name, d::TEXT, next_d::TEXT
    );
    d := next_d;
  END LOOP;
END $$;

-- ── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.__seo_snapshot_cf_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all"
  ON public.__seo_snapshot_cf_analytics
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;

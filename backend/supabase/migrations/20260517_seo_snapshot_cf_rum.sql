-- Migration : __seo_snapshot_cf_rum — L1 Collector edge-RUM Web Vitals
-- ADR-064 SEO Production Control Plane, PR-2A-2.5 Cloudflare RUM Web Vitals.
--
-- Rôle : stocker les snapshots agrégés Cloudflare GraphQL `rumPerformanceEventsAdaptiveGroups`
-- (LCP / CLS / INP / FCP / TTFB percentiles p50/p75/p95) + `rumPageloadEventsAdaptiveGroups`
-- (visits / pageviews) par jour × tier × path_group. Lu par L2 SLO engine
-- (Source C', edge-RUM utilisateur réel — complémentaire de la table edge-server
-- __seo_snapshot_cf_analytics qui ne capture que les status codes et la perf origin).
--
-- Partitionnement quotidien (RANGE par bucket_start::date) :
--   - INSERT 1x/jour à 01:00 UTC (RUM buffered ~30 min après minuit, ABR favorise daily).
--   - Volume estimé : ~10 path_groups × 4 tiers × 1 bucket/jour = 40 rows/jour.
--   - 90 jours × 40 = 3 600 rows max. Storage négligeable.
--   - TTL 90 jours via DETACH + DROP, identique à __seo_snapshot_cf_analytics.
--
-- Cadence q-daily justifiée (≠ Q5min de cf-analytics) :
--   - rumPerformanceEventsAdaptiveGroups buffer RUM ~30 min, ABR ramène la
--     résolution à 1 jour pour fenêtres > 7 jours.
--   - Une seule fenêtre 24 h/jour suffit pour un SLO p75 hebdo + corrélation
--     traffic-drop J+1 (canon `feedback_gsc_is_secondary_signal_only` → CF RUM est
--     la source primaire de monitoring Core Web Vitals, GSC secondaire à J+7).
--
-- Squawk conformance (ADR-064 squawk gate, PR #517) :
--   - Pas de BEGIN/COMMIT explicites : Supabase migration tool wrappe déjà
--     chaque .sql dans une transaction (`transaction-nesting` / `disallowed-statement`).
--   - SET lock_timeout + SET statement_timeout pré-DDL (`require-timeout-settings`).
--   - BIGINT pour les counters de latence (`prefer-bigint-over-int`).
--   - CLS exprimé en `cls_p75_milli BIGINT` = CLS × 1000 (entier, pas de REAL/NUMERIC).
--     Ex : CLS=0.087 → cls_p75_milli=87. Évite les pièges FP + reste lisible.

SET lock_timeout = '2s';
SET statement_timeout = '60s';

-- ── Parent table (partitioned) ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.__seo_snapshot_cf_rum (
  id              BIGINT      GENERATED ALWAYS AS IDENTITY,
  -- Aligned to midnight UTC of the day measured (daily granularity).
  bucket_start    TIMESTAMPTZ NOT NULL,
  tier            TEXT        NOT NULL CHECK (tier IN ('tier0', 'tier1', 'tier2', 'total')),
  -- Path-group dimension : derived from URL by first-segment normalization.
  -- 'total' = rollup across all paths (sanity baseline, equivalent to tier rollup).
  path_group      TEXT        NOT NULL DEFAULT 'total',

  -- ── Volume (rumPageloadEventsAdaptiveGroups) ───────────────────────────────
  visit_count     BIGINT      NOT NULL DEFAULT 0 CHECK (visit_count >= 0),
  pageview_count  BIGINT      NOT NULL DEFAULT 0 CHECK (pageview_count >= 0),
  -- Nombre d'évènements RUM agrégés (utile pour pondérer les percentiles).
  sample_count    BIGINT      NOT NULL DEFAULT 0 CHECK (sample_count >= 0),

  -- ── Core Web Vitals percentiles (rumPerformanceEventsAdaptiveGroups) ──────
  -- LCP / FCP / INP / TTFB : milliseconds, BIGINT (squawk prefer-bigint-over-int).
  -- CLS : ratio × 1000 stocké en entier (cls_p75=87 = CLS 0.087). Voir squawk note.
  lcp_p50_ms      BIGINT      NULL,
  lcp_p75_ms      BIGINT      NULL,
  lcp_p95_ms      BIGINT      NULL,
  cls_p50_milli   BIGINT      NULL,
  cls_p75_milli   BIGINT      NULL,
  cls_p95_milli   BIGINT      NULL,
  inp_p50_ms      BIGINT      NULL,
  inp_p75_ms      BIGINT      NULL,
  inp_p95_ms      BIGINT      NULL,
  fcp_p75_ms      BIGINT      NULL,
  ttfb_p75_ms     BIGINT      NULL,

  -- ── Breakdowns souples (browsers, devices, countries) ─────────────────────
  -- Volume contrôlé : ~10 paires KV par dimension, ~2 KB max. Cf.
  -- feedback_table_split_vs_mega_jsonb (sub-10 KB JSONB sur <50 K rows = safe).
  metrics_extra   JSONB       NOT NULL DEFAULT '{}'::jsonb,

  -- ── Run-level audit-trail ─────────────────────────────────────────────────
  run_id          UUID        NOT NULL,
  account_tag     TEXT        NOT NULL,
  fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, bucket_start)
)
PARTITION BY RANGE (bucket_start);

COMMENT ON TABLE public.__seo_snapshot_cf_rum IS
  'PR-2A-2.5 ADR-064 — L1 Cloudflare RUM Web Vitals, daily buckets, partitioned daily, TTL 90j. Source edge-RUM (utilisateur réel) complémentaire de __seo_snapshot_cf_analytics (edge-server status codes).';

-- ── Indexes (propagated to child partitions) ────────────────────────────────
-- R2 (sql-governance-rules.md) : chaque CREATE INDEX justifié table+pattern+gain+RPC.
-- Volume cible (cf. l'en-tête fichier) : ~40 rows/jour × 90 jours = ~3 600 rows max,
-- partitionné quotidiennement, storage négligeable. Pas de seq-scan pénalisant sur
-- une partition seule (~40 rows), mais le pruning + ordering ci-dessous évite
-- les agrégations cross-partition coûteuses sur les fenêtres SLO 7j / 28j.

-- INDEX: idx_snap_cf_rum_bucket_tier
-- Table: public.__seo_snapshot_cf_rum (~3 600 rows max, storage négligeable)
-- Pattern: WHERE bucket_start BETWEEN <a> AND <b> AND tier = '<tier>' ORDER BY bucket_start DESC
--          (queries SLO L2 engine — p50/p75/p95 LCP/CLS/INP par tier sur fenêtre 7j/28j)
-- Gain attendu: Seq Scan ~3 600 rows → Index Scan ~280 rows (1 tier × 7j × ~40 rows)
-- RPC concernees: L2 SLO engine (ADR-064 PR-2B+, future) ; cf-rum.service.ts:535 indirect
CREATE INDEX IF NOT EXISTS idx_snap_cf_rum_bucket_tier
  ON public.__seo_snapshot_cf_rum (bucket_start DESC, tier);

-- INDEX: idx_snap_cf_rum_run_id
-- Table: public.__seo_snapshot_cf_rum (~3 600 rows max, storage négligeable)
-- Pattern: WHERE run_id = <uuid> — audit-trail lookup (rejouer / diagnostiquer un run
--          collector spécifique, identifier les buckets manquants, debugging CF GraphQL)
-- Gain attendu: Seq Scan ~3 600 rows → Index Scan ~40 rows (1 run = 10 paths × 4 tiers)
-- RPC concernees: ops debugging via psql ; futur dashboard collector runs (ADR-064)
CREATE INDEX IF NOT EXISTS idx_snap_cf_rum_run_id
  ON public.__seo_snapshot_cf_rum (run_id);

-- INDEX: uniq_snap_cf_rum_bucket_tier_path (UNIQUE)
-- Table: public.__seo_snapshot_cf_rum (~3 600 rows max, storage négligeable)
-- Pattern: anti-duplicate gate pour UPSERT ON CONFLICT (bucket_start, tier, path_group)
--          CF GraphQL rumPerformanceEventsAdaptiveGroups est idempotent sur les buckets
--          passés (re-fetch même fenêtre renvoie les mêmes valeurs ABR-agrégées) — on
--          se repose sur cet index pour absorber les retries cron sans dupliquer.
-- Gain attendu: empêche le drift de cardinalité sur re-runs ; sans lui, chaque retry
--               doublerait la table (~80 rows/jour × N retries) et casserait les p75.
-- RPC concernees: backend/src/modules/seo-control-plane/collectors/cf-rum/cf-rum.service.ts:537
--                 (.upsert avec onConflict: 'bucket_start,tier,path_group')
CREATE UNIQUE INDEX IF NOT EXISTS uniq_snap_cf_rum_bucket_tier_path
  ON public.__seo_snapshot_cf_rum (bucket_start, tier, path_group);

-- ── Initial partitions (today + next 7 days) ────────────────────────────────
-- Cron mensuel partagé (PR-2A-1.5 follow-up) crée J+30 / drop J-90.
-- On pré-crée 8 partitions pour absorber le gap initial.

DO $$
DECLARE
  d DATE := CURRENT_DATE;
  next_d DATE;
  part_name TEXT;
BEGIN
  FOR i IN 0..7 LOOP
    next_d := d + INTERVAL '1 day';
    part_name := '__seo_snapshot_cf_rum_p' || TO_CHAR(d, 'YYYYMMDD');
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.__seo_snapshot_cf_rum FOR VALUES FROM (%L) TO (%L);',
      part_name, d::TEXT, next_d::TEXT
    );
    d := next_d;
  END LOOP;
END $$;

-- ── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.__seo_snapshot_cf_rum ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all"
  ON public.__seo_snapshot_cf_rum
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

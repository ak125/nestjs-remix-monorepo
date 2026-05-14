-- Migration : __seo_snapshot_synthetic — Layer 1 Collectors snapshot table
-- ADR-064 SEO Production Control Plane, PR-2A-1 Synthetic Crawler
--
-- Rôle : stocker les snapshots HTTP+HTML produits par le synthetic crawler
-- BullMQ q15min (UA AutoMecanikSyntheticBot/1.0). Lu par L2 Evaluators
-- (SLO engine pondéré + drift engine). Jamais écrit par L2/L3.
--
-- Partitionnement quotidien (RANGE par created_at::date) :
--   - INSERT-only par run, jamais d'UPDATE.
--   - Volume estimé : 500 URLs × 4 runs/h × 24h = 48 000 rows/jour.
--   - TTL 90 jours via DETACH+DROP des vieilles partitions (cron mensuel).
--   - 540 partitions max sur 18 mois ; sans partitionnement = 17M rows
--     → query plan dégénère sur les fenêtres glissantes 1h SLO L2.
--
-- Cf. ADR-064 §Architecture L1, feedback_seo_routes_need_criticality_tiers,
-- canon `seo-criticality.yaml` (PR-2D foundation #515).

BEGIN;

-- ── Parent table (partitioned) ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.__seo_snapshot_synthetic (
  id               BIGINT GENERATED ALWAYS AS IDENTITY,
  url              TEXT          NOT NULL,
  route_path       TEXT          NOT NULL,
  tier             TEXT          NOT NULL CHECK (tier IN ('tier0', 'tier1', 'tier2')),
  http_code        INTEGER       NOT NULL,
  ttfb_ms          INTEGER       NOT NULL,
  content_length   INTEGER       NULL,
  cache_control    TEXT          NULL,
  cf_cache_status  TEXT          NULL,
  cf_ray           TEXT          NULL,
  age_seconds      INTEGER       NULL,
  has_title        BOOLEAN       NULL,
  title_text       TEXT          NULL,
  has_h1           BOOLEAN       NULL,
  h1_text          TEXT          NULL,
  has_canonical    BOOLEAN       NULL,
  canonical_url    TEXT          NULL,
  robots_meta      TEXT          NULL,
  x_robots_tag     TEXT          NULL,
  error_kind       TEXT          NULL,        -- timeout|network|parse|null
  error_message    TEXT          NULL,
  run_id           UUID          NOT NULL,
  seed             BIGINT        NOT NULL,
  user_agent       TEXT          NOT NULL,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, created_at)
)
PARTITION BY RANGE (created_at);

COMMENT ON TABLE public.__seo_snapshot_synthetic IS
  'PR-2A-1 ADR-064 — L1 Collector snapshot, partitioned daily, TTL 90j.';

-- ── Indexes (sur partitions enfants) ─────────────────────────────────────────
-- BTREE composite (created_at, tier) pour SLO query L2 (fenêtre 1h × tier).
-- BTREE (url) pour drift detection L2 (diff N vs N-1 par URL).
-- BTREE (run_id) pour debug/replay par run.

-- Index parent-level (propagé automatiquement aux partitions enfants).
CREATE INDEX IF NOT EXISTS idx_snap_synth_created_tier
  ON public.__seo_snapshot_synthetic (created_at DESC, tier);

CREATE INDEX IF NOT EXISTS idx_snap_synth_url_created
  ON public.__seo_snapshot_synthetic (url, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_snap_synth_run_id
  ON public.__seo_snapshot_synthetic (run_id);

-- ── Initial partitions (today + next 7 days) ─────────────────────────────────
-- Pre-créer 7 partitions à l'avance pour éviter qu'un INSERT plante à minuit
-- UTC si le job de création de partition n'a pas tourné. Cron mensuel
-- (créé en PR-2A-1.5) gère la rotation : create J+30, drop J-90.

DO $$
DECLARE
  d DATE := CURRENT_DATE;
  next_d DATE;
  part_name TEXT;
BEGIN
  FOR i IN 0..7 LOOP
    next_d := d + INTERVAL '1 day';
    part_name := '__seo_snapshot_synthetic_p' || TO_CHAR(d, 'YYYYMMDD');
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.__seo_snapshot_synthetic FOR VALUES FROM (%L) TO (%L);',
      part_name, d::TEXT, next_d::TEXT
    );
    d := next_d;
  END LOOP;
END $$;

-- ── RLS — service_role only, lecture authenticated ───────────────────────────

ALTER TABLE public.__seo_snapshot_synthetic ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all" ON public.__seo_snapshot_synthetic;
CREATE POLICY "service_role_all"
  ON public.__seo_snapshot_synthetic
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- L2 Evaluators (future PR-2B) tourneront en service_role aussi. Les admins
-- humains qui consulteront le dashboard L2/L3 le feront via authenticated +
-- view dédiée, pas direct sur cette table raw.

COMMIT;

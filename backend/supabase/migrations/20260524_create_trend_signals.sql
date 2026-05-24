-- =====================================================
-- Trend Signals — middle-ground ingestion
-- =====================================================
-- Cf. spec docs/superpowers/specs/2026-05-23-ai-additive-layer-phase-0-and-1-design.md §4.6
-- Sources publiques : rappels.gouv.fr API, codes défaut fréquents, saisonnalité CT.
-- Table additive simple (non partitionnée — volume <10k rows/an).
-- =====================================================

CREATE TABLE IF NOT EXISTS __trend_signals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recorded_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  source       TEXT NOT NULL CHECK (source IN ('rappels_gouv_fr', 'obd_codes_frequent', 'saisonnalite_ct')),
  label        TEXT NOT NULL,
  freq         NUMERIC,
  link         TEXT,
  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT __trend_signals_source_label_recorded_unique UNIQUE (source, label, recorded_at)
);

COMMENT ON TABLE __trend_signals IS
  'Trend signals from public sources (rappels.gouv.fr, OBD codes, saisonnalité). Light ingestion, monthly cron, no auto content gen.';

CREATE INDEX IF NOT EXISTS idx_trend_signals_source_recorded
  ON __trend_signals (source, recorded_at DESC);

ALTER TABLE __trend_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY trend_signals_service_role_all
  ON __trend_signals
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

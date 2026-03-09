-- =============================================================================
-- Lighthouse CWV Monitoring Tables
-- Tables pour stocker les audits Lighthouse et les alertes CWV
-- =============================================================================

-- __lighthouse_runs : résultats d'audit Lighthouse
CREATE TABLE IF NOT EXISTS __lighthouse_runs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url        TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  fcp_ms     REAL,
  lcp_ms     REAL,
  cls        REAL,
  tbt_ms     REAL,
  si_ms      REAL,
  ttfb_ms    REAL,
  perf_score SMALLINT,
  a11y_score SMALLINT,
  seo_score  SMALLINT,
  bp_score   SMALLINT,
  cwv_pass   BOOLEAN,
  raw_json   JSONB
);

CREATE INDEX IF NOT EXISTS idx_lhr_url_created ON __lighthouse_runs (url, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lhr_created ON __lighthouse_runs (created_at DESC);

-- __lighthouse_alerts : alertes sur dépassement consécutif de seuils CWV
CREATE TABLE IF NOT EXISTS __lighthouse_alerts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url         TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  metric      TEXT NOT NULL,
  threshold   REAL NOT NULL,
  value_run1  REAL NOT NULL,
  value_run2  REAL NOT NULL,
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_lha_url ON __lighthouse_alerts (url);

-- RLS activé mais pas de policies (accès via service_role uniquement)
ALTER TABLE __lighthouse_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE __lighthouse_alerts ENABLE ROW LEVEL SECURITY;

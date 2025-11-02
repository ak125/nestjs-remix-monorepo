-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 🧪 SEO CRAWL BUDGET A/B TESTING - Supabase Tables
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Table principale des expériences
CREATE TABLE IF NOT EXISTS crawl_budget_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  action TEXT NOT NULL CHECK (action IN ('exclude', 'include', 'reduce')),
  target_families TEXT[] NOT NULL, -- Array de codes gammes/catégories
  reduction_percent INTEGER CHECK (reduction_percent >= 0 AND reduction_percent <= 100),
  duration_days INTEGER NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'paused', 'completed')),
  baseline JSONB, -- {crawlRate, indexation, traffic}
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table des métriques quotidiennes
CREATE TABLE IF NOT EXISTS crawl_budget_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL REFERENCES crawl_budget_experiments(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_crawled_urls INTEGER NOT NULL DEFAULT 0,
  crawl_requests_count INTEGER NOT NULL DEFAULT 0,
  avg_crawl_rate DECIMAL(10, 2) NOT NULL DEFAULT 0,
  indexed_urls INTEGER NOT NULL DEFAULT 0,
  indexation_rate DECIMAL(5, 2) NOT NULL DEFAULT 0,
  organic_sessions INTEGER,
  organic_conversions INTEGER,
  family_metrics JSONB, -- [{familyCode, crawledUrls, indexedUrls, avgPosition}]
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(experiment_id, date)
);

-- Index pour performance
CREATE INDEX idx_experiments_status ON crawl_budget_experiments(status);
CREATE INDEX idx_experiments_created_at ON crawl_budget_experiments(created_at DESC);
CREATE INDEX idx_metrics_experiment_id ON crawl_budget_metrics(experiment_id);
CREATE INDEX idx_metrics_date ON crawl_budget_metrics(date DESC);
CREATE INDEX idx_metrics_experiment_date ON crawl_budget_metrics(experiment_id, date DESC);

-- Trigger pour updated_at automatique
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_crawl_budget_experiments_updated_at
  BEFORE UPDATE ON crawl_budget_experiments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) - optionnel
ALTER TABLE crawl_budget_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE crawl_budget_metrics ENABLE ROW LEVEL SECURITY;

-- Politique RLS: Tous les utilisateurs authentifiés peuvent lire
CREATE POLICY "Allow authenticated read on experiments"
  ON crawl_budget_experiments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated read on metrics"
  ON crawl_budget_metrics FOR SELECT
  TO authenticated
  USING (true);

-- Politique RLS: Seuls les admins peuvent modifier (ajuster selon vos besoins)
CREATE POLICY "Allow service role write on experiments"
  ON crawl_budget_experiments FOR ALL
  TO service_role
  USING (true);

CREATE POLICY "Allow service role write on metrics"
  ON crawl_budget_metrics FOR ALL
  TO service_role
  USING (true);

COMMENT ON TABLE crawl_budget_experiments IS 'Expériences A/B pour optimiser le crawl budget en incluant/excluant des familles de produits';
COMMENT ON TABLE crawl_budget_metrics IS 'Métriques quotidiennes collectées durant les expériences (GSC + GA4)';

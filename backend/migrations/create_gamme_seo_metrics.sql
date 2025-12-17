-- Migration: Create gamme_seo_metrics table
-- Date: 2025-12-17
-- Purpose: Store SEO metrics for gammes (Google Trends, Keyword Planner, etc.)

-- Create table
CREATE TABLE IF NOT EXISTS gamme_seo_metrics (
  id SERIAL PRIMARY KEY,
  pg_id INTEGER NOT NULL UNIQUE,

  -- Google Trends data
  trends_index INTEGER DEFAULT 0,
  trends_updated_at TIMESTAMP,

  -- Google Keyword Planner data (future)
  search_volume INTEGER,
  competition VARCHAR(20),
  competition_index INTEGER,

  -- Calculated classification
  g_level_recommended VARCHAR(2),  -- G1, G2, G3
  action_recommended VARCHAR(50),  -- PROMOUVOIR_INDEX, PROMOUVOIR_G1, VERIFIER_G1

  -- User notes and actions
  user_notes TEXT,
  user_action VARCHAR(50),

  -- Audit fields
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_gamme_seo_pg_id ON gamme_seo_metrics(pg_id);
CREATE INDEX IF NOT EXISTS idx_gamme_seo_trends ON gamme_seo_metrics(trends_index DESC);
CREATE INDEX IF NOT EXISTS idx_gamme_seo_action ON gamme_seo_metrics(action_recommended);

-- Add comment
COMMENT ON TABLE gamme_seo_metrics IS 'SEO metrics for product categories (gammes) - Google Trends, Keyword Planner data';

-- Grant permissions (adjust as needed for your Supabase setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON gamme_seo_metrics TO authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON gamme_seo_metrics TO service_role;

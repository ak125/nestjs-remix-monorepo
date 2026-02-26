-- Migration documentaire : __seo_keyword_cluster
-- Table deja creee en prod via MCP. Ce fichier sert de reference pour le repo.
-- Date: 2026-02-24

CREATE TABLE IF NOT EXISTS __seo_keyword_cluster (
  id SERIAL PRIMARY KEY,
  pg_id INTEGER NOT NULL,
  pg_alias VARCHAR(255) NOT NULL,
  primary_keyword TEXT NOT NULL,
  primary_volume INTEGER NOT NULL DEFAULT 0,
  primary_intent VARCHAR(50) NOT NULL DEFAULT 'informationnelle',
  keyword_variants JSONB NOT NULL DEFAULT '[]',
  paa_questions JSONB NOT NULL DEFAULT '[]',
  role_keywords JSONB NOT NULL DEFAULT '{}',
  overlap_flags JSONB NOT NULL DEFAULT '[]',
  source VARCHAR(50) NOT NULL DEFAULT 'keyword-dataset',
  schema_version VARCHAR(20) NOT NULL DEFAULT '1.0',
  built_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  built_by VARCHAR(100) NOT NULL DEFAULT 'build-keyword-clusters',
  UNIQUE (pg_id)
);

-- Colonnes ajoutees a __seo_page_brief (deja presentes en prod)
-- ALTER TABLE __seo_page_brief ADD COLUMN IF NOT EXISTS keyword_source VARCHAR(50) DEFAULT 'manual';
-- ALTER TABLE __seo_page_brief ADD COLUMN IF NOT EXISTS keyword_cluster_id INTEGER;

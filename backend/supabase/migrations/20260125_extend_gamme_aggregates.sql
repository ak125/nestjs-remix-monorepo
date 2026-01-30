-- ============================================================================
-- MIGRATION: Centralisation SEO - Extension gamme_aggregates
-- ============================================================================
-- Phase 1: Ajouter colonnes manquantes pour centraliser les données SEO
-- - V-Level counts dénormalisés (depuis __seo_keywords)
-- - Trends data (pour Agent 2 / Google Trends)
-- - G-Level explicite
--
-- Date: 2026-01-25
-- ============================================================================

-- 1. Colonnes V-Level dénormalisées (depuis __seo_keywords)
-- Permet des requêtes rapides sans parser vlevel_counts JSONB
ALTER TABLE gamme_aggregates
  ADD COLUMN IF NOT EXISTS v2_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS v3_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS v4_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS v5_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS keyword_total INTEGER DEFAULT 0;

-- 2. Colonnes Trends (Agent 2 / Google Trends)
ALTER TABLE gamme_aggregates
  ADD COLUMN IF NOT EXISTS trends_index INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trends_updated_at TIMESTAMPTZ;

-- 3. G-Level explicite (calculé depuis pg_top + contexte)
ALTER TABLE gamme_aggregates
  ADD COLUMN IF NOT EXISTS g_level VARCHAR(5) DEFAULT 'G3';

-- 4. Smart Action primaire simplifié (vs smart_actions JSONB existant)
ALTER TABLE gamme_aggregates
  ADD COLUMN IF NOT EXISTS smart_action_primary VARCHAR(30);

-- 5. SEO Score dédié (copie de priority_score pour clarté)
ALTER TABLE gamme_aggregates
  ADD COLUMN IF NOT EXISTS seo_score INTEGER DEFAULT 0;

-- 6. Index pour les nouvelles colonnes (performance dashboards)
CREATE INDEX IF NOT EXISTS idx_ga_v2_count ON gamme_aggregates(v2_count DESC);
CREATE INDEX IF NOT EXISTS idx_ga_v3_count ON gamme_aggregates(v3_count DESC);
CREATE INDEX IF NOT EXISTS idx_ga_trends_index ON gamme_aggregates(trends_index DESC);
CREATE INDEX IF NOT EXISTS idx_ga_g_level ON gamme_aggregates(g_level);
CREATE INDEX IF NOT EXISTS idx_ga_smart_action_primary ON gamme_aggregates(smart_action_primary);
CREATE INDEX IF NOT EXISTS idx_ga_keyword_total ON gamme_aggregates(keyword_total DESC);

-- 7. Commentaires pour documentation
COMMENT ON COLUMN gamme_aggregates.v2_count IS 'Keywords V2 (marque+gamme) depuis __seo_keywords - sync auto';
COMMENT ON COLUMN gamme_aggregates.v3_count IS 'Keywords V3 (marque+modèle+gamme) depuis __seo_keywords - sync auto';
COMMENT ON COLUMN gamme_aggregates.v4_count IS 'Keywords V4 (marque+modèle+variante+gamme) depuis __seo_keywords - sync auto';
COMMENT ON COLUMN gamme_aggregates.v5_count IS 'Keywords V5 (complet) depuis __seo_keywords - sync auto';
COMMENT ON COLUMN gamme_aggregates.keyword_total IS 'Total keywords depuis __seo_keywords - sync auto';
COMMENT ON COLUMN gamme_aggregates.trends_index IS 'Google Trends index 0-100 (mis à jour par Agent 2)';
COMMENT ON COLUMN gamme_aggregates.trends_updated_at IS 'Dernière mise à jour Trends';
COMMENT ON COLUMN gamme_aggregates.g_level IS 'G-Level explicite: G1=prioritaire, G2=important, G3=standard';
COMMENT ON COLUMN gamme_aggregates.smart_action_primary IS 'Action SEO primaire recommandée';
COMMENT ON COLUMN gamme_aggregates.seo_score IS 'Score SEO global (basé sur priority_score)';

-- Vérification
DO $$
DECLARE
  col_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO col_count
  FROM information_schema.columns
  WHERE table_name = 'gamme_aggregates'
    AND column_name IN ('v2_count', 'v3_count', 'v4_count', 'trends_index', 'g_level');

  IF col_count = 5 THEN
    RAISE NOTICE '✅ Migration 20260125_extend_gamme_aggregates: 5 colonnes ajoutées avec succès';
  ELSE
    RAISE WARNING '⚠️ Migration partielle: % colonnes sur 5 attendues', col_count;
  END IF;
END $$;

-- =====================================================
-- 🧪 A/B Testing Columns - Ajout colonnes pour tracking formulations
-- Migration: 003_add_ab_testing_columns.sql
-- Date: 2025-12-03
-- Description: Ajoute les colonnes A/B testing à seo_link_clicks
-- =====================================================

-- Ajouter les colonnes A/B testing à la table existante
ALTER TABLE seo_link_clicks 
ADD COLUMN IF NOT EXISTS switch_verb_id INTEGER,
ADD COLUMN IF NOT EXISTS switch_noun_id INTEGER,
ADD COLUMN IF NOT EXISTS switch_formula VARCHAR(100),
ADD COLUMN IF NOT EXISTS target_gamme_id INTEGER;

-- Créer les index pour A/B testing (IF NOT EXISTS n'existe pas pour CREATE INDEX, on utilise une condition)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_seo_link_clicks_formula') THEN
        CREATE INDEX idx_seo_link_clicks_formula ON seo_link_clicks(switch_formula);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_seo_link_clicks_gamme') THEN
        CREATE INDEX idx_seo_link_clicks_gamme ON seo_link_clicks(target_gamme_id);
    END IF;
END $$;

-- Commentaires sur les nouvelles colonnes
COMMENT ON COLUMN seo_link_clicks.switch_verb_id IS 'ID du verbe utilisé (SGCS_ALIAS=1): Découvrez, Trouvez, etc.';
COMMENT ON COLUMN seo_link_clicks.switch_noun_id IS 'ID du nom utilisé (SGCS_ALIAS=2): accessoires, équipements, etc.';
COMMENT ON COLUMN seo_link_clicks.switch_formula IS 'Formule complète "verb_id:noun_id" pour analytics A/B testing';
COMMENT ON COLUMN seo_link_clicks.target_gamme_id IS 'ID de la gamme cible du lien';

-- =====================================================
-- 🧪 A/B Testing Analytics - Vues pour mesurer CTR par formulation
-- =====================================================

-- Vue: CTR par formulation (verbe+nom) sur 30 jours
CREATE OR REPLACE VIEW seo_ab_testing_formula_ctr AS
SELECT 
    switch_formula,
    switch_verb_id,
    switch_noun_id,
    target_gamme_id,
    COUNT(*) as total_clicks,
    COUNT(DISTINCT session_id) as unique_users,
    DATE_TRUNC('day', clicked_at) as date
FROM seo_link_clicks
WHERE 
    switch_formula IS NOT NULL
    AND clicked_at >= NOW() - INTERVAL '30 days'
GROUP BY switch_formula, switch_verb_id, switch_noun_id, target_gamme_id, DATE_TRUNC('day', clicked_at)
ORDER BY total_clicks DESC;

-- Vue: Performance des verbes (SGCS_ALIAS=1)
CREATE OR REPLACE VIEW seo_ab_testing_verbs AS
SELECT 
    switch_verb_id,
    COUNT(*) as total_clicks,
    COUNT(DISTINCT session_id) as unique_users,
    COUNT(DISTINCT source_url) as pages_sources,
    ROUND(AVG(CASE WHEN device_type = 'mobile' THEN 1 ELSE 0 END) * 100, 2) as mobile_pct
FROM seo_link_clicks
WHERE 
    switch_verb_id IS NOT NULL
    AND clicked_at >= NOW() - INTERVAL '30 days'
GROUP BY switch_verb_id
ORDER BY total_clicks DESC;

-- Vue: Performance des noms (SGCS_ALIAS=2)
CREATE OR REPLACE VIEW seo_ab_testing_nouns AS
SELECT 
    switch_noun_id,
    COUNT(*) as total_clicks,
    COUNT(DISTINCT session_id) as unique_users,
    COUNT(DISTINCT target_gamme_id) as gammes_ciblees
FROM seo_link_clicks
WHERE 
    switch_noun_id IS NOT NULL
    AND clicked_at >= NOW() - INTERVAL '30 days'
GROUP BY switch_noun_id
ORDER BY total_clicks DESC;

-- Vue: Top formulations combinées avec CTR estimé
CREATE OR REPLACE VIEW seo_ab_testing_top_formulas AS
WITH formula_clicks AS (
    SELECT 
        switch_formula,
        COUNT(*) as clicks
    FROM seo_link_clicks
    WHERE switch_formula IS NOT NULL
    GROUP BY switch_formula
),
formula_impressions AS (
    SELECT 
        link_type,
        SUM(link_count) as impressions
    FROM seo_link_impressions
    WHERE link_type = 'LinkGammeCar'
    GROUP BY link_type
)
SELECT 
    fc.switch_formula,
    fc.clicks,
    fi.impressions,
    CASE WHEN fi.impressions > 0 
         THEN ROUND((fc.clicks::numeric / fi.impressions) * 100, 2) 
         ELSE 0 
    END as ctr_pct
FROM formula_clicks fc
CROSS JOIN formula_impressions fi
ORDER BY fc.clicks DESC
LIMIT 20;

COMMENT ON VIEW seo_ab_testing_formula_ctr IS 'CTR par formulation verbe+nom pour A/B testing';
COMMENT ON VIEW seo_ab_testing_verbs IS 'Performance des verbes (Découvrez, Trouvez, etc.)';
COMMENT ON VIEW seo_ab_testing_nouns IS 'Performance des noms (accessoires, équipements, etc.)';
COMMENT ON VIEW seo_ab_testing_top_formulas IS 'Top 20 formulations avec CTR estimé';

-- Confirmation
SELECT 'Migration 003_add_ab_testing_columns completed successfully' as status;

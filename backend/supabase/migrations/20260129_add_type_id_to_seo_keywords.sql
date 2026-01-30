-- Migration: Ajouter colonne type_id a __seo_keywords
-- Date: 2026-01-29
-- Description: Permet de lier les keywords V-Level aux motorisations auto_type pour enrichissement

-- Ajouter la colonne type_id
ALTER TABLE __seo_keywords
ADD COLUMN IF NOT EXISTS type_id BIGINT;

-- Index pour accelerer les lookups par type_id
CREATE INDEX IF NOT EXISTS idx_seo_keywords_type_id
ON __seo_keywords(type_id)
WHERE type_id IS NOT NULL;

-- Index composite pour les requetes V-Level avec type_id (utilise gamme au lieu de pg_id)
CREATE INDEX IF NOT EXISTS idx_seo_keywords_vlevel_type
ON __seo_keywords(gamme, v_level, type_id)
WHERE type = 'vehicle' AND v_level IS NOT NULL;

-- Commentaire pour documentation
COMMENT ON COLUMN __seo_keywords.type_id IS 'FK vers auto_type.type_id pour enrichissement vehicule (make, model, engine, power, years, fuel)';

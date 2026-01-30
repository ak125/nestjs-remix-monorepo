-- Migration: Ajouter colonnes V-Level counts à gamme_seo_metrics
-- Date: 2026-01-24
-- Description: Permet de stocker les compteurs V2/V3/V4/V5 pour le dashboard admin

-- Ajouter colonnes pour compteurs V-Level
ALTER TABLE gamme_seo_metrics
ADD COLUMN IF NOT EXISTS v3_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS v4_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS v5_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_keywords INTEGER DEFAULT 0;

-- Commenter les colonnes
COMMENT ON COLUMN gamme_seo_metrics.v3_count IS 'Nombre de keywords V3 (marque+modèle+gamme)';
COMMENT ON COLUMN gamme_seo_metrics.v4_count IS 'Nombre de keywords V4 (marque+modèle+variante+gamme)';
COMMENT ON COLUMN gamme_seo_metrics.v5_count IS 'Nombre de keywords V5 (marque+modèle+variante+énergie+gamme)';
COMMENT ON COLUMN gamme_seo_metrics.total_keywords IS 'Nombre total de keywords pour cette gamme';

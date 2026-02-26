-- ============================================================================
-- Purchase Guide v2: provenance source metadata
-- ============================================================================
-- Objectif:
--   Ajouter une traçabilité explicite de la source éditoriale par gamme
--   (PDF ou autre source fiable: OEM, catalog, manuel, bulletin technique,
--    scraping web qualifié)
--   pour alimenter le Quality Gate "source fiable".
--
-- Date: 2026-02-13
-- ============================================================================

ALTER TABLE __seo_gamme_purchase_guide
  ADD COLUMN IF NOT EXISTS sgpg_source_type VARCHAR(32),
  ADD COLUMN IF NOT EXISTS sgpg_source_uri TEXT,
  ADD COLUMN IF NOT EXISTS sgpg_source_ref TEXT;

COMMENT ON COLUMN __seo_gamme_purchase_guide.sgpg_source_type IS
  'Type de source: pdf, oem, catalog, manual, tech, bulletin, scraping, db_manual';

COMMENT ON COLUMN __seo_gamme_purchase_guide.sgpg_source_uri IS
  'URI source canonique (ex: pdf://catalog/ate-brake-discs-2025.pdf)';

COMMENT ON COLUMN __seo_gamme_purchase_guide.sgpg_source_ref IS
  'Référence source fine (ex: pages=12-19, section=3.2)';

UPDATE __seo_gamme_purchase_guide
SET sgpg_source_type = COALESCE(NULLIF(sgpg_source_type, ''), 'db_manual')
WHERE sgpg_source_type IS NULL OR sgpg_source_type = '';

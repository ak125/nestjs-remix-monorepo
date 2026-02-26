-- ============================================================================
-- Purchase Guide v2: source verification metadata (pipeline attest)
-- ============================================================================
-- Objectif:
--   La DB ne "juge" pas la qualité source: elle stocke l'attestation pipeline.
--   Runtime lit ensuite cette attestation pour accepter/rejeter le contrat.
--
-- Date: 2026-02-14
-- ============================================================================

ALTER TABLE __seo_gamme_purchase_guide
  ADD COLUMN IF NOT EXISTS sgpg_source_verified BOOLEAN,
  ADD COLUMN IF NOT EXISTS sgpg_source_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sgpg_source_verified_by TEXT;

UPDATE __seo_gamme_purchase_guide
SET sgpg_source_verified = COALESCE(sgpg_source_verified, false)
WHERE sgpg_source_verified IS NULL;

ALTER TABLE __seo_gamme_purchase_guide
  ALTER COLUMN sgpg_source_verified SET DEFAULT false;

COMMENT ON COLUMN __seo_gamme_purchase_guide.sgpg_source_verified IS
  'Attestation pipeline: true si source vérifiée avant publication';

COMMENT ON COLUMN __seo_gamme_purchase_guide.sgpg_source_verified_at IS
  'Horodatage de vérification de la source par pipeline';

COMMENT ON COLUMN __seo_gamme_purchase_guide.sgpg_source_verified_by IS
  'Identité technique de vérification (ex: pipeline:pdf-ingest, pipeline:scraping-review)';

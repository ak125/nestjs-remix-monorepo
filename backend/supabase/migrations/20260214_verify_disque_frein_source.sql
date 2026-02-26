-- ============================================================================
-- Purchase Guide v2: source verification for disque de frein (pg_id=82)
-- ============================================================================
-- Objectif:
--   Enregistrer explicitement l'attestation pipeline pour la source PDF
--   utilisée par le guide d'achat disque de frein.
--
-- Date: 2026-02-14
-- ============================================================================

UPDATE __seo_gamme_purchase_guide
SET
  sgpg_source_verified = true,
  sgpg_source_verified_at = NOW(),
  sgpg_source_verified_by = COALESCE(NULLIF(sgpg_source_verified_by, ''), 'pipeline:pdf-ingest'),
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '82'
  AND sgpg_source_type = 'pdf'
  AND sgpg_source_uri = 'pdf://catalog/ate-brake-discs-scheibenbremsen-2025.pdf';

-- Vérification rapide:
-- SELECT sgpg_pg_id, sgpg_source_type, sgpg_source_uri, sgpg_source_verified,
--        sgpg_source_verified_at, sgpg_source_verified_by
-- FROM __seo_gamme_purchase_guide
-- WHERE sgpg_pg_id = '82';

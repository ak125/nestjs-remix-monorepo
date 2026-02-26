-- ============================================================================
-- Purchase Guide v2: set provenance for disque de frein (pg_id=82)
-- ============================================================================
-- Objectif:
--   Marquer explicitement la source de contenu pour la gamme "disque de frein"
--   afin de passer le quality gate de provenance fiable.
--
-- Source fichier validée dans le repo:
--   _bmad-output/ATE Brake discs - Scheibenbremsen 2025.pdf
--
-- Date: 2026-02-13
-- ============================================================================

UPDATE __seo_gamme_purchase_guide
SET
  sgpg_source_type = 'pdf',
  sgpg_source_uri = 'pdf://catalog/ate-brake-discs-scheibenbremsen-2025.pdf',
  sgpg_source_ref = 'file=_bmad-output/ATE Brake discs - Scheibenbremsen 2025.pdf',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '82';

-- Vérification rapide:
-- SELECT sgpg_pg_id, sgpg_source_type, sgpg_source_uri, sgpg_source_ref
-- FROM __seo_gamme_purchase_guide
-- WHERE sgpg_pg_id = '82';

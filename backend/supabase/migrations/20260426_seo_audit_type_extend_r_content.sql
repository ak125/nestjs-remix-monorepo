-- =====================================================
-- SEO Audit Type Extension — add 'r_content_gap' (Phase 2a')
-- Date: 2026-04-26
-- Refs: ADR-025-seo-department-architecture
--       PR #174 (foundations) — __seo_audit_findings table créée
-- =====================================================
--
-- L'ENUM seo_audit_type initial (Phase 2 foundations) couvre les 5 types
-- planifiés dans le plan : schema_violation, image_seo, canonical_conflict,
-- meta_experiment, internal_link_suggestion.
--
-- Phase 2a' ajoute 'r_content_gap' pour couvrir les findings sur les
-- tables R-content qui contiennent du contenu persisté en DB (vs Phase 2b
-- canonical/JSON-LD calculés runtime via fetch HTTP) :
--
--   __seo_gamme_conseil       (sections S1-S8 conseils)
--   __seo_gamme_purchase_guide (guides d'achat R6)
--   __seo_reference           (fiches référence R4)
--   __seo_brand_editorial     (contenu marques R7)
--
-- Sous-types via payload.gap_type :
--   - thin_section        : sgc_content < threshold (default 300 chars)
--   - empty_section       : sgc_content vide ou NULL
--   - empty_intro         : sgpg_intro_role vide ou NULL (R6)
--   - missing_gatekeeper  : sgpg_gatekeeper_score IS NULL
--   - missing_faq         : common_questions IS NULL (R4)
--   - unpublished_eligible: is_published=false alors que content présent
-- =====================================================

ALTER TYPE seo_audit_type ADD VALUE IF NOT EXISTS 'r_content_gap';

COMMENT ON TYPE seo_audit_type IS 'Types d''audit SEO. r_content_gap = lacune contenu sur tables R-content persistées (vs schema_violation = JSON-LD invalide en runtime).';

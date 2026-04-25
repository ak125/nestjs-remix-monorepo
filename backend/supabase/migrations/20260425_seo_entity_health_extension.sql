-- =====================================================
-- SEO Entity Health — Extension JSONB columns (Phase 1+)
-- Date: 2026-04-25
-- Refs: ADR-025-seo-department-architecture (DB lean design)
-- =====================================================
--
-- Au lieu de créer __seo_eeat_scores, __seo_helpful_content_audit,
-- __seo_content_freshness séparées, on étend la table existante
-- __seo_entity_health (créée par 20260123_seo_enterprise_dashboard.sql)
-- avec 4 colonnes JSONB.
--
-- Sémantique : cette table est déjà la "vue d'état actuel par entité"
-- (entity_score, risk_flag, risk_level). Y ajouter les scores E-E-A-T,
-- Helpful Content, freshness, et onpage_audit_summary est cohérent =
-- single source of truth par entité.
--
-- Phase 1 ajoute uniquement les colonnes (NULL par défaut).
-- Phases 2+5 ajouteront les services qui les peuplent.
-- =====================================================

ALTER TABLE __seo_entity_health
    ADD COLUMN IF NOT EXISTS eeat_scores JSONB,
    ADD COLUMN IF NOT EXISTS helpful_content_audit JSONB,
    ADD COLUMN IF NOT EXISTS freshness_state JSONB,
    ADD COLUMN IF NOT EXISTS onpage_audit_summary JSONB;

COMMENT ON COLUMN __seo_entity_health.eeat_scores IS 'E-E-A-T local scoring (Phase 5). Schema: seo-types/geo-aeo.ts EEATScoresSchema';
COMMENT ON COLUMN __seo_entity_health.helpful_content_audit IS 'Helpful Content audit (Phase 5). Schema: seo-types/geo-aeo.ts HelpfulContentAuditSchema';
COMMENT ON COLUMN __seo_entity_health.freshness_state IS 'Content freshness state (Phase 3). Schema: seo-types/content-ops.ts FreshnessStateSchema';
COMMENT ON COLUMN __seo_entity_health.onpage_audit_summary IS 'Aggregat des findings on-page open par entity (Phase 2). Schema: seo-types/onpage.ts OnpageAuditSummarySchema';

-- GIN indexes uniquement sur les colonnes susceptibles d'être interrogées en filtre JSONB
-- (eeat_scores et freshness_state servent surtout en lecture par entity_id, pas en search)
-- On ajoute GIN seulement sur onpage_audit_summary (queries possibles "entités avec ≥X findings critical")
CREATE INDEX IF NOT EXISTS idx_entity_health_onpage_summary_gin
    ON __seo_entity_health USING GIN (onpage_audit_summary)
    WHERE onpage_audit_summary IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_entity_health_freshness_priority
    ON __seo_entity_health ((freshness_state->>'refresh_priority'))
    WHERE freshness_state IS NOT NULL;

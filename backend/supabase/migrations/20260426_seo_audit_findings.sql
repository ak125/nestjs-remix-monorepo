-- =====================================================
-- SEO Audit Findings — Unified findings table (Phase 2)
-- Date: 2026-04-26
-- Refs: ADR-025-seo-department-architecture (DB lean design)
--       packages/seo-types/src/onpage.ts (Zod mirror — discriminated union)
-- =====================================================
--
-- Single Postgres table replaces 5 originally proposed :
--   __seo_schema_violations + __seo_meta_experiments + __seo_image_audit
--   + __seo_canonical_audit + __seo_internal_link_suggestions
--
-- Discrimination par audit_type ENUM strict + payload_jsonb GIN-indexé.
-- Schemas Zod par variant (cf. seo-types/onpage.ts) garantissent la
-- type safety au runtime côté NestJS.
--
-- Pattern identique à __seo_event_log (Phase 1) — extensible via
-- ALTER TYPE seo_audit_type ADD VALUE 'new_variant' sans migration table.
-- =====================================================

-- ENUM type pour audit_type (extensible via ALTER TYPE)
DO $$ BEGIN
    CREATE TYPE seo_audit_type AS ENUM (
        'schema_violation',
        'image_seo',
        'canonical_conflict',
        'meta_experiment',
        'internal_link_suggestion'
    );
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

-- seo_severity ENUM est déjà créé en Phase 1 (event_log migration), réutilisation.

CREATE TABLE IF NOT EXISTS __seo_audit_findings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_type seo_audit_type NOT NULL,
    entity_url TEXT NOT NULL,
    severity seo_severity NOT NULL DEFAULT 'medium',
    payload JSONB NOT NULL,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    fixed_at TIMESTAMPTZ
);

-- Indexes :
-- - (audit_type, entity_url) pour "trouver tous les findings d'un type sur une URL"
-- - (entity_url) pour "tous les findings sur une URL" (cross-type)
-- - (detected_at) pour TTL/cleanup
-- - (audit_type, severity, detected_at) pour dashboard "critical findings open"
-- - GIN(payload) pour requêtes JSONB filtrées (ex: schema_type='Product')

CREATE INDEX IF NOT EXISTS idx_seo_audit_findings_type_url
    ON __seo_audit_findings (audit_type, entity_url);

CREATE INDEX IF NOT EXISTS idx_seo_audit_findings_url_open
    ON __seo_audit_findings (entity_url, detected_at DESC)
    WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_seo_audit_findings_severity_open
    ON __seo_audit_findings (audit_type, severity, detected_at DESC)
    WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_seo_audit_findings_payload_gin
    ON __seo_audit_findings USING GIN (payload);

COMMENT ON TABLE __seo_audit_findings IS 'Findings on-page unifiés (schema/image/canonical/meta-ab/linking). Variants discriminés par audit_type avec payload typé Zod (cf. seo-types/onpage.ts).';

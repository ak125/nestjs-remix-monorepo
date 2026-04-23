-- =============================================================================
-- Migration : A01 — CREATE TABLE __rag_proposals (R8 RAG Control Plane)
-- Date      : 2026-04-24
-- Severity  : LOW (additive only, new empty table, zero impact on existing flows)
-- ADR       : ADR-022 (R8 RAG Control Plane — Propose-Before-Write + 5-Layer Gates)
-- Spec      : ledger/knowledge/r8-rag-control-plane-design-20260423.md § 5.1
-- Plan      : ledger/knowledge/r8-rag-control-plane-implementation-plan-20260423.md A01
-- =============================================================================
--
-- PURPOSE
-- -------
-- Table fondatrice du Layer 1 (propose-before-write) du plan de contrôle R8.
-- `VehicleRagGeneratorService` et l'éditorial insèrent ici des *proposals* de
-- changement de fichier RAG `/rag/knowledge/vehicles/{slug}.{md,variations.yaml,
-- role_map.json}`. Aucune écriture directe sur disque. Les proposals transitent
-- par les status pending → validating → approved → merged, avec gates CI à
-- chaque étape (JSON Schema, forbidden terms, FK check).
--
-- RLS (per ADR-021 zero-trust)
-- ----------------------------
-- * RLS enabled
-- * service_role : full access (backend bypass via BYPASSRLS grant)
-- * No anon / authenticated grant : any read/write from client side = denied
--
-- IDEMPOTENCE
-- -----------
-- * CREATE TABLE IF NOT EXISTS
-- * CREATE INDEX IF NOT EXISTS
-- * CREATE POLICY inside DO block (pattern ADR-021)
-- Re-running this migration on an already-migrated DB is safe, no-op.
--
-- ROLLBACK
-- --------
-- Table is new + empty. Rollback = `DROP TABLE IF EXISTS public.__rag_proposals;`
-- No data loss risk (no existing consumers of this table as of 2026-04-24).
--
-- CHECK CONSTRAINT CRITIQUE
-- -------------------------
-- `chk_approved_requires_validation` : status='approved' impossible si
-- schema_valid IS NOT TRUE. Empêche par design qu'une proposal soit approved
-- sans que le gate JSON Schema ait tourné et passé.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Table __rag_proposals
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.__rag_proposals (
    id BIGSERIAL PRIMARY KEY,
    proposal_uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,

    -- Target (RAG file destination)
    target_path TEXT NOT NULL,
    target_slug TEXT NOT NULL,
    target_kind TEXT NOT NULL,

    -- Proposal content (diff vs git HEAD)
    base_commit_sha TEXT NOT NULL,
    base_content_hash TEXT,                    -- NULL if new file
    proposed_content TEXT NOT NULL,
    proposed_content_hash TEXT NOT NULL,
    diff_unified TEXT,

    -- Idempotence / dedup
    input_fingerprint TEXT NOT NULL,           -- hash stable of DB inputs (modele_id + TecDoc sync SHA + motorisations count)

    -- Lifecycle
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by TEXT NOT NULL,                  -- service@version or user@email
    validated_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    approved_by TEXT,
    rejected_at TIMESTAMPTZ,
    rejection_reason TEXT,
    merged_at TIMESTAMPTZ,
    merged_commit_sha TEXT,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),

    -- Risk classification
    risk_level TEXT NOT NULL,
    risk_flags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    diff_lines_added INT NOT NULL DEFAULT 0,
    diff_lines_removed INT NOT NULL DEFAULT 0,

    -- Validation results (filled by CI L1 gate)
    schema_valid BOOLEAN,
    forbidden_terms_found TEXT[],
    placeholders_unresolved TEXT[],
    validation_report JSONB,

    -- Dependencies
    depends_on UUID REFERENCES public.__rag_proposals(proposal_uuid),
    superseded_by UUID REFERENCES public.__rag_proposals(proposal_uuid),

    -- Enum constraints (CHECK for narrow taxonomy)
    CONSTRAINT chk_target_kind CHECK (target_kind IN ('vehicle_model', 'variations', 'role_map')),
    CONSTRAINT chk_status CHECK (status IN ('pending', 'validating', 'approved', 'rejected', 'merged', 'expired', 'superseded')),
    CONSTRAINT chk_risk_level CHECK (risk_level IN ('low', 'medium', 'high')),

    -- CRITICAL: approval cannot happen before validation passed
    CONSTRAINT chk_approved_requires_validation CHECK (
        status <> 'approved' OR (schema_valid IS TRUE AND (forbidden_terms_found IS NULL OR array_length(forbidden_terms_found, 1) IS NULL))
    )
);

COMMENT ON TABLE public.__rag_proposals IS
    'L1 propose-before-write staging for RAG vehicle files. ADR-022. Status flows pending->validating->approved->merged, with CI gates between each. No direct fs writes from generator service. service_role only (RLS).';

COMMENT ON COLUMN public.__rag_proposals.target_kind IS 'Artefact type: vehicle_model (.md), variations (.variations.yaml), role_map (.role_map.json)';
COMMENT ON COLUMN public.__rag_proposals.input_fingerprint IS 'Stable hash of generator inputs — dedup pending/validating/approved proposals for same input';
COMMENT ON COLUMN public.__rag_proposals.risk_level IS 'low=auto-approve eligible, medium=editorial human review, high=CODEOWNER vehicle-schema review';
COMMENT ON COLUMN public.__rag_proposals.status IS 'Lifecycle: pending→validating→(approved|rejected); approved→merged; pending/validating→expired (14j); pending/validating→superseded (new proposal same fingerprint)';

-- -----------------------------------------------------------------------------
-- 2. Indexes
-- -----------------------------------------------------------------------------

-- Active queue scan (CI poller fetches pending/validating/approved)
CREATE INDEX IF NOT EXISTS idx_rag_proposals_status_expires
    ON public.__rag_proposals (status, expires_at)
    WHERE status IN ('pending', 'validating', 'approved');

-- Slug lookup (audit, find all proposals for a given model)
CREATE INDEX IF NOT EXISTS idx_rag_proposals_target_slug
    ON public.__rag_proposals (target_slug);

-- Idempotence: unique input_fingerprint on ACTIVE proposals only
-- (allows re-propose after rejected/expired/merged without fighting old rows)
CREATE UNIQUE INDEX IF NOT EXISTS idx_rag_proposals_fingerprint_active
    ON public.__rag_proposals (input_fingerprint)
    WHERE status IN ('pending', 'validating', 'approved');

-- Chain traversal (depends_on / superseded_by graph)
CREATE INDEX IF NOT EXISTS idx_rag_proposals_depends_on
    ON public.__rag_proposals (depends_on)
    WHERE depends_on IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rag_proposals_superseded_by
    ON public.__rag_proposals (superseded_by)
    WHERE superseded_by IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 3. Row Level Security (pattern ADR-021 zero-trust)
-- -----------------------------------------------------------------------------

ALTER TABLE public.__rag_proposals ENABLE ROW LEVEL SECURITY;

-- Idempotent policy creation (pattern ADR-021 : DO block, no DROP IF EXISTS + CREATE)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = '__rag_proposals'
          AND policyname = 'service_role_all'
    ) THEN
        CREATE POLICY service_role_all
            ON public.__rag_proposals
            AS PERMISSIVE
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 4. Grants (explicit, per ADR-021: no anon, no authenticated)
-- -----------------------------------------------------------------------------

-- Revoke any default grants that might exist from schema-level grants
REVOKE ALL ON public.__rag_proposals FROM anon;
REVOKE ALL ON public.__rag_proposals FROM authenticated;

-- service_role already has BYPASSRLS + ALL on all tables via role attribute;
-- we do not re-grant here (pattern verified in ADR-021 PR #42).

COMMIT;

-- =============================================================================
-- End of migration.
-- Rollback: DROP TABLE IF EXISTS public.__rag_proposals CASCADE;
-- =============================================================================

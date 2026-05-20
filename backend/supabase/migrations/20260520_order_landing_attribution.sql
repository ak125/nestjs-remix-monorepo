-- =====================================================
-- Order Landing Attribution (Étape 0 — PR-INST-1)
-- Date: 2026-05-20
-- Refs: plans/utiliser-superpower-toasty-charm.md (Étape 0, corrected)
--       docs/superpowers/plans/2026-05-20-organic-landing-attribution.md
-- =====================================================
-- First-party server-side attribution, complements existing ga_client_id.
-- New columns are NULLABLE: existing rows stay NULL (no backfill needed,
-- "unknown attribution" is the correct value for pre-instrumentation orders).
-- ___xtr_order is small (~1.7k rows / ~2 MB), so the CHECK constraint
-- validates instantly — no NOT VALID/VALIDATE split needed.
-- =====================================================

ALTER TABLE ___xtr_order
    ADD COLUMN IF NOT EXISTS landing_source        TEXT,
    ADD COLUMN IF NOT EXISTS landing_path          TEXT,
    ADD COLUMN IF NOT EXISTS landing_first_seen_at TIMESTAMPTZ;

-- Closed-enum guard at the DB layer (defense in depth; app also validates).
-- Allow NULL (unknown). Reject typos so dashboard aggregates stay clean.
ALTER TABLE ___xtr_order
    DROP CONSTRAINT IF EXISTS chk_xtr_order_landing_source;
ALTER TABLE ___xtr_order
    ADD CONSTRAINT chk_xtr_order_landing_source
    CHECK (landing_source IS NULL OR landing_source IN
        ('organic','paid','social','email','referral','direct','campaign'));

-- Partial index for dashboard cohort queries (WHERE landing_source = 'organic').
CREATE INDEX IF NOT EXISTS idx_xtr_order_landing_source
    ON ___xtr_order (landing_source)
    WHERE landing_source IS NOT NULL;

COMMENT ON COLUMN ___xtr_order.landing_source IS
    'First-party attribution at first session hit: organic|paid|social|email|referral|direct|campaign. NULL = pre-instrumentation or untraceable. Complements ga_client_id.';
COMMENT ON COLUMN ___xtr_order.landing_path IS
    'URL pathname of the landing page (no query string — PII-safe).';
COMMENT ON COLUMN ___xtr_order.landing_first_seen_at IS
    'Timestamp of the first hit of the attributed session (ISO/TIMESTAMPTZ).';

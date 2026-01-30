-- Migration: Create __seo_keywords table for keyword-engine data
-- Purpose: Store classified SEO keywords for automotive parts search optimization
--
-- V-Level Classification:
-- - V2: Motorization found in Google Suggest (champion)
-- - V3: Motorization NOT found (challenger)
-- - V1: Motorization is V2 in multiple gammes (super-champion, inter-gammes)
-- - V4: Reserved for explicitly marked as not found
-- - V5: BLOC B only (reverse search vehicle → parts) - OUT OF SCOPE

-- ============================================================
-- CREATE TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS __seo_keywords (
    id BIGSERIAL PRIMARY KEY,

    -- Identification
    keyword TEXT NOT NULL,                    -- "disque de frein clio 3 1.5 dci"
    keyword_normalized TEXT NOT NULL,         -- Normalized version (lowercase, no accents)
    gamme TEXT NOT NULL,                      -- "disque de frein"

    -- Classification
    type TEXT NOT NULL CHECK (type IN ('vehicle', 'content', 'generic')),
    v_level TEXT CHECK (v_level IN ('V1', 'V2', 'V3', 'V4', 'V5')),

    -- Vehicle data (if type = 'vehicle')
    model TEXT,                               -- "clio"
    generation TEXT,                          -- "3"
    variant TEXT,                             -- "1.5 dci" or "w204" or "rs"
    energy TEXT,                              -- "diesel", "essence", "unknown"
    famille_moteur TEXT,                      -- "K9K", "DV6"
    displacement NUMERIC(3,1),                -- 1.5, 2.0
    power INTEGER,                            -- 90 (CV)
    finition TEXT,                            -- "rs", "gti", "alpine"

    -- Metrics
    best_rank INTEGER,                        -- Position in Google Suggest
    v2_repetitions INTEGER DEFAULT 0,         -- Number of gammes where V2

    -- Content data (if type = 'content')
    content_type TEXT,                        -- "howto", "timing", "symptom", "diagnostic"

    -- Metadata
    source TEXT DEFAULT 'keyword-engine',     -- Collection source
    collected_at TIMESTAMPTZ DEFAULT NOW(),   -- Collection date
    updated_at TIMESTAMPTZ DEFAULT NOW(),     -- Last update

    -- Constraints
    UNIQUE(keyword, gamme)                    -- One keyword per gamme
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Fast lookup by gamme
CREATE INDEX IF NOT EXISTS idx_seo_keywords_gamme
ON __seo_keywords(gamme);

-- Fast lookup by type
CREATE INDEX IF NOT EXISTS idx_seo_keywords_type
ON __seo_keywords(type);

-- Fast lookup by model (for vehicle keywords)
CREATE INDEX IF NOT EXISTS idx_seo_keywords_model
ON __seo_keywords(model) WHERE model IS NOT NULL;

-- Fast lookup by v_level
CREATE INDEX IF NOT EXISTS idx_seo_keywords_v_level
ON __seo_keywords(v_level) WHERE v_level IS NOT NULL;

-- Fast lookup by energy
CREATE INDEX IF NOT EXISTS idx_seo_keywords_energy
ON __seo_keywords(energy) WHERE energy IS NOT NULL;

-- Composite for vehicle queries
CREATE INDEX IF NOT EXISTS idx_seo_keywords_vehicle_lookup
ON __seo_keywords(gamme, model, energy) WHERE type = 'vehicle';

-- Full-text search on keyword
CREATE INDEX IF NOT EXISTS idx_seo_keywords_keyword_fts
ON __seo_keywords USING gin(to_tsvector('french', keyword));

-- ============================================================
-- TRIGGER: Update updated_at timestamp
-- ============================================================
CREATE OR REPLACE FUNCTION update_seo_keywords_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_seo_keywords_updated_at ON __seo_keywords;
CREATE TRIGGER trg_seo_keywords_updated_at
    BEFORE UPDATE ON __seo_keywords
    FOR EACH ROW
    EXECUTE FUNCTION update_seo_keywords_updated_at();

-- ============================================================
-- COMMENTS
-- ============================================================
COMMENT ON TABLE __seo_keywords IS 'SEO keywords collected and classified by the keyword-engine pipeline';
COMMENT ON COLUMN __seo_keywords.v_level IS 'V1=champion inter-gammes, V2=champion gamme (motorization found), V3=challenger (not found), V4=reserved, V5=BLOC B only';
COMMENT ON COLUMN __seo_keywords.variant IS 'Motorization variant: displacement+motor_type (1.5 dci), chassis code (w204), or finition (rs)';
COMMENT ON COLUMN __seo_keywords.best_rank IS 'Position in Google Suggest (1=first suggestion, lower is better)';
COMMENT ON COLUMN __seo_keywords.v2_repetitions IS 'Number of gammes where this variant is V2 (used to determine V1)';

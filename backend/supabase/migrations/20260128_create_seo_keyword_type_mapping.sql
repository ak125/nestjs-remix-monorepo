-- Migration: Create __seo_keyword_type_mapping table
-- Purpose: Link __seo_keywords to auto_type.type_id with confidence score
-- This solves the motor_key collision problem (178 motor_keys vs 476 lignes V2/V3)

-- 1. Create mapping table
CREATE TABLE IF NOT EXISTS __seo_keyword_type_mapping (
  id SERIAL PRIMARY KEY,
  pg_id INTEGER NOT NULL,
  keyword_id BIGINT NOT NULL REFERENCES __seo_keywords(id) ON DELETE CASCADE,
  type_id TEXT NOT NULL,
  confidence FLOAT DEFAULT 0.0 CHECK (confidence >= 0 AND confidence <= 1),
  match_method TEXT DEFAULT 'fuzzy', -- 'exact', 'fuzzy', 'manual'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one mapping per keyword
  CONSTRAINT uq_keyword_type_mapping UNIQUE (keyword_id, type_id)
);

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_seo_keyword_type_mapping_pg_id
  ON __seo_keyword_type_mapping(pg_id);

CREATE INDEX IF NOT EXISTS idx_seo_keyword_type_mapping_keyword_id
  ON __seo_keyword_type_mapping(keyword_id);

CREATE INDEX IF NOT EXISTS idx_seo_keyword_type_mapping_type_id
  ON __seo_keyword_type_mapping(type_id);

CREATE INDEX IF NOT EXISTS idx_seo_keyword_type_mapping_confidence
  ON __seo_keyword_type_mapping(confidence)
  WHERE confidence >= 0.9;

-- 3. Add trigger for updated_at
CREATE OR REPLACE FUNCTION trg_seo_keyword_type_mapping_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_seo_keyword_type_mapping ON __seo_keyword_type_mapping;
CREATE TRIGGER trg_update_seo_keyword_type_mapping
  BEFORE UPDATE ON __seo_keyword_type_mapping
  FOR EACH ROW
  EXECUTE FUNCTION trg_seo_keyword_type_mapping_updated_at();

-- 4. Comment
COMMENT ON TABLE __seo_keyword_type_mapping IS
  'Maps __seo_keywords to auto_type.type_id with confidence score for stable V4 matching';
COMMENT ON COLUMN __seo_keyword_type_mapping.confidence IS
  'Matching confidence: 1.0=exact, 0.9+=high, <0.9=low (requires review)';
COMMENT ON COLUMN __seo_keyword_type_mapping.match_method IS
  'How the match was determined: exact, fuzzy, or manual';

-- Migration: Add score_seo column to __seo_keywords
-- Version: V-Level v3.0
-- Date: 2026-02-01
--
-- score_seo = volume × (1 + nb_v4 / 5)
-- Used to rank V3 champions and select TOP 20 for V2 promotion

-- 1. Add score_seo column
ALTER TABLE __seo_keywords
ADD COLUMN IF NOT EXISTS score_seo INTEGER DEFAULT NULL;

-- 2. Add index for performance (sorting by score_seo per gamme)
CREATE INDEX IF NOT EXISTS idx_seo_keywords_score_seo
ON __seo_keywords(pg_id, score_seo DESC NULLS LAST)
WHERE v_level IN ('V2', 'V3');

-- 3. Comment for documentation
COMMENT ON COLUMN __seo_keywords.score_seo IS
'SEO score = volume × (1 + nb_v4/5). Used to rank champions and select TOP 20 V2 per gamme. V-Level v3.0';

-- 4. Migration script for existing data: shift v_level values
-- V5 → V6 (Bloc B)
-- V4 → V5 (volume = 0)
-- V3 → V4 (variants)
-- V2 → V3 (champions locaux)
-- Then TOP 20 V3 → V2 (see insert-missing-keywords.ts)

-- Step 1: Rename V5 → V6 (Bloc B catalogue)
UPDATE __seo_keywords
SET v_level = 'V6'
WHERE v_level = 'V5';

-- Step 2: Rename V4 → V5 (volume = 0)
UPDATE __seo_keywords
SET v_level = 'V5'
WHERE v_level = 'V4';

-- Step 3: Rename V3 → V4 (variants secondaires)
UPDATE __seo_keywords
SET v_level = 'V4'
WHERE v_level = 'V3';

-- Step 4: Rename V2 → V3 (champions locaux)
UPDATE __seo_keywords
SET v_level = 'V3'
WHERE v_level = 'V2';

-- Note: V1 stays V1 (inter-gammes champions)
-- Note: TOP 20 V3 → V2 promotion will be done by insert-missing-keywords.ts
-- after calculating score_seo for each keyword

-- 5. Add constraint to validate v_level values
ALTER TABLE __seo_keywords
DROP CONSTRAINT IF EXISTS check_v_level_valid;

ALTER TABLE __seo_keywords
ADD CONSTRAINT check_v_level_valid
CHECK (v_level IS NULL OR v_level IN ('V1', 'V2', 'V3', 'V4', 'V5', 'V6'));

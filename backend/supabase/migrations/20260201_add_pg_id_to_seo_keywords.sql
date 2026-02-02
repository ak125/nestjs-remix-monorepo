-- Migration: Add pg_id column to __seo_keywords
-- Version: V-Level v3.0 fix
-- Date: 2026-02-01
-- Purpose: Enable proper FK relationship with pieces_gamme for performance and integrity

-- 1. Add the pg_id column (INTEGER to match pieces_gamme.pg_id)
ALTER TABLE __seo_keywords
ADD COLUMN IF NOT EXISTS pg_id INTEGER;

-- 2. Populate pg_id from pieces_gamme using gamme name
UPDATE __seo_keywords k
SET pg_id = pg.pg_id::INTEGER
FROM pieces_gamme pg
WHERE LOWER(TRIM(k.gamme)) = LOWER(TRIM(pg.pg_name))
  AND k.pg_id IS NULL;

-- 3. Add index for fast lookups by pg_id
CREATE INDEX IF NOT EXISTS idx_seo_keywords_pg_id
ON __seo_keywords(pg_id);

-- 4. Add composite index for common queries (pg_id + v_level)
CREATE INDEX IF NOT EXISTS idx_seo_keywords_pg_id_vlevel
ON __seo_keywords(pg_id, v_level)
WHERE v_level IS NOT NULL;

-- 5. Comment for documentation
COMMENT ON COLUMN __seo_keywords.pg_id IS
'Foreign key to pieces_gamme.pg_id - Added in V-Level v3.0 for proper FK integrity and query performance';

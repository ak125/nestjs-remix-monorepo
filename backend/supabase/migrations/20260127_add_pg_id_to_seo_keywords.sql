-- Migration: Add pg_id column to __seo_keywords for direct lookup
-- Date: 2026-01-27
-- Purpose: Enable efficient V-Level queries by pg_id instead of gamme name matching
--
-- Background: The V-Level tab in admin was showing 0 items because it queried
-- gamme_seo_metrics (empty table) instead of __seo_keywords (1026+ keywords).
-- Adding pg_id allows direct lookup by gamme ID in Promise.all parallel queries.

-- ============================================================
-- ADD pg_id COLUMN
-- ============================================================
ALTER TABLE __seo_keywords
ADD COLUMN IF NOT EXISTS pg_id INTEGER;

-- ============================================================
-- CREATE INDEX
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_seo_keywords_pg_id
ON __seo_keywords(pg_id)
WHERE pg_id IS NOT NULL;

-- ============================================================
-- BACKFILL: Match gamme text to pieces_gamme.pg_id
-- ============================================================
-- This UPDATE matches the gamme text (case-insensitive, trimmed)
-- to pieces_gamme.pg_name to populate pg_id for existing rows

UPDATE __seo_keywords sk
SET pg_id = pg.pg_id::INTEGER
FROM pieces_gamme pg
WHERE LOWER(TRIM(sk.gamme)) = LOWER(TRIM(pg.pg_name))
  AND sk.pg_id IS NULL;

-- Also try matching with pg_alias for gammes that use alias names
UPDATE __seo_keywords sk
SET pg_id = pg.pg_id::INTEGER
FROM pieces_gamme pg
WHERE LOWER(TRIM(sk.gamme)) = LOWER(TRIM(pg.pg_alias))
  AND sk.pg_id IS NULL;

-- ============================================================
-- VERIFY BACKFILL RESULTS
-- ============================================================
-- Run this query to check backfill status:
-- SELECT
--   COUNT(*) as total,
--   COUNT(pg_id) as with_pg_id,
--   COUNT(*) - COUNT(pg_id) as missing_pg_id
-- FROM __seo_keywords;

-- ============================================================
-- COMMENTS
-- ============================================================
COMMENT ON COLUMN __seo_keywords.pg_id IS 'Foreign key to pieces_gamme.pg_id for efficient lookups';

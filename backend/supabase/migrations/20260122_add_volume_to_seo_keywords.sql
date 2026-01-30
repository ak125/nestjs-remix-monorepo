-- Migration: Add volume column to __seo_keywords table
-- Date: 2026-01-22
-- Description: Adds search volume column for V-Level classification by volume

-- Add volume column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = '__seo_keywords' AND column_name = 'volume'
    ) THEN
        ALTER TABLE __seo_keywords ADD COLUMN volume INTEGER DEFAULT 0;
    END IF;
END $$;

-- Add index for volume-based queries
CREATE INDEX IF NOT EXISTS idx_seo_keywords_volume
    ON __seo_keywords(volume DESC)
    WHERE volume > 0;

-- Comment
COMMENT ON COLUMN __seo_keywords.volume IS 'Volume de recherche mensuel (Google Keyword Planner)';

-- Migration: Add content type fields to __blog_advice for HUB Conseils
-- Sprint 1 — Blog Hub SEO-First

ALTER TABLE __blog_advice
  ADD COLUMN IF NOT EXISTS ba_content_type TEXT
    CHECK (ba_content_type IN ('HOWTO','DIAGNOSTIC','BUYING_GUIDE','GLOSSARY')),
  ADD COLUMN IF NOT EXISTS ba_difficulty SMALLINT CHECK (ba_difficulty BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS ba_time_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS ba_tools_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ba_primary_gamme_slug TEXT;

CREATE INDEX IF NOT EXISTS idx_blog_advice_content_type ON __blog_advice(ba_content_type);
CREATE INDEX IF NOT EXISTS idx_blog_advice_gamme_slug ON __blog_advice(ba_primary_gamme_slug);

-- Backfill primary_gamme_slug from pieces_gamme
UPDATE __blog_advice ba SET ba_primary_gamme_slug = pg.pg_alias
FROM pieces_gamme pg WHERE ba.ba_pg_id = pg.pg_id::text AND ba.ba_primary_gamme_slug IS NULL;

-- Backfill HOWTO based on H2 section titles
UPDATE __blog_advice SET ba_content_type = 'HOWTO'
WHERE ba_content_type IS NULL AND ba_id IN (
  SELECT DISTINCT ba2_ba_id FROM __blog_advice_h2
  WHERE LOWER(ba2_h2) ~ '(montage|installation|remplacement|comment|etape|procedure|depose|repose)'
);

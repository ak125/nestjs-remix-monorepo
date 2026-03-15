-- Migration: R4 Taxonomy + Full-Text Search + Trigram
-- Date: 2026-03-12
-- Status: APPLIED (executed via MCP)

-- Step 1: Taxonomy columns
ALTER TABLE __seo_reference ADD COLUMN IF NOT EXISTS system TEXT;
ALTER TABLE __seo_reference ADD COLUMN IF NOT EXISTS part_type TEXT;
ALTER TABLE __seo_reference ADD COLUMN IF NOT EXISTS level TEXT DEFAULT 'intermediaire';
ALTER TABLE __seo_reference ADD COLUMN IF NOT EXISTS search_aliases TEXT[];
ALTER TABLE __seo_reference ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE INDEX IF NOT EXISTS idx_seo_ref_system ON __seo_reference(system) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_seo_ref_part_type ON __seo_reference(part_type) WHERE is_published = true;

-- Step 2: Populate system from catalog_family.mf_name
UPDATE __seo_reference r
SET system = cf.mf_name
FROM pieces_gamme pg
JOIN catalog_gamme cg ON pg.pg_id::text = cg.mc_pg_id
JOIN catalog_family cf ON cg.mc_mf_id = cf.mf_id
WHERE pg.pg_id = r.pg_id AND r.system IS NULL;

-- Step 3: Normalize titles (keep only piece name)
UPDATE __seo_reference
SET title = TRIM(regexp_replace(title, '\s*[:|].*$', ''))
WHERE title ~ '[:|]';

-- Step 4: Full-text search trigger
CREATE OR REPLACE FUNCTION update_ref_search_vector() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('french', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('french', COALESCE(array_to_string(NEW.synonyms, ' '), '')), 'A') ||
    setweight(to_tsvector('french', COALESCE(array_to_string(NEW.search_aliases, ' '), '')), 'B') ||
    setweight(to_tsvector('french', COALESCE(LEFT(NEW.definition, 500), '')), 'C');
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ref_search_vector ON __seo_reference;
CREATE TRIGGER trg_ref_search_vector
  BEFORE INSERT OR UPDATE ON __seo_reference
  FOR EACH ROW EXECUTE FUNCTION update_ref_search_vector();

-- Recalculate search_vector for all rows
UPDATE __seo_reference SET title = title WHERE TRUE;

-- Step 5: GIN indexes
CREATE INDEX IF NOT EXISTS idx_seo_ref_search ON __seo_reference USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_seo_ref_title_trgm ON __seo_reference USING gin(title gin_trgm_ops);

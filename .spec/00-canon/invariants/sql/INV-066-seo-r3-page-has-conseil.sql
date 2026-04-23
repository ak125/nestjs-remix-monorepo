-- INV-066: seo-r3-page-has-conseil
-- Domain: D6-consistency
-- Severity: medium
-- Description: Published R3 pages must have at least one conseil section for same pg_alias
-- Tables: __seo_page, __seo_page_brief, __seo_gamme_conseil
-- Returns 0 rows when invariant holds.

SELECT sp.id, sp.slug FROM __seo_page sp JOIN __seo_page_brief spb ON sp.entity_id = spb.id WHERE sp.status = 'published' AND sp.role = 'R3' AND NOT EXISTS ( SELECT 1 FROM __seo_gamme_conseil sgc WHERE sgc.pg_alias = spb.pg_alias );

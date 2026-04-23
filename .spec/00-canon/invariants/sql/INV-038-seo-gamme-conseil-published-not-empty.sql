-- INV-038: seo-gamme-conseil-published-not-empty
-- Domain: D3-seo
-- Severity: medium
-- Description: Published conseil sections must have non-empty content
-- Tables: __seo_gamme_conseil
-- Returns 0 rows when invariant holds.

SELECT id, pg_alias, section_key FROM __seo_gamme_conseil WHERE status = 'published' AND (content IS NULL OR content = '');

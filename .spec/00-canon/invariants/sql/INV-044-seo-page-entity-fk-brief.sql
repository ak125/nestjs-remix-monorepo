-- INV-044: seo-page-entity-fk-brief
-- Domain: D3-seo
-- Severity: medium
-- Description: __seo_page.entity_id must reference existing entry in __seo_page_brief where not null
-- Tables: __seo_page, __seo_page_brief
-- Returns 0 rows when invariant holds.

SELECT sp.id, sp.slug, sp.entity_id FROM __seo_page sp LEFT JOIN __seo_page_brief spb ON sp.entity_id = spb.id WHERE sp.entity_id IS NOT NULL AND spb.id IS NULL;

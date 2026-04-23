-- INV-062: no-orphan-seo-published-pages
-- Domain: D5-structural
-- Severity: high
-- Description: Published __seo_page without corresponding entity_id in __seo_page_brief = orphan
-- Tables: __seo_page, __seo_page_brief
-- Returns 0 rows when invariant holds.

SELECT sp.id, sp.slug FROM __seo_page sp WHERE sp.status = 'published' AND sp.entity_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM __seo_page_brief spb WHERE spb.id = sp.entity_id);

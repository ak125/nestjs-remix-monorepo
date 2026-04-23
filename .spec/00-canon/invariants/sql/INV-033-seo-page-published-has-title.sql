-- INV-033: seo-page-published-has-title
-- Domain: D3-seo
-- Severity: high
-- Description: Published __seo_page rows must have non-null non-empty title
-- Tables: __seo_page
-- Returns 0 rows when invariant holds.

SELECT id, slug FROM __seo_page WHERE status = 'published' AND (title IS NULL OR title = '');

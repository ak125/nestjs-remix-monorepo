-- INV-032: seo-page-published-has-slug
-- Domain: D3-seo
-- Severity: critical
-- Description: Published __seo_page rows must have non-null non-empty slug
-- Tables: __seo_page
-- Returns 0 rows when invariant holds.

SELECT id FROM __seo_page WHERE status = 'published' AND (slug IS NULL OR slug = '');

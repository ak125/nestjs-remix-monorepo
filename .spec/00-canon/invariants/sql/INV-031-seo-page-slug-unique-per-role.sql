-- INV-031: seo-page-slug-unique-per-role
-- Domain: D3-seo
-- Severity: critical
-- Description: __seo_page: slug must be unique per role
-- Tables: __seo_page
-- Returns 0 rows when invariant holds.

SELECT slug, role, COUNT(*) FROM __seo_page WHERE slug IS NOT NULL GROUP BY slug, role HAVING COUNT(*) > 1;

-- INV-035: seo-page-status-valid
-- Domain: D3-seo
-- Severity: high
-- Description: __seo_page.status must be in allowed set {draft,published,archived,review}
-- Tables: __seo_page
-- Returns 0 rows when invariant holds.

SELECT id, slug, status FROM __seo_page WHERE status NOT IN ('draft','published','archived','review');

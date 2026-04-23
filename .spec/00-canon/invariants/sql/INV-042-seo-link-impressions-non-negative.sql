-- INV-042: seo-link-impressions-non-negative
-- Domain: D3-seo
-- Severity: medium
-- Description: seo_link_impressions.impressions must be >= 0
-- Tables: seo_link_impressions
-- Returns 0 rows when invariant holds.

SELECT id FROM seo_link_impressions WHERE impressions < 0;

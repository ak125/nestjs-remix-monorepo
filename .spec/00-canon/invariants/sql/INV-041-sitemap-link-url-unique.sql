-- INV-041: sitemap-link-url-unique
-- Domain: D3-seo
-- Severity: medium
-- Description: __sitemap_p_link: no duplicate URL
-- Tables: __sitemap_p_link
-- Returns 0 rows when invariant holds.

SELECT url, COUNT(*) FROM __sitemap_p_link GROUP BY url HAVING COUNT(*) > 1;

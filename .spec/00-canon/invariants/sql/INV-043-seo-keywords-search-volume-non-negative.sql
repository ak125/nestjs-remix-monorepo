-- INV-043: seo-keywords-search-volume-non-negative
-- Domain: D3-seo
-- Severity: low
-- Description: __seo_keywords.search_volume must be >= 0 where defined
-- Tables: __seo_keywords
-- Returns 0 rows when invariant holds.

SELECT id, keyword FROM __seo_keywords WHERE search_volume IS NOT NULL AND search_volume < 0;

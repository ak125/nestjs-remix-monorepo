-- INV-040: seo-keywords-no-duplicate
-- Domain: D3-seo
-- Severity: medium
-- Description: __seo_keywords: no duplicate keyword for same (pg_alias, role)
-- Tables: __seo_keywords
-- Returns 0 rows when invariant holds.

SELECT pg_alias, role, keyword, COUNT(*) FROM __seo_keywords GROUP BY pg_alias, role, keyword HAVING COUNT(*) > 1;

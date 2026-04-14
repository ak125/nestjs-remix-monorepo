-- INV-039: seo-page-brief-pg-alias-unique-per-role
-- Domain: D3-seo
-- Severity: high
-- Description: __seo_page_brief: pg_alias must be unique per role
-- Tables: __seo_page_brief
-- Returns 0 rows when invariant holds.

SELECT pg_alias, role, COUNT(*) FROM __seo_page_brief WHERE pg_alias IS NOT NULL GROUP BY pg_alias, role HAVING COUNT(*) > 1;

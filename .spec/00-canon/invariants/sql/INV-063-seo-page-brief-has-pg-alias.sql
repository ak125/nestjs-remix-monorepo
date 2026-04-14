-- INV-063: seo-page-brief-has-pg-alias
-- Domain: D5-structural
-- Severity: high
-- Description: __seo_page_brief: pg_alias must not be null or empty
-- Tables: __seo_page_brief
-- Returns 0 rows when invariant holds.

SELECT id, role FROM __seo_page_brief WHERE pg_alias IS NULL OR pg_alias = '';

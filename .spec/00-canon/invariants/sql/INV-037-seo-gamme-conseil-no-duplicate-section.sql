-- INV-037: seo-gamme-conseil-no-duplicate-section
-- Domain: D3-seo
-- Severity: high
-- Description: __seo_gamme_conseil: no duplicate (pg_alias, section_key) pairs
-- Tables: __seo_gamme_conseil
-- Returns 0 rows when invariant holds.

SELECT pg_alias, section_key, COUNT(*) FROM __seo_gamme_conseil GROUP BY pg_alias, section_key HAVING COUNT(*) > 1;

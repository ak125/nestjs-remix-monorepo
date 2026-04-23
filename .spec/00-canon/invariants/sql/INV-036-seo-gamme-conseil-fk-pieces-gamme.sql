-- INV-036: seo-gamme-conseil-fk-pieces-gamme
-- Domain: D3-seo
-- Severity: high
-- Description: __seo_gamme_conseil.pg_alias must reference existing pg_alias in pieces_gamme
-- Tables: __seo_gamme_conseil, pieces_gamme
-- Returns 0 rows when invariant holds.

SELECT sgc.id, sgc.pg_alias FROM __seo_gamme_conseil sgc LEFT JOIN pieces_gamme pg ON sgc.pg_alias = pg.pg_alias WHERE sgc.pg_alias IS NOT NULL AND pg.pg_alias IS NULL;

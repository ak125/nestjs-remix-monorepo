-- INV-069: seo-gamme-conseil-pg-alias-matches-active-gamme
-- Domain: D6-consistency
-- Severity: high
-- Description: __seo_gamme_conseil.pg_alias must match an active gamme in pieces_gamme
-- Tables: __seo_gamme_conseil, pieces_gamme
-- Returns 0 rows when invariant holds.

SELECT sgc.id, sgc.pg_alias FROM __seo_gamme_conseil sgc LEFT JOIN pieces_gamme pg ON sgc.pg_alias = pg.pg_alias AND pg.pg_status = 'active' WHERE pg.pg_alias IS NULL;

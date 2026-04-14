-- INV-013: pieces-gamme-parent-fk-valid
-- Domain: D1-catalog
-- Severity: high
-- Description: pieces_gamme.pg_parent_gamme_id must reference a valid pg_id (when not null)
-- Tables: pieces_gamme
-- Returns 0 rows when invariant holds.

SELECT pg.pg_id, pg.pg_alias, pg.pg_parent_gamme_id FROM pieces_gamme pg LEFT JOIN pieces_gamme parent ON pg.pg_parent_gamme_id = parent.pg_id WHERE pg.pg_parent_gamme_id IS NOT NULL AND parent.pg_id IS NULL;

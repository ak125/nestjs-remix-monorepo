-- INV-012: pieces-gamme-parent-no-self-ref
-- Domain: D1-catalog
-- Severity: high
-- Description: No gamme may have pg_parent_gamme_id pointing to itself
-- Tables: pieces_gamme
-- Returns 0 rows when invariant holds.

SELECT pg_id, pg_alias, pg_parent_gamme_id FROM pieces_gamme WHERE pg_parent_gamme_id = pg_id;

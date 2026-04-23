-- INV-015: pieces-gamme-active-has-alias
-- Domain: D1-catalog
-- Severity: high
-- Description: Active gamme must have non-null non-empty pg_alias
-- Tables: pieces_gamme
-- Returns 0 rows when invariant holds.

SELECT pg_id FROM pieces_gamme WHERE pg_status = 'active' AND (pg_alias IS NULL OR pg_alias = '');

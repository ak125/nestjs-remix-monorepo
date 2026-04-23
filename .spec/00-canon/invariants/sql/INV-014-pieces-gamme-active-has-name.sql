-- INV-014: pieces-gamme-active-has-name
-- Domain: D1-catalog
-- Severity: medium
-- Description: Active gamme must have non-null non-empty pg_name
-- Tables: pieces_gamme
-- Returns 0 rows when invariant holds.

SELECT pg_id, pg_alias FROM pieces_gamme WHERE pg_status = 'active' AND (pg_name IS NULL OR pg_name = '');

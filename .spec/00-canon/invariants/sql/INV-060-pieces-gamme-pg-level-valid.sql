-- INV-060: pieces-gamme-pg-level-valid
-- Domain: D5-structural
-- Severity: medium
-- Description: pieces_gamme.pg_level must be in allowed set (top, mid, leaf, or null)
-- Tables: pieces_gamme
-- Returns 0 rows when invariant holds.

SELECT pg_id, pg_alias, pg_level FROM pieces_gamme WHERE pg_level IS NOT NULL AND pg_level NOT IN ('top','mid','leaf');

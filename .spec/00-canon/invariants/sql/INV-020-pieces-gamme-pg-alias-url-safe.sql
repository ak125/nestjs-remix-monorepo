-- INV-020: pieces-gamme-pg-alias-url-safe
-- Domain: D1-catalog
-- Severity: medium
-- Description: pieces_gamme.pg_alias must match pattern [a-z0-9-]+ (lowercase, digits, hyphens only)
-- Tables: pieces_gamme
-- Returns 0 rows when invariant holds.

SELECT pg_id, pg_alias FROM pieces_gamme WHERE pg_alias IS NOT NULL AND pg_alias !~ '^[a-z0-9-]+$';

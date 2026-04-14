-- INV-001: pg-alias-unique
-- Domain: D1-catalog
-- Severity: critical
-- Description: pg_alias must be unique and non-null in pieces_gamme
-- Tables: pieces_gamme
-- Returns 0 rows when invariant holds.

SELECT pg_alias, COUNT(*) FROM pieces_gamme WHERE pg_alias IS NOT NULL GROUP BY pg_alias HAVING COUNT(*) > 1;

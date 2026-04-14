-- INV-002: pg-alias-no-dup-suffix
-- Domain: D1-catalog
-- Severity: critical
-- Description: No pg_alias may contain '-dup' suffix
-- Tables: pieces_gamme
-- Returns 0 rows when invariant holds.

SELECT pg_id, pg_alias FROM pieces_gamme WHERE pg_alias LIKE '%-dup';

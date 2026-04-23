-- INV-003: pieces-gamme-pg-id-unique
-- Domain: D1-catalog
-- Severity: critical
-- Description: pieces_gamme.pg_id (PK) must be unique
-- Tables: pieces_gamme
-- Returns 0 rows when invariant holds.

SELECT pg_id, COUNT(*) FROM pieces_gamme GROUP BY pg_id HAVING COUNT(*) > 1;

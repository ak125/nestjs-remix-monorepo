-- INV-022: auto-type-type-id-i-unique
-- Domain: D2-vehicle
-- Severity: high
-- Description: auto_type.type_id_i (shadow INTEGER column) must be unique where not null
-- Tables: auto_type
-- Returns 0 rows when invariant holds.

SELECT type_id_i, COUNT(*) FROM auto_type WHERE type_id_i IS NOT NULL GROUP BY type_id_i HAVING COUNT(*) > 1;

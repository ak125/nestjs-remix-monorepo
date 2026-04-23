-- INV-021: auto-type-type-id-unique
-- Domain: D2-vehicle
-- Severity: critical
-- Description: auto_type.type_id must be unique
-- Tables: auto_type
-- Returns 0 rows when invariant holds.

SELECT type_id, COUNT(*) FROM auto_type GROUP BY type_id HAVING COUNT(*) > 1;

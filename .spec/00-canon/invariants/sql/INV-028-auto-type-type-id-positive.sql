-- INV-028: auto-type-type-id-positive
-- Domain: D2-vehicle
-- Severity: medium
-- Description: auto_type.type_id must be > 0 (positive TecDoc value)
-- Tables: auto_type
-- Returns 0 rows when invariant holds.

SELECT type_id FROM auto_type WHERE type_id::bigint <= 0;

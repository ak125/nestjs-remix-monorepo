-- INV-029: cars-engine-fk-auto-type
-- Domain: D2-vehicle
-- Severity: medium
-- Description: cars_engine must reference existing type_id in auto_type
-- Tables: cars_engine, auto_type
-- Returns 0 rows when invariant holds.

SELECT ce.id FROM cars_engine ce LEFT JOIN auto_type at ON ce.type_id = at.type_id WHERE ce.type_id IS NOT NULL AND at.type_id IS NULL;

-- INV-024: auto-type-number-code-fk
-- Domain: D2-vehicle
-- Severity: medium
-- Description: auto_type_number_code must reference existing type_id in auto_type
-- Tables: auto_type_number_code, auto_type
-- Returns 0 rows when invariant holds.

SELECT atnc.id FROM auto_type_number_code atnc LEFT JOIN auto_type at ON atnc.type_id = at.type_id WHERE atnc.type_id IS NOT NULL AND at.type_id IS NULL;

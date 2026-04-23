-- INV-057: auto-type-shadow-col-sync
-- Domain: D5-structural
-- Severity: high
-- Description: auto_type: type_id_i (INTEGER shadow) must not be null where type_id TEXT is non-null
-- Tables: auto_type
-- Returns 0 rows when invariant holds.

SELECT type_id FROM auto_type WHERE type_id IS NOT NULL AND type_id_i IS NULL;

-- INV-030: auto-type-not-all-null-identity
-- Domain: D2-vehicle
-- Severity: medium
-- Description: auto_type: at least one identity column (brand, model, type_label) must not be null
-- Tables: auto_type
-- Returns 0 rows when invariant holds.

SELECT type_id FROM auto_type WHERE marque IS NULL AND modele IS NULL AND type_label IS NULL;

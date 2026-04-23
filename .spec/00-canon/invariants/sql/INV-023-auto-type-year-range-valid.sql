-- INV-023: auto-type-year-range-valid
-- Domain: D2-vehicle
-- Severity: high
-- Description: auto_type: year_from <= year_to when both defined
-- Tables: auto_type
-- Returns 0 rows when invariant holds.

SELECT type_id, year_from, year_to FROM auto_type WHERE year_from IS NOT NULL AND year_to IS NOT NULL AND year_from > year_to;

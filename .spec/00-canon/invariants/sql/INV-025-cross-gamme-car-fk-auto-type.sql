-- INV-025: cross-gamme-car-fk-auto-type
-- Domain: D2-vehicle
-- Severity: high
-- Description: __cross_gamme_car_new must reference existing type_id in auto_type
-- Tables: __cross_gamme_car_new, auto_type
-- Returns 0 rows when invariant holds.

SELECT cgc.id FROM __cross_gamme_car_new cgc LEFT JOIN auto_type at ON cgc.type_id::text = at.type_id WHERE cgc.type_id IS NOT NULL AND at.type_id IS NULL;

-- INV-027: cross-gamme-car-no-duplicate-pair
-- Domain: D2-vehicle
-- Severity: medium
-- Description: __cross_gamme_car_new: each (gamme, vehicle) pair must be unique
-- Tables: __cross_gamme_car_new
-- Returns 0 rows when invariant holds.

SELECT pg_alias, type_id, COUNT(*) FROM __cross_gamme_car_new GROUP BY pg_alias, type_id HAVING COUNT(*) > 1;

-- INV-026: cross-gamme-car-fk-gamme
-- Domain: D2-vehicle
-- Severity: high
-- Description: __cross_gamme_car_new must reference existing pg_alias in pieces_gamme
-- Tables: __cross_gamme_car_new, pieces_gamme
-- Returns 0 rows when invariant holds.

SELECT cgc.id FROM __cross_gamme_car_new cgc LEFT JOIN pieces_gamme pg ON cgc.pg_alias = pg.pg_alias WHERE cgc.pg_alias IS NOT NULL AND pg.pg_alias IS NULL;

-- INV-051: order-line-unit-price-non-negative
-- Domain: D4-orders
-- Severity: high
-- Description: ___xtr_order_line.unit_price must be >= 0
-- Tables: ___xtr_order_line
-- Returns 0 rows when invariant holds.

SELECT id, order_id FROM ___xtr_order_line WHERE unit_price IS NOT NULL AND unit_price < 0;

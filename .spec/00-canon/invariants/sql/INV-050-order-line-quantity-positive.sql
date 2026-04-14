-- INV-050: order-line-quantity-positive
-- Domain: D4-orders
-- Severity: high
-- Description: ___xtr_order_line.quantity must be > 0
-- Tables: ___xtr_order_line
-- Returns 0 rows when invariant holds.

SELECT id, order_id FROM ___xtr_order_line WHERE quantity IS NULL OR quantity <= 0;

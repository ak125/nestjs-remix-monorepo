-- INV-005: order-amount-non-negative
-- Domain: D4-orders
-- Severity: critical
-- Description: All order amounts must be >= 0
-- Tables: ___xtr_order
-- Returns 0 rows when invariant holds.

SELECT id FROM ___xtr_order WHERE total_amount < 0 OR subtotal < 0;

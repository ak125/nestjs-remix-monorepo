-- INV-055: order-line-status-valid
-- Domain: D4-orders
-- Severity: medium
-- Description: ___xtr_order_line_status: status must be in allowed set
-- Tables: ___xtr_order_line_status
-- Returns 0 rows when invariant holds.

SELECT id, status FROM ___xtr_order_line_status WHERE status NOT IN ('pending','processing','shipped','delivered','cancelled','returned','refunded');

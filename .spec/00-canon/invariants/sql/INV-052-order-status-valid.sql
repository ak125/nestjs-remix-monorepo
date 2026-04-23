-- INV-052: order-status-valid
-- Domain: D4-orders
-- Severity: high
-- Description: ___xtr_order.status must be in allowed set
-- Tables: ___xtr_order
-- Returns 0 rows when invariant holds.

SELECT id, status FROM ___xtr_order WHERE status NOT IN ('pending','confirmed','shipped','delivered','cancelled','refunded');

-- INV-048: order-fk-customer
-- Domain: D4-orders
-- Severity: critical
-- Description: ___xtr_order must reference existing customer in ___xtr_customer
-- Tables: ___xtr_order, ___xtr_customer
-- Returns 0 rows when invariant holds.

SELECT o.id FROM ___xtr_order o LEFT JOIN ___xtr_customer c ON o.customer_id = c.id WHERE o.customer_id IS NOT NULL AND c.id IS NULL;

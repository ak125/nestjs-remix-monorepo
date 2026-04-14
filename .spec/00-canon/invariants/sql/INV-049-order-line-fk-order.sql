-- INV-049: order-line-fk-order
-- Domain: D4-orders
-- Severity: critical
-- Description: ___xtr_order_line must reference existing order in ___xtr_order
-- Tables: ___xtr_order_line, ___xtr_order
-- Returns 0 rows when invariant holds.

SELECT ol.id FROM ___xtr_order_line ol LEFT JOIN ___xtr_order o ON ol.order_id = o.id WHERE ol.order_id IS NOT NULL AND o.id IS NULL;

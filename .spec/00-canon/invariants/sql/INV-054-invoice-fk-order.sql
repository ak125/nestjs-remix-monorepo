-- INV-054: invoice-fk-order
-- Domain: D4-orders
-- Severity: high
-- Description: ___xtr_invoice must reference existing order in ___xtr_order (where FK is defined)
-- Tables: ___xtr_invoice, ___xtr_order
-- Returns 0 rows when invariant holds.

SELECT i.id FROM ___xtr_invoice i LEFT JOIN ___xtr_order o ON i.order_id = o.id WHERE i.order_id IS NOT NULL AND o.id IS NULL;

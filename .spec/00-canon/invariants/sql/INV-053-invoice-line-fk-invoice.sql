-- INV-053: invoice-line-fk-invoice
-- Domain: D4-orders
-- Severity: high
-- Description: ___xtr_invoice_line must reference existing invoice in ___xtr_invoice
-- Tables: ___xtr_invoice_line, ___xtr_invoice
-- Returns 0 rows when invariant holds.

SELECT il.id FROM ___xtr_invoice_line il LEFT JOIN ___xtr_invoice i ON il.invoice_id = i.id WHERE il.invoice_id IS NOT NULL AND i.id IS NULL;

-- INV-046: customer-email-not-null
-- Domain: D4-orders
-- Severity: critical
-- Description: ___xtr_customer.email must not be null or empty
-- Tables: ___xtr_customer
-- Returns 0 rows when invariant holds.

SELECT id FROM ___xtr_customer WHERE email IS NULL OR email = '';

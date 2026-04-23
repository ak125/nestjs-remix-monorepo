-- INV-047: customer-email-unique
-- Domain: D4-orders
-- Severity: high
-- Description: ___xtr_customer: no duplicate emails
-- Tables: ___xtr_customer
-- Returns 0 rows when invariant holds.

SELECT email, COUNT(*) FROM ___xtr_customer WHERE email IS NOT NULL GROUP BY email HAVING COUNT(*) > 1;

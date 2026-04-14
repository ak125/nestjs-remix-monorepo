-- INV-058: no-public-table-without-pk
-- Domain: D5-structural
-- Severity: critical
-- Description: No table in public schema may lack a primary key
-- Tables: information_schema.tables, information_schema.table_constraints
-- Returns 0 rows when invariant holds.

SELECT t.table_name FROM information_schema.tables t WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE' AND NOT EXISTS ( SELECT 1 FROM information_schema.table_constraints tc WHERE tc.table_schema = 'public' AND tc.table_name = t.table_name AND tc.constraint_type = 'PRIMARY KEY' );

-- INV-011: pieces-relation-criteria-fk-auto-type
-- Domain: D1-catalog
-- Severity: high
-- Description: pieces_relation_criteria.rcp_type_id must reference existing vehicle in auto_type
-- Tables: pieces_relation_criteria, auto_type
-- Returns 0 rows when invariant holds.

SELECT prc.rcp_id FROM pieces_relation_criteria prc LEFT JOIN auto_type at ON prc.rcp_type_id::text = at.type_id WHERE prc.rcp_type_id IS NOT NULL AND at.type_id IS NULL;

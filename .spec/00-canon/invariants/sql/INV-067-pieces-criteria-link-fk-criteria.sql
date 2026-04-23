-- INV-067: pieces-criteria-link-fk-criteria
-- Domain: D6-consistency
-- Severity: medium
-- Description: pieces_criteria_link must reference existing criteria in pieces_criteria
-- Tables: pieces_criteria_link, pieces_criteria
-- Returns 0 rows when invariant holds.

SELECT pcl.id FROM pieces_criteria_link pcl LEFT JOIN pieces_criteria pc ON pcl.criteria_id = pc.id WHERE pcl.criteria_id IS NOT NULL AND pc.id IS NULL;

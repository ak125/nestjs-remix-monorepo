-- INV-018: pieces-criteria-link-fk-piece
-- Domain: D1-catalog
-- Severity: medium
-- Description: pieces_criteria_link must reference existing pieces
-- Tables: pieces_criteria_link, pieces
-- Returns 0 rows when invariant holds.

SELECT pcl.id FROM pieces_criteria_link pcl LEFT JOIN pieces p ON pcl.piece_id = p.p_id WHERE pcl.piece_id IS NOT NULL AND p.p_id IS NULL;

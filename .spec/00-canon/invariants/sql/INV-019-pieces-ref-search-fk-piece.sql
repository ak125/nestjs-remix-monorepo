-- INV-019: pieces-ref-search-fk-piece
-- Domain: D1-catalog
-- Severity: medium
-- Description: pieces_ref_search must not have orphaned references to pieces
-- Tables: pieces_ref_search, pieces
-- Returns 0 rows when invariant holds.

SELECT prs.id FROM pieces_ref_search prs LEFT JOIN pieces p ON prs.piece_id = p.p_id WHERE prs.piece_id IS NOT NULL AND p.p_id IS NULL;

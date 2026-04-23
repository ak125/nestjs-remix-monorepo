-- INV-006: pieces-relation-type-fk-piece
-- Domain: D1-catalog
-- Severity: high
-- Description: pieces_relation_type.rtp_piece_id must reference existing piece in pieces
-- Tables: pieces_relation_type, pieces
-- Returns 0 rows when invariant holds.

SELECT prt.rtp_id FROM pieces_relation_type prt LEFT JOIN pieces p ON prt.rtp_piece_id = p.p_id WHERE prt.rtp_piece_id IS NOT NULL AND p.p_id IS NULL;

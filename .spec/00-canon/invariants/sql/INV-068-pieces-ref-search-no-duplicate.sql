-- INV-068: pieces-ref-search-no-duplicate
-- Domain: D6-consistency
-- Severity: medium
-- Description: pieces_ref_search: no duplicate on primary search key
-- Tables: pieces_ref_search
-- Returns 0 rows when invariant holds.

SELECT search_key, piece_id, COUNT(*) FROM pieces_ref_search WHERE search_key IS NOT NULL GROUP BY search_key, piece_id HAVING COUNT(*) > 1;

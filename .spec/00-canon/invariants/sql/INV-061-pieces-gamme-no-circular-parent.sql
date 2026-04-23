-- INV-061: pieces-gamme-no-circular-parent
-- Domain: D5-structural
-- Severity: medium
-- Description: pieces_gamme: no cycle in parent hierarchy (max 5 levels deep)
-- Tables: pieces_gamme
-- Returns 0 rows when invariant holds.

WITH RECURSIVE hierarchy AS (
  SELECT pg_id, pg_parent_gamme_id, 1 AS depth, ARRAY[pg_id] AS path
  FROM pieces_gamme WHERE pg_parent_gamme_id IS NOT NULL
  UNION ALL
  SELECT pg.pg_id, pg.pg_parent_gamme_id, h.depth + 1, h.path || pg.pg_id
  FROM pieces_gamme pg JOIN hierarchy h ON pg.pg_id = h.pg_parent_gamme_id
  WHERE pg.pg_id <> ALL(h.path) AND h.depth < 6
)
SELECT pg_id FROM hierarchy WHERE depth >= 6 OR pg_id = ANY(path[1:array_length(path,1)-1]);

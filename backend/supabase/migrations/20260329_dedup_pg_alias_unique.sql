-- Migration: deduplicate pg_alias + add UNIQUE constraint
-- Context: 48 duplicate pg_alias values cause .single() failures → 404 on R3/R6 routes
-- Strategy: keep ACTIVE row (or lowest pg_id if all same status), suffix duplicates with -dup{pg_id}

BEGIN;

-- Step 1: Rename duplicate aliases
-- Ranking: ACTIVE=0, HIDDEN=1, DEPRECATED=2, then lowest pg_id wins
WITH ranked AS (
  SELECT pg_id, pg_alias, pg_status,
    ROW_NUMBER() OVER (
      PARTITION BY pg_alias
      ORDER BY
        CASE pg_status
          WHEN 'ACTIVE' THEN 0
          WHEN 'DEPRECATED' THEN 2
          ELSE 1
        END,
        pg_id ASC
    ) AS rn
  FROM pieces_gamme
  WHERE pg_alias IN (
    SELECT pg_alias FROM pieces_gamme
    WHERE pg_alias IS NOT NULL AND pg_alias != ''
    GROUP BY pg_alias HAVING count(*) > 1
  )
)
UPDATE pieces_gamme g
SET pg_alias = g.pg_alias || '-dup' || g.pg_id
FROM ranked r
WHERE g.pg_id = r.pg_id
  AND r.rn > 1;

-- Step 2: Add unique partial index (allows NULL and empty, blocks duplicates)
CREATE UNIQUE INDEX IF NOT EXISTS uq_pieces_gamme_pg_alias
  ON pieces_gamme (pg_alias)
  WHERE pg_alias IS NOT NULL AND pg_alias != '';

COMMIT;

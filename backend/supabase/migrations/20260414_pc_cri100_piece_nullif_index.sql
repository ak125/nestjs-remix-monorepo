-- =====================================================================
-- Perf fix : rm_get_page_complete_v2 latency on brake pads / filters
-- =====================================================================
--
-- Context (2026-04-14) :
--   User reported /pieces/plaquette-de-frein-402/... taking 7706ms (cold)
--   with rm-v2 budget near limit. Investigation showed get_listing_products_extended
--   spending 2-30s in a Parallel Bitmap Heap Scan on pieces_criteria[pc_cri_id='100']
--   followed by an external merge sort over ~1.25M rows, just to semi-join with
--   the 50-80 active pieces of the page. Under concurrent crawler traffic the
--   cost amplified to 4-33s per call, with LWLock:BufferMapping contention
--   visible in pg_stat_activity.
--
-- Root cause :
--   An existing partial functional index already exists :
--     idx_pieces_criteria_cri100_piece_int  ON (((pc_piece_id)::integer))
--                                           WHERE pc_cri_id='100' AND pc_cri_value...
--   But the query in get_listing_products_extended uses the expression
--     (NULLIF(pc_piece_id, '')::integer)
--   which is NOT matched by the planner against the existing index (expression
--   mismatch, even though NULLIF is a no-op here : 0/1374038 rows have NULL or ''
--   pc_piece_id for pc_cri_id='100').
--
-- Fix :
--   Add a new partial functional index whose expression matches exactly the
--   query's NULLIF form, so the planner switches from
--     Parallel Bitmap Heap Scan + External Merge Sort 15MB/worker (~2000ms)
--   to
--     Nested Loop → Index Scan using idx_pc_cri100_piece_nullif_int (~20ms for 57 loops).
--
-- Measured impact on rm_get_page_complete_v2 (Megane III 1.5 dCi, type_id=77310) :
--   - plaquette-de-frein (pg 402)  : ~4200ms → 319-405ms warm   (~10-13x)
--   - filtre-a-huile    (pg 7)     : 32908ms → 337ms            (~97x)
--   - disque-de-frein   (pg 82)    :               400ms
--   - amortisseur       (pg 854)   :               218ms
--   - courroie-distrib  (pg 306)   :               219ms
--   - filtre-a-air      (pg 8)     :               164ms
--
-- Size : 28 MB (pieces_criteria is 1.7 GB, existing indexes 7.9 GB — trivial add)
--
-- Safety :
--   - CREATE INDEX CONCURRENTLY : no table lock during build
--   - Fully additive : does not remove or alter any existing index
--   - Rollback : DROP INDEX CONCURRENTLY public.idx_pc_cri100_piece_nullif_int
--   - If the planner ever regresses, dropping the index restores the prior plan
--
-- Applied 2026-04-14 via direct psycopg2 session (CREATE INDEX CONCURRENTLY
-- cannot run inside a transaction, and the Supabase MCP session wraps each
-- query in a transaction — this migration file documents the canonical state
-- and can be replayed on a fresh environment with a psql/psycopg2 session.
-- =====================================================================

-- Idempotent : can be re-run safely
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pc_cri100_piece_nullif_int
ON public.pieces_criteria
USING btree (((NULLIF(pc_piece_id, ''::text))::integer))
WHERE pc_cri_id = '100'
  AND pc_cri_value IS NOT NULL
  AND (pc_cri_value)::text <> '';

-- Post-apply sanity : index must be valid
DO $$
DECLARE
  v_valid boolean;
BEGIN
  SELECT i.indisvalid INTO v_valid
  FROM pg_class c
  JOIN pg_index i ON i.indexrelid = c.oid
  WHERE c.relname = 'idx_pc_cri100_piece_nullif_int';

  IF v_valid IS NULL THEN
    RAISE EXCEPTION 'idx_pc_cri100_piece_nullif_int missing after CREATE INDEX';
  ELSIF NOT v_valid THEN
    RAISE EXCEPTION 'idx_pc_cri100_piece_nullif_int exists but is INVALID — rebuild required';
  END IF;

  RAISE NOTICE 'idx_pc_cri100_piece_nullif_int is valid';
END $$;

-- =====================================================================
-- Rollback (if ever needed) :
--   DROP INDEX CONCURRENTLY IF EXISTS public.idx_pc_cri100_piece_nullif_int;
-- The prior (slow) plan will come back — no other side effect.
-- =====================================================================

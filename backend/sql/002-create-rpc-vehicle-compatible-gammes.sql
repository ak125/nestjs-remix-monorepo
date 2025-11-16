-- ============================================================================
-- RPC Function: get_vehicle_compatible_gammes_php
-- ============================================================================
-- Purpose: Get all gammes that have at least one compatible piece for a vehicle type
--          Uses the same PHP filter logic: piece_display=true, pg_display='1', pg_level IN ('1','2')
--
-- This function bypasses Supabase ORM foreign key requirements by using explicit JOINs
--
-- Performance: Uses idx_pieces_relation_type_type_id_composite index
--              ~65ms for 146M rows with type_id filter
--
-- Usage from NestJS:
--   const { data } = await this.supabase
--     .rpc('get_vehicle_compatible_gammes_php', { p_type_id: 30764 });
--
-- Returns: Table with columns (pg_id INTEGER, total_pieces BIGINT)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_vehicle_compatible_gammes_php(p_type_id INTEGER)
RETURNS TABLE (
  pg_id INTEGER,
  total_pieces BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    prt.rtp_pg_id::INTEGER AS pg_id,
    COUNT(DISTINCT prt.rtp_piece_id)::BIGINT AS total_pieces
  FROM pieces_relation_type prt
  INNER JOIN pieces p ON prt.rtp_piece_id = p.piece_id
  INNER JOIN pieces_gamme pg ON p.piece_pg_id = pg.pg_id
  WHERE 
    prt.rtp_type_id = p_type_id
    AND p.piece_display = true           -- PHP filter: piece_display (BOOLEAN)
    AND pg.pg_display = '1'              -- PHP filter: pg_display='1' (TEXT)
    AND pg.pg_level IN ('1', '2')        -- PHP filter: pg_level IN ('1','2') (TEXT)
  GROUP BY prt.rtp_pg_id;
END;
$$;

-- ============================================================================
-- Create index on pieces table for piece_display filter (if not exists)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_pieces_display 
ON pieces(piece_id) 
WHERE piece_display = true;

-- ============================================================================
-- Create index on pieces_gamme for pg_display and pg_level filters (if not exists)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_pieces_gamme_display_level 
ON pieces_gamme(pg_id) 
WHERE pg_display = '1' AND pg_level IN ('1', '2');

-- ============================================================================
-- Grant execute permission to anon and authenticated roles
-- ============================================================================
GRANT EXECUTE ON FUNCTION get_vehicle_compatible_gammes_php(INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION get_vehicle_compatible_gammes_php(INTEGER) TO authenticated;

-- ============================================================================
-- Test Query: Verify function returns ~98 gammes for type_id=30764
-- ============================================================================
-- SELECT pg_id, total_pieces 
-- FROM get_vehicle_compatible_gammes_php(30764) 
-- ORDER BY total_pieces DESC, pg_id ASC;
--
-- Expected: ~98 gammes (not 226)
-- Compare with raw query to verify filters are working correctly
-- ============================================================================

-- ============================================================================
-- RPC Function: get_oem_refs_for_vehicle
-- ============================================================================
-- Purpose: Récupère toutes les références OEM constructeur pour une page liste
--          (type_id + gamme_id), filtrées par la marque du véhicule
--
-- Retourne: Liste unique des refs OEM de la marque du véhicule
--           Ex: Sur Renault Clio, retourne uniquement les refs RENAULT
--
-- Performance attendue: ~20-50ms
--
-- Usage depuis NestJS:
--   const { data } = await this.supabase.rpc('get_oem_refs_for_vehicle', { 
--     p_type_id: 16104,
--     p_pg_id: 479,
--     p_marque_name: 'RENAULT'
--   });
--
-- Retour:
--   {
--     "vehicleMarque": "RENAULT",
--     "oemRefs": ["7701469442", "7701478190", "7711368201", "7711497220"],
--     "count": 4,
--     "piecesWithOem": 12,
--     "duration_ms": 25
--   }
-- ============================================================================

CREATE OR REPLACE FUNCTION get_oem_refs_for_vehicle(
  p_type_id INTEGER,
  p_pg_id INTEGER,
  p_marque_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_start_time TIMESTAMPTZ := clock_timestamp();
  v_marque_upper TEXT;
BEGIN
  -- Normaliser le nom de marque en majuscules
  v_marque_upper := UPPER(TRIM(p_marque_name));
  
  WITH 
  -- ═══════════════════════════════════════════════════════════════════════════
  -- 1. RELATIONS: Récupère les pièces liées au véhicule + gamme
  -- ═══════════════════════════════════════════════════════════════════════════
  relations AS (
    SELECT DISTINCT rtp_piece_id::INTEGER as piece_id
    FROM pieces_relation_type
    WHERE rtp_type_id::INTEGER = p_type_id
      AND rtp_pg_id::INTEGER = p_pg_id
    LIMIT 500
  ),
  
  -- ═══════════════════════════════════════════════════════════════════════════
  -- 2. PIÈCES ACTIVES avec OEM
  -- ═══════════════════════════════════════════════════════════════════════════
  active_pieces AS (
    SELECT p.piece_id::INTEGER as piece_id
    FROM pieces p
    INNER JOIN relations r ON p.piece_id::INTEGER = r.piece_id
    WHERE p.piece_display = true
      AND p.piece_has_oem = true
  ),
  
  -- ═══════════════════════════════════════════════════════════════════════════
  -- 3. RÉFÉRENCES OEM Type 3 (constructeurs) pour ces pièces
  -- ═══════════════════════════════════════════════════════════════════════════
  oem_refs_raw AS (
    SELECT 
      prs.prs_ref,
      prs.prs_prb_id,
      prs.prs_piece_id
    FROM pieces_ref_search prs
    WHERE prs.prs_piece_id::INTEGER IN (SELECT piece_id FROM active_pieces)
      AND prs.prs_kind = '3'  -- Type 3 = OEM constructeurs
  ),
  
  -- ═══════════════════════════════════════════════════════════════════════════
  -- 4. MARQUES OEM (pieces_ref_brand) - Filtrer par marque véhicule
  -- ═══════════════════════════════════════════════════════════════════════════
  oem_with_brand AS (
    SELECT DISTINCT
      o.prs_ref,
      prb.prb_name
    FROM oem_refs_raw o
    INNER JOIN pieces_ref_brand prb ON o.prs_prb_id::TEXT = prb.prb_id::TEXT
    WHERE UPPER(prb.prb_name) = v_marque_upper
  ),
  
  -- ═══════════════════════════════════════════════════════════════════════════
  -- 5. RÉSULTAT: Liste unique des refs OEM triées
  -- ═══════════════════════════════════════════════════════════════════════════
  unique_refs AS (
    SELECT DISTINCT prs_ref as ref
    FROM oem_with_brand
    ORDER BY ref
  ),
  
  -- Stats
  stats AS (
    SELECT 
      COUNT(DISTINCT prs_piece_id) as pieces_with_oem
    FROM oem_refs_raw
  )
  
  SELECT jsonb_build_object(
    'vehicleMarque', v_marque_upper,
    'oemRefs', COALESCE((SELECT jsonb_agg(ref) FROM unique_refs), '[]'::jsonb),
    'count', (SELECT COUNT(*) FROM unique_refs),
    'piecesWithOem', (SELECT pieces_with_oem FROM stats),
    'duration_ms', EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)::INTEGER
  ) INTO v_result;
  
  RETURN v_result;
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'vehicleMarque', v_marque_upper,
    'oemRefs', '[]'::jsonb,
    'count', 0,
    'error', SQLERRM,
    'duration_ms', EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)::INTEGER
  );
END;
$$;

-- ============================================================================
-- Permissions
-- ============================================================================
GRANT EXECUTE ON FUNCTION get_oem_refs_for_vehicle(INTEGER, INTEGER, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_oem_refs_for_vehicle(INTEGER, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_oem_refs_for_vehicle(INTEGER, INTEGER, TEXT) TO service_role;

-- ============================================================================
-- Index recommandés pour performance optimale (décommenter si nécessaire)
-- ============================================================================
-- CREATE INDEX IF NOT EXISTS idx_pieces_ref_search_piece_kind 
--   ON pieces_ref_search(prs_piece_id, prs_kind);
-- CREATE INDEX IF NOT EXISTS idx_pieces_ref_brand_name_upper 
--   ON pieces_ref_brand(UPPER(prb_name));

COMMENT ON FUNCTION get_oem_refs_for_vehicle IS 
'Récupère toutes les références OEM constructeur pour une page liste, filtrées par la marque du véhicule.
Ex: Sur Renault Clio, retourne uniquement les refs RENAULT (7701469442, 7701478190, etc.)';

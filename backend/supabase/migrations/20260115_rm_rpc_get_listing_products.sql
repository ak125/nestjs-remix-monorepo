-- ============================================================================
-- MIGRATION: Create get_listing_products_for_build RPC
-- ============================================================================
-- Main RPC function for RM (Read Model) product building
-- Fetches compatible products for a gamme+vehicle pair with:
-- - Quality mapping (OE/EQUIV/ECO)
-- - Stock status (IN_STOCK/LOW_STOCK/OUT_OF_STOCK/PREORDER)
-- - Scoring algorithm for ranking
-- - Best price selection
--
-- Date: 2026-01-15
-- Version: 1.2.1 (Schema-aware)
-- Requires: 20260115_rm_enums.sql, 20260115_rm_helpers.sql
-- ============================================================================
-- Schema Reference (verified via information_schema):
-- | Table                 | Column           | Type      | Notes              |
-- |-----------------------|------------------|-----------|---------------------|
-- | pieces_relation_type  | rtp_*            | INTEGER   | No NULLIF needed    |
-- | pieces                | piece_id/pg_id   | INTEGER   | No NULLIF needed    |
-- | pieces                | piece_pm_id      | SMALLINT  | Cast to INTEGER     |
-- | pieces                | piece_display    | BOOLEAN   | Direct comparison   |
-- | pieces                | piece_has_img    | BOOLEAN   | Direct comparison   |
-- | pieces                | piece_ref/name   | VARCHAR   | Cast to TEXT        |
-- | pieces_marque         | pm_id            | INTEGER   | No NULLIF needed    |
-- | pieces_price          | pri_piece_id     | TEXT      | NULLIF required ⚠️  |
-- | pieces_price          | pri_vente_ttc    | TEXT      | NULLIF required ⚠️  |
-- | pieces_price          | pri_dispo        | TEXT      | Direct comparison   |
-- ============================================================================

CREATE OR REPLACE FUNCTION get_listing_products_for_build(
    p_gamme_id INT,
    p_vehicle_id BIGINT,
    p_limit INT DEFAULT 500
)
RETURNS TABLE(
    piece_id BIGINT,
    piece_reference TEXT,
    piece_name TEXT,
    pm_id INT,
    pm_name TEXT,
    price_ttc INT,
    quality rm_quality_enum,
    stock_status rm_stock_status_enum,
    piece_position TEXT,
    score INT,
    has_image BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- =========================================================
    -- Input Validation
    -- =========================================================
    IF p_gamme_id IS NULL OR p_vehicle_id IS NULL THEN
        RAISE EXCEPTION 'gamme_id and vehicle_id are required';
    END IF;

    -- Clamp limit to valid range [1, 1000]
    IF p_limit IS NULL OR p_limit < 1 THEN
        p_limit := 500;
    ELSIF p_limit > 1000 THEN
        p_limit := 1000;
    END IF;

    -- =========================================================
    -- Main Query with CTEs
    -- =========================================================
    RETURN QUERY
    WITH
    -- Step 1: Get piece IDs from pieces_relation_type
    -- ALL columns are INTEGER - no NULLIF needed
    relations AS (
        SELECT DISTINCT rtp.rtp_piece_id, rtp.rtp_pm_id
        FROM pieces_relation_type rtp
        WHERE rtp.rtp_type_id = p_vehicle_id::INTEGER
          AND rtp.rtp_pg_id = p_gamme_id
        LIMIT p_limit * 2  -- Over-fetch to account for filtering
    ),

    -- Step 2: Get active pieces
    -- piece_id, piece_pg_id are INTEGER
    -- piece_display, piece_has_img are BOOLEAN
    -- piece_ref, piece_name are VARCHAR -> cast to TEXT
    active_pieces AS (
        SELECT
            p.piece_id AS p_id,
            p.piece_ref::TEXT AS reference,
            p.piece_name::TEXT AS name,
            COALESCE(r.rtp_pm_id, p.piece_pm_id::INTEGER) AS brand_id,
            p.piece_has_img AS has_image
        FROM pieces p
        INNER JOIN relations r ON r.rtp_piece_id = p.piece_id
        WHERE p.piece_display = true
          AND p.piece_pg_id = p_gamme_id
    ),

    -- Step 3: Get brand info for quality determination
    -- pm_id is INTEGER - no NULLIF needed
    pieces_with_brand AS (
        SELECT
            ap.p_id,
            ap.reference,
            ap.name,
            ap.brand_id,
            COALESCE(pm.pm_name, 'Inconnu') AS brand_name,
            ap.has_image,
            determine_product_quality(pm.pm_oes, pm.pm_nb_stars, pm.pm_quality) AS quality
        FROM active_pieces ap
        LEFT JOIN pieces_marque pm ON pm.pm_id = ap.brand_id
    ),

    -- Step 4: Get best price for each piece
    -- pri_piece_id and pri_vente_ttc are TEXT - NULLIF required!
    best_prices AS (
        SELECT DISTINCT ON (NULLIF(pp.pri_piece_id, '')::INTEGER)
            NULLIF(pp.pri_piece_id, '')::INTEGER AS bp_piece_id,
            COALESCE(ROUND(NULLIF(TRIM(pp.pri_vente_ttc), '')::NUMERIC)::INT, 0) AS price_ttc,
            determine_stock_status(pp.pri_dispo) AS stock_status
        FROM pieces_price pp
        WHERE NULLIF(pp.pri_piece_id, '')::INTEGER IN (SELECT p_id FROM pieces_with_brand)
          AND pp.pri_dispo IN ('1', '2', '3')  -- Only available stock
        ORDER BY NULLIF(pp.pri_piece_id, '')::INTEGER,
                 CASE pp.pri_dispo
                     WHEN '1' THEN 1  -- IN_STOCK first
                     WHEN '2' THEN 2  -- LOW_STOCK second
                     WHEN '3' THEN 3  -- PREORDER third
                 END,
                 ROUND(NULLIF(TRIM(pp.pri_vente_ttc), '')::NUMERIC)::INT ASC NULLS LAST  -- Cheapest price
    ),

    -- Step 5: Final assembly with scoring
    final_products AS (
        SELECT
            pb.p_id::BIGINT AS fp_piece_id,
            pb.reference,
            pb.name,
            pb.brand_id,
            pb.brand_name,
            COALESCE(bp.price_ttc, 0) AS price_ttc,
            pb.quality,
            COALESCE(bp.stock_status, 'OUT_OF_STOCK'::rm_stock_status_enum) AS stock_status,
            NULL::TEXT AS piece_position,  -- Reserved for future position extraction
            pb.has_image,
            calculate_product_score(
                pb.quality,
                COALESCE(bp.stock_status, 'OUT_OF_STOCK'::rm_stock_status_enum),
                pb.has_image,
                COALESCE(bp.price_ttc, 0)
            ) AS score
        FROM pieces_with_brand pb
        LEFT JOIN best_prices bp ON bp.bp_piece_id = pb.p_id
    )

    -- Return sorted by score (DESC) then price (ASC)
    SELECT
        fp.fp_piece_id AS piece_id,
        fp.reference AS piece_reference,
        fp.name AS piece_name,
        fp.brand_id AS pm_id,
        fp.brand_name AS pm_name,
        fp.price_ttc,
        fp.quality,
        fp.stock_status,
        fp.piece_position,
        fp.score,
        fp.has_image
    FROM final_products fp
    ORDER BY fp.score DESC, fp.price_ttc ASC NULLS LAST
    LIMIT p_limit;

END;
$$;

-- ============================================================================
-- Permissions
-- ============================================================================
GRANT EXECUTE ON FUNCTION get_listing_products_for_build TO service_role;

-- ============================================================================
-- Documentation
-- ============================================================================
COMMENT ON FUNCTION get_listing_products_for_build IS
'v1.2.2: Fetches compatible products for RM listing build.
v1.2.2 fix: Decimal prices use NUMERIC cast (ROUND(::NUMERIC)::INT).

Parameters:
  - p_gamme_id: Product family ID (pieces_gamme.pg_id)
  - p_vehicle_id: Vehicle type ID (auto_type.type_id)
  - p_limit: Max products to return (default 500, max 1000)

Returns TABLE with:
  - piece_id, piece_reference, piece_name
  - pm_id, pm_name (brand)
  - price_ttc (in centimes)
  - quality (OE/EQUIV/ECO)
  - stock_status (IN_STOCK/LOW_STOCK/OUT_OF_STOCK/PREORDER)
  - piece_position (reserved for future use)
  - score (ranking score)
  - has_image

Schema Notes:
  - pieces_price columns are TEXT -> use NULLIF pattern
  - Other tables are INTEGER/BOOLEAN -> direct comparison
  - VARCHAR columns -> cast to TEXT for return type';

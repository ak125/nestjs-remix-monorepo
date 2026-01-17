-- ============================================================================
-- MIGRATION: Add pmi_folder and pmi_name to get_listing_products_for_build
-- ============================================================================
-- FIX: Images were broken because the RPC only returned has_image boolean,
-- not the actual path data (pmi_folder, pmi_name) needed to construct URLs.
--
-- Date: 2026-01-17
-- Version: 1.3.0
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
    has_image BOOLEAN,
    pmi_folder TEXT,  -- NEW: Image folder in bucket
    pmi_name TEXT     -- NEW: Image filename
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
    relations AS (
        SELECT DISTINCT rtp.rtp_piece_id, rtp.rtp_pm_id
        FROM pieces_relation_type rtp
        WHERE rtp.rtp_type_id = p_vehicle_id::INTEGER
          AND rtp.rtp_pg_id = p_gamme_id
        LIMIT p_limit * 2
    ),

    -- Step 2: Get active pieces
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
    best_prices AS (
        SELECT DISTINCT ON (NULLIF(pp.pri_piece_id, '')::INTEGER)
            NULLIF(pp.pri_piece_id, '')::INTEGER AS bp_piece_id,
            COALESCE(ROUND(NULLIF(TRIM(pp.pri_vente_ttc), '')::NUMERIC)::INT, 0) AS price_ttc,
            determine_stock_status(pp.pri_dispo) AS stock_status
        FROM pieces_price pp
        WHERE NULLIF(pp.pri_piece_id, '')::INTEGER IN (SELECT p_id FROM pieces_with_brand)
          AND pp.pri_dispo IN ('1', '2', '3')
        ORDER BY NULLIF(pp.pri_piece_id, '')::INTEGER,
                 CASE pp.pri_dispo
                     WHEN '1' THEN 1
                     WHEN '2' THEN 2
                     WHEN '3' THEN 3
                 END,
                 ROUND(NULLIF(TRIM(pp.pri_vente_ttc), '')::NUMERIC)::INT ASC NULLS LAST
    ),

    -- Step 5: Get first image for each piece (NEW)
    first_images AS (
        SELECT DISTINCT ON (pmi.pmi_piece_id)
            NULLIF(pmi.pmi_piece_id, '')::INTEGER AS fi_piece_id,
            pmi.pmi_folder::TEXT AS img_folder,
            CASE
                WHEN pmi.pmi_name LIKE '%.%' THEN pmi.pmi_name
                ELSE pmi.pmi_name || '.JPG'
            END AS img_name
        FROM pieces_media_img pmi
        WHERE NULLIF(pmi.pmi_piece_id, '')::INTEGER IN (SELECT p_id FROM pieces_with_brand)
          AND pmi.pmi_display = '1'
        ORDER BY pmi.pmi_piece_id, pmi.pmi_sort ASC
    ),

    -- Step 6: Final assembly with scoring
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
            NULL::TEXT AS piece_position,
            pb.has_image,
            fi.img_folder,
            fi.img_name,
            calculate_product_score(
                pb.quality,
                COALESCE(bp.stock_status, 'OUT_OF_STOCK'::rm_stock_status_enum),
                pb.has_image,
                COALESCE(bp.price_ttc, 0)
            ) AS score
        FROM pieces_with_brand pb
        LEFT JOIN best_prices bp ON bp.bp_piece_id = pb.p_id
        LEFT JOIN first_images fi ON fi.fi_piece_id = pb.p_id
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
        fp.has_image,
        fp.img_folder AS pmi_folder,
        fp.img_name AS pmi_name
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
'v1.3.0: Added pmi_folder and pmi_name for image URLs.

FIX: Images were broken because hardcoded path "260" did not match actual
bucket structure. Now returns real folder/filename from pieces_media_img.

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
  - pmi_folder (NEW: bucket folder, e.g. "101")
  - pmi_name (NEW: filename, e.g. "34407_1.JPG")';

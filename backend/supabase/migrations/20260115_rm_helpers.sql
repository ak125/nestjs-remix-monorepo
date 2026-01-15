-- ============================================================================
-- MIGRATION: Create RM Helper Functions
-- ============================================================================
-- Helper functions for RM (Read Model) product building
-- - determine_product_quality: Maps brand data to quality enum
-- - determine_stock_status: Maps availability to stock enum
-- - calculate_product_score: Scoring algorithm for product ranking
--
-- Date: 2026-01-15
-- Requires: 20260115_rm_enums.sql
-- ============================================================================

-- ============================================================================
-- Helper: Quality Mapping
-- ============================================================================
-- Determines product quality based on brand attributes
-- OE: pm_oes='1' OR pm_nb_stars=6 OR pm_quality='OE'
-- EQUIV: pm_nb_stars >= 3
-- ECO: default (pm_nb_stars <= 2 or NULL)
-- ============================================================================
CREATE OR REPLACE FUNCTION determine_product_quality(
    p_pm_oes TEXT,
    p_pm_nb_stars TEXT,
    p_pm_quality TEXT
) RETURNS rm_quality_enum
LANGUAGE plpgsql IMMUTABLE
AS $$
BEGIN
    -- OE: Original Equipment
    IF p_pm_oes = '1' OR p_pm_nb_stars = '6' OR UPPER(COALESCE(p_pm_quality, '')) = 'OE' THEN
        RETURN 'OE';
    END IF;

    -- EQUIV: Equivalent quality (3+ stars)
    IF NULLIF(p_pm_nb_stars, '')::INTEGER >= 3 THEN
        RETURN 'EQUIV';
    END IF;

    -- ECO: Economy (default)
    RETURN 'ECO';
EXCEPTION WHEN OTHERS THEN
    RETURN 'ECO';
END;
$$;

COMMENT ON FUNCTION determine_product_quality IS 'Maps brand attributes (pm_oes, pm_nb_stars, pm_quality) to rm_quality_enum';

-- ============================================================================
-- Helper: Stock Status
-- ============================================================================
-- Maps pieces_price.pri_dispo to rm_stock_status_enum
-- '1' → IN_STOCK
-- '2' → LOW_STOCK
-- '3' → PREORDER
-- else → OUT_OF_STOCK
-- ============================================================================
CREATE OR REPLACE FUNCTION determine_stock_status(
    p_pri_dispo TEXT
) RETURNS rm_stock_status_enum
LANGUAGE plpgsql IMMUTABLE
AS $$
BEGIN
    CASE p_pri_dispo
        WHEN '1' THEN RETURN 'IN_STOCK';
        WHEN '2' THEN RETURN 'LOW_STOCK';
        WHEN '3' THEN RETURN 'PREORDER';
        ELSE RETURN 'OUT_OF_STOCK';
    END CASE;
END;
$$;

COMMENT ON FUNCTION determine_stock_status IS 'Maps pieces_price.pri_dispo to rm_stock_status_enum';

-- ============================================================================
-- Helper: Scoring Algorithm
-- ============================================================================
-- Calculates product score for ranking in listings
-- | Factor        | Points |
-- |---------------|--------|
-- | OE Quality    | +100   |
-- | EQUIV Quality | +50    |
-- | ECO Quality   | +25    |
-- | IN_STOCK      | +10    |
-- | LOW_STOCK     | +5     |
-- | Has Image     | +5     |
-- | Price > 500€  | -5     |
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_product_score(
    p_quality rm_quality_enum,
    p_stock_status rm_stock_status_enum,
    p_has_image BOOLEAN,
    p_price INT  -- Price in centimes
) RETURNS INT
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
    v_score INT := 0;
BEGIN
    -- Quality points
    CASE p_quality
        WHEN 'OE' THEN v_score := v_score + 100;
        WHEN 'EQUIV' THEN v_score := v_score + 50;
        WHEN 'ECO' THEN v_score := v_score + 25;
        ELSE NULL;
    END CASE;

    -- Stock points
    CASE p_stock_status
        WHEN 'IN_STOCK' THEN v_score := v_score + 10;
        WHEN 'LOW_STOCK' THEN v_score := v_score + 5;
        ELSE NULL;
    END CASE;

    -- Image bonus
    IF p_has_image THEN
        v_score := v_score + 5;
    END IF;

    -- Price penalty (> 500€ = 50000 centimes)
    IF COALESCE(p_price, 0) > 50000 THEN
        v_score := v_score - 5;
    END IF;

    RETURN v_score;
END;
$$;

COMMENT ON FUNCTION calculate_product_score IS 'Calculates product ranking score based on quality, stock, image, and price';

-- ============================================================================
-- Permissions
-- ============================================================================
GRANT EXECUTE ON FUNCTION determine_product_quality TO service_role;
GRANT EXECUTE ON FUNCTION determine_stock_status TO service_role;
GRANT EXECUTE ON FUNCTION calculate_product_score TO service_role;

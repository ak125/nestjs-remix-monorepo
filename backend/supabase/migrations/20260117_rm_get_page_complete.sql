-- ============================================================================
-- MIGRATION: Create rm_get_page_complete RPC
-- ============================================================================
-- Unified RPC that returns ALL data for a product listing page
-- Performance target: ~350ms (vs batch-loader ~950ms)
--
-- Date: 2026-01-17
-- Version: v5 (fixed column names for auto_type and pieces_gamme)
-- Requires: 20260115_rm_rpc_get_listing_products.sql
-- ============================================================================

CREATE OR REPLACE FUNCTION rm_get_page_complete(
    p_gamme_id INT,
    p_vehicle_id BIGINT,
    p_limit INT DEFAULT 200
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_start TIMESTAMPTZ := NOW();
    v_result JSONB;
    v_products JSONB;
    v_vehicle JSONB;
    v_gamme JSONB;
    v_filters JSONB;
    v_min_price INT;
    v_max_price INT;
    v_brands JSONB;
    v_qualities JSONB;
BEGIN
    IF p_gamme_id IS NULL OR p_vehicle_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', jsonb_build_object(
                'code', 'INVALID_PARAMS',
                'message', 'gamme_id and vehicle_id are required'
            )
        );
    END IF;

    IF p_limit IS NULL OR p_limit < 1 THEN
        p_limit := 200;
    ELSIF p_limit > 500 THEN
        p_limit := 500;
    END IF;

    -- 1. Products (reuse existing optimized RPC)
    SELECT jsonb_agg(row_to_json(p))
    INTO v_products
    FROM get_listing_products_for_build(p_gamme_id, p_vehicle_id, p_limit) p;

    IF v_products IS NULL THEN
        v_products := '[]'::JSONB;
    END IF;

    -- 2. Vehicle Info (type_id is TEXT in auto_type!)
    -- Columns: type_power_kw, type_power_ps, type_liter, type_year_from/to
    SELECT jsonb_build_object(
        'type_id', t.type_id::BIGINT,
        'type_name', t.type_name,
        'type_alias', t.type_alias,
        'type_power_kw', t.type_power_kw,
        'type_power_ps', t.type_power_ps,
        'type_liter', t.type_liter,
        'type_year_from', t.type_year_from,
        'type_year_to', t.type_year_to,
        'modele_id', m.modele_id::BIGINT,
        'modele_name', m.modele_name,
        'modele_alias', m.modele_alias,
        'marque_id', ma.marque_id::INT,
        'marque_name', ma.marque_name,
        'marque_alias', ma.marque_alias
    ) INTO v_vehicle
    FROM auto_type t
    JOIN auto_modele m ON m.modele_id::TEXT = t.type_modele_id::TEXT
    JOIN auto_marque ma ON ma.marque_id::TEXT = m.modele_marque_id::TEXT
    WHERE t.type_id::TEXT = p_vehicle_id::TEXT;

    IF v_vehicle IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', jsonb_build_object(
                'code', 'VEHICLE_NOT_FOUND',
                'message', 'Vehicle not found for id=' || p_vehicle_id
            )
        );
    END IF;

    -- 3. Gamme Info (pg_ppa_id is the family reference, not pg_pf_id)
    SELECT jsonb_build_object(
        'pg_id', pg.pg_id,
        'pg_name', pg.pg_name,
        'pg_alias', pg.pg_alias,
        'pg_ppa_id', pg.pg_ppa_id,
        'pg_parent', pg.pg_parent
    ) INTO v_gamme
    FROM pieces_gamme pg
    WHERE pg.pg_id = p_gamme_id;

    IF v_gamme IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', jsonb_build_object(
                'code', 'GAMME_NOT_FOUND',
                'message', 'Gamme not found for id=' || p_gamme_id
            )
        );
    END IF;

    -- 4. Compute filters from products
    IF jsonb_array_length(v_products) > 0 THEN
        SELECT jsonb_agg(DISTINCT jsonb_build_object('pm_id', pm_id, 'pm_name', pm_name))
        INTO v_brands
        FROM (
            SELECT DISTINCT
                (elem->>'pm_id')::INT as pm_id,
                elem->>'pm_name' as pm_name
            FROM jsonb_array_elements(v_products) as elem
            WHERE elem->>'pm_id' IS NOT NULL
        ) sub;

        SELECT jsonb_agg(DISTINCT elem->>'quality')
        INTO v_qualities
        FROM jsonb_array_elements(v_products) as elem
        WHERE elem->>'quality' IS NOT NULL;

        SELECT
            MIN((elem->>'price_ttc')::INT),
            MAX((elem->>'price_ttc')::INT)
        INTO v_min_price, v_max_price
        FROM jsonb_array_elements(v_products) as elem;
    ELSE
        v_brands := '[]'::JSONB;
        v_qualities := '[]'::JSONB;
        v_min_price := 0;
        v_max_price := 0;
    END IF;

    v_filters := jsonb_build_object(
        'brands', COALESCE(v_brands, '[]'::JSONB),
        'qualities', COALESCE(v_qualities, '[]'::JSONB),
        'price_range', jsonb_build_object(
            'min', COALESCE(v_min_price, 0),
            'max', COALESCE(v_max_price, 0)
        )
    );

    -- 5. Assemble result
    v_result := jsonb_build_object(
        'success', true,
        'products', v_products,
        'count', jsonb_array_length(v_products),
        'vehicleInfo', v_vehicle,
        'gamme', v_gamme,
        'filters', v_filters,
        'duration_ms', EXTRACT(MILLISECONDS FROM NOW() - v_start)::INT
    );

    RETURN v_result;

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', jsonb_build_object(
            'code', 'INTERNAL_ERROR',
            'message', SQLERRM
        ),
        'duration_ms', EXTRACT(MILLISECONDS FROM NOW() - v_start)::INT
    );
END;
$$;

-- ============================================================================
-- Permissions
-- ============================================================================
GRANT EXECUTE ON FUNCTION rm_get_page_complete TO service_role;

-- ============================================================================
-- Documentation
-- ============================================================================
COMMENT ON FUNCTION rm_get_page_complete IS
'v1.0.0: Unified RPC for product listing pages.

Returns ALL data needed for a listing page in a single call:
- products: Scored product list (reuses get_listing_products_for_build)
- vehicleInfo: Full vehicle hierarchy (type, modele, marque)
- gamme: Product family info
- filters: Available brands, qualities, price range

Parameters:
  - p_gamme_id: Product family ID (pieces_gamme.pg_id)
  - p_vehicle_id: Vehicle type ID (auto_type.type_id)
  - p_limit: Max products to return (default 200, max 500)

Performance: ~350ms target (vs batch-loader ~950ms)';

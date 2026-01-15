-- ============================================================================
-- MIGRATION: Create RM Tables + Build RPC
-- ============================================================================
-- Tables for storing pre-computed RM listings and build logs
--
-- Date: 2026-01-15
-- Requires: 20260115_rm_enums.sql, 20260115_rm_helpers.sql, 20260115_rm_rpc_get_listing_products.sql
-- ============================================================================

-- ============================================================================
-- Table: rm_listing
-- ============================================================================
-- Stores pre-computed listings for gamme+vehicle pairs
-- ============================================================================
CREATE TABLE IF NOT EXISTS rm_listing (
    rml_id BIGSERIAL PRIMARY KEY,
    rml_gamme_id INT NOT NULL,
    rml_vehicle_id BIGINT NOT NULL,
    rml_h1 TEXT,
    rml_title TEXT,
    rml_meta_description TEXT,
    rml_build_status rm_build_status_enum DEFAULT 'PENDING',
    rml_product_count INT DEFAULT 0,
    rml_products JSONB DEFAULT '[]'::JSONB,
    rml_data_version UUID DEFAULT gen_random_uuid(),
    rml_created_at TIMESTAMPTZ DEFAULT NOW(),
    rml_updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(rml_gamme_id, rml_vehicle_id)
);

CREATE INDEX IF NOT EXISTS idx_rm_listing_gamme_vehicle ON rm_listing(rml_gamme_id, rml_vehicle_id);
CREATE INDEX IF NOT EXISTS idx_rm_listing_status ON rm_listing(rml_build_status);

COMMENT ON TABLE rm_listing IS 'Pre-computed product listings for gamme+vehicle pairs';

-- ============================================================================
-- Table: rm_build_log
-- ============================================================================
-- Logs build operations for monitoring and debugging
-- ============================================================================
CREATE TABLE IF NOT EXISTS rm_build_log (
    rmbl_id BIGSERIAL PRIMARY KEY,
    rmbl_listing_id BIGINT REFERENCES rm_listing(rml_id) ON DELETE CASCADE,
    rmbl_gamme_id INT NOT NULL,
    rmbl_vehicle_id BIGINT NOT NULL,
    rmbl_status rm_build_status_enum NOT NULL,
    rmbl_product_count INT DEFAULT 0,
    rmbl_duration_ms INT,
    rmbl_error_message TEXT,
    rmbl_created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rm_build_log_created ON rm_build_log(rmbl_created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rm_build_log_listing ON rm_build_log(rmbl_listing_id);

COMMENT ON TABLE rm_build_log IS 'Build operation logs for RM listings';

-- ============================================================================
-- RPC: build_rm_listing
-- ============================================================================
-- Builds and saves a listing for a gamme+vehicle pair
-- Uses get_listing_products_for_build to fetch products
-- ============================================================================
CREATE OR REPLACE FUNCTION build_rm_listing(
    p_gamme_id INT,
    p_vehicle_id BIGINT
) RETURNS rm_listing
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_start_time TIMESTAMPTZ := NOW();
    v_products JSONB;
    v_count INT;
    v_listing rm_listing;
    v_duration_ms INT;
BEGIN
    -- Input validation
    IF p_gamme_id IS NULL OR p_vehicle_id IS NULL THEN
        RAISE EXCEPTION 'gamme_id and vehicle_id are required';
    END IF;

    -- Fetch products via existing RPC
    SELECT jsonb_agg(row_to_json(p))
    INTO v_products
    FROM get_listing_products_for_build(p_gamme_id, p_vehicle_id, 500) p;

    v_count := COALESCE(jsonb_array_length(v_products), 0);
    v_duration_ms := EXTRACT(MILLISECONDS FROM NOW() - v_start_time)::INT;

    -- Upsert the listing
    INSERT INTO rm_listing (
        rml_gamme_id, rml_vehicle_id, rml_build_status,
        rml_product_count, rml_products, rml_updated_at
    ) VALUES (
        p_gamme_id, p_vehicle_id,
        CASE WHEN v_count > 0 THEN 'READY' ELSE 'EMPTY' END::rm_build_status_enum,
        v_count, COALESCE(v_products, '[]'::JSONB), NOW()
    )
    ON CONFLICT (rml_gamme_id, rml_vehicle_id) DO UPDATE SET
        rml_build_status = EXCLUDED.rml_build_status,
        rml_product_count = EXCLUDED.rml_product_count,
        rml_products = EXCLUDED.rml_products,
        rml_data_version = gen_random_uuid(),
        rml_updated_at = NOW()
    RETURNING * INTO v_listing;

    -- Log the build
    INSERT INTO rm_build_log (
        rmbl_listing_id, rmbl_gamme_id, rmbl_vehicle_id,
        rmbl_status, rmbl_product_count, rmbl_duration_ms
    ) VALUES (
        v_listing.rml_id, p_gamme_id, p_vehicle_id,
        v_listing.rml_build_status, v_count, v_duration_ms
    );

    RETURN v_listing;
EXCEPTION WHEN OTHERS THEN
    -- Log the error
    INSERT INTO rm_build_log (
        rmbl_gamme_id, rmbl_vehicle_id, rmbl_status, rmbl_error_message
    ) VALUES (
        p_gamme_id, p_vehicle_id, 'FAILED', SQLERRM
    );
    RAISE;
END;
$$;

COMMENT ON FUNCTION build_rm_listing IS 'Builds and caches a product listing for a gamme+vehicle pair';

-- ============================================================================
-- RPC: get_rm_listing
-- ============================================================================
-- Retrieves a cached listing, optionally rebuilding if stale
-- ============================================================================
CREATE OR REPLACE FUNCTION get_rm_listing(
    p_gamme_id INT,
    p_vehicle_id BIGINT,
    p_rebuild_if_missing BOOLEAN DEFAULT false
) RETURNS rm_listing
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_listing rm_listing;
BEGIN
    -- Try to get existing listing
    SELECT * INTO v_listing
    FROM rm_listing
    WHERE rml_gamme_id = p_gamme_id
      AND rml_vehicle_id = p_vehicle_id;

    -- If not found and rebuild requested, build it
    IF v_listing IS NULL AND p_rebuild_if_missing THEN
        v_listing := build_rm_listing(p_gamme_id, p_vehicle_id);
    END IF;

    RETURN v_listing;
END;
$$;

COMMENT ON FUNCTION get_rm_listing IS 'Retrieves a cached listing, optionally rebuilding if not found';

-- ============================================================================
-- Permissions
-- ============================================================================
GRANT ALL ON TABLE rm_listing TO service_role;
GRANT ALL ON TABLE rm_build_log TO service_role;
GRANT USAGE, SELECT ON SEQUENCE rm_listing_rml_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE rm_build_log_rmbl_id_seq TO service_role;
GRANT EXECUTE ON FUNCTION build_rm_listing TO service_role;
GRANT EXECUTE ON FUNCTION get_rm_listing TO service_role;

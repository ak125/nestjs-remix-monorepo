-- Migration: RPC function for dynamic Money Pages selection
-- Date: 2026-01-25
-- Description: Returns top gammes by keyword search volume

CREATE OR REPLACE FUNCTION get_top_money_gammes(p_limit INT DEFAULT 10)
RETURNS TABLE (gamme_id INT, gamme_name TEXT, total_volume BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT
        pg.pg_id::INT AS gamme_id,
        pg.pg_name::TEXT AS gamme_name,
        COALESCE(SUM(k.volume), 0)::BIGINT AS total_volume
    FROM __products_gammes pg
    LEFT JOIN __seo_keywords k ON LOWER(k.gamme) = LOWER(pg.pg_name)
    WHERE pg.pg_enabled = 1
    GROUP BY pg.pg_id, pg.pg_name
    HAVING COALESCE(SUM(k.volume), 0) > 0
    ORDER BY total_volume DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_top_money_gammes IS 'Returns top N gammes ranked by total keyword search volume';

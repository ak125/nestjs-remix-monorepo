-- Migration: RPC function for STABILIZE hub (J7 pages)
-- Date: 2026-01-25
-- Description: Returns pages indexed 6-8 days ago that need stabilization

CREATE OR REPLACE FUNCTION get_stabilize_pages(
    p_days_min INT DEFAULT 6,
    p_days_max INT DEFAULT 8,
    p_limit INT DEFAULT 2000
)
RETURNS TABLE (
    url TEXT,
    page_type TEXT,
    days_since_indexed INT,
    score_total NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        h.url,
        p.page_type,
        EXTRACT(DAY FROM (NOW() - h.first_indexed_at))::INT AS days_since_indexed,
        COALESCE(s.score_total, 50) AS score_total
    FROM __seo_index_history h
    LEFT JOIN __seo_page p ON p.url = h.url
    LEFT JOIN __seo_entity_score_v10 s ON s.url = h.url
    WHERE h.first_indexed_at IS NOT NULL
      AND h.first_indexed_at BETWEEN (NOW() - (p_days_max || ' days')::INTERVAL)
                                 AND (NOW() - (p_days_min || ' days')::INTERVAL)
      AND (s.score_total IS NULL OR s.score_total < 70)
      AND (s.score_total IS NULL OR s.score_total >= 30)
      AND COALESCE(p.is_indexable_hint, TRUE) = TRUE
    ORDER BY s.score_total DESC NULLS LAST
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_stabilize_pages IS 'Returns pages indexed 6-8 days ago needing stabilization (score 30-70)';

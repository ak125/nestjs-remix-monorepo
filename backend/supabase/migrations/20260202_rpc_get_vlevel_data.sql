-- RPC get_vlevel_data: Retourne stats V-Level + détails pour une gamme
-- Migration: 20260202_rpc_get_vlevel_data
-- Date: 2026-02-02
-- Description: Créer la fonction RPC manquante utilisée par AdminGammesSeoService.getGammeDetail()

CREATE OR REPLACE FUNCTION get_vlevel_data(p_pg_id INTEGER)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'stats', (
      SELECT COALESCE(json_object_agg(v_level, cnt), '{}'::json)
      FROM (
        SELECT v_level, COUNT(*) AS cnt
        FROM __seo_keywords
        WHERE pg_id = p_pg_id
          AND type = 'vehicle'
          AND v_level IS NOT NULL
        GROUP BY v_level
      ) s
    ),
    'details', (
      SELECT COALESCE(json_agg(row_to_json(d)), '[]'::json)
      FROM (
        SELECT id, keyword, model, variant, energy, v_level,
               best_rank, volume, v2_repetitions, type_id
        FROM __seo_keywords
        WHERE pg_id = p_pg_id
          AND type = 'vehicle'
        ORDER BY
          CASE v_level
            WHEN 'V1' THEN 1
            WHEN 'V2' THEN 2
            WHEN 'V3' THEN 3
            WHEN 'V4' THEN 4
            WHEN 'V5' THEN 5
          END,
          volume DESC NULLS LAST
      ) d
    )
  ) INTO result;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION get_vlevel_data IS 'Retourne les stats V-Level (counts par niveau) et détails (keywords) pour une gamme donnée';

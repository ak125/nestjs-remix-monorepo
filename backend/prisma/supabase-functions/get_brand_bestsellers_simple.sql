-- VERSION SIMPLIFIÉE sans sous-requête DISTINCT ON

CREATE OR REPLACE FUNCTION get_brand_bestsellers_optimized(
  p_marque_id INTEGER,
  p_limit_vehicles INTEGER DEFAULT 12,
  p_limit_parts INTEGER DEFAULT 12
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'vehicles', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT DISTINCT
          cgc.cgc_type_id,
          at.type_id,
          at.type_alias,
          at.type_name,
          at.type_name_meta,
          at.type_power_ps,
          at.type_fuel,
          at.type_year_from,
          at.type_month_from,
          at.type_year_to,
          at.type_month_to,
          am.modele_id,
          am.modele_alias,
          am.modele_name,
          am.modele_name_meta,
          am.modele_pic,
          amb.marque_id,
          amb.marque_alias,
          amb.marque_name,
          amb.marque_name_meta,
          amb.marque_name_meta_title,
          at.type_id::INTEGER as type_id_int
        FROM __cross_gamme_car_new cgc
        INNER JOIN auto_type at ON at.type_id::TEXT = cgc.cgc_type_id
        INNER JOIN auto_modele am ON am.modele_id::TEXT = at.type_modele_id
        INNER JOIN auto_marque amb ON amb.marque_id = am.modele_marque_id
        WHERE cgc.cgc_level = '2'
          AND amb.marque_id = p_marque_id
          AND am.modele_display = 1
          AND at.type_display = '1'
        ORDER BY type_id_int DESC
        LIMIT p_limit_vehicles
      ) t
    ),
    'parts', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT DISTINCT
          cgc.cgc_pg_id,
          pg.pg_id,
          pg.pg_alias,
          pg.pg_name,
          pg.pg_name_meta,
          pg.pg_pic,
          pg.pg_img,
          pg.pg_top,
          cgc.cgc_type_id,
          at.type_name,
          at.type_power_ps,
          am.modele_id,
          am.modele_name,
          am.modele_alias,
          amb.marque_id,
          amb.marque_name,
          amb.marque_alias,
          pg.pg_top::INTEGER as pg_top_int,
          pg.pg_id::INTEGER as pg_id_int
        FROM __cross_gamme_car_new cgc
        INNER JOIN pieces_gamme pg ON pg.pg_id::TEXT = cgc.cgc_pg_id
        INNER JOIN auto_type at ON at.type_id::TEXT = cgc.cgc_type_id
        INNER JOIN auto_modele am ON am.modele_id::TEXT = at.type_modele_id
        INNER JOIN auto_marque amb ON amb.marque_id = am.modele_marque_id
        WHERE cgc.cgc_level = '1'
          AND amb.marque_id = p_marque_id
          AND pg.pg_display = '1'
          AND am.modele_display = 1
        ORDER BY pg_top_int DESC, pg_id_int DESC
        LIMIT p_limit_parts
      ) t
    )
  ) INTO v_result;

  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'vehicles', json_build_array(),
      'parts', json_build_array(),
      'error', SQLERRM
    );
END;
$$;

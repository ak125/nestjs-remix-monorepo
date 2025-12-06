-- ⚡ FONCTION RPC OPTIMISÉE V2 : Bestsellers par marque
-- Utilise des CTEs pour éviter les problèmes de GROUP BY avec json_agg

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
  v_vehicles JSON;
  v_parts JSON;
BEGIN
  -- ========================================
  -- VÉHICULES POPULAIRES (CGC_LEVEL = 2)
  -- ========================================
  SELECT COALESCE(json_agg(row_to_json(v)), '[]'::json)
  INTO v_vehicles
  FROM (
    SELECT DISTINCT ON (at.type_id)
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
      amb.marque_name_meta_title
    FROM __cross_gamme_car_new cgc
    INNER JOIN auto_type at ON at.type_id::TEXT = cgc.cgc_type_id
    INNER JOIN auto_modele am ON am.modele_id::TEXT = at.type_modele_id
    INNER JOIN auto_marque amb ON amb.marque_id = am.modele_marque_id
    WHERE cgc.cgc_level = '2'
      AND cgc.cgc_marque_id = p_marque_id::TEXT
      AND am.modele_display = 1
      AND at.type_display = '1'
    ORDER BY at.type_id DESC
    LIMIT p_limit_vehicles
  ) v;

  -- ========================================
  -- PIÈCES POPULAIRES (CGC_LEVEL = 1)
  -- ========================================
  SELECT COALESCE(json_agg(row_to_json(p)), '[]'::json)
  INTO v_parts
  FROM (
    SELECT DISTINCT ON (pg.pg_id)
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
      at.type_alias,
      at.type_power_ps,
      am.modele_id,
      am.modele_name,
      am.modele_alias,
      amb.marque_id,
      amb.marque_name,
      amb.marque_alias
    FROM __cross_gamme_car_new cgc
    INNER JOIN pieces_gamme pg ON pg.pg_id::TEXT = cgc.cgc_pg_id
    INNER JOIN auto_type at ON at.type_id::TEXT = cgc.cgc_type_id
    INNER JOIN auto_modele am ON am.modele_id::TEXT = at.type_modele_id
    INNER JOIN auto_marque amb ON amb.marque_id::TEXT = cgc.cgc_marque_id
    WHERE cgc.cgc_level = '1'
      AND cgc.cgc_marque_id = p_marque_id::TEXT
      AND pg.pg_activ = '1'
    ORDER BY pg.pg_id, pg.pg_top DESC
    LIMIT p_limit_parts
  ) p;

  -- Retourner le résultat combiné
  RETURN json_build_object(
    'vehicles', v_vehicles,
    'parts', v_parts
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'vehicles', '[]'::json,
      'parts', '[]'::json,
      'error', SQLERRM
    );
END;
$$;

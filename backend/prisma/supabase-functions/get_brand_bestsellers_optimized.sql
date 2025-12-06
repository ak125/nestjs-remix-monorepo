-- ⚡ FONCTION RPC OPTIMISÉE : Bestsellers par marque
-- Récupère les véhicules et pièces populaires d'une marque en 1 SEULE requête
-- Utilise __cross_gamme_car_new comme source de vérité avec cgc_marque_id
-- 
-- Usage: SELECT get_brand_bestsellers_optimized(140, 0, 0); -- Renault, TOUS les résultats
-- Usage: SELECT get_brand_bestsellers_optimized(140, 12, 12); -- Renault, limité
--
-- @param p_marque_id INTEGER - ID de la marque (auto_marque.marque_id)
-- @param p_limit_vehicles INTEGER - Nombre max de véhicules (0 = pas de limite, default 0)
-- @param p_limit_parts INTEGER - Nombre max de pièces (0 = pas de limite, default 0)
-- @return JSON - { vehicles: [...], parts: [...] }

CREATE OR REPLACE FUNCTION get_brand_bestsellers_optimized(
  p_marque_id INTEGER,
  p_limit_vehicles INTEGER DEFAULT 0,
  p_limit_parts INTEGER DEFAULT 0
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
  -- Filtrage direct via cgc_marque_id
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
    INNER JOIN auto_modele am ON am.modele_id::TEXT = at.type_modele_id::TEXT
    INNER JOIN auto_marque amb ON amb.marque_id = am.modele_marque_id
    WHERE cgc.cgc_level = '2'
      AND cgc.cgc_marque_id = p_marque_id::TEXT
      AND am.modele_display = 1
      AND at.type_display = '1'
    ORDER BY at.type_id DESC
    LIMIT CASE WHEN p_limit_vehicles = 0 THEN NULL ELSE p_limit_vehicles END
  ) v;

  -- ========================================
  -- PIÈCES POPULAIRES (CGC_LEVEL = 1)
  -- Filtrage direct via cgc_marque_id
  -- pg_display = '1' pour pièces actives
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
    INNER JOIN auto_modele am ON am.modele_id::TEXT = at.type_modele_id::TEXT
    INNER JOIN auto_marque amb ON amb.marque_id::TEXT = cgc.cgc_marque_id
    WHERE cgc.cgc_level = '1'
      AND cgc.cgc_marque_id = p_marque_id::TEXT
      AND pg.pg_display = '1'
    ORDER BY pg.pg_id, pg.pg_top DESC
    LIMIT CASE WHEN p_limit_parts = 0 THEN NULL ELSE p_limit_parts END
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

-- ========================================
-- COMMENTAIRE
-- ========================================
COMMENT ON FUNCTION get_brand_bestsellers_optimized IS 
'Récupère les véhicules (cgc_level=2) et pièces (cgc_level=1) populaires pour une marque.
Utilise cgc_marque_id pour filtrage direct. Colonnes vérifiées: pg_display, modele_display, type_display.';

-- ========================================
-- EXEMPLES D'UTILISATION
-- ========================================
-- Renault (marque_id = 140):
-- SELECT get_brand_bestsellers_optimized(140, 6, 12);

-- BMW (marque_id = 33):
-- SELECT get_brand_bestsellers_optimized(33, 12, 12);

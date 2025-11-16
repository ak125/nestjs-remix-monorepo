-- ⚡ FONCTION RPC OPTIMISÉE : Bestsellers par marque
-- Récupère les véhicules et pièces populaires d'une marque en 1 SEULE requête
-- Utilise __cross_gamme_car_new comme source de vérité
-- 
-- Usage: SELECT get_brand_bestsellers_optimized(33, 12, 12); -- BMW, 12 véhicules, 12 pièces
--
-- @param p_marque_id INTEGER - ID de la marque (auto_marque.marque_id)
-- @param p_limit_vehicles INTEGER - Nombre max de véhicules (default 12)
-- @param p_limit_parts INTEGER - Nombre max de pièces (default 12)
-- @return JSON - { vehicles: [...], parts: [...] }

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
  -- ========================================
  -- CONSTRUCTION DU RÉSULTAT JSON UNIFIÉ
  -- ========================================
  SELECT json_build_object(
    -- ========================================
    -- VÉHICULES POPULAIRES (CGC_LEVEL = 2)
    -- ========================================
    'vehicles', (
      SELECT json_agg(
        json_build_object(
          'cgc_type_id', cgc.cgc_type_id,
          'type_id', at.type_id,
          'type_alias', at.type_alias,
          'type_name', at.type_name,
          'type_name_meta', at.type_name_meta,
          'type_power_ps', at.type_power_ps,
          'type_fuel', at.type_fuel,
          'type_year_from', at.type_year_from,
          'type_month_from', at.type_month_from,
          'type_year_to', at.type_year_to,
          'type_month_to', at.type_month_to,
          'modele_id', am.modele_id,
          'modele_alias', am.modele_alias,
          'modele_name', am.modele_name,
          'modele_name_meta', am.modele_name_meta,
          'modele_pic', am.modele_pic,
          'marque_id', amb.marque_id,
          'marque_alias', amb.marque_alias,
          'marque_name', amb.marque_name,
          'marque_name_meta', amb.marque_name_meta,
          'marque_name_meta_title', amb.marque_name_meta_title
        )
      )
      FROM (
        -- Sous-requête pour obtenir des véhicules uniques par type
        SELECT DISTINCT ON (cgc.cgc_type_id) 
          cgc.cgc_type_id,
          cgc.cgc_modele_id
        FROM __cross_gamme_car_new cgc
        WHERE cgc.cgc_level = '2' -- Véhicules populaires
        ORDER BY cgc.cgc_type_id, cgc.cgc_id DESC
        LIMIT p_limit_vehicles * 2 -- Pré-filtrage large avant jointures
      ) cgc
      -- Jointure auto_type (cgc_type_id est TEXT dans __cross_gamme_car_new)
      INNER JOIN auto_type at ON at.type_id::TEXT = cgc.cgc_type_id
      -- Jointure auto_modele (type_modele_id est TEXT, modele_id peut être INTEGER)
      INNER JOIN auto_modele am ON am.modele_id::TEXT = at.type_modele_id
      -- Filtrage par marque (modele_marque_id et marque_id sont INTEGER)
      INNER JOIN auto_marque amb ON amb.marque_id = am.modele_marque_id
      WHERE amb.marque_id = p_marque_id
        AND am.modele_display = 1 -- Modèles visibles uniquement
        AND at.type_display = '1' -- Types visibles uniquement (type_display est TEXT)
      ORDER BY at.type_id::INTEGER DESC -- Plus récents en premier (type_id est TEXT)
      LIMIT p_limit_vehicles
    ),
    
    -- ========================================
    -- PIÈCES POPULAIRES (CGC_LEVEL = 1)
    -- ========================================
    'parts', (
      SELECT json_agg(
        json_build_object(
          'cgc_pg_id', cgc.cgc_pg_id,
          'pg_id', pg.pg_id,
          'pg_alias', pg.pg_alias,
          'pg_name', pg.pg_name,
          'pg_name_meta', pg.pg_name_meta,
          'pg_pic', pg.pg_pic,
          'pg_img', pg.pg_img,
          'pg_top', pg.pg_top,
          'cgc_type_id', cgc.cgc_type_id,
          'type_name', at.type_name,
          'type_power_ps', at.type_power_ps,
          'modele_id', am.modele_id,
          'modele_name', am.modele_name,
          'modele_alias', am.modele_alias,
          'marque_id', amb.marque_id,
          'marque_name', amb.marque_name,
          'marque_alias', amb.marque_alias
        )
      )
      FROM (
        -- Sous-requête pour obtenir des pièces uniques par pg_id
        SELECT DISTINCT ON (cgc.cgc_pg_id) 
          cgc.cgc_pg_id,
          cgc.cgc_type_id
        FROM __cross_gamme_car_new cgc
        WHERE cgc.cgc_level = '1' -- Pièces populaires
        ORDER BY cgc.cgc_pg_id, cgc.cgc_id DESC
        LIMIT p_limit_parts * 3 -- Pré-filtrage large avant jointures
      ) cgc
      -- Jointure pieces_gamme (cgc_pg_id est TEXT dans __cross_gamme_car_new)
      INNER JOIN pieces_gamme pg ON pg.pg_id::TEXT = cgc.cgc_pg_id
      -- Jointure auto_type pour récupérer le véhicule associé
      INNER JOIN auto_type at ON at.type_id::TEXT = cgc.cgc_type_id
      -- Jointure auto_modele (type_modele_id est TEXT, modele_id peut être INTEGER)
      INNER JOIN auto_modele am ON am.modele_id::TEXT = at.type_modele_id
      -- Filtrage par marque (modele_marque_id et marque_id sont INTEGER)
      INNER JOIN auto_marque amb ON amb.marque_id = am.modele_marque_id
      WHERE amb.marque_id = p_marque_id
        AND pg.pg_activ = '1' -- Pièces actives uniquement (pg_activ est TEXT)
        AND am.modele_display = 1 -- modele_display est INTEGER
      ORDER BY pg.pg_top DESC, pg.pg_id DESC -- Pièces "top" en premier
      LIMIT p_limit_parts
    )
  ) INTO v_result;

  -- Retourner le résultat JSON
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- En cas d'erreur, retourner structure vide avec message d'erreur
    RETURN json_build_object(
      'vehicles', json_build_array(),
      'parts', json_build_array(),
      'error', SQLERRM
    );
END;
$$;

-- ========================================
-- COMMENTAIRE POUR L'ÉQUIPE
-- ========================================
COMMENT ON FUNCTION get_brand_bestsellers_optimized IS 
'Récupère les véhicules et pièces populaires pour une marque donnée. 
Utilise __cross_gamme_car_new avec cgc_level=2 pour véhicules et cgc_level=1 pour pièces.
Performance optimisée avec DISTINCT ON et pré-filtrage avant jointures.
Gère les conversions TEXT↔INTEGER pour compatibilité schéma legacy.';

-- ========================================
-- EXEMPLES D'UTILISATION
-- ========================================
-- BMW (marque_id = 33):
-- SELECT get_brand_bestsellers_optimized(33, 12, 12);

-- Renault (marque_id = 70):
-- SELECT get_brand_bestsellers_optimized(70, 10, 10);

-- Peugeot (marque_id = 62):
-- SELECT get_brand_bestsellers_optimized(62, 15, 15);

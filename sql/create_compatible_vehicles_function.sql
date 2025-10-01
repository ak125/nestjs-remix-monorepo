-- ========================================
-- FONCTION SQL : Récupérer les véhicules compatibles avec une gamme de pièce
-- ========================================
-- Cette fonction remplace les 5 requêtes REST par 1 seule requête SQL optimisée
-- Utilisation : SELECT * FROM get_compatible_vehicles(4, 12);

CREATE OR REPLACE FUNCTION get_compatible_vehicles(
  p_pg_id INTEGER,
  p_limit INTEGER DEFAULT 12
)
RETURNS TABLE (
  type_id TEXT,
  type_alias TEXT,
  type_name TEXT,
  type_power INTEGER,
  type_fuel TEXT,
  type_body TEXT,
  type_year_from TEXT,
  type_year_to TEXT,
  type_month_from TEXT,
  type_month_to TEXT,
  modele_id TEXT,
  modele_alias TEXT,
  modele_name TEXT,
  modele_pic TEXT,
  marque_id TEXT,
  marque_alias TEXT,
  marque_name TEXT,
  marque_logo TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.type_id::TEXT,
    t.type_alias::TEXT,
    t.type_name::TEXT,
    t.type_power_ps::INTEGER,
    t.type_fuel::TEXT,
    t.type_body::TEXT,
    t.type_year_from::TEXT,
    t.type_year_to::TEXT,
    t.type_month_from::TEXT,
    t.type_month_to::TEXT,
    m.modele_id::TEXT,
    m.modele_alias::TEXT,
    m.modele_name::TEXT,
    m.modele_pic::TEXT,
    ma.marque_id::TEXT,
    ma.marque_alias::TEXT,
    ma.marque_name::TEXT,
    ma.marque_logo::TEXT
  FROM __cross_gamme_car_new cgc
  INNER JOIN auto_type t ON t.type_id::TEXT = cgc.cgc_type_id::TEXT
  INNER JOIN auto_modele m ON m.modele_id::TEXT = t.type_modele_id::TEXT
  INNER JOIN auto_marque ma ON ma.marque_id::TEXT = m.modele_marque_id::TEXT
  WHERE cgc.cgc_pg_id::TEXT = p_pg_id::TEXT
    AND cgc.cgc_level = 2
    AND t.type_display = 1
    AND m.modele_display = 1
    AND ma.marque_display = 1
  ORDER BY cgc.cgc_id::INTEGER DESC
  LIMIT p_limit;
END;
$$;

-- ========================================
-- TEST DE LA FONCTION
-- ========================================
-- SELECT * FROM get_compatible_vehicles(4, 5);
-- Devrait retourner ~5 véhicules compatibles avec l'alternateur (PG_ID=4)

-- ========================================
-- GRANT PERMISSIONS
-- ========================================
-- Permettre à l'API d'appeler cette fonction
GRANT EXECUTE ON FUNCTION get_compatible_vehicles(INTEGER, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION get_compatible_vehicles(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_compatible_vehicles(INTEGER, INTEGER) TO service_role;

-- ========================================
-- NOTES
-- ========================================
-- Cette fonction :
-- 1. Utilise SECURITY DEFINER pour bypass RLS
-- 2. Cast tous les IDs en TEXT pour éviter les problèmes de type
-- 3. Retourne les données prêtes pour le frontend
-- 4. Optimisée avec INNER JOIN (pas de LEFT JOIN inutiles)
-- 5. Limite configurable (défaut 12)

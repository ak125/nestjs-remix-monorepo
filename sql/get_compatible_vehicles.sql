-- Fonction PostgreSQL pour récupérer les véhicules compatibles avec une gamme de pièce
-- Reproduit la logique du PHP avec un JOIN en une seule requête

CREATE OR REPLACE FUNCTION get_compatible_vehicles(
  p_pg_id INTEGER,
  p_limit INTEGER DEFAULT 12
)
RETURNS TABLE (
  cgc_id TEXT,
  type_id TEXT,
  type_alias TEXT,
  type_name TEXT,
  type_power_ps TEXT,
  type_year_from TEXT,
  type_year_to TEXT,
  type_month_from TEXT,
  type_month_to TEXT,
  type_fuel TEXT,
  type_body TEXT,
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
    cgc.cgc_id::TEXT,
    t.type_id::TEXT,
    t.type_alias,
    t.type_name,
    t.type_power_ps::TEXT,
    t.type_year_from::TEXT,
    t.type_year_to::TEXT,
    t.type_month_from::TEXT,
    t.type_month_to::TEXT,
    t.type_fuel,
    t.type_body,
    m.modele_id::TEXT,
    m.modele_alias,
    m.modele_name,
    m.modele_pic,
    ma.marque_id::TEXT,
    ma.marque_alias,
    ma.marque_name,
    ma.marque_logo
  FROM __cross_gamme_car_new cgc
  JOIN auto_type t ON t.type_id::TEXT = cgc.cgc_type_id::TEXT
  JOIN auto_modele m ON m.modele_id::TEXT = t.type_modele_id::TEXT
  JOIN auto_marque ma ON ma.marque_id::TEXT = m.modele_marque_id::TEXT
  WHERE cgc.cgc_pg_id::TEXT = p_pg_id::TEXT
    AND cgc.cgc_level::TEXT = '2'
    AND t.type_display = 1
    AND m.modele_display = 1
    AND ma.marque_display = 1
  ORDER BY cgc.cgc_id DESC
  LIMIT p_limit;
END;
$$;

-- Accorder les permissions
GRANT EXECUTE ON FUNCTION get_compatible_vehicles(INTEGER, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION get_compatible_vehicles(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_compatible_vehicles(INTEGER, INTEGER) TO service_role;

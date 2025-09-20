-- Fonction PostgreSQL pour récupérer les véhicules avec relations
-- À exécuter dans l'éditeur SQL de Supabase

CREATE OR REPLACE FUNCTION get_vehicles_with_relations(limit_param INTEGER DEFAULT 10)
RETURNS TABLE (
  type_id TEXT,
  type_name TEXT,
  type_fuel TEXT,
  type_power_ps TEXT,
  type_year_from TEXT,
  type_year_to TEXT,
  modele_id INTEGER,
  modele_name TEXT,
  marque_id INTEGER,
  marque_name TEXT,
  marque_logo TEXT
) 
LANGUAGE SQL
AS $$
  SELECT 
    at.type_id,
    at.type_name,
    at.type_fuel,
    at.type_power_ps,
    at.type_year_from,
    at.type_year_to,
    am.modele_id,
    am.modele_name,
    ab.marque_id,
    ab.marque_name,
    ab.marque_logo
  FROM auto_type at
  LEFT JOIN auto_modele am ON at.type_modele_id::INTEGER = am.modele_id
  LEFT JOIN auto_marque ab ON at.type_marque_id::INTEGER = ab.marque_id
  WHERE at.type_display = '1'
  ORDER BY at.type_id::INTEGER
  LIMIT limit_param;
$$;

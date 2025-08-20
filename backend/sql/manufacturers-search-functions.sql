-- 🔍 FONCTIONS DE RECHERCHE AVANCÉE POUR MANUFACTURERS
-- Version SIMPLIFIÉE utilisant UNIQUEMENT les tables et colonnes existantes
-- S'appuie sur auto_marque, auto_modele, auto_type telles qu'elles existent

-- ✅ 1. Extension pg_trgm pour recherche similarity
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ✅ 2. Fonction de recherche manufacturers (SIMPLE)
CREATE OR REPLACE FUNCTION search_manufacturers_advanced(
  search_query TEXT,
  limit_count INTEGER DEFAULT 20
)
RETURNS TABLE (
  id INTEGER,
  name VARCHAR,
  display_name VARCHAR,
  country VARCHAR,
  logo_url TEXT,
  slug VARCHAR,
  relevance FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.marque_id as id,
    m.marque_name as name,
    m.marque_name as display_name,
    'Unknown'::VARCHAR as country,
    CASE 
        WHEN m.marque_logo IS NOT NULL AND m.marque_logo != '' 
        THEN 'https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/constructeurs-automobiles/marques-logos/' || m.marque_logo
        ELSE NULL 
    END as logo_url,
    lower(replace(m.marque_name, ' ', '-')) as slug,
    GREATEST(
      similarity(m.marque_name, search_query),
      CASE WHEN m.marque_name ILIKE '%' || search_query || '%' THEN 0.5 ELSE 0 END
    ) as relevance
  FROM auto_marque m
  WHERE 
    m.marque_activ = '1'
    AND (
      similarity(m.marque_name, search_query) > 0.1
      OR m.marque_name ILIKE '%' || search_query || '%'
    )
  ORDER BY relevance DESC, m.marque_name ASC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- ✅ 3. Fonction de recherche types/motorisations (SIMPLE)
CREATE OR REPLACE FUNCTION search_types_advanced(
  search_query TEXT,
  filter_manufacturer_id INTEGER DEFAULT NULL,
  filter_fuel_type TEXT DEFAULT NULL,
  limit_count INTEGER DEFAULT 50
)
RETURNS TABLE (
  id INTEGER,
  name VARCHAR,
  manufacturer_name VARCHAR,
  manufacturer_id INTEGER,
  fuel_type VARCHAR,
  power_hp INTEGER,
  power_kw INTEGER,
  year_from INTEGER,
  year_to INTEGER,
  relevance FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.type_id as id,
    t.type_name as name,
    m.marque_name as manufacturer_name,
    m.marque_id as manufacturer_id,
    COALESCE(t.type_fuel, 'Essence')::VARCHAR as fuel_type,
    COALESCE(t.type_power_ps::INTEGER, 0) as power_hp,
    COALESCE(t.type_power_kw::INTEGER, 0) as power_kw,
    COALESCE(t.type_year_from::INTEGER, 0) as year_from,
    COALESCE(t.type_year_to::INTEGER, 0) as year_to,
    GREATEST(
      similarity(t.type_name, search_query),
      CASE WHEN t.type_name ILIKE '%' || search_query || '%' THEN 0.5 ELSE 0 END
    ) as relevance
  FROM auto_type t
  JOIN auto_modele mo ON t.type_modele_id::TEXT = mo.modele_id::TEXT
  JOIN auto_marque m ON mo.modele_marque_id = m.marque_id
  WHERE t.type_display = '1' 
    AND mo.modele_display = '1' 
    AND m.marque_activ = '1'
    AND (filter_manufacturer_id IS NULL OR m.marque_id = filter_manufacturer_id)
    AND (filter_fuel_type IS NULL OR t.type_fuel ILIKE filter_fuel_type || '%')
    AND (
      similarity(t.type_name, search_query) > 0.1
      OR t.type_name ILIKE '%' || search_query || '%'
    )
  ORDER BY relevance DESC, t.type_name ASC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- ✅ 4. Fonction pour incrémenter les vues (SIMPLE - avec gestion d'erreurs)
CREATE OR REPLACE FUNCTION increment_manufacturer_views(manufacturer_id INTEGER)
RETURNS void AS $$
BEGIN
  -- Tentative de mise à jour simple
  UPDATE auto_marque
  SET marque_name = marque_name -- Juste pour déclencher l'update
  WHERE marque_id = manufacturer_id;
  
EXCEPTION WHEN OTHERS THEN
  -- Ignore toutes les erreurs
  NULL;
END;
$$ LANGUAGE plpgsql;

-- ✅ 5. Fonction pour incrémenter les vues type (SIMPLE)
CREATE OR REPLACE FUNCTION increment_type_views(input_type_id INTEGER)
RETURNS void AS $$
BEGIN
  -- Tentative de mise à jour simple
  UPDATE auto_type
  SET type_name = type_name -- Juste pour déclencher l'update  
  WHERE type_id = input_type_id;
  
EXCEPTION WHEN OTHERS THEN
  -- Ignore toutes les erreurs
  NULL;
END;
$$ LANGUAGE plpgsql;

-- ✅ 6. Vue enrichie SIMPLE (utilise seulement les colonnes existantes)
CREATE OR REPLACE VIEW manufacturer_overview_enhanced AS
SELECT
  m.marque_id as id,
  m.marque_name as name,
  'Unknown'::VARCHAR as country,
  m.marque_logo as logo,
  lower(replace(m.marque_name, ' ', '-')) as slug,
  COUNT(DISTINCT t.type_id) as types_count,
  COUNT(DISTINCT mo.modele_id) as models_count,
  0 as view_count,
  false as is_featured,
  0 as sort_order,
  -- Statistiques calculées
  MIN(COALESCE(t.type_year_from::INTEGER, 2024)) as year_start,
  MAX(COALESCE(t.type_year_to::INTEGER, 2024)) as year_end,
  ARRAY_AGG(DISTINCT t.type_fuel ORDER BY t.type_fuel) FILTER (WHERE t.type_fuel IS NOT NULL) as fuel_types,
  AVG(COALESCE(t.type_power_ps::INTEGER, 0)) FILTER (WHERE t.type_power_ps IS NOT NULL AND t.type_power_ps::INTEGER > 0) as avg_power
FROM auto_marque m
LEFT JOIN auto_modele mo ON m.marque_id = mo.modele_marque_id AND mo.modele_display = '1'
LEFT JOIN auto_type t ON mo.modele_id::TEXT = t.type_modele_id::TEXT AND t.type_display = '1'
WHERE m.marque_activ = '1'
GROUP BY m.marque_id;

-- ✅ 7. Fonction arbre types SIMPLE
CREATE OR REPLACE FUNCTION get_types_tree_by_category(
  category_filter TEXT DEFAULT NULL,
  limit_per_manufacturer INTEGER DEFAULT 10
)
RETURNS TABLE (
  category VARCHAR,
  segment VARCHAR,
  manufacturer_name VARCHAR,
  manufacturer_id INTEGER,
  manufacturer_logo TEXT,
  types JSONB,
  types_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'passenger'::VARCHAR as category,
    'C'::VARCHAR as segment,
    m.marque_name as manufacturer_name,
    m.marque_id as manufacturer_id,
    m.marque_logo as manufacturer_logo,
    jsonb_agg(
      jsonb_build_object(
        'id', t.type_id,
        'name', t.type_name,
        'fuel_type', t.type_fuel,
        'power_hp', t.type_power_ps,
        'year_from', t.type_year_from,
        'year_to', t.type_year_to,
        'model_name', mo.modele_name
      ) ORDER BY t.type_name
    ) as types,
    COUNT(t.type_id)::INTEGER as types_count
  FROM auto_type t
  JOIN auto_modele mo ON t.type_modele_id::TEXT = mo.modele_id::TEXT
  JOIN auto_marque m ON mo.modele_marque_id = m.marque_id
  WHERE t.type_display = '1' 
    AND mo.modele_display = '1' 
    AND m.marque_activ = '1'
  GROUP BY m.marque_name, m.marque_id, m.marque_logo
  HAVING COUNT(t.type_id) > 0
  ORDER BY m.marque_name
  LIMIT limit_per_manufacturer;
END;
$$ LANGUAGE plpgsql;

-- ✅ 8. Index pour optimiser les performances de recherche
CREATE INDEX IF NOT EXISTS idx_auto_marque_search_gin 
ON auto_marque USING gin (marque_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_auto_type_search_gin 
ON auto_type USING gin (type_name gin_trgm_ops);

-- ✅ 9. Fonction d'exemple d'utilisation (SIMPLE)
CREATE OR REPLACE FUNCTION test_search_functions()
RETURNS TABLE (
  test_name TEXT,
  result_count INTEGER,
  status TEXT
) AS $$
BEGIN
  -- Test 1: Recherche manufacturers
  BEGIN
    SELECT COUNT(*)::INTEGER INTO result_count FROM search_manufacturers_advanced('BMW', 10);
    RETURN QUERY SELECT 'search_manufacturers_advanced(BMW)'::TEXT, result_count, 'SUCCESS'::TEXT;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'search_manufacturers_advanced(BMW)'::TEXT, 0, 'ERROR: ' || SQLERRM;
  END;
  
  -- Test 2: Recherche types
  BEGIN
    SELECT COUNT(*)::INTEGER INTO result_count FROM search_types_advanced('GTI', NULL, NULL, 20);
    RETURN QUERY SELECT 'search_types_advanced(GTI)'::TEXT, result_count, 'SUCCESS'::TEXT;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'search_types_advanced(GTI)'::TEXT, 0, 'ERROR: ' || SQLERRM;
  END;
  
  -- Test 3: Vue overview
  BEGIN
    SELECT COUNT(*)::INTEGER INTO result_count FROM manufacturer_overview_enhanced WHERE types_count > 10;
    RETURN QUERY SELECT 'manufacturer_overview_enhanced'::TEXT, result_count, 'SUCCESS'::TEXT;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'manufacturer_overview_enhanced'::TEXT, 0, 'ERROR: ' || SQLERRM;
  END;
  
END;
$$ LANGUAGE plpgsql;

-- ✅ 10. Commentaires pour documentation
COMMENT ON FUNCTION search_manufacturers_advanced(TEXT, INTEGER) IS 'Recherche simplifiée de constructeurs avec similarity PostgreSQL';
COMMENT ON FUNCTION search_types_advanced(TEXT, INTEGER, TEXT, INTEGER) IS 'Recherche simplifiée de types/motorisations';
COMMENT ON FUNCTION increment_manufacturer_views(INTEGER) IS 'Fonction stub pour tracking de vues';
COMMENT ON FUNCTION increment_type_views(INTEGER) IS 'Fonction stub pour tracking de vues';
COMMENT ON VIEW manufacturer_overview_enhanced IS 'Vue simplifiée avec statistiques des constructeurs';
COMMENT ON FUNCTION get_types_tree_by_category(TEXT, INTEGER) IS 'Arbre des types simplifié';
COMMENT ON FUNCTION test_search_functions() IS 'Tests des fonctions de recherche';

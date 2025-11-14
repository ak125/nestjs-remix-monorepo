-- =========================================
-- TEST DE LA FONCTION
-- =========================================

-- Test 1: Vérifier que la fonction existe
SELECT 
  proname as nom_fonction,
  proargtypes::regtype[] as types_parametres,
  prosrc LIKE '%::INTEGER%' as contient_cast_integer
FROM pg_proc 
WHERE proname = 'get_gamme_page_data_optimized';

-- Test 2: Appeler la fonction directement
SELECT get_gamme_page_data_optimized('7') -> 'page_info' -> 'pg_name' as pg_name;

-- Test 3: Vérifier les résultats complets
SELECT 
  jsonb_pretty(get_gamme_page_data_optimized('7')) 
LIMIT 1;

-- Test DISTINCT ON qui pourrait causer le problème

-- Test 1: DISTINCT ON simple
SELECT DISTINCT ON (cgc.cgc_type_id) 
  cgc.cgc_type_id,
  cgc.cgc_modele_id
FROM __cross_gamme_car_new cgc
WHERE cgc.cgc_level = '2'
ORDER BY cgc.cgc_type_id, cgc.cgc_id DESC
LIMIT 3;

-- Test 2: DISTINCT ON avec jointure complète (copie exacte de la fonction)
SELECT 
  at.type_id,
  at.type_name,
  am.modele_name,
  amb.marque_name
FROM (
  SELECT DISTINCT ON (cgc.cgc_type_id) 
    cgc.cgc_type_id,
    cgc.cgc_modele_id
  FROM __cross_gamme_car_new cgc
  WHERE cgc.cgc_level = '2'
  ORDER BY cgc.cgc_type_id, cgc.cgc_id DESC
  LIMIT 24
) cgc
INNER JOIN auto_type at ON at.type_id::TEXT = cgc.cgc_type_id
INNER JOIN auto_modele am ON am.modele_id::TEXT = at.type_modele_id
INNER JOIN auto_marque amb ON amb.marque_id = am.modele_marque_id
WHERE amb.marque_id = 33
  AND am.modele_display = 1
  AND at.type_display = 1
ORDER BY at.type_id::INTEGER DESC
LIMIT 3;

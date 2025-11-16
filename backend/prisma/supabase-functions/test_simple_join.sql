-- Test simplifié pour identifier le problème de type

-- Test 1: Vérifier les données brutes
SELECT 
  cgc_id, 
  cgc_level, 
  cgc_type_id::TEXT as cgc_type_id_text,
  cgc_pg_id::TEXT as cgc_pg_id_text
FROM __cross_gamme_car_new 
WHERE cgc_level = '2' 
LIMIT 3;

-- Test 2: Jointure avec auto_type seulement
SELECT 
  cgc.cgc_type_id,
  at.type_id,
  at.type_name
FROM __cross_gamme_car_new cgc
INNER JOIN auto_type at ON at.type_id::TEXT = cgc.cgc_type_id
WHERE cgc.cgc_level = '2'
LIMIT 3;

-- Test 3: Ajouter auto_modele
SELECT 
  cgc.cgc_type_id,
  at.type_id,
  at.type_modele_id,
  am.modele_id
FROM __cross_gamme_car_new cgc
INNER JOIN auto_type at ON at.type_id::TEXT = cgc.cgc_type_id
INNER JOIN auto_modele am ON am.modele_id::TEXT = at.type_modele_id
WHERE cgc.cgc_level = '2'
LIMIT 3;

-- Test 4: Jointure complète (c'est ici que l'erreur devrait apparaître)
SELECT 
  cgc.cgc_type_id,
  at.type_id,
  am.modele_id,
  amb.marque_id
FROM __cross_gamme_car_new cgc
INNER JOIN auto_type at ON at.type_id::TEXT = cgc.cgc_type_id
INNER JOIN auto_modele am ON am.modele_id::TEXT = at.type_modele_id
INNER JOIN auto_marque amb ON amb.marque_id = am.modele_marque_id
WHERE cgc.cgc_level = '2'
  AND amb.marque_id = 33
LIMIT 3;

-- Script SQL pour vérifier les valeurs display
-- 1. Modèles AUDI contenant "80"
SELECT 
  modele_id, 
  modele_name, 
  modele_display, 
  modele_marque_id,
  modele_year_from,
  modele_year_to
FROM auto_modele 
WHERE modele_marque_id = 22 
  AND modele_name ILIKE '%80%'
ORDER BY modele_name;

-- 2. Types AUDI contenant "80 V"
SELECT 
  type_id, 
  type_name, 
  type_display, 
  type_year_from, 
  type_year_to, 
  type_modele_id
FROM auto_type 
WHERE type_marque_id = 22 
  AND type_name ILIKE '%80 V%'
ORDER BY type_name;

-- 3. Statistiques des valeurs display
SELECT 'marques' as table_name, marque_display as display_value, COUNT(*) as count
FROM auto_marque 
GROUP BY marque_display
UNION ALL
SELECT 'modeles', modele_display::text, COUNT(*)
FROM auto_modele 
GROUP BY modele_display
UNION ALL  
SELECT 'types', type_display::text, COUNT(*)
FROM auto_type 
GROUP BY type_display
ORDER BY table_name, display_value;

-- 4. Modèles AUDI cachés (display = 0)
SELECT 
  modele_id, 
  modele_name, 
  modele_display,
  modele_year_from,
  modele_year_to
FROM auto_modele 
WHERE modele_marque_id = 22 
  AND modele_display = 0
LIMIT 10;
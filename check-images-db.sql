-- Script SQL pour vérifier les colonnes marque_logo et modele_pic
-- Exécuter dans Supabase SQL Editor

-- 1. Vérifier quelques marques
SELECT 
  marque_id,
  marque_name,
  marque_logo,
  CASE 
    WHEN marque_logo IS NULL THEN '❌ NULL'
    WHEN marque_logo = '' THEN '❌ VIDE'
    ELSE '✅ ' || marque_logo
  END as status
FROM auto_marque
WHERE marque_name IN ('PEUGEOT', 'RENAULT', 'FIAT', 'BMW', 'AUDI', 'VOLKSWAGEN')
ORDER BY marque_name;

-- 2. Statistiques globales marques
SELECT 
  COUNT(*) as total_marques,
  COUNT(marque_logo) as avec_logo,
  COUNT(*) - COUNT(marque_logo) as sans_logo,
  ROUND(100.0 * COUNT(marque_logo) / COUNT(*), 2) as pourcentage_avec_logo
FROM auto_marque
WHERE marque_display = 1;

-- 3. Vérifier quelques modèles
SELECT 
  m.modele_id,
  ma.marque_name,
  m.modele_name,
  m.modele_pic,
  CASE 
    WHEN m.modele_pic IS NULL THEN '❌ NULL'
    WHEN m.modele_pic = '' THEN '❌ VIDE'
    ELSE '✅ ' || m.modele_pic
  END as status
FROM auto_modele m
JOIN auto_marque ma ON m.modele_marque_id = ma.marque_id
WHERE m.modele_name IN ('206', 'GOLF IV', '147', 'PUNTO II', 'GETZ')
  AND m.modele_display = 1
ORDER BY ma.marque_name, m.modele_name;

-- 4. Statistiques globales modèles
SELECT 
  COUNT(*) as total_modeles,
  COUNT(modele_pic) as avec_photo,
  COUNT(*) - COUNT(modele_pic) as sans_photo,
  ROUND(100.0 * COUNT(modele_pic) / COUNT(*), 2) as pourcentage_avec_photo
FROM auto_modele
WHERE modele_display = 1;

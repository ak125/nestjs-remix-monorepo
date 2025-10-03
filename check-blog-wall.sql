-- Vérifier le champ ba_wall pour l'article alternateur (ID 20)
SELECT 
  ba_id,
  ba_title,
  ba_wall,
  CASE 
    WHEN ba_wall IS NULL THEN '❌ NULL'
    WHEN ba_wall = '' THEN '❌ VIDE'
    WHEN ba_wall = 'no.jpg' THEN '⚠️ NO.JPG'
    ELSE '✅ ' || ba_wall
  END as status
FROM __blog_advice
WHERE ba_id = 20;

-- Vérifier quelques autres articles
SELECT 
  ba_id,
  ba_title,
  ba_wall,
  CASE 
    WHEN ba_wall IS NULL THEN '❌ NULL'
    WHEN ba_wall = '' THEN '❌ VIDE'
    WHEN ba_wall = 'no.jpg' THEN '⚠️ NO.JPG'
    ELSE '✅ ' || ba_wall
  END as status
FROM __blog_advice
WHERE ba_id IN (20, 61, 62, 65)
ORDER BY ba_id;

-- Statistiques globales
SELECT 
  COUNT(*) as total,
  COUNT(ba_wall) as avec_wall,
  COUNT(CASE WHEN ba_wall != 'no.jpg' AND ba_wall IS NOT NULL AND ba_wall != '' THEN 1 END) as avec_vraie_image,
  ROUND(100.0 * COUNT(CASE WHEN ba_wall != 'no.jpg' AND ba_wall IS NOT NULL AND ba_wall != '' THEN 1 END) / COUNT(*), 2) as pourcentage
FROM __blog_advice;

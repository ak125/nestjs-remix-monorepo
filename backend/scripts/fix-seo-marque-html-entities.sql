-- 🧹 Nettoyage des entités HTML dans la table __seo_marque
-- Corrige: &nbsp; &eacute; etc. et problèmes d'espaces

UPDATE __seo_marque
SET 
  sm_title = REPLACE(REPLACE(sm_title, '&nbsp;', ' '), '  ', ' '),
  sm_descrip = REPLACE(REPLACE(sm_descrip, '&nbsp;', ' '), '  ', ' '),
  sm_h1 = REPLACE(REPLACE(sm_h1, '&nbsp;', ' '), '  ', ' '),
  sm_content = 
    -- Entités HTML courantes
    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    REPLACE(REPLACE(REPLACE(REPLACE(
      sm_content,
      '&nbsp;', ' '),
      '&eacute;', 'é'),
      '&egrave;', 'è'),
      '&ecirc;', 'ê'),
      '&agrave;', 'à'),
      '&acirc;', 'â'),
      '&ccedil;', 'ç'),
      '&ocirc;', 'ô'),
      '&ucirc;', 'û'),
      '&ugrave;', 'ù'),
      '&icirc;', 'î'),
      '&iuml;', 'ï')
WHERE 
  sm_content LIKE '%&%' 
  OR sm_title LIKE '%&%'
  OR sm_descrip LIKE '%&%'
  OR sm_h1 LIKE '%&%';

-- Correction des espaces manquants après balises HTML fermantes
UPDATE __seo_marque
SET sm_content = REGEXP_REPLACE(sm_content, '</b>([A-Z])', '</b> \1', 'g')
WHERE sm_content LIKE '%</b>%';

-- Correction des doubles espaces
UPDATE __seo_marque
SET 
  sm_title = REGEXP_REPLACE(TRIM(sm_title), '\s+', ' ', 'g'),
  sm_descrip = REGEXP_REPLACE(TRIM(sm_descrip), '\s+', ' ', 'g'),
  sm_h1 = REGEXP_REPLACE(TRIM(sm_h1), '\s+', ' ', 'g'),
  sm_content = REGEXP_REPLACE(TRIM(sm_content), '\s+', ' ', 'g');

-- Vérification après correction
SELECT 
  sm_marque_id,
  LEFT(sm_title, 60) as title_preview,
  LEFT(sm_content, 100) as content_preview,
  CASE 
    WHEN sm_content LIKE '%&%' THEN '⚠️ Entités restantes'
    ELSE '✅ Nettoyé'
  END as status
FROM __seo_marque
ORDER BY sm_marque_id;

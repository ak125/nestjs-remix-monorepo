-- Migration: Nettoyer les balises HTML des H1
-- Date: 2026-01-05
-- Description: Supprime les balises <b> et autres tags HTML des sg_h1

-- Nettoyer toutes les balises HTML (principalement <b> et </b>)
UPDATE __seo_gamme
SET sg_h1 = REGEXP_REPLACE(sg_h1, '<[^>]*>', '', 'g')
WHERE sg_h1 ~ '<[^>]*>';

-- Vérification: compter les H1 restants avec balises HTML
DO $$
DECLARE
  remaining_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_count
  FROM __seo_gamme
  WHERE sg_h1 ~ '<[^>]*>';
  
  IF remaining_count > 0 THEN
    RAISE NOTICE 'Attention: % H1 contiennent encore des balises HTML', remaining_count;
  ELSE
    RAISE NOTICE 'Succès: Tous les H1 sont nettoyés';
  END IF;
END $$;

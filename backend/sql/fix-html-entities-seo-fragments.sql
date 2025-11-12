-- ================================================
-- Script de correction des entités HTML dans __seo_family_gamme_car_switch
-- ================================================
-- Ce script décode toutes les entités HTML corrompues dans la table
-- Exemples: &eacute; → é, &ocirc; → ô, &rsquo; → '
-- 
-- ⚠️ ATTENTION: Ce script modifie TOUTES les lignes de la table
-- ⚠️ Faire un backup avant: pg_dump -t __seo_family_gamme_car_switch
-- ================================================

-- Étape 1: Afficher les lignes corrompues AVANT correction
SELECT 
  sfgcs_id,
  sfgcs_pg_id,
  sfgcs_content as "Contenu_avant",
  CASE 
    WHEN sfgcs_content LIKE '%&%' THEN '✅ Contient des entités HTML'
    ELSE '❌ Aucune entité'
  END as statut
FROM __seo_family_gamme_car_switch
WHERE sfgcs_content LIKE '%&%'
ORDER BY sfgcs_id
LIMIT 10;

-- Étape 2: Correction des entités HTML
-- Utilisation de REPLACE en chaîne pour décoder toutes les entités courantes
UPDATE __seo_family_gamme_car_switch
SET sfgcs_content = 
  REPLACE(
    REPLACE(
      REPLACE(
        REPLACE(
          REPLACE(
            REPLACE(
              REPLACE(
                REPLACE(
                  REPLACE(
                    REPLACE(
                      REPLACE(
                        REPLACE(
                          REPLACE(
                            REPLACE(
                              REPLACE(
                                REPLACE(
                                  REPLACE(
                                    REPLACE(
                                      REPLACE(
                                        REPLACE(sfgcs_content,
                                        '&eacute;', 'é'),
                                      '&egrave;', 'è'),
                                    '&ecirc;', 'ê'),
                                  '&euml;', 'ë'),
                                '&agrave;', 'à'),
                              '&acirc;', 'â'),
                            '&auml;', 'ä'),
                          '&ocirc;', 'ô'),
                        '&ouml;', 'ö'),
                      '&ograve;', 'ò'),
                    '&icirc;', 'î'),
                  '&iuml;', 'ï'),
                '&igrave;', 'ì'),
              '&ucirc;', 'û'),
            '&ugrave;', 'ù'),
          '&uuml;', 'ü'),
        '&ccedil;', 'ç'),
      '&rsquo;', ''''),
    '&lsquo;', ''''),
  '&nbsp;', ' ')
WHERE sfgcs_content LIKE '%&%';

-- Étape 3: Vérification APRÈS correction
SELECT 
  sfgcs_id,
  sfgcs_pg_id,
  sfgcs_content as "Contenu_après",
  CASE 
    WHEN sfgcs_content LIKE '%&%' THEN '⚠️ Encore des entités'
    ELSE '✅ Nettoyé'
  END as statut
FROM __seo_family_gamme_car_switch
WHERE sfgcs_id IN (
  SELECT sfgcs_id 
  FROM __seo_family_gamme_car_switch 
  WHERE sfgcs_content LIKE '%&%' 
  LIMIT 10
)
ORDER BY sfgcs_id;

-- Étape 4: Statistiques finales
SELECT 
  COUNT(*) as total_lignes,
  SUM(CASE WHEN sfgcs_content LIKE '%&%' THEN 1 ELSE 0 END) as lignes_avec_entites,
  SUM(CASE WHEN sfgcs_content LIKE '%#VMarque#%' THEN 1 ELSE 0 END) as lignes_avec_variables
FROM __seo_family_gamme_car_switch;

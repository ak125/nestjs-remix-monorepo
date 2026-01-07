-- ============================================================
-- Migration: Améliorer le template SEO Alternateur (pgId=4)
-- Date: 2025-12-31
-- Objectif: Utiliser les variables techniques pour contenu unique
-- ============================================================

-- 1. Vérifier le template actuel
SELECT sgc_pg_id, sgc_title, sgc_descrip, sgc_content
FROM "__seo_gamme_car"
WHERE sgc_pg_id = 4;

-- 2. Mettre à jour le template avec variables enrichies
UPDATE "__seo_gamme_car"
SET
  -- Meta Title enrichi avec puissance et prix
  sgc_title = '#Gamme# #VMarque# #VModele# #VType# #VNbCh# #PrixPasCher# #MinPrice#',

  -- Meta Description avec données techniques
  sgc_descrip = '#ArticlesCount# #Gamme# pour #VMarque# #VModele# #VType# #VNbCh#. Moteur #VMotorisation# code #VCodeMoteur#. Livraison 24-48h. #MinPrice#.',

  -- H1 enrichi
  sgc_h1 = '#Gamme# <b>#VMarque#</b> <b>#VModele#</b> <b>#VType#</b> <b>#VNbCh#</b>',

  -- Contenu enrichi avec toutes les variables techniques
  sgc_content = 'L''<b>alternateur</b> pour votre <b>#VMarque#</b> <b>#VModele#</b> <b>#VType#</b> <b>#VNbCh#</b> est l''élément principal du <b>système électrique</b> qui alimente les équipements de votre moteur <b>#VMotorisation#</b> (code moteur <b>#VCodeMoteur#</b>).<br><br>Automecanik #VousPropose# #ArticlesCount# alternateurs compatibles #PrixPasCher# #MinPrice#. Chaque alternateur a un voltage de 12-14V avec ampérage adapté à votre <b>#VMarque#</b> <b>#VModele#</b>.<br><br>Vérifiez la compatibilité avec votre <b>#VType#</b> via le numéro de châssis (VIN). #Switch_1# les <b>courroie d''accessoire</b> et <b>galet tendeur</b> lors du remplacement.',

  -- Preview court
  sgc_preview = '#Gamme# #VMarque# #VModele# #VNbCh# - #ArticlesCount# références #MinPrice#',

  -- Timestamp de mise à jour
  sgc_updated_at = NOW()

WHERE sgc_pg_id = 4;

-- 3. Vérifier le résultat
SELECT sgc_pg_id, sgc_title, sgc_descrip, LEFT(sgc_content, 200) as content_preview
FROM "__seo_gamme_car"
WHERE sgc_pg_id = 4;

-- ============================================================
-- ROLLBACK (si nécessaire)
-- ============================================================
-- UPDATE "__seo_gamme_car"
-- SET
--   sgc_title = 'Alternateur pas cher à contrôler si coincé ou bloqué ou ne tourne pas',
--   sgc_descrip = 'contrôler l''état de l''alternateur si le témoin de la batterie est allumé pour assurer le bon fonctionnement des composants électrique.',
--   sgc_content = 'L''<b>alternateur</b> est l''élément principal du <b>système électrique</b> du véhicule qui est entraîné par la <b>courroie d''accessoires</b> pour générer du courant électrique aux différents équipements de la voiture.<br>Chaque <b>alternateur</b> à un voltage entre 12 volts à 14 volts et un ampérage différents suivant les équipements et les options du modèle de votre véhicule.'
-- WHERE sgc_pg_id = 4;

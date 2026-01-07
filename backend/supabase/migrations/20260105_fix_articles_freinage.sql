-- Migration: Corriger les patterns "Le/La" pour famille FREINAGE
-- Date: 2026-01-05
-- Objectif: Remplacer "Le/La Plaquette" par "Les plaquettes" (pluriel)
--           Harmoniser tous les titres au pluriel pour SEO e-commerce

-- ============================================================================
-- RÈGLE SEO: Toujours au PLURIEL pour e-commerce auto
-- ✅ "Les plaquettes de frein" (pas "Le/La Plaquette")
-- ✅ "Les disques de frein" (pas "Le/La Disque")
-- ✅ "Les changer" (pas "le/la changer")
-- ============================================================================

-- 1. Plaquettes de frein (pg_id: 402)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_intro_title = 'Les plaquettes de frein',
  sgpg_intro_role = 'Les plaquettes de frein sont les pièces qui appuient sur les disques pour ralentir et arrêter votre voiture. Elles s''usent à chaque freinage car elles absorbent toute l''énergie de décélération. C''est la pièce de sécurité n°1 de votre véhicule.',
  sgpg_risk_title = 'Pourquoi ne jamais rouler avec des plaquettes usées ?',
  sgpg_timing_title = 'Quand faut-il les changer ?',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '402';

-- 2. Disques de frein (pg_id: 82)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_intro_title = 'Les disques de frein',
  sgpg_intro_role = 'Les disques de frein tournent avec vos roues. Quand vous freinez, les plaquettes serrent ces disques pour ralentir le véhicule. Ils transforment l''énergie du mouvement en chaleur.',
  sgpg_risk_title = 'Pourquoi ne jamais négliger vos disques ?',
  sgpg_timing_title = 'Quand faut-il les changer ?',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '82';

-- 3. Étriers de frein (pg_id: 78)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_intro_title = 'Les étriers de frein',
  sgpg_intro_role = 'Les étriers de frein sont les pinces qui poussent les plaquettes contre les disques quand vous appuyez sur la pédale. Ils contiennent des pistons hydrauliques actionnés par le liquide de frein.',
  sgpg_risk_title = 'Pourquoi un étrier défaillant est dangereux ?',
  sgpg_timing_title = 'Quand faut-il les changer ?',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '78';

-- 4. Témoins d'usure (pg_id: 407)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_intro_title = 'Les témoins d''usure',
  sgpg_intro_role = 'Les témoins d''usure sont de petits capteurs qui alertent quand les plaquettes de frein sont trop usées. Ils déclenchent un voyant sur votre tableau de bord.',
  sgpg_risk_title = 'Pourquoi ne jamais ignorer un témoin d''usure ?',
  sgpg_timing_title = 'Quand faut-il les changer ?',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '407';

-- 5. Kits freins arrière (pg_id: 3859)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_intro_title = 'Les kits freins arrière',
  sgpg_intro_role = 'Les kits freins arrière regroupent toutes les pièces nécessaires au freinage de l''essieu arrière : mâchoires, tambours, cylindres et accessoires.',
  sgpg_risk_title = 'Pourquoi choisir un kit complet ?',
  sgpg_timing_title = 'Quand faut-il les changer ?',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '3859';

-- 6. Mâchoires de frein (pg_id: 70)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_intro_title = 'Les mâchoires de frein',
  sgpg_intro_role = 'Les mâchoires de frein sont l''équivalent des plaquettes pour les freins à tambour. Elles appuient contre l''intérieur du tambour pour freiner le véhicule.',
  sgpg_risk_title = 'Pourquoi ne jamais rouler avec des mâchoires usées ?',
  sgpg_timing_title = 'Quand faut-il les changer ?',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '70';

-- 7. Cylindres de roue (pg_id: 277)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_intro_title = 'Les cylindres de roue',
  sgpg_intro_role = 'Les cylindres de roue poussent les mâchoires contre les tambours de frein. Ils transforment la pression hydraulique en force mécanique.',
  sgpg_risk_title = 'Pourquoi une fuite de cylindre est dangereuse ?',
  sgpg_timing_title = 'Quand faut-il les changer ?',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '277';

-- 8. Flexibles de frein (pg_id: 83)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_intro_title = 'Les flexibles de frein',
  sgpg_intro_role = 'Les flexibles de frein transmettent la pression du liquide de frein entre les canalisations rigides et les étriers ou cylindres de roue.',
  sgpg_risk_title = 'Pourquoi un flexible craquelé est dangereux ?',
  sgpg_timing_title = 'Quand faut-il les changer ?',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '83';

-- 9. Câbles de frein à main (pg_id: 124)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_intro_title = 'Les câbles de frein à main',
  sgpg_intro_role = 'Les câbles de frein à main transmettent la force de votre levier jusqu''aux freins arrière pour immobiliser le véhicule en stationnement.',
  sgpg_risk_title = 'Pourquoi un câble détendu est dangereux ?',
  sgpg_timing_title = 'Quand faut-il les changer ?',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '124';

-- 10. Tambours de frein (pg_id: 123)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_intro_title = 'Les tambours de frein',
  sgpg_intro_role = 'Les tambours de frein sont des cylindres creux dans lesquels les mâchoires viennent appuyer pour freiner. Ils sont utilisés sur l''essieu arrière de nombreux véhicules.',
  sgpg_risk_title = 'Pourquoi ne jamais négliger vos tambours ?',
  sgpg_timing_title = 'Quand faut-il les changer ?',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '123';

-- 11. Maîtres-cylindres (pg_id: 258)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_intro_title = 'Les maîtres-cylindres',
  sgpg_intro_role = 'Les maîtres-cylindres transforment la force de votre pédale en pression hydraulique. Ils distribuent cette pression à tout le circuit de freinage.',
  sgpg_risk_title = 'Pourquoi un maître-cylindre défaillant est critique ?',
  sgpg_timing_title = 'Quand faut-il les changer ?',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '258';

-- 12. Servo-freins (pg_id: 74)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_intro_title = 'Les servo-freins',
  sgpg_intro_role = 'Les servo-freins amplifient votre effort sur la pédale de frein grâce à la dépression moteur. Sans eux, freiner demanderait une force considérable.',
  sgpg_risk_title = 'Pourquoi un servo-frein défaillant est dangereux ?',
  sgpg_timing_title = 'Quand faut-il les changer ?',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '74';

-- 13. Agrégats ABS (pg_id: 415)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_intro_title = 'Les agrégats ABS',
  sgpg_intro_role = 'Les agrégats ABS empêchent le blocage des roues au freinage. Ils permettent de garder le contrôle du véhicule même en cas de freinage d''urgence.',
  sgpg_risk_title = 'Pourquoi un ABS défaillant est dangereux ?',
  sgpg_timing_title = 'Quand faut-il les changer ?',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '415';

-- 14. Vis de disque (pg_id: 54)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_intro_title = 'Les vis de disque',
  sgpg_intro_role = 'Les vis de disque maintiennent les disques de frein sur les moyeux. Elles assurent un positionnement précis pour un freinage optimal.',
  sgpg_risk_title = 'Pourquoi des vis grippées posent problème ?',
  sgpg_timing_title = 'Quand faut-il les changer ?',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '54';

-- 15. Répartiteurs de freinage (pg_id: 73)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_intro_title = 'Les répartiteurs de freinage',
  sgpg_intro_role = 'Les répartiteurs de freinage dosent la pression entre l''avant et l''arrière du véhicule. Ils évitent le blocage des roues arrière au freinage.',
  sgpg_risk_title = 'Pourquoi un répartiteur défaillant est dangereux ?',
  sgpg_timing_title = 'Quand faut-il les changer ?',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '73';

-- 16. Pompes à vide (pg_id: 387)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_intro_title = 'Les pompes à vide',
  sgpg_intro_role = 'Les pompes à vide alimentent le servo-frein sur les moteurs diesel. Sans dépression naturelle du moteur, elles créent le vide nécessaire à l''assistance.',
  sgpg_risk_title = 'Pourquoi une pompe à vide défaillante est dangereuse ?',
  sgpg_timing_title = 'Quand faut-il les changer ?',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '387';

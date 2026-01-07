-- Migration: Correction des 13 gammes Freinage restantes avec contenu dupliqué
-- Date: 2026-01-05
-- Gammes concernées: 123, 124, 258, 277, 3859, 387, 412, 415, 54, 70, 73, 806, 83

-- ============================================================================
-- TAMBOUR DE FREIN (ID 123)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide
SET
  sgpg_risk_explanation = 'Un tambour de frein usé ou ovalisé empêche les mâchoires d''appuyer uniformément sur sa surface intérieure. Le freinage devient irrégulier et les distances d''arrêt augmentent, surtout à l''arrière du véhicule.',
  sgpg_risk_consequences = '["freinage arrière inefficace ou saccadé", "bruit de frottement métallique au freinage", "frein à main qui ne tient plus en côte", "usure accélérée des mâchoires", "surchauffe et risque de blocage de roue"]'::jsonb,
  sgpg_risk_conclusion = 'Les tambours se remplacent par paire sur le même essieu pour garantir un freinage équilibré.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = 123;

-- ============================================================================
-- CÂBLE DE FREIN À MAIN (ID 124)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide
SET
  sgpg_risk_explanation = 'Un câble de frein à main détendu, grippé ou cassé rend le stationnement dangereux. Le véhicule peut rouler même frein à main serré, surtout en pente.',
  sgpg_risk_consequences = '["véhicule qui roule malgré le frein à main serré", "course du levier excessivement longue", "câble grippé qui ne revient pas", "impossibilité de passer le contrôle technique", "danger en stationnement sur pente"]'::jsonb,
  sgpg_risk_conclusion = 'Remplacez le câble si le levier de frein à main monte trop haut ou si le véhicule bouge en pente.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = 124;

-- ============================================================================
-- MAÎTRE CYLINDRE DE FREIN (ID 258)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide
SET
  sgpg_risk_explanation = 'Le maître-cylindre transforme la pression de votre pied sur la pédale en pression hydraulique. S''il fuit ou s''use, la pédale s''enfonce progressivement et le freinage devient mou voire inexistant.',
  sgpg_risk_consequences = '["pédale de frein molle qui s''enfonce au plancher", "perte progressive de pression de freinage", "fuite de liquide de frein visible sous le capot", "voyant de frein allumé en permanence", "perte totale de freinage en cas de rupture"]'::jsonb,
  sgpg_risk_conclusion = 'Une pédale de frein qui s''enfonce progressivement est le signe d''un maître-cylindre défaillant. Consultez un professionnel rapidement.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = 258;

-- ============================================================================
-- CYLINDRE DE ROUE (ID 277)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide
SET
  sgpg_risk_explanation = 'Le cylindre de roue pousse les mâchoires contre le tambour. Une fuite de liquide ou un piston grippé provoque un freinage asymétrique et une usure inégale.',
  sgpg_risk_consequences = '["véhicule qui tire d''un côté au freinage", "traces de liquide de frein sur la roue ou le tambour", "usure anormale d''une seule mâchoire", "freinage arrière très faible", "blocage de roue si le piston grippe"]'::jsonb,
  sgpg_risk_conclusion = 'Les cylindres de roue se remplacent généralement par paire pour maintenir un freinage équilibré.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = 277;

-- ============================================================================
-- KIT DE FREINS ARRIÈRE (ID 3859)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide
SET
  sgpg_risk_explanation = 'Le kit complet regroupe mâchoires, ressorts et accessoires pour une rénovation complète du frein arrière. Remplacer uniquement les mâchoires sans les ressorts peut compromettre le bon fonctionnement.',
  sgpg_risk_consequences = '["mâchoires qui ne s''écartent pas correctement", "ressorts fatigués qui provoquent un frottement permanent", "usure prématurée des nouvelles mâchoires", "bruit au freinage malgré les pièces neuves", "frein à main inefficace"]'::jsonb,
  sgpg_risk_conclusion = 'Le kit complet garantit que toutes les pièces d''usure sont remplacées ensemble pour un freinage optimal.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = 3859;

-- ============================================================================
-- POMPE À VIDE DE FREINAGE (ID 387)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide
SET
  sgpg_risk_explanation = 'La pompe à vide alimente le servo-frein sur les moteurs diesel et certains essence turbo. Sans elle, la pédale devient très dure et nécessite beaucoup plus d''effort pour freiner.',
  sgpg_risk_consequences = '["pédale de frein très dure, effort important nécessaire", "assistance de freinage qui disparaît progressivement", "bruit de sifflement au niveau du moteur", "freinages d''urgence difficiles", "fatigue du conducteur sur longs trajets"]'::jsonb,
  sgpg_risk_conclusion = 'Sur un diesel, une pédale de frein dure indique souvent une pompe à vide défaillante.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = 387;

-- ============================================================================
-- CAPTEUR ABS (ID 412)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide
SET
  sgpg_risk_explanation = 'Le capteur ABS détecte la vitesse de rotation de chaque roue. Sans signal fiable, l''ABS et l''ESP se désactivent, augmentant le risque de blocage de roues en freinage d''urgence.',
  sgpg_risk_consequences = '["voyant ABS et ESP allumés au tableau de bord", "système antiblocage désactivé", "blocage des roues possible en freinage d''urgence", "contrôle de stabilité inactif", "refus au contrôle technique"]'::jsonb,
  sgpg_risk_conclusion = 'Un voyant ABS allumé indique souvent un capteur défaillant ou un câblage endommagé à vérifier en priorité.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = 412;

-- ============================================================================
-- AGRÉGAT DE FREINAGE / BLOC ABS (ID 415)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide
SET
  sgpg_risk_explanation = 'L''agrégat ABS (bloc hydraulique + calculateur) gère la pression de freinage sur chaque roue. Une panne désactive tous les systèmes d''aide au freinage (ABS, ESP, AFU).',
  sgpg_risk_consequences = '["ABS, ESP et aide au freinage d''urgence désactivés", "voyants multiples allumés au tableau de bord", "freinage de base conservé mais sans assistance électronique", "comportement dangereux sur route mouillée", "réparation coûteuse si le calculateur est HS"]'::jsonb,
  sgpg_risk_conclusion = 'Avant de remplacer l''agrégat complet, faites vérifier les capteurs et le câblage - souvent moins coûteux.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = 415;

-- ============================================================================
-- VIS DE DISQUE (ID 54)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide
SET
  sgpg_risk_explanation = 'Les vis de disque maintiennent le disque sur le moyeu pendant le montage. Une vis grippée ou cassée complique le remplacement des disques et peut provoquer un voilage.',
  sgpg_risk_consequences = '["disque mal centré provoquant des vibrations", "difficulté à déposer le disque lors de l''entretien", "vis grippée qui casse au démontage", "voile du disque si serrage inégal", "risque de desserrage si vis usée"]'::jsonb,
  sgpg_risk_conclusion = 'Remplacez les vis de disque à chaque changement de disques pour faciliter les entretiens futurs.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = 54;

-- ============================================================================
-- MÂCHOIRES DE FREIN (ID 70)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide
SET
  sgpg_risk_explanation = 'Les mâchoires de frein sont l''équivalent des plaquettes pour les freins à tambour. Elles s''écartent pour appuyer sur l''intérieur du tambour et ralentir la roue.',
  sgpg_risk_consequences = '["freinage arrière très faible ou inexistant", "frein à main qui ne tient plus", "bruit de raclement métallique", "usure du tambour si garniture trop amincie", "distances de freinage allongées"]'::jsonb,
  sgpg_risk_conclusion = 'Remplacez les mâchoires par essieu complet (gauche + droite) et vérifiez l''état des tambours.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = 70;

-- ============================================================================
-- RÉPARTITEUR DE FREIN (ID 73)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide
SET
  sgpg_risk_explanation = 'Le répartiteur dose la pression de freinage entre l''avant et l''arrière en fonction de la charge. Un répartiteur bloqué provoque un blocage prématuré des roues arrière.',
  sgpg_risk_consequences = '["roues arrière qui bloquent avant les avant", "véhicule instable au freinage", "dérapage du train arrière en freinage appuyé", "usure asymétrique des plaquettes/mâchoires", "fuite de liquide si le répartiteur est percé"]'::jsonb,
  sgpg_risk_conclusion = 'Le répartiteur est souvent exposé sous le véhicule - vérifiez son état en cas de corrosion.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = 73;

-- ============================================================================
-- INTERRUPTEUR DES FEUX DE FREINS (ID 806)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide
SET
  sgpg_risk_explanation = 'L''interrupteur de feux stop détecte l''appui sur la pédale pour allumer les feux arrière. S''il est défaillant, les conducteurs derrière vous ne voient pas que vous freinez.',
  sgpg_risk_consequences = '["feux stop qui ne s''allument pas = risque de collision", "feux stop allumés en permanence = ampoules grillées", "régulateur de vitesse qui ne se désactive pas", "boîte automatique bloquée en position P", "refus au contrôle technique"]'::jsonb,
  sgpg_risk_conclusion = 'Vérifiez régulièrement que vos feux stop fonctionnent - demandez à quelqu''un d''appuyer sur la pédale.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = 806;

-- ============================================================================
-- FLEXIBLE DE FREIN (ID 83)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide
SET
  sgpg_risk_explanation = 'Les flexibles de frein transmettent la pression hydraulique aux étriers ou cylindres de roue. Un flexible poreux, gonflé ou fissuré peut éclater sous la pression.',
  sgpg_risk_consequences = '["perte de liquide de frein et baisse de pression", "pédale molle qui s''enfonce", "flexible qui gonfle et absorbe la pression", "fuite visible sur la roue ou le passage de roue", "éclatement brutal = perte de freinage"]'::jsonb,
  sgpg_risk_conclusion = 'Les flexibles doivent être remplacés tous les 100 000 km ou 10 ans maximum, ou dès qu''ils présentent des craquelures.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = 83;

-- ============================================================================
-- Vérification post-migration
-- ============================================================================
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(DISTINCT sgpg_risk_explanation) INTO v_count
  FROM __seo_gamme_purchase_guide
  WHERE sgpg_pg_id IN (402, 82, 78, 407, 123, 124, 258, 277, 3859, 387, 412, 415, 54, 70, 73, 806, 83);

  IF v_count = 17 THEN
    RAISE NOTICE 'Migration réussie : 17 textes uniques pour la famille Freinage complète';
  ELSE
    RAISE WARNING 'Attention : seulement % textes uniques sur 17', v_count;
  END IF;
END $$;

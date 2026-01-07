-- Migration: Correction des arguments dupliqués - Famille Freinage (17 gammes)
-- Date: 2026-01-05
-- Objectif: Rendre les arguments de vente uniques par gamme pour éviter le duplicate SEO
-- Champs modifiés: sgpg_arg1_content, sgpg_arg2_content, sgpg_arg3_content, sgpg_arg4_content

-- ============================================================================
-- PLAQUETTES DE FREIN (ID: 402)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_arg1_content = 'Sur notre site, vous sélectionnez votre véhicule et nous filtrons automatiquement les plaquettes compatibles. Fini les erreurs : avant ou arrière, ventilé ou plein, nous affichons uniquement ce qui correspond à vos freins.',
  sgpg_arg2_content = 'Nous proposons des marques reconnues (Brembo, TRW, Bosch, ATE) utilisées en première monte. Les plaquettes que vous recevez ont les mêmes performances de freinage que celles d''origine.',
  sgpg_arg3_content = 'Jusqu''à 40 % moins cher qu''en garage ou concession. Les plaquettes de frein sont parmi les pièces les plus fréquemment remplacées : faites des économies sans sacrifier la sécurité.',
  sgpg_arg4_content = 'Les plaquettes se changent toujours par essieu (gauche + droite ensemble). Cela garantit un freinage équilibré et évite l''usure prématurée des disques.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = 402;

-- ============================================================================
-- DISQUES DE FREIN (ID: 82)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_arg1_content = 'Sélectionnez votre véhicule et nous affichons uniquement les disques compatibles. Diamètre, nombre de trous, ventilé ou plein : tout est filtré automatiquement pour éviter les erreurs.',
  sgpg_arg2_content = 'Nos disques proviennent de marques OEM (Brembo, TRW, Bosch, Ferodo). Ils respectent les mêmes tolérances d''épaisseur et de planéité que les disques d''origine.',
  sgpg_arg3_content = 'Les disques de frein coûtent cher en concession. Sur Automecanik, bénéficiez de prix jusqu''à 50 % inférieurs pour des disques de qualité identique.',
  sgpg_arg4_content = 'Les disques se remplacent par paire sur le même essieu. Changez les plaquettes en même temps pour éviter une usure accélérée des nouveaux disques.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = 82;

-- ============================================================================
-- ÉTRIER DE FREIN (ID: 78)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_arg1_content = 'L''étrier est spécifique à chaque véhicule et chaque côté (gauche/droite). Notre système de sélection évite toute confusion et vous garantit la bonne pièce du premier coup.',
  sgpg_arg2_content = 'Nos étriers reconditionnés ou neufs sont testés en pression hydraulique. Les marques comme ATE, Budweg ou TRW garantissent une qualité équivalente à l''équipement d''origine.',
  sgpg_arg3_content = 'Un étrier neuf peut coûter 300 € à 600 € en concession. Sur notre site, trouvez des étriers reconditionnés ou neufs jusqu''à 60 % moins chers.',
  sgpg_arg4_content = 'L''étrier de frein est une pièce de sécurité critique. Vérifiez qu''il ne fuit pas et que les pistons coulissent librement. En cas de doute, faites appel à un professionnel.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = 78;

-- ============================================================================
-- TÉMOIN D'USURE (ID: 407)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_arg1_content = 'Le témoin d''usure est spécifique à chaque véhicule. Certains modèles en ont un par roue, d''autres seulement à l''avant. Notre filtre véhicule vous évite les erreurs.',
  sgpg_arg2_content = 'Nos capteurs d''usure sont compatibles avec les systèmes électroniques de votre véhicule. Ils éteignent correctement le voyant au tableau de bord une fois les plaquettes remplacées.',
  sgpg_arg3_content = 'Le témoin d''usure coûte quelques euros mais son remplacement est souvent facturé cher en main-d''œuvre. Commandez-le avec vos plaquettes et faites-le changer en même temps.',
  sgpg_arg4_content = 'Le témoin d''usure se change systématiquement avec les plaquettes. Oublier de le remplacer laissera le voyant allumé même avec des plaquettes neuves.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = 407;

-- ============================================================================
-- TAMBOUR DE FREIN (ID: 123)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_arg1_content = 'Les tambours varient selon le véhicule et l''essieu. Notre sélection par plaque d''immatriculation vous garantit le bon diamètre et le bon nombre de fixations.',
  sgpg_arg2_content = 'Nos tambours respectent les tolérances d''ovalisation et de diamètre intérieur des pièces d''origine. Marques disponibles : TRW, Brembo, NK.',
  sgpg_arg3_content = 'Les tambours sont moins chers que les disques mais tout aussi importants pour le freinage arrière. Économisez jusqu''à 40 % par rapport aux prix concession.',
  sgpg_arg4_content = 'Les tambours se changent par paire et se remplacent généralement avec les mâchoires de frein. Vérifiez le diamètre maximum d''usure gravé sur le tambour.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = 123;

-- ============================================================================
-- CÂBLE DE FREIN À MAIN (ID: 124)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_arg1_content = 'Le câble de frein à main est spécifique à chaque véhicule et chaque côté (gauche/droite ou central). Notre système de filtrage évite toute erreur de commande.',
  sgpg_arg2_content = 'Nos câbles proviennent de fabricants équipementiers (Triscan, Cofle, TRW). La gaine et le câble sont identiques aux pièces d''origine pour une course de levier optimale.',
  sgpg_arg3_content = 'Un câble de frein à main coûte entre 15 € et 40 €. La main-d''œuvre en garage peut tripler ce prix. Commandez la bonne pièce et faites des économies.',
  sgpg_arg4_content = 'Si le levier de frein à main monte trop haut ou si le véhicule bouge en pente, le câble est probablement détendu ou grippé. Remplacez-le pour retrouver un stationnement sûr.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = 124;

-- ============================================================================
-- MAÎTRE-CYLINDRE DE FREIN (ID: 258)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_arg1_content = 'Le maître-cylindre est une pièce technique spécifique à chaque véhicule. Sélectionnez votre modèle pour obtenir la référence exacte compatible avec votre circuit de freinage.',
  sgpg_arg2_content = 'Nos maîtres-cylindres sont neufs ou reconditionnés avec des joints de qualité OE. Marques : ATE, TRW, Bosch. Ils garantissent une pression de freinage constante.',
  sgpg_arg3_content = 'Un maître-cylindre peut coûter 150 € à 400 € en concession. Sur Automecanik, trouvez des pièces de qualité équivalente jusqu''à 50 % moins chères.',
  sgpg_arg4_content = 'Le maître-cylindre est le cœur hydraulique de votre système de freinage. Une pédale molle ou qui s''enfonce progressivement indique souvent un maître-cylindre défaillant.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = 258;

-- ============================================================================
-- CYLINDRE DE ROUE (ID: 277)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_arg1_content = 'Le cylindre de roue est spécifique à chaque côté (gauche/droite) et à chaque véhicule. Notre système de sélection vous garantit la bonne pièce pour votre essieu arrière.',
  sgpg_arg2_content = 'Nos cylindres de roue sont neufs avec joints et pistons de qualité OE. Marques : TRW, ATE, Cifam. Ils résistent à la pression hydraulique et aux conditions climatiques.',
  sgpg_arg3_content = 'Le cylindre de roue est une petite pièce mais son remplacement en garage peut coûter cher. Commandez-le à prix juste et faites-le monter par votre garagiste.',
  sgpg_arg4_content = 'Les cylindres de roue se remplacent généralement par paire pour maintenir un freinage équilibré. Une trace humide sur le tambour signale une fuite à traiter rapidement.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = 277;

-- ============================================================================
-- KIT DE FREINS ARRIÈRE (ID: 3859)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_arg1_content = 'Le kit complet est adapté à votre véhicule et inclut tout le nécessaire : mâchoires, ressorts, câbles et accessoires. Plus de risque d''oublier une pièce.',
  sgpg_arg2_content = 'Nos kits freins arrière regroupent des composants de marques reconnues (Bosch, TRW, Brembo). Toutes les pièces sont compatibles entre elles pour un montage sans surprise.',
  sgpg_arg3_content = 'Acheter le kit complet revient moins cher que d''acheter chaque pièce séparément. Vous économisez jusqu''à 30 % par rapport à l''achat à l''unité.',
  sgpg_arg4_content = 'Le kit complet garantit que toutes les pièces d''usure sont remplacées ensemble. Les ressorts fatigués peuvent compromettre le bon fonctionnement des mâchoires neuves.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = 3859;

-- ============================================================================
-- MÂCHOIRES DE FREIN (ID: 70)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_arg1_content = 'Les mâchoires varient selon le véhicule et le diamètre du tambour. Notre système de sélection vous garantit les bonnes dimensions et le bon type de garniture.',
  sgpg_arg2_content = 'Nos mâchoires de frein sont fabriquées par des équipementiers reconnus (TRW, Brembo, Ferodo). La garniture est identique aux pièces d''origine pour un freinage optimal.',
  sgpg_arg3_content = 'Les mâchoires de frein coûtent généralement entre 20 € et 60 € la paire. Sur notre site, bénéficiez de prix jusqu''à 40 % inférieurs aux concessions.',
  sgpg_arg4_content = 'Les mâchoires se changent par essieu (gauche + droite ensemble) et il est recommandé de vérifier l''état des tambours en même temps. Contrôlez également les ressorts de rappel.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = 70;

-- ============================================================================
-- RÉPARTITEUR DE FREIN (ID: 73)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_arg1_content = 'Le répartiteur de frein est propre à chaque véhicule. Notre filtre par plaque d''immatriculation vous garantit la pièce exacte compatible avec votre circuit hydraulique.',
  sgpg_arg2_content = 'Nos répartiteurs sont neufs et respectent les caractéristiques de dosage de pression d''origine. Ils assurent un freinage équilibré entre l''avant et l''arrière.',
  sgpg_arg3_content = 'Le répartiteur est une pièce robuste mais exposée à la corrosion. Sur Automecanik, trouvez des pièces neuves à prix réduit pour prolonger la sécurité de votre véhicule.',
  sgpg_arg4_content = 'Le répartiteur dose la pression de freinage selon la charge du véhicule. Sur les modèles modernes, l''ABS remplace souvent cette fonction mécanique.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = 73;

-- ============================================================================
-- POMPE À VIDE DE FREINAGE (ID: 387)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_arg1_content = 'La pompe à vide est spécifique à chaque motorisation. Sur les diesels et certains essence turbo, elle est indispensable pour l''assistance de freinage. Sélectionnez votre véhicule pour la bonne référence.',
  sgpg_arg2_content = 'Nos pompes à vide sont neuves ou reconditionnées avec des joints et palettes de qualité OE. Elles garantissent une dépression suffisante pour le servo-frein.',
  sgpg_arg3_content = 'Une pompe à vide peut coûter 200 € à 500 € en concession. Sur notre site, trouvez des alternatives de qualité équivalente jusqu''à 50 % moins chères.',
  sgpg_arg4_content = 'Sur un diesel, une pédale de frein très dure indique souvent une pompe à vide défaillante. Vérifiez également l''absence de fuite d''huile autour de la pompe.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = 387;

-- ============================================================================
-- CAPTEUR ABS (ID: 412)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_arg1_content = 'Le capteur ABS est spécifique à chaque roue et chaque véhicule. Avant/arrière, gauche/droite : notre système vous garantit le bon capteur pour votre position.',
  sgpg_arg2_content = 'Nos capteurs ABS sont neufs et respectent les caractéristiques électriques d''origine. Ils communiquent correctement avec le calculateur pour un ABS fonctionnel.',
  sgpg_arg3_content = 'Un capteur ABS coûte entre 30 € et 80 € sur notre site, contre 80 € à 150 € en concession. Économisez tout en conservant la sécurité de votre véhicule.',
  sgpg_arg4_content = 'Un voyant ABS allumé indique souvent un capteur défaillant ou un câblage endommagé. Vérifiez en priorité les capteurs avant de suspecter le bloc ABS.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = 412;

-- ============================================================================
-- AGRÉGAT DE FREINAGE / BLOC ABS (ID: 415)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_arg1_content = 'L''agrégat ABS (bloc hydraulique + calculateur) est propre à chaque véhicule. Notre système de sélection vous garantit la pièce compatible avec votre configuration.',
  sgpg_arg2_content = 'Nos agrégats sont reconditionnés par des spécialistes ou neufs. Les joints, valves et calculateurs sont testés en pression pour garantir un fonctionnement optimal.',
  sgpg_arg3_content = 'Un agrégat ABS neuf peut coûter 1 000 € à 3 000 €. Sur Automecanik, trouvez des blocs reconditionnés ou neufs à prix réduit.',
  sgpg_arg4_content = 'Avant de remplacer l''agrégat complet, faites vérifier les capteurs et le câblage. Un diagnostic électronique peut éviter une dépense inutile.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = 415;

-- ============================================================================
-- VIS DE DISQUE (ID: 54)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_arg1_content = 'Les vis de disque varient selon le véhicule (taille, pas de vis, tête). Notre filtre vous garantit les bonnes vis pour maintenir vos disques sur le moyeu.',
  sgpg_arg2_content = 'Nos vis de disque sont en acier traité pour résister à la corrosion. Elles se dévissent facilement même après plusieurs années, contrairement aux vis bas de gamme.',
  sgpg_arg3_content = 'Les vis de disque coûtent quelques euros mais leur remplacement facilite l''entretien futur. Un petit investissement pour éviter de casser les vis au démontage.',
  sgpg_arg4_content = 'Remplacez les vis de disque à chaque changement de disques. Appliquez un peu de graisse cuivrée sur le filetage pour faciliter le prochain démontage.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = 54;

-- ============================================================================
-- INTERRUPTEUR DES FEUX DE FREINS (ID: 806)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_arg1_content = 'L''interrupteur de feux stop est spécifique à chaque véhicule et à sa pédale de frein. Sélectionnez votre modèle pour obtenir la référence exacte.',
  sgpg_arg2_content = 'Nos interrupteurs sont neufs et compatibles avec l''électronique de votre véhicule. Ils garantissent un allumage fiable des feux stop et le bon fonctionnement du régulateur de vitesse.',
  sgpg_arg3_content = 'L''interrupteur de feux stop coûte entre 10 € et 30 €. Une pièce peu coûteuse mais essentielle pour la sécurité des usagers derrière vous.',
  sgpg_arg4_content = 'Vérifiez régulièrement que vos feux stop fonctionnent. Demandez à quelqu''un d''appuyer sur la pédale pendant que vous regardez l''arrière du véhicule.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = 806;

-- ============================================================================
-- FLEXIBLE DE FREIN (ID: 83)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_arg1_content = 'Les flexibles de frein sont spécifiques à chaque roue et chaque véhicule. Avant/arrière, gauche/droite : notre système vous garantit le bon flexible pour votre position.',
  sgpg_arg2_content = 'Nos flexibles sont fabriqués aux normes DOT et SAE avec une gaine renforcée. Ils résistent à la pression et aux agressions extérieures (huile, UV, chaleur).',
  sgpg_arg3_content = 'Un flexible de frein coûte entre 15 € et 40 € sur notre site. Remplacez-les préventivement tous les 100 000 km ou 10 ans pour éviter une rupture.',
  sgpg_arg4_content = 'Les flexibles doivent être inspectés visuellement : craquelures, gonflements ou traces d''humidité signalent un remplacement urgent. Une rupture entraîne une perte de freinage.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = 83;

-- ============================================================================
-- VÉRIFICATION POST-MIGRATION
-- ============================================================================
DO $$
DECLARE
  v_count_arg1 INTEGER;
  v_count_arg2 INTEGER;
  v_count_arg3 INTEGER;
  v_count_arg4 INTEGER;
BEGIN
  -- Vérifier unicité Arg1
  SELECT COUNT(DISTINCT sgpg_arg1_content) INTO v_count_arg1
  FROM __seo_gamme_purchase_guide
  WHERE sgpg_pg_id IN (402, 82, 78, 407, 123, 124, 258, 277, 3859, 387, 412, 415, 54, 70, 73, 806, 83);

  -- Vérifier unicité Arg2
  SELECT COUNT(DISTINCT sgpg_arg2_content) INTO v_count_arg2
  FROM __seo_gamme_purchase_guide
  WHERE sgpg_pg_id IN (402, 82, 78, 407, 123, 124, 258, 277, 3859, 387, 412, 415, 54, 70, 73, 806, 83);

  -- Vérifier unicité Arg3
  SELECT COUNT(DISTINCT sgpg_arg3_content) INTO v_count_arg3
  FROM __seo_gamme_purchase_guide
  WHERE sgpg_pg_id IN (402, 82, 78, 407, 123, 124, 258, 277, 3859, 387, 412, 415, 54, 70, 73, 806, 83);

  -- Vérifier unicité Arg4
  SELECT COUNT(DISTINCT sgpg_arg4_content) INTO v_count_arg4
  FROM __seo_gamme_purchase_guide
  WHERE sgpg_pg_id IN (402, 82, 78, 407, 123, 124, 258, 277, 3859, 387, 412, 415, 54, 70, 73, 806, 83);

  -- Rapport
  IF v_count_arg1 = 17 AND v_count_arg2 = 17 AND v_count_arg3 = 17 AND v_count_arg4 = 17 THEN
    RAISE NOTICE '✅ Migration réussie : 17 textes uniques pour chaque argument (Arg1-4)';
  ELSE
    RAISE WARNING '⚠️ Attention : Arg1=%, Arg2=%, Arg3=%, Arg4=% sur 17 attendus',
      v_count_arg1, v_count_arg2, v_count_arg3, v_count_arg4;
  END IF;
END $$;

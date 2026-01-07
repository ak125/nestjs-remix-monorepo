-- Migration: Correction timing + syncParts dupliqués - Famille Freinage (17 gammes)
-- Date: 2026-01-05
-- Objectif: Rendre timing et syncParts uniques et métier-corrects
-- Champs modifiés: sgpg_timing_years, sgpg_timing_km, sgpg_timing_note, sgpg_intro_sync_parts

-- ============================================================================
-- CATÉGORIE 1 : PIÈCES D'USURE RAPIDE (1-4 ans)
-- ============================================================================

-- PLAQUETTES DE FREIN (ID: 402)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_timing_years = '1 à 3 ans',
  sgpg_timing_km = '20 000 à 50 000 km',
  sgpg_timing_note = 'Vérifiez le témoin d''usure sur votre tableau de bord. En ville, elles s''usent 2 fois plus vite qu''sur autoroute.',
  sgpg_intro_sync_parts = '["les disques de frein", "les étriers", "le liquide de frein"]'::jsonb,
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = 402;

-- TÉMOIN D'USURE (ID: 407)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_timing_years = '1 à 3 ans',
  sgpg_timing_km = '20 000 à 50 000 km',
  sgpg_timing_note = 'Se remplace systématiquement à chaque changement de plaquettes. Ne jamais le réutiliser.',
  sgpg_intro_sync_parts = '["les plaquettes de frein", "le système électrique du véhicule"]'::jsonb,
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = 407;

-- ============================================================================
-- CATÉGORIE 2 : PIÈCES D'USURE MOYENNE (4-8 ans)
-- ============================================================================

-- DISQUES DE FREIN (ID: 82)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_timing_years = '4 à 6 ans',
  sgpg_timing_km = '60 000 à 90 000 km',
  sgpg_timing_note = 'Contrôlez l''épaisseur minimale gravée sur le disque. Changez toujours par paire avec les plaquettes.',
  sgpg_intro_sync_parts = '["les plaquettes de frein", "les étriers", "le moyeu de roue"]'::jsonb,
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = 82;

-- VIS DE DISQUE (ID: 54)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_timing_years = '4 à 6 ans',
  sgpg_timing_km = '60 000 à 80 000 km',
  sgpg_timing_note = 'Remplacez-les à chaque changement de disques. Appliquez de la graisse cuivrée pour faciliter le prochain démontage.',
  sgpg_intro_sync_parts = '["les disques de frein", "le moyeu"]'::jsonb,
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = 54;

-- MÂCHOIRES DE FREIN (ID: 70)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_timing_years = '5 à 8 ans',
  sgpg_timing_km = '80 000 à 120 000 km',
  sgpg_timing_note = 'Vérifiez le frein à main : s''il faut tirer fort ou s''il monte trop haut, les mâchoires sont probablement usées.',
  sgpg_intro_sync_parts = '["les tambours de frein", "les ressorts de rappel", "les cylindres de roue"]'::jsonb,
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = 70;

-- KIT DE FREINS ARRIÈRE (ID: 3859)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_timing_years = '4 à 6 ans',
  sgpg_timing_km = '60 000 à 100 000 km',
  sgpg_timing_note = 'Le kit complet inclut mâchoires + ressorts. Ne jamais remplacer les mâchoires sans les ressorts.',
  sgpg_intro_sync_parts = '["les tambours de frein", "le câble de frein à main"]'::jsonb,
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = 3859;

-- CYLINDRE DE ROUE (ID: 277)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_timing_years = '6 à 10 ans',
  sgpg_timing_km = '100 000 à 150 000 km',
  sgpg_timing_note = 'Inspectez-le à chaque changement de mâchoires. Une trace humide sur le tambour signale une fuite.',
  sgpg_intro_sync_parts = '["les mâchoires de frein", "les tambours", "le liquide de frein"]'::jsonb,
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = 277;

-- ============================================================================
-- CATÉGORIE 3 : PIÈCES LONGUE DURÉE (8-15 ans)
-- ============================================================================

-- ÉTRIER DE FREIN (ID: 78) - Cas spécial : pas d'intervalle fixe
UPDATE __seo_gamme_purchase_guide SET
  sgpg_timing_years = 'Pas d''intervalle fixe',
  sgpg_timing_km = 'Sur défaut uniquement',
  sgpg_timing_note = 'Un étrier se remplace uniquement si : fuite de liquide, grippage (roue très chaude), ou usure inégale des plaquettes.',
  sgpg_intro_sync_parts = '["les plaquettes de frein", "les flexibles de frein", "le liquide de frein"]'::jsonb,
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = 78;

-- TAMBOUR DE FREIN (ID: 123)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_timing_years = '8 à 12 ans',
  sgpg_timing_km = '120 000 à 180 000 km',
  sgpg_timing_note = 'Vérifiez le diamètre maximum d''usure gravé sur le tambour. Changez toujours par paire.',
  sgpg_intro_sync_parts = '["les mâchoires de frein", "les cylindres de roue", "le câble de frein à main"]'::jsonb,
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = 123;

-- CÂBLE DE FREIN À MAIN (ID: 124)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_timing_years = '8 à 12 ans',
  sgpg_timing_km = '150 000 à 200 000 km',
  sgpg_timing_note = 'Si le levier de frein à main monte trop haut ou si le véhicule bouge en pente, le câble est à remplacer.',
  sgpg_intro_sync_parts = '["les mâchoires de frein", "le levier de frein à main"]'::jsonb,
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = 124;

-- FLEXIBLE DE FREIN (ID: 83)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_timing_years = '8 à 12 ans',
  sgpg_timing_km = '150 000 à 200 000 km',
  sgpg_timing_note = 'Inspectez visuellement : craquelures, gonflements ou traces d''humidité signalent un remplacement urgent.',
  sgpg_intro_sync_parts = '["les étriers", "les cylindres de roue", "le circuit hydraulique"]'::jsonb,
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = 83;

-- MAÎTRE-CYLINDRE DE FREIN (ID: 258)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_timing_years = '10 à 15 ans',
  sgpg_timing_km = '200 000 à 300 000 km',
  sgpg_timing_note = 'Changez le liquide de frein tous les 2 ans pour préserver les joints du maître-cylindre.',
  sgpg_intro_sync_parts = '["le bocal de liquide de frein", "le servo-frein", "les flexibles de frein"]'::jsonb,
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = 258;

-- POMPE À VIDE DE FREINAGE (ID: 387)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_timing_years = '10 à 15 ans',
  sgpg_timing_km = '150 000 à 250 000 km',
  sgpg_timing_note = 'Sur diesel : une pédale de frein très dure indique une pompe défaillante. Vérifiez les fuites d''huile.',
  sgpg_intro_sync_parts = '["le servo-frein", "le moteur (entraînement)"]'::jsonb,
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = 387;

-- CAPTEUR ABS (ID: 412)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_timing_years = '10 à 15 ans',
  sgpg_timing_km = '150 000 à 250 000 km',
  sgpg_timing_note = 'Voyant ABS allumé = souvent le capteur ou son câblage, pas le bloc ABS. À vérifier en priorité.',
  sgpg_intro_sync_parts = '["le calculateur ABS", "la cible magnétique (roue dentée)"]'::jsonb,
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = 412;

-- ============================================================================
-- CATÉGORIE 4 : PIÈCES TRÈS LONGUE DURÉE (12-20 ans)
-- ============================================================================

-- RÉPARTITEUR DE FREIN (ID: 73)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_timing_years = '12 à 20 ans',
  sgpg_timing_km = '200 000 à 300 000 km',
  sgpg_timing_note = 'Pièce robuste qui dure longtemps. Sur les véhicules modernes, l''ABS remplace souvent cette fonction.',
  sgpg_intro_sync_parts = '["le circuit hydraulique arrière", "le maître-cylindre"]'::jsonb,
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = 73;

-- AGRÉGAT DE FREINAGE / BLOC ABS (ID: 415)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_timing_years = '15 à 20 ans',
  sgpg_timing_km = '250 000 à 350 000 km',
  sgpg_timing_note = 'Pièce rarement remplacée. Une réparation (kit joints, valves) est souvent possible avant remplacement.',
  sgpg_intro_sync_parts = '["les capteurs ABS", "le maître-cylindre", "les flexibles de frein"]'::jsonb,
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = 415;

-- INTERRUPTEUR DES FEUX DE FREINS (ID: 806)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_timing_years = '8 à 15 ans',
  sgpg_timing_km = '150 000 à 200 000 km',
  sgpg_timing_note = 'Vérifiez régulièrement que vos feux stop s''allument quand vous freinez. Demandez à quelqu''un de regarder.',
  sgpg_intro_sync_parts = '["la pédale de frein", "le régulateur de vitesse", "les feux arrière"]'::jsonb,
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = 806;

-- ============================================================================
-- VÉRIFICATION POST-MIGRATION
-- ============================================================================
DO $$
DECLARE
  v_count_years INTEGER;
  v_count_km INTEGER;
  v_count_note INTEGER;
  v_count_sync INTEGER;
BEGIN
  -- Vérifier unicité timing_years
  SELECT COUNT(DISTINCT sgpg_timing_years) INTO v_count_years
  FROM __seo_gamme_purchase_guide
  WHERE sgpg_pg_id IN (402, 82, 78, 407, 123, 124, 258, 277, 3859, 387, 412, 415, 54, 70, 73, 806, 83);

  -- Vérifier unicité timing_km
  SELECT COUNT(DISTINCT sgpg_timing_km) INTO v_count_km
  FROM __seo_gamme_purchase_guide
  WHERE sgpg_pg_id IN (402, 82, 78, 407, 123, 124, 258, 277, 3859, 387, 412, 415, 54, 70, 73, 806, 83);

  -- Vérifier unicité timing_note
  SELECT COUNT(DISTINCT sgpg_timing_note) INTO v_count_note
  FROM __seo_gamme_purchase_guide
  WHERE sgpg_pg_id IN (402, 82, 78, 407, 123, 124, 258, 277, 3859, 387, 412, 415, 54, 70, 73, 806, 83);

  -- Vérifier unicité sync_parts
  SELECT COUNT(DISTINCT sgpg_intro_sync_parts::text) INTO v_count_sync
  FROM __seo_gamme_purchase_guide
  WHERE sgpg_pg_id IN (402, 82, 78, 407, 123, 124, 258, 277, 3859, 387, 412, 415, 54, 70, 73, 806, 83);

  -- Rapport
  RAISE NOTICE '=== RAPPORT MIGRATION TIMING + SYNCPARTS ===';
  RAISE NOTICE 'timing_years : % valeurs distinctes sur 17', v_count_years;
  RAISE NOTICE 'timing_km : % valeurs distinctes sur 17', v_count_km;
  RAISE NOTICE 'timing_note : % valeurs distinctes sur 17', v_count_note;
  RAISE NOTICE 'sync_parts : % valeurs distinctes sur 17', v_count_sync;

  IF v_count_years >= 10 AND v_count_note = 17 AND v_count_sync = 17 THEN
    RAISE NOTICE '✅ Migration réussie : bonne diversité des contenus';
  ELSE
    RAISE WARNING '⚠️ Attention : vérifiez les duplicates restants';
  END IF;
END $$;

-- Migration: Corriger le paragraphe intro_role pour Plaquettes de frein
-- Date: 2026-01-05
-- Objectif: Remplacer "Ils se montent... proposé en jeu de 4" par un texte propre
-- Problème: Accord grammatical incorrect (Ils → Elles) et phrase mal construite

-- ============================================================================
-- Plaquettes de frein (pg_id: 402) - Correction intro_role
-- ============================================================================

UPDATE __seo_gamme_purchase_guide SET
  sgpg_intro_role = 'Les plaquettes de frein font partie des éléments essentiels du freinage. Elles se montent sur l''essieu avant ou arrière et sont généralement vendues par jeu de 4. Sélectionnez votre véhicule, puis choisissez l''essieu (avant/arrière) pour afficher les références compatibles.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '402';

-- ============================================================================
-- Disques de frein (pg_id: 82) - Correction intro_role
-- ============================================================================

UPDATE __seo_gamme_purchase_guide SET
  sgpg_intro_role = 'Les disques de frein sont des pièces essentielles du système de freinage. Ils tournent avec la roue et les plaquettes viennent appuyer dessus pour ralentir le véhicule. On les remplace généralement par paire (gauche + droite) sur un même essieu.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '82';

-- ============================================================================
-- Étriers de frein (pg_id: 78) - Correction intro_role
-- ============================================================================

UPDATE __seo_gamme_purchase_guide SET
  sgpg_intro_role = 'Les étriers de frein sont les éléments qui maintiennent les plaquettes et les pressent contre les disques lors du freinage. Ils fonctionnent grâce à la pression hydraulique du liquide de frein. Un étrier défaillant peut causer un freinage inégal.',
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '78';

-- ============================================================================
-- Vérification après migration
-- ============================================================================
-- SELECT sgpg_pg_id, sgpg_intro_role
-- FROM __seo_gamme_purchase_guide
-- WHERE sgpg_pg_id IN ('402', '82', '78')
-- ORDER BY sgpg_pg_id;

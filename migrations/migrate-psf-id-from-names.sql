-- =====================================================
-- MIGRATION: Peupler RTP_PSF_ID depuis noms de pièces
-- =====================================================
-- Date: 2025-11-24
-- Objectif: Corriger rtp_psf_id = 9999 en détectant position depuis piece_name
-- Base: Documentation PHP legacy - filtres Avant/Arrière/Gauche/Droite
--
-- PSF_ID réels dans la base:
--   1000 = Avant
--   2000 = Arrière  
--   1100 = Avant Gauche
--   1200 = Avant Droit
--   2100 = Arrière Gauche
--   2200 = Arrière Droit
--   9999 = Non spécifié (défaut)
--
-- IMPORTANT: Ce script est SAFE - il ne modifie QUE les rtp_psf_id = 9999
-- =====================================================

-- =====================================================
-- ÉTAPE 1: ANALYSE PRÉ-MIGRATION (VERSION OPTIMISÉE)
-- =====================================================

-- Compter pièces sans position pour PLAQUETTES DE FREIN uniquement
SELECT 
  pg.pg_name AS gamme,
  COUNT(*) AS pieces_sans_position,
  COUNT(DISTINCT prt.rtp_type_id) AS vehicules_impactes
FROM pieces_relation_type prt
JOIN pieces p ON p.piece_id = prt.rtp_piece_id
JOIN pieces_gamme pg ON pg.pg_id = prt.rtp_pg_id
WHERE prt.rtp_psf_id = 9999
  AND p.piece_display = true
  AND prt.rtp_pg_id = 402  -- ⚡ FILTRE GAMME pour éviter timeout
GROUP BY pg.pg_name;

-- =====================================================
-- ÉTAPE 2: TEST DÉTECTION SUR PLAQUETTES DE FREIN
-- =====================================================

-- Vérifier ce qui serait détecté (DRY RUN)
SELECT 
  p.piece_id,
  p.piece_name,
  CASE
    -- Détection position combinée (priorité: avant+gauche > avant > arrière+gauche > arrière)
    WHEN LOWER(p.piece_name) ~ '(avant|front).*(gauche|left|lh)' THEN 1100  -- Avant Gauche
    WHEN LOWER(p.piece_name) ~ '(avant|front).*(droit|right|rh)' THEN 1200  -- Avant Droit
    WHEN LOWER(p.piece_name) ~ '(arrière|arriere|rear).*(gauche|left|lh)' THEN 2100  -- Arrière Gauche
    WHEN LOWER(p.piece_name) ~ '(arrière|arriere|rear).*(droit|right|rh)' THEN 2200  -- Arrière Droit
    -- Détection position simple
    WHEN LOWER(p.piece_name) ~ '(avant|front)' AND LOWER(p.piece_name) !~ '(arrière|arriere|rear)' THEN 1000  -- Avant
    WHEN LOWER(p.piece_name) ~ '(arrière|arriere|rear)' THEN 2000  -- Arrière
    WHEN LOWER(p.piece_name) ~ '(gauche|left|lh)' THEN 1100  -- Gauche (défaut avant)
    WHEN LOWER(p.piece_name) ~ '(droit|right|rh)' THEN 1200  -- Droit (défaut avant)
    ELSE 9999  -- Reste non spécifié
  END AS nouveau_psf_id,
  psf.psf_side AS position_detectee
FROM pieces_relation_type prt
JOIN pieces p ON p.piece_id = prt.rtp_piece_id
LEFT JOIN pieces_side_filtre psf ON psf.psf_id = CASE
    WHEN LOWER(p.piece_name) ~ '(avant|front).*(gauche|left|lh)' THEN 1100
    WHEN LOWER(p.piece_name) ~ '(avant|front).*(droit|right|rh)' THEN 1200
    WHEN LOWER(p.piece_name) ~ '(arrière|arriere|rear).*(gauche|left|lh)' THEN 2100
    WHEN LOWER(p.piece_name) ~ '(arrière|arriere|rear).*(droit|right|rh)' THEN 2200
    WHEN LOWER(p.piece_name) ~ '(avant|front)' AND LOWER(p.piece_name) !~ '(arrière|arriere|rear)' THEN 1000
    WHEN LOWER(p.piece_name) ~ '(arrière|arriere|rear)' THEN 2000
    WHEN LOWER(p.piece_name) ~ '(gauche|left|lh)' THEN 1100
    WHEN LOWER(p.piece_name) ~ '(droit|right|rh)' THEN 1200
    ELSE 9999
  END
WHERE prt.rtp_pg_id = 402  -- Plaquettes de frein
  AND prt.rtp_psf_id = 9999
  AND p.piece_display = true
LIMIT 50;

-- =====================================================
-- ÉTAPE 3: MIGRATION EFFECTIVE - PLAQUETTES DE FREIN UNIQUEMENT
-- =====================================================

-- ATTENTION: Cette requête MODIFIE les données
-- Exécutez d'abord les étapes 1 et 2 pour valider la détection

-- ⚡ OPTIMISATION: On traite UNE SEULE GAMME à la fois pour éviter timeout

BEGIN;

-- Mettre à jour UNIQUEMENT les plaquettes de frein (gamme 402)
UPDATE pieces_relation_type prt
SET rtp_psf_id = CASE
    -- Détection position combinée (priorité: spécifique > général)
    WHEN LOWER(p.piece_name) ~ '(avant|front).*(gauche|left|lh)' THEN 1100  -- Avant Gauche
    WHEN LOWER(p.piece_name) ~ '(avant|front).*(droit|right|rh)' THEN 1200  -- Avant Droit
    WHEN LOWER(p.piece_name) ~ '(arrière|arriere|rear).*(gauche|left|lh)' THEN 2100  -- Arrière Gauche
    WHEN LOWER(p.piece_name) ~ '(arrière|arriere|rear).*(droit|right|rh)' THEN 2200  -- Arrière Droit
    -- Détection position simple
    WHEN LOWER(p.piece_name) ~ '(avant|front)' AND LOWER(p.piece_name) !~ '(arrière|arriere|rear)' THEN 1000  -- Avant
    WHEN LOWER(p.piece_name) ~ '(arrière|arriere|rear)' THEN 2000  -- Arrière
    WHEN LOWER(p.piece_name) ~ '(gauche|left|lh)' THEN 1100  -- Gauche (défaut avant)
    WHEN LOWER(p.piece_name) ~ '(droit|right|rh)' THEN 1200  -- Droit (défaut avant)
    ELSE 9999  -- Reste non spécifié
  END
FROM pieces p
WHERE prt.rtp_piece_id = p.piece_id
  AND prt.rtp_psf_id = 9999  -- Ne touche QUE les non-définis
  AND p.piece_display = true
  AND prt.rtp_pg_id = 402;  -- ⚡ UNIQUEMENT plaquettes de frein

-- Vérifier combien de lignes ont été modifiées
SELECT 
  pg.pg_name AS gamme,
  psf.psf_side AS nouvelle_position,
  COUNT(*) AS pieces_mises_a_jour
FROM pieces_relation_type prt
JOIN pieces p ON p.piece_id = prt.rtp_piece_id
JOIN pieces_gamme pg ON pg.pg_id = prt.rtp_pg_id
JOIN pieces_side_filtre psf ON psf.psf_id = prt.rtp_psf_id
WHERE prt.rtp_psf_id != 9999
  AND prt.rtp_pg_id = 402
GROUP BY pg.pg_name, psf.psf_side, psf.psf_sort
ORDER BY psf.psf_sort;

COMMIT;
-- Ou ROLLBACK; si quelque chose ne va pas

-- =====================================================
-- ÉTAPE 4: VALIDATION POST-MIGRATION
-- =====================================================

-- Compter les pièces par position pour PLAQUETTES DE FREIN
SELECT 
  pg.pg_name AS gamme,
  psf.psf_side AS position,
  COUNT(*) AS nombre_pieces
FROM pieces_relation_type prt
JOIN pieces p ON p.piece_id = prt.rtp_piece_id
JOIN pieces_gamme pg ON pg.pg_id = prt.rtp_pg_id
JOIN pieces_side_filtre psf ON psf.psf_id = prt.rtp_psf_id
WHERE prt.rtp_pg_id = 402  -- ⚡ UNIQUEMENT plaquettes
  AND p.piece_display = true
GROUP BY pg.pg_name, psf.psf_side, psf.psf_sort
ORDER BY pg.pg_name, psf.psf_sort;

-- Vérifier qu'il reste des pièces avec 9999 (c'est OK pour kits/accessoires)
SELECT 
  pg.pg_name AS gamme,
  COUNT(*) AS pieces_sans_position
FROM pieces_relation_type prt
JOIN pieces p ON p.piece_id = prt.rtp_piece_id
JOIN pieces_gamme pg ON pg.pg_id = prt.rtp_pg_id
WHERE prt.rtp_psf_id = 9999
  AND p.piece_display = true
  AND prt.rtp_pg_id = 402  -- ⚡ UNIQUEMENT plaquettes
GROUP BY pg.pg_name;

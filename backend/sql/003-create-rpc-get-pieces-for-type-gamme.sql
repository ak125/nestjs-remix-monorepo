-- ============================================================================
-- RPC Function: get_pieces_for_type_gamme (V3 avec Logique PHP V4 Complète)
-- ============================================================================
-- Purpose: Récupère TOUTES les pièces + FILTRES pour un véhicule (type_id) + gamme (pg_id)
--          en UNE SEULE requête SQL au lieu de 10+ requêtes séparées
--
-- ⚡ LOGIQUE PHP V4 RESTAURÉE + Avant/Arrière (commit eb79742):
--   - Détection de position sur 4 niveaux: relation_criteria > criteria > side_filters > piece_name
--   - Priorité des positions: Avant (1) > Arrière (2) > Gauche (3) > Droite (4) > Autres (5)
--   - Fusion des groupes pour pièces "intérieure"/"extérieure"
--   - Tri: Gamme parent, puis accessoires, puis position, puis prix
--
-- Performance attendue: ~50-100ms au lieu de 2-4 secondes
--
-- Remplace VehiclePiecesCompatibilityService + ProductFilteringService:
--   1. pieces_relation_type (relations)
--   2. pieces (pièces de base)
--   3. pieces_marque (équipementiers)
--   4. pieces_price (prix)
--   5. pieces_side_filtre (positions)
--   6. pieces_media_img (images)
--   7. pieces_criteria (critères) ← PRIORITÉ 1 pour position
--   8. pieces_criteria_link (liens critères)
--   9. pieces_relation_criteria (critères par véhicule) ← PRIORITÉ 2 pour position
--  10. ProductFilteringService.getAllFilters() ← intégré dans filters{}
--
-- Usage depuis NestJS:
--   const { data } = await this.supabase.rpc('get_pieces_for_type_gamme', { 
--     p_type_id: 33302, 
--     p_pg_id: 402 
--   });
-- ============================================================================

CREATE OR REPLACE FUNCTION get_pieces_for_type_gamme(
  p_type_id INTEGER,
  p_pg_id INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_start_time TIMESTAMPTZ := clock_timestamp();
  v_duration_ms INTEGER;
  -- CDN Supabase Storage (avec cache intégré)
  v_cdn_base TEXT := 'https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public';
BEGIN
  WITH 
  -- ═══════════════════════════════════════════════════════════════════════════
  -- 1. RELATIONS: Récupère les liens véhicule-pièce (limite 500 pour perf)
  -- Note: rtp_type_id et rtp_pg_id sont de type TEXT dans la base
  -- ═══════════════════════════════════════════════════════════════════════════
  relations AS (
    SELECT DISTINCT 
      rtp_piece_id::INTEGER as rtp_piece_id,
      rtp_psf_id::INTEGER as rtp_psf_id,
      rtp_pm_id::INTEGER as rtp_pm_id
    FROM pieces_relation_type
    WHERE rtp_type_id::INTEGER = p_type_id
      AND rtp_pg_id::INTEGER = p_pg_id
    LIMIT 500
  ),
  
  -- ═══════════════════════════════════════════════════════════════════════════
  -- 2. PIÈCES ACTIVES: Jointure avec pieces + filtre display=true
  -- + Détection is_accessory via comparaison du nom (singulier/pluriel)
  -- ═══════════════════════════════════════════════════════════════════════════
  -- Récupérer le nom de la gamme RACINE (pg_id = p_pg_id)
  root_gamme AS (
    SELECT pg_id, pg_name, pg_parent
    FROM pieces_gamme
    WHERE pg_id = p_pg_id
    LIMIT 1
  ),
  active_pieces AS (
    SELECT 
      p.piece_id,
      p.piece_name,
      p.piece_ref,
      p.piece_ref_clean,
      p.piece_des,
      p.piece_has_img,
      p.piece_has_oem,
      p.piece_qty_sale,
      p.piece_qty_pack,
      p.piece_name_side,
      p.piece_name_comp,
      p.piece_fil_id,
      p.piece_fil_name,
      p.piece_pm_id,
      r.rtp_psf_id,
      r.rtp_pm_id,
      -- ⭐ is_accessory = true si piece_fil_name ne correspond PAS au nom de la gamme racine
      -- Comparaison: "Plaquettes de frein" vs "Plaquette de frein"
      -- On cherche le radical commun: "Plaquette" (sans 's' et sans le reste)
      -- Donc is_accessory = false pour plaquettes, true pour accessoires
      CASE 
        -- Si piece_fil_name commence par le même radical que pg_name (premier mot sans 's') → NOT accessory
        -- Ex: "Plaquettes de frein" commence par "Plaquette" (extrait de "Plaquette de frein")
        WHEN LOWER(p.piece_fil_name) LIKE LOWER(RTRIM(SPLIT_PART(rg.pg_name, ' ', 1), 's')) || '%' THEN false
        ELSE true
      END as is_accessory
    FROM pieces p
    INNER JOIN relations r ON p.piece_id = r.rtp_piece_id
    CROSS JOIN root_gamme rg
    WHERE p.piece_display = true
  ),
  
  -- ═══════════════════════════════════════════════════════════════════════════
  -- 3. MEILLEUR PRIX par pièce (tri par pri_type DESC)
  -- ═══════════════════════════════════════════════════════════════════════════
  best_prices AS (
    SELECT DISTINCT ON (pri_piece_id)
      pri_piece_id,
      pri_vente_ttc,
      pri_consigne_ttc,
      pri_type,
      pri_dispo
    FROM pieces_price
    WHERE pri_piece_id IN (SELECT piece_id::TEXT FROM active_pieces)
      AND pri_dispo = '1'
    ORDER BY pri_piece_id, NULLIF(pri_type, '')::INTEGER DESC NULLS LAST
  ),
  
  -- ═══════════════════════════════════════════════════════════════════════════
  -- 4. PREMIÈRE IMAGE par pièce (tri par pmi_sort ASC)
  -- Note: pmi_piece_id est TEXT, donc on convertit piece_id en TEXT
  -- ═══════════════════════════════════════════════════════════════════════════
  first_images AS (
    SELECT DISTINCT ON (pmi_piece_id)
      pmi_piece_id as piece_id_text,
      pmi_folder,
      pmi_name,
      -- ✅ FIX: Détecte si l'extension est déjà présente
      CASE 
        WHEN pmi_name ~* '\.(webp|jpg|jpeg|png|gif)$' THEN pmi_name
        ELSE pmi_name || '.webp'
      END as pmi_name_with_ext
    FROM pieces_media_img
    WHERE pmi_piece_id IN (SELECT piece_id::TEXT FROM active_pieces)
      AND pmi_display = '1'
    ORDER BY pmi_piece_id, pmi_sort ASC
  ),
  
  -- ═══════════════════════════════════════════════════════════════════════════
  -- 4b. TOUTES LES IMAGES par pièce (pour le modal - évite /api/catalog/pieces/:id)
  -- ═══════════════════════════════════════════════════════════════════════════
  all_images AS (
    SELECT 
      pmi_piece_id as piece_id_text,
      jsonb_agg(
        jsonb_build_object(
          'url', v_cdn_base || '/rack-images/' || pmi_folder || '/' || 
            CASE 
              WHEN pmi_name ~* '\.(webp|jpg|jpeg|png|gif)$' THEN pmi_name
              ELSE pmi_name || '.webp'
            END,
          'sort', COALESCE(pmi_sort::INTEGER, 999),
          'alt', pmi_name
        ) ORDER BY pmi_sort::INTEGER
      ) as images
    FROM pieces_media_img
    WHERE pmi_piece_id IN (SELECT piece_id::TEXT FROM active_pieces)
      AND pmi_display = '1'
    GROUP BY pmi_piece_id
  ),
  
  -- ═══════════════════════════════════════════════════════════════════════════
  -- 5. FILTRES DE CÔTÉ (Avant, Arrière, Gauche, Droite)
  -- ═══════════════════════════════════════════════════════════════════════════
  side_filters AS (
    SELECT 
      psf_id,
      psf_side,
      psf_sort
    FROM pieces_side_filtre
    WHERE psf_id IN (SELECT DISTINCT rtp_psf_id FROM active_pieces WHERE rtp_psf_id IS NOT NULL)
  ),
  
  -- ═══════════════════════════════════════════════════════════════════════════
  -- 5b. ⭐ DÉTECTION POSITION depuis pieces_criteria (critère 100 = Côté d'assemblage)
  -- Ordre de priorité: Avant/Arrière (1) > Gauche/Droite (2) > Autres (99)
  -- ═══════════════════════════════════════════════════════════════════════════
  criteria_positions AS (
    SELECT DISTINCT ON (pc_piece_id::INTEGER)
      pc_piece_id::INTEGER as piece_id,
      pc_cri_value,
      CASE 
        -- Avant (priorité 1) - NE PAS détecter si contient aussi gauche/droit
        WHEN (LOWER(pc_cri_value) LIKE '%essieu avant%' OR LOWER(pc_cri_value) = 'avant' 
          OR LOWER(pc_cri_value) LIKE '%front%' OR LOWER(pc_cri_value) LIKE 'avant %')
          AND LOWER(pc_cri_value) NOT LIKE '%gauche%' AND LOWER(pc_cri_value) NOT LIKE '%droit%'
          AND LOWER(pc_cri_value) NOT LIKE '%left%' AND LOWER(pc_cri_value) NOT LIKE '%right%' THEN 'Avant'
        -- Arrière (priorité 1) - NE PAS détecter si contient aussi gauche/droit  
        WHEN (LOWER(pc_cri_value) LIKE '%essieu arrière%' OR LOWER(pc_cri_value) LIKE '%essieu arriere%'
          OR LOWER(pc_cri_value) = 'arrière' OR LOWER(pc_cri_value) = 'arriere'
          OR LOWER(pc_cri_value) LIKE '%rear%' OR LOWER(pc_cri_value) LIKE 'arrière %' OR LOWER(pc_cri_value) LIKE 'arriere %')
          AND LOWER(pc_cri_value) NOT LIKE '%gauche%' AND LOWER(pc_cri_value) NOT LIKE '%droit%'
          AND LOWER(pc_cri_value) NOT LIKE '%left%' AND LOWER(pc_cri_value) NOT LIKE '%right%' THEN 'Arrière'
        -- Gauche (priorité 2)
        WHEN LOWER(pc_cri_value) LIKE '%avant gauche%' OR LOWER(pc_cri_value) LIKE '%essieu avant gauche%' THEN 'Gauche'
        WHEN LOWER(pc_cri_value) LIKE '%gauche%' OR LOWER(pc_cri_value) LIKE '%conducteur%' 
          OR LOWER(pc_cri_value) LIKE '%left%' OR LOWER(pc_cri_value) LIKE '% lh%' THEN 'Gauche'
        -- Droite (priorité 2)
        WHEN LOWER(pc_cri_value) LIKE '%avant droit%' OR LOWER(pc_cri_value) LIKE '%essieu avant droit%' THEN 'Droite'
        WHEN LOWER(pc_cri_value) LIKE '%droit%' OR LOWER(pc_cri_value) LIKE '%passager%' 
          OR LOWER(pc_cri_value) LIKE '%right%' OR LOWER(pc_cri_value) LIKE '% rh%' THEN 'Droite'
        ELSE NULL
      END as detected_position,
      CASE 
        -- Avant/Arrière priorité 1
        WHEN (LOWER(pc_cri_value) LIKE '%essieu avant%' OR LOWER(pc_cri_value) = 'avant'
          OR LOWER(pc_cri_value) LIKE '%front%')
          AND LOWER(pc_cri_value) NOT LIKE '%gauche%' AND LOWER(pc_cri_value) NOT LIKE '%droit%' THEN 1
        WHEN (LOWER(pc_cri_value) LIKE '%essieu arrière%' OR LOWER(pc_cri_value) LIKE '%essieu arriere%'
          OR LOWER(pc_cri_value) = 'arrière' OR LOWER(pc_cri_value) = 'arriere'
          OR LOWER(pc_cri_value) LIKE '%rear%')
          AND LOWER(pc_cri_value) NOT LIKE '%gauche%' AND LOWER(pc_cri_value) NOT LIKE '%droit%' THEN 1
        -- Gauche/Droite priorité 2
        WHEN LOWER(pc_cri_value) LIKE '%gauche%' OR LOWER(pc_cri_value) LIKE '%conducteur%' THEN 2
        WHEN LOWER(pc_cri_value) LIKE '%droit%' OR LOWER(pc_cri_value) LIKE '%passager%' THEN 2
        ELSE 99
      END as priority
    FROM pieces_criteria
    WHERE pc_piece_id::INTEGER IN (SELECT piece_id FROM active_pieces)
      AND pc_cri_id::TEXT = '100'  -- Critère "Côté d'assemblage"
      AND pc_cri_value IS NOT NULL 
      AND pc_cri_value != ''
    ORDER BY pc_piece_id::INTEGER, 
      CASE 
        -- Avant/Arrière priorité 1
        WHEN (LOWER(pc_cri_value) LIKE '%essieu avant%' OR LOWER(pc_cri_value) LIKE '%essieu arrière%'
          OR LOWER(pc_cri_value) LIKE '%essieu arriere%') 
          AND LOWER(pc_cri_value) NOT LIKE '%gauche%' AND LOWER(pc_cri_value) NOT LIKE '%droit%' THEN 1
        -- Gauche/Droite priorité 2
        WHEN LOWER(pc_cri_value) LIKE '%gauche%' OR LOWER(pc_cri_value) LIKE '%droit%' THEN 2
        ELSE 99
      END ASC
  ),
  
  -- ═══════════════════════════════════════════════════════════════════════════
  -- 5c. ⭐⭐ PRIORITÉ 1: Positions depuis pieces_relation_criteria (SPÉCIFIQUE VÉHICULE)
  -- Cherche dans TOUS les critères de la pièce pour trouver Gauche/Droite en priorité
  -- Mots-clés: FR+L=Gauche, FR+R=Droite, gauche, droit, left, right, lh, rh
  -- ═══════════════════════════════════════════════════════════════════════════
  -- D'abord, identifier les pièces qui ont LES DEUX côtés (Gauche ET Droite) = universelles
  pieces_with_both_sides AS (
    SELECT DISTINCT rcp_piece_id::INTEGER as piece_id
    FROM pieces_relation_criteria
    WHERE rcp_type_id::INTEGER = p_type_id
      AND rcp_pg_id::INTEGER = p_pg_id
      AND rcp_piece_id::INTEGER IN (SELECT piece_id FROM active_pieces)
      AND (
        -- FR+L ET FR+R dans la même valeur
        rcp_cri_value ~ '\+L.*\+R|\+R.*\+L'
        -- OU "des deux côtés"
        OR LOWER(rcp_cri_value) LIKE '%des deux côtés%' 
        OR LOWER(rcp_cri_value) LIKE '%deux cotes%'
      )
    UNION
    -- Pièces qui ont Gauche dans une ligne ET Droite dans une autre ligne
    SELECT piece_id FROM (
      SELECT rcp_piece_id::INTEGER as piece_id,
        bool_or(LOWER(rcp_cri_value) LIKE '%gauche%' OR rcp_cri_value LIKE '%+L%') as has_left,
        bool_or(LOWER(rcp_cri_value) LIKE '%droit%' OR rcp_cri_value LIKE '%+R%') as has_right
      FROM pieces_relation_criteria
      WHERE rcp_type_id::INTEGER = p_type_id
        AND rcp_pg_id::INTEGER = p_pg_id
        AND rcp_piece_id::INTEGER IN (SELECT piece_id FROM active_pieces)
      GROUP BY rcp_piece_id::INTEGER
    ) sub WHERE has_left AND has_right
  ),
  relation_criteria_all AS (
    SELECT 
      rcp_piece_id::INTEGER as piece_id,
      rcp_cri_value,
      -- Score de priorité: Avant/Arrière = 1, Gauche/Droite = 2, autres = 99
      CASE 
        -- Exclure les pièces universelles (ont les deux côtés)
        WHEN rcp_piece_id::INTEGER IN (SELECT piece_id FROM pieces_with_both_sides) THEN 99
        -- Avant (priorité 1) - sans gauche/droit
        WHEN (LOWER(rcp_cri_value) LIKE '%essieu avant%' OR LOWER(rcp_cri_value) = 'avant'
          OR LOWER(rcp_cri_value) LIKE '%front%' OR LOWER(rcp_cri_value) LIKE 'avant %')
          AND LOWER(rcp_cri_value) NOT LIKE '%gauche%' AND LOWER(rcp_cri_value) NOT LIKE '%droit%'
          AND rcp_cri_value NOT LIKE '%+L%' AND rcp_cri_value NOT LIKE '%+R%' THEN 1
        -- Arrière (priorité 1) - sans gauche/droit
        WHEN (LOWER(rcp_cri_value) LIKE '%essieu arrière%' OR LOWER(rcp_cri_value) LIKE '%essieu arriere%'
          OR LOWER(rcp_cri_value) = 'arrière' OR LOWER(rcp_cri_value) = 'arriere'
          OR LOWER(rcp_cri_value) LIKE '%rear%' OR LOWER(rcp_cri_value) LIKE 'arrière %' OR LOWER(rcp_cri_value) LIKE 'arriere %')
          AND LOWER(rcp_cri_value) NOT LIKE '%gauche%' AND LOWER(rcp_cri_value) NOT LIKE '%droit%'
          AND rcp_cri_value NOT LIKE '%+L%' AND rcp_cri_value NOT LIKE '%+R%' THEN 1
        -- Gauche (priorité 2)
        WHEN LOWER(rcp_cri_value) LIKE '%avant gauche%' OR LOWER(rcp_cri_value) LIKE '%essieu avant gauche%' THEN 2
        WHEN rcp_cri_value LIKE '%+L%' THEN 2
        WHEN LOWER(rcp_cri_value) LIKE '%gauche%' OR LOWER(rcp_cri_value) LIKE '%conducteur%' 
          OR LOWER(rcp_cri_value) LIKE '%left%' OR LOWER(rcp_cri_value) LIKE '% lh%' THEN 2
        -- Droite (priorité 2)
        WHEN LOWER(rcp_cri_value) LIKE '%avant droit%' OR LOWER(rcp_cri_value) LIKE '%essieu avant droit%' THEN 2
        WHEN rcp_cri_value LIKE '%+R%' THEN 2
        WHEN LOWER(rcp_cri_value) LIKE '%droit%' OR LOWER(rcp_cri_value) LIKE '%passager%' 
          OR LOWER(rcp_cri_value) LIKE '%right%' OR LOWER(rcp_cri_value) LIKE '% rh%' THEN 2
        ELSE 99
      END as priority,
      -- Position détectée: Avant/Arrière puis Gauche/Droite
      CASE 
        -- Universel = pas de position (pièce avec les deux côtés)
        WHEN rcp_piece_id::INTEGER IN (SELECT piece_id FROM pieces_with_both_sides) THEN NULL
        -- Avant (sans gauche/droit)
        WHEN (LOWER(rcp_cri_value) LIKE '%essieu avant%' OR LOWER(rcp_cri_value) = 'avant'
          OR LOWER(rcp_cri_value) LIKE '%front%' OR LOWER(rcp_cri_value) LIKE 'avant %')
          AND LOWER(rcp_cri_value) NOT LIKE '%gauche%' AND LOWER(rcp_cri_value) NOT LIKE '%droit%'
          AND rcp_cri_value NOT LIKE '%+L%' AND rcp_cri_value NOT LIKE '%+R%' THEN 'Avant'
        -- Arrière (sans gauche/droit)
        WHEN (LOWER(rcp_cri_value) LIKE '%essieu arrière%' OR LOWER(rcp_cri_value) LIKE '%essieu arriere%'
          OR LOWER(rcp_cri_value) = 'arrière' OR LOWER(rcp_cri_value) = 'arriere'
          OR LOWER(rcp_cri_value) LIKE '%rear%' OR LOWER(rcp_cri_value) LIKE 'arrière %' OR LOWER(rcp_cri_value) LIKE 'arriere %')
          AND LOWER(rcp_cri_value) NOT LIKE '%gauche%' AND LOWER(rcp_cri_value) NOT LIKE '%droit%'
          AND rcp_cri_value NOT LIKE '%+L%' AND rcp_cri_value NOT LIKE '%+R%' THEN 'Arrière'
        -- Gauche (valeurs exactes)
        WHEN LOWER(rcp_cri_value) LIKE '%avant gauche%' OR LOWER(rcp_cri_value) LIKE '%essieu avant gauche%' THEN 'Gauche'
        WHEN rcp_cri_value LIKE '%+L%' THEN 'Gauche'
        WHEN LOWER(rcp_cri_value) LIKE '%gauche%' OR LOWER(rcp_cri_value) LIKE '%conducteur%' 
          OR LOWER(rcp_cri_value) LIKE '%left%' OR LOWER(rcp_cri_value) LIKE '% lh%' THEN 'Gauche'
        -- Droite (valeurs exactes)
        WHEN LOWER(rcp_cri_value) LIKE '%avant droit%' OR LOWER(rcp_cri_value) LIKE '%essieu avant droit%' THEN 'Droite'
        WHEN rcp_cri_value LIKE '%+R%' THEN 'Droite'
        WHEN LOWER(rcp_cri_value) LIKE '%droit%' OR LOWER(rcp_cri_value) LIKE '%passager%' 
          OR LOWER(rcp_cri_value) LIKE '%right%' OR LOWER(rcp_cri_value) LIKE '% rh%' THEN 'Droite'
        ELSE NULL
      END as detected_position
    FROM pieces_relation_criteria
    WHERE rcp_type_id::INTEGER = p_type_id
      AND rcp_pg_id::INTEGER = p_pg_id
      AND rcp_piece_id::INTEGER IN (SELECT piece_id FROM active_pieces)
      AND rcp_cri_value IS NOT NULL 
      AND rcp_cri_value != ''
  ),
  -- Sélectionner la MEILLEURE position par pièce (Gauche/Droite prioritaire)
  relation_criteria_positions AS (
    SELECT DISTINCT ON (piece_id)
      piece_id,
      rcp_cri_value,
      detected_position
    FROM relation_criteria_all
    WHERE detected_position IS NOT NULL
    ORDER BY piece_id, priority ASC, detected_position
  ),
  
  -- ═══════════════════════════════════════════════════════════════════════════
  -- 6. ASSEMBLAGE FINAL: Jointure de toutes les données
  -- Position: criteria_positions > side_filters > piece_name_side
  -- ═══════════════════════════════════════════════════════════════════════════
  assembled_pieces AS (
    SELECT 
      ap.piece_id as id,
      -- Nom complet: nom + side (si pas déjà inclus) + comp
      TRIM(CONCAT_WS(' ',
        ap.piece_name,
        CASE 
          WHEN COALESCE(sf.psf_side, ap.piece_name_side) IS NOT NULL 
            AND POSITION(LOWER(COALESCE(sf.psf_side, ap.piece_name_side)) IN LOWER(COALESCE(ap.piece_name, ''))) = 0
          THEN COALESCE(sf.psf_side, ap.piece_name_side)
          ELSE NULL
        END,
        CASE 
          WHEN ap.piece_name_comp IS NOT NULL 
            AND POSITION(LOWER(ap.piece_name_comp) IN LOWER(COALESCE(ap.piece_name, ''))) = 0
          THEN ap.piece_name_comp
          ELSE NULL
        END
      )) as nom,
      ap.piece_name as piece_name_raw,
      ap.piece_ref as reference,
      ap.piece_ref_clean as reference_clean,
      ap.piece_des as description,
      COALESCE(ap.piece_qty_sale, 1)::NUMERIC as quantite_vente,
      ap.piece_has_img as has_image,
      ap.piece_has_oem as has_oem,
      ap.piece_fil_name as filtre_gamme,
      -- Marque (équipementier)
      COALESCE(pm.pm_name, 'Marque inconnue') as marque,
      pm.pm_id as marque_id,
      pm.pm_logo as marque_logo,
      COALESCE(NULLIF(pm.pm_nb_stars, '')::INTEGER, 0) as nb_stars,
      -- Prix (colonnes TEXT, cast en NUMERIC)
      COALESCE(NULLIF(bp.pri_vente_ttc, '')::NUMERIC, 0) as prix_unitaire,
      (COALESCE(NULLIF(bp.pri_vente_ttc, '')::NUMERIC, 0) * COALESCE(ap.piece_qty_sale, 1))::NUMERIC as prix_ttc,
      (COALESCE(NULLIF(bp.pri_consigne_ttc, '')::NUMERIC, 0) * COALESCE(ap.piece_qty_sale, 1))::NUMERIC as prix_consigne,
      (COALESCE(NULLIF(bp.pri_vente_ttc, '')::NUMERIC, 0) + COALESCE(NULLIF(bp.pri_consigne_ttc, '')::NUMERIC, 0))::NUMERIC * COALESCE(ap.piece_qty_sale, 1) as prix_total,
      COALESCE(bp.pri_dispo, '0') = '1' as dispo,
      -- Image principale (CDN Supabase Storage direct)
      CASE 
        WHEN fi.pmi_folder IS NOT NULL AND fi.pmi_name IS NOT NULL
        THEN v_cdn_base || '/rack-images/' || fi.pmi_folder || '/' || fi.pmi_name_with_ext
        ELSE v_cdn_base || '/uploads/articles/no.png'
      END as image,
      -- Toutes les images pour le modal
      COALESCE(ai.images, '[]'::jsonb) as images,
      -- ⭐⭐ Position avec priorité: relation_criteria > criteria > side_filters > piece_name_side > piece_name
      -- SAUF pour "intérieure" qui n'a pas de position Gauche/Droite
      CASE 
        WHEN LOWER(COALESCE(ap.piece_fil_name, '')) LIKE '%intérieure%' 
          OR LOWER(COALESCE(ap.piece_fil_name, '')) LIKE '%interieure%' THEN ''
        ELSE COALESCE(
          rcp.detected_position, 
          cp.detected_position, 
          sf.psf_side, 
          ap.piece_name_side,
          -- Fallback: détection depuis piece_name (Avant/Arrière seulement)
          CASE 
            WHEN LOWER(COALESCE(ap.piece_name, '')) LIKE '%avant%' 
              AND LOWER(COALESCE(ap.piece_name, '')) NOT LIKE '%arrière%'
              AND LOWER(COALESCE(ap.piece_name, '')) NOT LIKE '%arriere%' THEN 'Avant'
            WHEN LOWER(COALESCE(ap.piece_name, '')) LIKE '%arrière%' 
              OR LOWER(COALESCE(ap.piece_name, '')) LIKE '%arriere%' THEN 'Arrière'
            ELSE NULL
          END,
          ''
        )
      END as filtre_side,
      COALESCE(sf.psf_sort::INTEGER, 999) as psf_sort,
      -- Qualité selon pm_oes
      CASE
        WHEN pm.pm_oes IN ('OES', 'O') THEN pm.pm_oes
        ELSE 'A'
      END as qualite,
      -- ⭐ Flag accessoire pour tri (gamme principale en premier)
      ap.is_accessory
    FROM active_pieces ap
    LEFT JOIN pieces_marque pm ON pm.pm_id = COALESCE(ap.rtp_pm_id, ap.piece_pm_id)
    LEFT JOIN best_prices bp ON bp.pri_piece_id = ap.piece_id::TEXT
    LEFT JOIN first_images fi ON fi.piece_id_text = ap.piece_id::TEXT
    LEFT JOIN all_images ai ON ai.piece_id_text = ap.piece_id::TEXT
    LEFT JOIN side_filters sf ON sf.psf_id = ap.rtp_psf_id
    LEFT JOIN relation_criteria_positions rcp ON rcp.piece_id = ap.piece_id  -- ⭐⭐ PRIORITÉ 1: relation véhicule
    LEFT JOIN criteria_positions cp ON cp.piece_id = ap.piece_id  -- ⭐ PRIORITÉ 2: critères pièce
    WHERE COALESCE(bp.pri_dispo, '1') = '1' OR bp.pri_dispo IS NULL
  ),
  
  -- ═══════════════════════════════════════════════════════════════════════════
  -- 7. PIÈCES TRIÉES (accessoires en dernier, puis position, puis prix)
  -- ═══════════════════════════════════════════════════════════════════════════
  sorted_pieces AS (
    SELECT *
    FROM assembled_pieces
    ORDER BY 
      -- ⭐ Accessoires en dernier (is_accessory = false → 0, true → 1)
      CASE WHEN is_accessory THEN 1 ELSE 0 END,
      -- ⭐ PHP V4: Tri par position avec priorité Avant/Arrière > Gauche/Droite
      CASE filtre_side
        WHEN 'Avant' THEN 1
        WHEN 'Arrière' THEN 2
        WHEN 'Gauche' THEN 3
        WHEN 'Droite' THEN 4
        WHEN 'Supérieur' THEN 5
        WHEN 'Inférieur' THEN 6
        ELSE 7
      END,
      psf_sort,
      prix_ttc
  ),
  
  -- ═══════════════════════════════════════════════════════════════════════════
  -- 10. GROUPEMENT par filtre_gamme + filtre_side (simplifié pour performance)
  -- ═══════════════════════════════════════════════════════════════════════════
  grouped AS (
    SELECT 
      COALESCE(filtre_gamme, 'Pièces') as group_gamme,
      COALESCE(NULLIF(filtre_side, ''), 'Standard') as group_side,
      -- Titre H2: "Filtre Gamme Position" (ex: "Rotule de direction Gauche")
      TRIM(CONCAT_WS(' ', 
        COALESCE(filtre_gamme, 'Pièces'),
        NULLIF(filtre_side, '')
      )) as title_h2,
      -- ⭐ Flag pour tri final (accessoires en dernier)
      is_accessory,
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'nom', nom,
          'reference', reference,
          'reference_clean', reference_clean,
          'description', description,
          'marque', marque,
          'marque_id', marque_id,
          'marque_logo', marque_logo,
          'nb_stars', nb_stars,
          'prix_unitaire', prix_unitaire,
          'prix_ttc', prix_ttc,
          'prix_consigne', prix_consigne,
          'prix_total', prix_total,
          'quantite_vente', quantite_vente,
          'dispo', dispo,
          'image', image,
          'images', images,
          'qualite', qualite,
          'filtre_gamme', filtre_gamme,
          'filtre_side', filtre_side,
          'has_image', has_image,
          'has_oem', has_oem
        ) ORDER BY prix_ttc
      ) as pieces
    FROM sorted_pieces
    GROUP BY 
      COALESCE(filtre_gamme, 'Pièces'),
      COALESCE(NULLIF(filtre_side, ''), 'Standard'),
      TRIM(CONCAT_WS(' ', COALESCE(filtre_gamme, 'Pièces'), NULLIF(filtre_side, ''))),
      is_accessory
    ORDER BY 
      -- ⭐ Accessoires en dernier (is_accessory = false → 0, true → 1)
      CASE WHEN is_accessory THEN 1 ELSE 0 END,
      -- Position: Avant > Arrière > Gauche > Droite > Standard
      CASE COALESCE(NULLIF(filtre_side, ''), 'Standard')
        WHEN 'Avant' THEN 1
        WHEN 'Arrière' THEN 2
        WHEN 'Gauche' THEN 3
        WHEN 'Droite' THEN 4
        ELSE 5
      END
  ),
  
  -- ═══════════════════════════════════════════════════════════════════════════
  -- 11. FILTRES AGRÉGÉS (côté, qualité, marques) - Remplace ProductFilteringService
  -- ═══════════════════════════════════════════════════════════════════════════
  -- Filtre CÔTÉ: uniquement si > 1 position différente
  side_filter_agg AS (
    SELECT jsonb_build_object(
      'type', 'side',
      'name', 'Côté du Véhicule',
      'options', COALESCE(
        (SELECT jsonb_agg(jsonb_build_object(
          'value', side_val,
          'label', side_val,
          'count', cnt,
          'trending', cnt > 2
        ) ORDER BY 
          CASE side_val
            WHEN 'Avant' THEN 1
            WHEN 'Arrière' THEN 2
            WHEN 'Gauche' THEN 3
            WHEN 'Droite' THEN 4
            ELSE 5
          END
        )
        FROM (
          SELECT filtre_side as side_val, COUNT(*)::INTEGER as cnt
          FROM sorted_pieces
          WHERE filtre_side IS NOT NULL AND filtre_side != ''
          GROUP BY filtre_side
          HAVING COUNT(*) > 0
        ) sides
        WHERE (SELECT COUNT(DISTINCT filtre_side) FROM sorted_pieces WHERE filtre_side IS NOT NULL AND filtre_side != '') > 1
        ), '[]'::jsonb)
    ) as filter_data
  ),
  
  -- Filtre QUALITÉ (OE/Aftermarket)
  quality_filter_agg AS (
    SELECT jsonb_build_object(
      'type', 'quality',
      'name', 'Qualité',
      'options', COALESCE(
        (SELECT jsonb_agg(jsonb_build_object(
          'value', qual_val,
          'label', CASE qual_val
            WHEN 'OES' THEN 'Qualité Origine (OE)'
            WHEN 'O' THEN 'Qualité Origine (OE)'
            ELSE 'Aftermarket'
          END,
          'count', cnt,
          'trending', qual_val IN ('OES', 'O')
        ) ORDER BY 
          CASE qual_val WHEN 'OES' THEN 1 WHEN 'O' THEN 2 ELSE 3 END
        )
        FROM (
          SELECT qualite as qual_val, COUNT(*)::INTEGER as cnt
          FROM sorted_pieces
          WHERE qualite IS NOT NULL
          GROUP BY qualite
        ) quals
        WHERE (SELECT COUNT(DISTINCT qualite) FROM sorted_pieces) > 1
        ), '[]'::jsonb)
    ) as filter_data
  ),
  
  -- Filtre MARQUES (équipementiers)
  brand_filter_agg AS (
    SELECT jsonb_build_object(
      'type', 'brand',
      'name', 'Marque',
      'options', COALESCE(
        (SELECT jsonb_agg(jsonb_build_object(
          'value', marque_id::TEXT,
          'label', marque,
          'count', cnt,
          'logo', marque_logo,
          'stars', nb_stars,
          'trending', nb_stars >= 4
        ) ORDER BY nb_stars DESC, cnt DESC)
        FROM (
          SELECT marque, marque_id, marque_logo, MAX(nb_stars) as nb_stars, COUNT(*)::INTEGER as cnt
          FROM sorted_pieces
          WHERE marque_id IS NOT NULL
          GROUP BY marque, marque_id, marque_logo
        ) brands
        ), '[]'::jsonb)
    ) as filter_data
  )
  
  -- ═══════════════════════════════════════════════════════════════════════════
  -- RÉSULTAT FINAL avec FILTRES intégrés
  -- ═══════════════════════════════════════════════════════════════════════════
  SELECT jsonb_build_object(
    'pieces', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', id,
          'nom', nom,
          'reference', reference,
          'reference_clean', reference_clean,
          'description', description,
          'marque', marque,
          'marque_id', marque_id,
          'marque_logo', marque_logo,
          'nb_stars', nb_stars,
          'prix_unitaire', prix_unitaire,
          'prix_ttc', prix_ttc,
          'prix_consigne', prix_consigne,
          'prix_total', prix_total,
          'quantite_vente', quantite_vente,
          'dispo', dispo,
          'image', image,
          'images', images,  -- ✅ NOUVEAU: toutes les images pour le modal
          'qualite', qualite,
          'filtre_gamme', filtre_gamme,
          'filtre_side', filtre_side,
          'has_image', has_image,
          'has_oem', has_oem
        )
      )
      FROM sorted_pieces
    ), '[]'::jsonb),
    'grouped_pieces', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'filtre_gamme', group_gamme,
          'filtre_side', group_side,
          'title_h2', title_h2,
          'pieces', pieces
        )
        ORDER BY 
          CASE WHEN is_accessory THEN 1 ELSE 0 END,
          CASE group_side
            WHEN 'Avant' THEN 1
            WHEN 'Arrière' THEN 2
            WHEN 'Gauche' THEN 3
            WHEN 'Droite' THEN 4
            ELSE 5
          END
      )
      FROM grouped
    ), '[]'::jsonb),
    'blocs', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'filtre_gamme', group_gamme,
          'filtre_side', group_side,
          'title_h2', title_h2,
          'pieces', pieces
        )
        ORDER BY 
          CASE WHEN is_accessory THEN 1 ELSE 0 END,
          CASE group_side
            WHEN 'Avant' THEN 1
            WHEN 'Arrière' THEN 2
            WHEN 'Gauche' THEN 3
            WHEN 'Droite' THEN 4
            ELSE 5
          END
      )
      FROM grouped
    ), '[]'::jsonb),
    -- ✨ NOUVEAU: Filtres intégrés (remplace /api/products/filters)
    'filters', jsonb_build_object(
      'success', true,
      'data', jsonb_build_object(
        'filters', COALESCE((
          SELECT jsonb_agg(f.filter_data) 
          FROM (
            SELECT filter_data FROM side_filter_agg WHERE (filter_data->>'options')::jsonb != '[]'::jsonb
            UNION ALL
            SELECT filter_data FROM quality_filter_agg WHERE (filter_data->>'options')::jsonb != '[]'::jsonb
            UNION ALL
            SELECT filter_data FROM brand_filter_agg WHERE (filter_data->>'options')::jsonb != '[]'::jsonb
          ) f
        ), '[]'::jsonb),
        'summary', jsonb_build_object(
          'total_pieces', (SELECT COUNT(*)::INTEGER FROM sorted_pieces),
          'unique_brands', (SELECT COUNT(DISTINCT marque_id)::INTEGER FROM sorted_pieces WHERE marque_id IS NOT NULL),
          'unique_sides', (SELECT COUNT(DISTINCT filtre_side)::INTEGER FROM sorted_pieces WHERE filtre_side IS NOT NULL AND filtre_side != '')
        )
      ),
      'metadata', jsonb_build_object(
        'cached', false,
        'api_version', 'RPC_V2_INTEGRATED'
      )
    ),
    'count', (SELECT COUNT(*)::INTEGER FROM sorted_pieces),
    'minPrice', (SELECT MIN(prix_unitaire) FROM sorted_pieces WHERE prix_unitaire > 0),
    'relations_found', (SELECT COUNT(*)::INTEGER FROM relations),
    'success', true,
    'optimization', 'RPC_V6_FIXED_ACCESSORY'
  ) INTO v_result;

  -- Ajouter la durée d'exécution
  v_duration_ms := EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)::INTEGER;
  v_result := v_result || jsonb_build_object('duration', v_duration_ms || 'ms');
  
  RETURN v_result;
END;
$$;

-- ============================================================================
-- Permissions
-- ============================================================================
GRANT EXECUTE ON FUNCTION get_pieces_for_type_gamme(INTEGER, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION get_pieces_for_type_gamme(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_pieces_for_type_gamme(INTEGER, INTEGER) TO service_role;

-- ============================================================================
-- Test Query
-- ============================================================================
-- SELECT get_pieces_for_type_gamme(33302, 402);
-- 
-- Résultat attendu: JSONB avec pieces[], grouped_pieces[], blocs[], count, minPrice
-- Performance attendue: <200ms (vs 2-4s avec 9 requêtes)
--
-- ⭐ LOGIQUE PHP V4 + Avant/Arrière:
--   - Détection position: relation_criteria > criteria > side_filters > piece_name_side > piece_name
--   - Priorité positions: Avant (1) > Arrière (2) > Gauche (3) > Droite (4)
--   - Fusion groupes: pièces "intérieure"/"extérieure" → groupe Standard sans position
--   - Tri: Gamme parent, puis accessoires, puis Avant→Arrière→Gauche→Droite, puis prix
-- ============================================================================

COMMENT ON FUNCTION get_pieces_for_type_gamme IS 
'⚡ RPC V4 avec logique PHP V4 + Avant/Arrière.
Détection position sur 5 niveaux: relation_criteria > criteria > side_filters > piece_name_side > piece_name.
Priorité: Avant (1) > Arrière (2) > Gauche (3) > Droite (4).
Fusion des groupes pour pièces intérieure/extérieure.
Remplace 10 requêtes REST API (~2-4s) par 1 appel RPC (~100-200ms).
Usage: supabase.rpc("get_pieces_for_type_gamme", { p_type_id: 33302, p_pg_id: 402 })';

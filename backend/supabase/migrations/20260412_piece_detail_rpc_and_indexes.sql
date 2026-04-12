-- Migration: RPC get_piece_detail + index btree sur colonnes _i
-- Date: 2026-04-12
-- Context: Incident modal R2 timeout 30s+ sur click fiche produit.
--   Root cause: getPieceById faisait 8 requetes sequentielles sur colonnes _i
--   INTEGER sans index, sur tables de 442k a 72M lignes (full scan 15s+).
-- Fix: RPC unique get_piece_detail (1 round-trip DB) + 4 index btree manquants.

-- ============================================================================
-- PART 1: Index btree sur les colonnes _piece_id_i (INTEGER, sans index)
-- ============================================================================
-- Les tables pieces_* ont des colonnes dupliquees TEXT + _i INTEGER heritees
-- du legacy PHP. Les index existaient uniquement sur les colonnes TEXT.
-- Tout code filtrant sur _i faisait un Parallel Seq Scan.
--
-- Impact mesure (EXPLAIN ANALYZE):
--   pieces_media_img: 383ms → 0.19ms (x2000)
--   pieces_price:      97ms → 0.16ms (x600)
--
-- CONCURRENTLY = pas de lock sur les tables pendant la creation.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pieces_price_piece_id_i
  ON pieces_price (pri_piece_id_i);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pieces_media_img_piece_id_i
  ON pieces_media_img (pmi_piece_id_i);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pieces_list_piece_id_i
  ON pieces_list (pli_piece_id_i);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pieces_ref_ean_piece_id_i
  ON pieces_ref_ean (pre_piece_id_i);

-- ============================================================================
-- PART 2: RPC get_piece_detail — tout en 1 round-trip
-- ============================================================================
-- Remplace 8 requetes Supabase sequentielles (getPieceById NestJS) par une
-- seule fonction PL/pgSQL qui fait :
--   1. Piece + prix + marque via LEFT JOINs
--   2. Images (agregation JSONB ordonnee par pmi_sort)
--   3. Criteres techniques level=1 avec fallback tous niveaux (DISTINCT ON)
--   4. OEM refs groupees par marque (JSONB object)
--
-- Filtre sur les colonnes TEXT indexees (pc_piece_id, pmi_piece_id, etc.)
-- via v_piece_id_text pour utiliser les index existants.
--
-- statement_timeout = 5s : safety net contre les requetes qui s'emballent.

CREATE OR REPLACE FUNCTION get_piece_detail(p_piece_id integer)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET statement_timeout = '5s'
AS $$
DECLARE
  v_piece record;
  v_images_paths jsonb;
  v_first_image text;
  v_criteres jsonb;
  v_oem_refs jsonb;
  v_piece_id_text text := p_piece_id::text;
BEGIN
  -- 1. Piece + prix + marque (1 SELECT avec LEFT JOINs)
  SELECT
    p.piece_id, p.piece_ref, p.piece_name, p.piece_des,
    p.piece_weight_kgm, p.piece_has_oem,
    pr.pri_vente_ttc_n, pr.pri_consigne_ttc_n, pr.pri_dispo,
    pm.pm_name, pm.pm_logo, pm.pm_quality, pm.pm_nb_stars
  INTO v_piece
  FROM pieces p
  LEFT JOIN pieces_price pr ON pr.pri_piece_id = v_piece_id_text AND pr.pri_type = '0'
  LEFT JOIN pieces_marque pm ON pm.pm_id = p.piece_pm_id
  WHERE p.piece_id = p_piece_id AND p.piece_display = true;

  IF v_piece IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Piece non trouvee');
  END IF;

  -- 2. Images — agregation JSONB ordonnee
  SELECT
    COALESCE(jsonb_agg(path ORDER BY sort), '[]'::jsonb)
  INTO v_images_paths
  FROM (
    SELECT pmi_folder || '/' || pmi_name as path, pmi_sort as sort
    FROM pieces_media_img
    WHERE pmi_piece_id = v_piece_id_text
      AND pmi_folder IS NOT NULL AND pmi_folder <> ''
      AND pmi_name IS NOT NULL AND pmi_name <> ''
    ORDER BY pmi_sort
  ) img;

  v_first_image := v_images_paths->>0;

  -- 3. Criteres techniques level=1 (DISTINCT ON pour eviter doublons)
  SELECT COALESCE(jsonb_agg(crit ORDER BY crit->>'level', crit->>'sort'), '[]'::jsonb)
  INTO v_criteres
  FROM (
    SELECT DISTINCT ON (pc.pc_cri_id)
      jsonb_build_object(
        'id', pc.pc_cri_id, 'name', pcl.pcl_cri_criteria,
        'value', pc.pc_cri_value, 'unit', COALESCE(pcl.pcl_cri_unit, ''),
        'level', COALESCE(pcl.pcl_level, '5'), 'sort', pc.pc_sort
      ) as crit
    FROM pieces_criteria pc
    JOIN pieces_criteria_link pcl
      ON pcl.pcl_cri_id = pc.pc_cri_id AND pcl.pcl_display = '1' AND pcl.pcl_level = '1'
    WHERE pc.pc_piece_id = v_piece_id_text AND pc.pc_display = '1'
    ORDER BY pc.pc_cri_id, pc.pc_sort
  ) sub;

  -- Fallback tous niveaux si aucun critere level=1
  IF v_criteres = '[]'::jsonb THEN
    SELECT COALESCE(jsonb_agg(crit ORDER BY crit->>'level', crit->>'sort'), '[]'::jsonb)
    INTO v_criteres
    FROM (
      SELECT DISTINCT ON (pc.pc_cri_id)
        jsonb_build_object(
          'id', pc.pc_cri_id, 'name', pcl.pcl_cri_criteria,
          'value', pc.pc_cri_value, 'unit', COALESCE(pcl.pcl_cri_unit, ''),
          'level', COALESCE(pcl.pcl_level, '5'), 'sort', pc.pc_sort
        ) as crit
      FROM pieces_criteria pc
      JOIN pieces_criteria_link pcl
        ON pcl.pcl_cri_id = pc.pc_cri_id AND pcl.pcl_display = '1'
      WHERE pc.pc_piece_id = v_piece_id_text AND pc.pc_display = '1'
      ORDER BY pc.pc_cri_id, pcl.pcl_level, pc.pc_sort
    ) sub;
  END IF;

  -- 4. OEM refs groupees par marque constructeur
  SELECT COALESCE(jsonb_object_agg(brand_name, refs), '{}'::jsonb)
  INTO v_oem_refs
  FROM (
    SELECT prb.prb_name as brand_name, jsonb_agg(DISTINCT prs.prs_ref) as refs
    FROM pieces_ref_search prs
    JOIN pieces_ref_brand prb ON prb.prb_id::text = prs.prs_prb_id
    WHERE prs.prs_piece_id = v_piece_id_text AND prs.prs_kind = '3'
    GROUP BY prb.prb_name
  ) sub;

  RETURN jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'id', v_piece.piece_id,
      'nom', v_piece.piece_name,
      'reference', v_piece.piece_ref,
      'marque', COALESCE(v_piece.pm_name, ''),
      'marque_logo', v_piece.pm_logo,
      'qualite', v_piece.pm_quality,
      'nb_stars', COALESCE(v_piece.pm_nb_stars, '0'),
      'prix_ttc', COALESCE(v_piece.pri_vente_ttc_n, 0),
      'consigne_ttc', COALESCE(v_piece.pri_consigne_ttc_n, 0),
      'dispo', COALESCE(v_piece.pri_dispo, '0') = '1',
      'description', v_piece.piece_des,
      'image', COALESCE(v_first_image, ''),
      'images', v_images_paths,
      'weight', v_piece.piece_weight_kgm,
      'hasOem', v_piece.piece_has_oem,
      'criteresTechniques', v_criteres,
      'referencesOem', v_oem_refs
    )
  );
END;
$$;

COMMENT ON FUNCTION get_piece_detail(integer) IS
  'Retourne le detail complet d''une piece en 1 round-trip DB. Utilise par CatalogService.getPieceById() avec cache Redis 1h. Remplace 8 requetes Supabase sequentielles.';

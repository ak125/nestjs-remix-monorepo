-- get_piece_detail : filtrer pmi_display='1' dans la section images.
--
-- Bug : la RPC ressortait TOUTES les lignes pieces_media_img (folder non vide) sans
-- filtrer pmi_display, contrairement à tout le reste du catalogue (search filtre déjà
-- pmi_display=1). Conséquence : les lignes legacy soft-hidden (display='0', fichier
-- supprimé → 404) restaient affichées dans le modal/galerie à côté des images valides
-- (ex. ELH4391 : 4 clés renvoyées, 2 mortes .BMP + 2 nouvelles .jpg).
--
-- Correctif : AND pmi_display = '1' dans la sous-requête images (1 ligne).
-- Impact mesuré (2026-06-10) : 0 régression — sur 2 446 pièces qui perdent toutes leurs
-- images sous le filtre, AUCUNE n'a de fichier storage existant (= images déjà mortes,
-- désormais fallback propre). Aucune image vivante masquée.
--
-- Idempotent (CREATE OR REPLACE). Rollback = recréer la fonction sans la ligne ajoutée.
-- Pas de BEGIN/COMMIT explicite (squawk assume_in_transaction).

CREATE OR REPLACE FUNCTION public.get_piece_detail(p_piece_id integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET statement_timeout TO '5s'
AS $function$
DECLARE
  v_piece record;
  v_images_paths jsonb;
  v_first_image text;
  v_criteres jsonb;
  v_oem_refs jsonb;
  v_piece_id_text text := p_piece_id::text;
BEGIN
  -- 1. Piece + prix + marque
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

  -- 2. Images — first image = premier par sort order
  SELECT
    COALESCE(jsonb_agg(path ORDER BY sort), '[]'::jsonb)
  INTO v_images_paths
  FROM (
    SELECT pmi_folder || '/' || pmi_name as path, pmi_sort as sort
    FROM pieces_media_img
    WHERE pmi_piece_id = v_piece_id_text
      AND pmi_folder IS NOT NULL AND pmi_folder <> ''
      AND pmi_name IS NOT NULL AND pmi_name <> ''
      AND pmi_display = '1'
    ORDER BY pmi_sort
  ) img;

  v_first_image := v_images_paths->>0;

  -- 3. Criteres techniques — DISTINCT pour eviter doublons
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

  -- Fallback tous niveaux
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

  -- 4. OEM refs groupees par marque
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
$function$;

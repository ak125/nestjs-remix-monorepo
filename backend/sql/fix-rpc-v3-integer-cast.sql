-- ============================================================================
-- FIX V7: RPC V3 Integer Cast Error - CORRECT FIX
-- ============================================================================
-- Problème: "invalid input syntax for type integer: """"
--
-- V6 BUG: Applied NULLIF to INTEGER columns which caused PostgreSQL to try
--         comparing INTEGER to empty string '' which fails!
--
-- V7 SOLUTION:
-- - KEEP NULLIF for TEXT columns that are cast to INTEGER
-- - REMOVE NULLIF for columns that are already INTEGER
--
-- TEXT columns (NEED NULLIF when casting to INTEGER):
-- - auto_type.type_id, type_modele_id
-- - auto_type_motor_code.tmc_type_id
-- - __seo_gamme_car.sgc_pg_id
-- - catalog_gamme.mc_pg_id, mc_mf_prime
-- - pieces_criteria.pc_piece_id
-- - pieces.piece_pm_id
-- - pieces_price.pri_type
-- - pieces_marque.pm_nb_stars
--
-- INTEGER columns (NO NULLIF - already INTEGER):
-- - pieces_relation_type.rtp_* (all are INTEGER)
-- - pieces_relation_criteria.rcp_* (all are INTEGER except rcp_cri_value)
--
-- Usage: Copier/coller dans Supabase SQL Editor et exécuter
-- ============================================================================

CREATE OR REPLACE FUNCTION get_pieces_for_type_gamme_v3(
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
  v_marque_name TEXT;
  v_marque_alias TEXT;
  v_marque_id INTEGER;
  v_modele_name TEXT;
  v_modele_alias TEXT;
  v_modele_id INTEGER;
  v_type_name TEXT;
  v_type_alias TEXT;
  v_type_power_ps TEXT;
  v_mf_id INTEGER;
  v_seo_h1 TEXT;
  v_seo_title TEXT;
  v_seo_description TEXT;
  v_seo_content TEXT;
  v_seo_preview TEXT;
  -- CDN Supabase Storage
  v_cdn_base TEXT := 'https://https://www.automecanik.com/img/v1/object/public';
BEGIN

  -- ═══════════════════════════════════════════════════════════════════════════
  -- PARTIE 0: RÉCUPÉRER LES INFOS VÉHICULE ET GAMME (pour SEO)
  -- ═══════════════════════════════════════════════════════════════════════════
  -- FIX V6: NULLIF sur at.type_modele_id et at.type_id
  SELECT
    amarq.marque_name,
    amarq.marque_alias,
    amarq.marque_id,
    am.modele_name,
    am.modele_alias,
    am.modele_id,
    at.type_name,
    at.type_alias,
    at.type_power_ps
  INTO
    v_marque_name,
    v_marque_alias,
    v_marque_id,
    v_modele_name,
    v_modele_alias,
    v_modele_id,
    v_type_name,
    v_type_alias,
    v_type_power_ps
  FROM auto_type at
  JOIN auto_modele am ON am.modele_id = NULLIF(at.type_modele_id, '')::INTEGER
  JOIN auto_marque amarq ON amarq.marque_id = am.modele_marque_id
  WHERE NULLIF(at.type_id, '')::INTEGER = p_type_id
    AND at.type_display = '1'
  LIMIT 1;

  -- FIX V6: NULLIF sur cg.mc_pg_id
  SELECT COALESCE(NULLIF(cg.mc_mf_prime, '')::INTEGER, 0)
  INTO v_mf_id
  FROM pieces_gamme pg
  LEFT JOIN catalog_gamme cg ON NULLIF(cg.mc_pg_id, '')::INTEGER = pg.pg_id
  WHERE pg.pg_id = p_pg_id;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- PARTIE 1: TRAITER LES TEMPLATES SEO
  -- ═══════════════════════════════════════════════════════════════════════════
  -- FIX V6: NULLIF sur sgc_pg_id
  SELECT
    process_seo_template(
      COALESCE(sgc_h1, ''),
      p_type_id, p_pg_id, v_mf_id,
      v_marque_name, v_marque_alias, v_marque_id,
      v_modele_name, v_modele_alias, v_modele_id,
      v_type_name, v_type_alias, v_type_power_ps
    ),
    process_seo_template(
      COALESCE(sgc_title, ''),
      p_type_id, p_pg_id, v_mf_id,
      v_marque_name, v_marque_alias, v_marque_id,
      v_modele_name, v_modele_alias, v_modele_id,
      v_type_name, v_type_alias, v_type_power_ps
    ),
    process_seo_template(
      COALESCE(sgc_descrip, ''),
      p_type_id, p_pg_id, v_mf_id,
      v_marque_name, v_marque_alias, v_marque_id,
      v_modele_name, v_modele_alias, v_modele_id,
      v_type_name, v_type_alias, v_type_power_ps
    ),
    process_seo_template(
      COALESCE(sgc_content, ''),
      p_type_id, p_pg_id, v_mf_id,
      v_marque_name, v_marque_alias, v_marque_id,
      v_modele_name, v_modele_alias, v_modele_id,
      v_type_name, v_type_alias, v_type_power_ps
    ),
    process_seo_template(
      COALESCE(sgc_preview, ''),
      p_type_id, p_pg_id, v_mf_id,
      v_marque_name, v_marque_alias, v_marque_id,
      v_modele_name, v_modele_alias, v_modele_id,
      v_type_name, v_type_alias, v_type_power_ps
    )
  INTO v_seo_h1, v_seo_title, v_seo_description, v_seo_content, v_seo_preview
  FROM __seo_gamme_car
  WHERE NULLIF(sgc_pg_id, '')::INTEGER = p_pg_id
  LIMIT 1;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- PARTIE 2: DONNÉES UNIFIÉES (comme V2)
  -- ═══════════════════════════════════════════════════════════════════════════

  WITH
  -- 🚗 VEHICLE INFO
  -- FIX V6: NULLIF sur at.type_modele_id et at.type_id
  vehicle_info AS (
    SELECT
      at.type_id,
      at.type_name,
      at.type_alias,
      at.type_power_ps,
      at.type_power_kw,
      at.type_year_from,
      at.type_year_to,
      at.type_body,
      at.type_fuel,
      at.type_engine,
      at.type_liter,
      am.modele_id,
      am.modele_name,
      am.modele_alias,
      am.modele_pic,
      amarq.marque_id,
      amarq.marque_name,
      amarq.marque_alias,
      amarq.marque_logo
    FROM auto_type at
    JOIN auto_modele am ON am.modele_id = NULLIF(at.type_modele_id, '')::INTEGER
    JOIN auto_marque amarq ON amarq.marque_id = am.modele_marque_id
    WHERE NULLIF(at.type_id, '')::INTEGER = p_type_id
      AND at.type_display = '1'
    LIMIT 1
  ),

  -- 🔧 MOTOR CODES
  -- FIX V6: NULLIF sur tmc_type_id
  motor_codes AS (
    SELECT COALESCE(STRING_AGG(tmc_code, ', '), '') as codes
    FROM auto_type_motor_code
    WHERE NULLIF(tmc_type_id, '')::INTEGER = p_type_id
  ),

  -- 📦 GAMME INFO
  -- FIX V6: NULLIF sur cg.mc_pg_id
  gamme_info AS (
    SELECT
      pg.pg_id,
      pg.pg_name,
      pg.pg_alias,
      pg.pg_pic,
      COALESCE(cg.mc_mf_prime, '') as mf_id
    FROM pieces_gamme pg
    LEFT JOIN catalog_gamme cg ON NULLIF(cg.mc_pg_id, '')::INTEGER = pg.pg_id
    WHERE pg.pg_id = p_pg_id
    LIMIT 1
  ),

  -- ═══════════════════════════════════════════════════════════════════════════
  -- PARTIE 3: PIÈCES (code V2)
  -- ═══════════════════════════════════════════════════════════════════════════

  -- FIX V7: pieces_relation_type columns are INTEGER, not TEXT - no NULLIF needed
  relations AS (
    SELECT DISTINCT
      rtp_piece_id,
      rtp_psf_id,
      rtp_pm_id
    FROM pieces_relation_type
    WHERE rtp_type_id = p_type_id
      AND rtp_pg_id = p_pg_id
    LIMIT 500
  ),

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
      CASE
        WHEN LOWER(p.piece_fil_name) LIKE LOWER(RTRIM(SPLIT_PART(rg.pg_name, ' ', 1), 's')) || '%' THEN false
        ELSE true
      END as is_accessory
    FROM pieces p
    INNER JOIN relations r ON p.piece_id = r.rtp_piece_id
    CROSS JOIN root_gamme rg
    WHERE p.piece_display = true
  ),

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

  first_images AS (
    SELECT DISTINCT ON (pmi_piece_id)
      pmi_piece_id as piece_id_text,
      pmi_folder,
      pmi_name,
      CASE
        WHEN pmi_name ~* '\.(webp|jpg|jpeg|png|gif)$' THEN pmi_name
        ELSE pmi_name || '.webp'
      END as pmi_name_with_ext
    FROM pieces_media_img
    WHERE pmi_piece_id IN (SELECT piece_id::TEXT FROM active_pieces)
      AND pmi_display = '1'
    ORDER BY pmi_piece_id, pmi_sort ASC
  ),

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
          'alt', pmi_name,
          'sort', pmi_sort
        ) ORDER BY pmi_sort ASC
      ) as images
    FROM pieces_media_img
    WHERE pmi_piece_id IN (SELECT piece_id::TEXT FROM active_pieces)
      AND pmi_display = '1'
    GROUP BY pmi_piece_id
  ),

  -- FIX V7: piece_pm_id is SMALLINT, not TEXT - no NULLIF needed
  piece_brands AS (
    SELECT
      pm_id,
      pm_name,
      pm_logo,
      pm_nb_stars
    FROM pieces_marque
    WHERE pm_id IN (SELECT DISTINCT COALESCE(rtp_pm_id, piece_pm_id) FROM active_pieces)
  ),

  side_positions AS (
    SELECT
      psf_id,
      psf_side
    FROM pieces_side_filtre
    WHERE psf_id IN (SELECT DISTINCT rtp_psf_id FROM active_pieces WHERE rtp_psf_id IS NOT NULL)
  ),

  -- FIX V3: pc_piece_id est TEXT - NULLIF pour protéger contre les chaînes vides
  criteria_positions AS (
    SELECT DISTINCT ON (NULLIF(pc_piece_id, '')::INTEGER)
      NULLIF(pc_piece_id, '')::INTEGER as piece_id,
      CASE
        WHEN LOWER(pc_cri_value) LIKE '%essieu avant%' OR LOWER(pc_cri_value) = 'avant' THEN 'Avant'
        WHEN LOWER(pc_cri_value) LIKE '%essieu arrière%' OR LOWER(pc_cri_value) = 'arrière' THEN 'Arrière'
        WHEN LOWER(pc_cri_value) LIKE '%gauche%' OR LOWER(pc_cri_value) LIKE '%conducteur%' THEN 'Gauche'
        WHEN LOWER(pc_cri_value) LIKE '%droit%' OR LOWER(pc_cri_value) LIKE '%passager%' THEN 'Droite'
        ELSE NULL
      END as detected_position
    FROM pieces_criteria
    WHERE NULLIF(pc_piece_id, '')::INTEGER IN (SELECT piece_id FROM active_pieces)
      AND pc_cri_id::TEXT = '100'
      AND pc_cri_value IS NOT NULL
      AND pc_cri_value != ''
    ORDER BY NULLIF(pc_piece_id, '')::INTEGER
  ),

  -- FIX V7: pieces_relation_criteria columns are INTEGER, not TEXT - no NULLIF needed
  -- (only rcp_cri_value is TEXT)
  relation_criteria_positions AS (
    SELECT DISTINCT ON (rcp_piece_id)
      rcp_piece_id as piece_id,
      CASE
        WHEN LOWER(rcp_cri_value) LIKE '%essieu avant%' OR LOWER(rcp_cri_value) = 'avant' THEN 'Avant'
        WHEN LOWER(rcp_cri_value) LIKE '%essieu arrière%' OR LOWER(rcp_cri_value) = 'arrière' THEN 'Arrière'
        WHEN rcp_cri_value LIKE '%+L%' OR LOWER(rcp_cri_value) LIKE '%gauche%' THEN 'Gauche'
        WHEN rcp_cri_value LIKE '%+R%' OR LOWER(rcp_cri_value) LIKE '%droit%' THEN 'Droite'
        ELSE NULL
      END as detected_position
    FROM pieces_relation_criteria
    WHERE rcp_type_id = p_type_id
      AND rcp_pg_id = p_pg_id
      AND rcp_piece_id IN (SELECT piece_id FROM active_pieces)
      AND rcp_cri_value IS NOT NULL
      AND rcp_cri_value != ''
    ORDER BY rcp_piece_id
  ),

  -- FIX #3: assembled_pieces avec NULLIF pour éviter l'erreur sur string vide
  assembled_pieces AS (
    SELECT
      ap.piece_id as id,
      TRIM(CONCAT_WS(' ', ap.piece_name,
        CASE WHEN COALESCE(sp.psf_side, ap.piece_name_side) IS NOT NULL
          AND POSITION(LOWER(COALESCE(sp.psf_side, ap.piece_name_side)) IN LOWER(COALESCE(ap.piece_name, ''))) = 0
          THEN COALESCE(sp.psf_side, ap.piece_name_side) ELSE NULL END,
        CASE WHEN ap.piece_name_comp IS NOT NULL
          AND POSITION(LOWER(ap.piece_name_comp) IN LOWER(COALESCE(ap.piece_name, ''))) = 0
          THEN ap.piece_name_comp ELSE NULL END
      )) as nom,
      ap.piece_ref as reference,
      ap.piece_ref_clean as reference_clean,
      ap.piece_des as description,
      COALESCE(ap.piece_qty_sale, 1)::NUMERIC as quantite_vente,
      ap.piece_has_img as has_image,
      ap.piece_has_oem as has_oem,
      ap.piece_fil_name as filtre_gamme,
      ap.is_accessory,
      COALESCE(pm.pm_name, 'Marque inconnue') as marque,
      pm.pm_id as marque_id,
      pm.pm_logo as marque_logo,
      COALESCE(NULLIF(pm.pm_nb_stars, '')::INTEGER, 0) as nb_stars,
      COALESCE(NULLIF(bp.pri_vente_ttc, '')::NUMERIC, 0) as prix_unitaire,
      (COALESCE(NULLIF(bp.pri_vente_ttc, '')::NUMERIC, 0) * COALESCE(ap.piece_qty_sale, 1))::NUMERIC as prix_ttc,
      (COALESCE(NULLIF(bp.pri_consigne_ttc, '')::NUMERIC, 0) * COALESCE(ap.piece_qty_sale, 1))::NUMERIC as prix_consigne,
      COALESCE(bp.pri_dispo, '0') = '1' as dispo,
      CASE WHEN fi.pmi_folder IS NOT NULL AND fi.pmi_name IS NOT NULL
        THEN v_cdn_base || '/rack-images/' || fi.pmi_folder || '/' || fi.pmi_name_with_ext
        ELSE v_cdn_base || '/uploads/articles/no.png'
      END as image,
      COALESCE(ai.images, '[]'::jsonb) as images,
      CASE
        WHEN COALESCE(NULLIF(pm.pm_nb_stars, '')::INTEGER, 0) >= 4 THEN 'Premium'
        WHEN COALESCE(NULLIF(pm.pm_nb_stars, '')::INTEGER, 0) >= 3 THEN 'Qualité'
        ELSE 'Économique'
      END as qualite,
      COALESCE(rcp.detected_position, cp.detected_position, sp.psf_side, ap.piece_name_side) as filtre_side
    FROM active_pieces ap
    LEFT JOIN best_prices bp ON bp.pri_piece_id = ap.piece_id::TEXT
    LEFT JOIN first_images fi ON fi.piece_id_text = ap.piece_id::TEXT
    LEFT JOIN all_images ai ON ai.piece_id_text = ap.piece_id::TEXT
    LEFT JOIN piece_brands pm ON pm.pm_id = COALESCE(ap.rtp_pm_id, ap.piece_pm_id)
    LEFT JOIN side_positions sp ON sp.psf_id = ap.rtp_psf_id
    LEFT JOIN criteria_positions cp ON cp.piece_id = ap.piece_id
    LEFT JOIN relation_criteria_positions rcp ON rcp.piece_id = ap.piece_id
  ),

  sorted_pieces AS (
    SELECT * FROM assembled_pieces
    ORDER BY
      CASE WHEN is_accessory THEN 1 ELSE 0 END,
      CASE filtre_side
        WHEN 'Avant' THEN 1
        WHEN 'Arrière' THEN 2
        WHEN 'Gauche' THEN 3
        WHEN 'Droite' THEN 4
        ELSE 5
      END,
      prix_unitaire ASC NULLS LAST
  ),

  -- 🏭 Brand OEM pour filtrer par constructeur
  oem_brand AS (
    SELECT prb.prb_id
    FROM pieces_ref_brand prb
    INNER JOIN vehicle_info vi ON UPPER(prb.prb_name) = UPPER(vi.marque_name)
    LIMIT 1
  ),

  -- 🔧 OEM refs avec position (filtre_side) de la pièce source
  -- Normalisation ULTRA-STRICTE: supprime TOUS les espaces, tirets, et préfixes
  oem_refs_with_position AS (
    SELECT
      prs.prs_ref as ref,
      -- Normalisation STRICTE: tout en majuscules, sans espaces/tirets, sans préfixe lettre isolée
      -- Ex: "1K0 698 151 D" -> "1K0698151D"
      -- Ex: "1K0 698 151D" -> "1K0698151D" (même résultat)
      -- Ex: "L1K0698151D" -> "1K0698151D" (préfixe L supprimé)
      REGEXP_REPLACE(
        UPPER(REPLACE(REPLACE(REPLACE(prs.prs_ref, ' ', ''), '-', ''), '.', '')),
        '^[A-Z](?=[0-9])',  -- Supprime une lettre isolée au début suivie d'un chiffre
        ''
      ) as ref_normalized,
      sp.filtre_gamme,
      sp.filtre_side,
      sp.is_accessory,
      -- Priorité pour le tri: Avant=1, Arrière=2, autres=3, puis accessoires en dernier
      CASE
        WHEN sp.is_accessory THEN 100
        WHEN sp.filtre_side = 'Avant' THEN 1
        WHEN sp.filtre_side = 'Arrière' THEN 2
        WHEN sp.filtre_side = 'Gauche' THEN 3
        WHEN sp.filtre_side = 'Droite' THEN 4
        ELSE 10
      END as group_priority,
      -- Score de "lisibilité": refs avec espaces bien placés sont préférées
      -- Format idéal: "XXX XXX XXX X" (3 espaces) ou "XXX XXX XXX XX"
      CASE
        WHEN prs.prs_ref ~ '^[A-Z0-9]{2,3} [0-9]{3} [0-9]{3} [A-Z0-9]{1,2}$' THEN 1  -- Format parfait avec espaces
        WHEN prs.prs_ref ~ '^[A-Z0-9]{2,3} [0-9]{3} [0-9]{3}[A-Z0-9]{1,2}$' THEN 2  -- Presque parfait (pas d'espace avant suffixe)
        WHEN prs.prs_ref ~ ' ' THEN 3  -- Au moins des espaces
        ELSE 10  -- Sans espaces
      END as format_score
    FROM pieces_ref_search prs
    INNER JOIN sorted_pieces sp ON prs.prs_piece_id = sp.id::TEXT
    INNER JOIN oem_brand ob ON prs.prs_prb_id = ob.prb_id
    WHERE prs.prs_kind = '3'
  ),

  -- 🎯 ÉTAPE 1: Dédoublonnage GLOBAL STRICT (une ref normalisée = UNE SEULE occurrence globale)
  -- Chaque ref n'apparaît QU'UNE SEULE fois, assignée au groupe prioritaire (Avant > Arrière > autres)
  -- Préfère le format avec espaces bien placés pour la lisibilité
  oem_refs_unique_global AS (
    SELECT DISTINCT ON (ref_normalized)
      ref,
      ref_normalized,
      filtre_gamme,
      filtre_side,
      is_accessory
    FROM oem_refs_with_position
    ORDER BY
      ref_normalized,           -- Grouper par ref normalisée
      group_priority ASC,       -- Priorité: Avant > Arrière > autres > accessoires
      format_score ASC,         -- Préfère format avec espaces bien placés
      LENGTH(ref) DESC          -- En cas d'égalité, préfère le plus long
  ),

  -- 📊 Agrégation des OEM refs par groupe
  -- Chaque ref n'apparaît que dans UN SEUL groupe (celui prioritaire)
  oem_refs_by_group AS (
    SELECT
      filtre_gamme,
      filtre_side,
      is_accessory,
      jsonb_agg(ref ORDER BY ref) as oem_refs,
      COUNT(*)::INTEGER as oem_refs_count
    FROM oem_refs_unique_global
    GROUP BY filtre_gamme, filtre_side, is_accessory
  ),

  grouped AS (
    SELECT
      sp.filtre_gamme as group_gamme,
      sp.filtre_side as group_side,
      sp.is_accessory,
      CASE
        WHEN sp.filtre_side IS NOT NULL AND sp.filtre_side != ''
          THEN sp.filtre_gamme || ' - ' || sp.filtre_side
        ELSE sp.filtre_gamme
      END as title_h2,
      jsonb_agg(
        jsonb_build_object(
          'id', sp.id, 'nom', sp.nom, 'reference', sp.reference,
          'marque', sp.marque, 'marque_id', sp.marque_id, 'marque_logo', sp.marque_logo,
          'prix_unitaire', sp.prix_unitaire, 'prix_ttc', sp.prix_ttc,
          'image', sp.image, 'images', sp.images, 'dispo', sp.dispo, 'qualite', sp.qualite
        ) ORDER BY sp.prix_unitaire ASC NULLS LAST
      ) as pieces,
      -- 🆕 OEM refs intégrées directement dans le groupe
      COALESCE(og.oem_refs, '[]'::jsonb) as oem_refs,
      COALESCE(og.oem_refs_count, 0) as oem_refs_count
    FROM sorted_pieces sp
    LEFT JOIN oem_refs_by_group og
      ON og.filtre_gamme IS NOT DISTINCT FROM sp.filtre_gamme
      AND og.filtre_side IS NOT DISTINCT FROM sp.filtre_side
      AND og.is_accessory = sp.is_accessory
    GROUP BY sp.filtre_gamme, sp.filtre_side, sp.is_accessory, og.oem_refs, og.oem_refs_count
  ),

  side_filter_agg AS (
    SELECT jsonb_build_object(
      'id', 'side', 'name', 'Position', 'type', 'checkbox',
      'options', COALESCE(jsonb_agg(DISTINCT jsonb_build_object(
        'value', filtre_side, 'label', filtre_side, 'count', 1
      )) FILTER (WHERE filtre_side IS NOT NULL AND filtre_side != ''), '[]'::jsonb)
    ) as filter_data FROM sorted_pieces
  ),
  quality_filter_agg AS (
    SELECT jsonb_build_object(
      'id', 'quality', 'name', 'Qualité', 'type', 'checkbox',
      'options', COALESCE(jsonb_agg(DISTINCT jsonb_build_object(
        'value', qualite, 'label', qualite, 'count', 1
      )), '[]'::jsonb)
    ) as filter_data FROM sorted_pieces
  ),
  brand_filter_agg AS (
    SELECT jsonb_build_object(
      'id', 'brand', 'name', 'Marque', 'type', 'checkbox',
      'options', COALESCE(jsonb_agg(DISTINCT jsonb_build_object(
        'value', marque_id::TEXT, 'label', marque, 'count', 1
      )) FILTER (WHERE marque_id IS NOT NULL), '[]'::jsonb)
    ) as filter_data FROM sorted_pieces
  ),

  -- ═══════════════════════════════════════════════════════════════════════════
  -- PARTIE 4: OEM REFS GLOBAL (pour compatibilité - liste dédupliquée globale)
  -- ═══════════════════════════════════════════════════════════════════════════
  oem_refs_global AS (
    SELECT DISTINCT ON (ref_normalized)
      ref
    FROM oem_refs_unique_global
    ORDER BY ref_normalized, LENGTH(ref) DESC
    LIMIT 50
  )

  -- ═══════════════════════════════════════════════════════════════════════════
  -- RÉSULTAT FINAL V3 - AVEC SEO PROCESSÉ ET OEM PAR GROUPE
  -- ═══════════════════════════════════════════════════════════════════════════
  SELECT jsonb_build_object(
    -- 🚗 DONNÉES VÉHICULE
    'vehicle_info', (
      SELECT jsonb_build_object(
        'type_id', type_id,
        'type_name', type_name,
        'type_alias', type_alias,
        'type_power_ps', type_power_ps,
        'type_power_kw', type_power_kw,
        'type_year_from', type_year_from,
        'type_year_to', type_year_to,
        'type_body', type_body,
        'type_fuel', type_fuel,
        'type_engine', type_engine,
        'type_liter', type_liter,
        'modele_id', modele_id,
        'modele_name', modele_name,
        'modele_alias', modele_alias,
        'modele_pic', modele_pic,
        'marque_id', marque_id,
        'marque_name', marque_name,
        'marque_alias', marque_alias,
        'marque_logo', marque_logo,
        'motor_codes', (SELECT codes FROM motor_codes)
      )
      FROM vehicle_info
    ),
    'gamme_info', (
      SELECT jsonb_build_object(
        'pg_id', pg_id,
        'pg_name', pg_name,
        'pg_alias', pg_alias,
        'pg_pic', pg_pic,
        'mf_id', mf_id
      )
      FROM gamme_info
    ),

    -- 🎯 SEO PROCESSÉ (nouveauté V3!)
    'seo', jsonb_build_object(
      'h1', COALESCE(v_seo_h1, ''),
      'title', COALESCE(v_seo_title, ''),
      'description', COALESCE(v_seo_description, ''),
      'content', COALESCE(v_seo_content, ''),
      'preview', COALESCE(v_seo_preview, '')
    ),

    -- Templates bruts pour debug (optionnel)
    -- FIX V6: NULLIF sur sgc_pg_id
    'seo_templates', (
      SELECT jsonb_build_object(
        'h1', COALESCE(sgc_h1, ''),
        'content', COALESCE(sgc_content, ''),
        'title', COALESCE(sgc_title, ''),
        'description', COALESCE(sgc_descrip, ''),
        'preview', COALESCE(sgc_preview, '')
      )
      FROM __seo_gamme_car
      WHERE NULLIF(sgc_pg_id, '')::INTEGER = p_pg_id
      LIMIT 1
    ),

    'oem_refs', COALESCE((SELECT jsonb_agg(ref) FROM oem_refs_global), '[]'::jsonb),

    -- 📦 DONNÉES PIÈCES
    'pieces', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', id, 'nom', nom, 'reference', reference, 'reference_clean', reference_clean,
          'description', description, 'marque', marque, 'marque_id', marque_id,
          'marque_logo', marque_logo, 'nb_stars', nb_stars,
          'prix_unitaire', prix_unitaire, 'prix_ttc', prix_ttc,
          'prix_consigne', prix_consigne, 'quantite_vente', quantite_vente,
          'dispo', dispo, 'image', image, 'images', images,
          'qualite', qualite, 'filtre_gamme', filtre_gamme, 'filtre_side', filtre_side,
          'has_image', has_image, 'has_oem', has_oem
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
          'pieces', pieces,
          'oemRefs', oem_refs,
          'oemRefsCount', oem_refs_count
        )
        ORDER BY
          CASE WHEN is_accessory THEN 1 ELSE 0 END,
          CASE group_side WHEN 'Avant' THEN 1 WHEN 'Arrière' THEN 2
            WHEN 'Gauche' THEN 3 WHEN 'Droite' THEN 4 ELSE 5 END
      )
      FROM grouped
    ), '[]'::jsonb),
    'blocs', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'filtre_gamme', group_gamme, 'filtre_side', group_side,
          'title_h2', title_h2, 'pieces', pieces,
          'oemRefs', oem_refs,
          'oemRefsCount', oem_refs_count
        )
        ORDER BY
          CASE WHEN is_accessory THEN 1 ELSE 0 END,
          CASE group_side WHEN 'Avant' THEN 1 WHEN 'Arrière' THEN 2
            WHEN 'Gauche' THEN 3 WHEN 'Droite' THEN 4 ELSE 5 END
      )
      FROM grouped
    ), '[]'::jsonb),
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
      )
    ),
    'count', (SELECT COUNT(*)::INTEGER FROM sorted_pieces),
    'minPrice', (SELECT MIN(prix_unitaire) FROM sorted_pieces WHERE prix_unitaire > 0),
    'relations_found', (SELECT COUNT(*)::INTEGER FROM relations),
    'success', true,
    'version', 'RPC_V3_SEO_INTEGRATED_FIXED_V7'
  ) INTO v_result;

  -- Ajouter la durée d'exécution
  v_duration_ms := EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)::INTEGER;
  v_result := v_result || jsonb_build_object('duration', v_duration_ms || 'ms');

  RETURN v_result;
END;
$$;

-- ============================================================================
-- Permissions (déjà existantes, juste au cas où)
-- ============================================================================
GRANT EXECUTE ON FUNCTION get_pieces_for_type_gamme_v3(INTEGER, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION get_pieces_for_type_gamme_v3(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_pieces_for_type_gamme_v3(INTEGER, INTEGER) TO service_role;

-- ============================================================================
-- Test après exécution
-- ============================================================================
-- SELECT get_pieces_for_type_gamme_v3(9045, 4);
-- SELECT get_pieces_for_type_gamme_v3(17398, 479);
-- SELECT get_pieces_for_type_gamme_v3(100413, 42);  -- Test avec pg=42

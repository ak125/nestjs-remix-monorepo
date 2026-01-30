-- ============================================================================
-- Migration: 20260128_get_pieces_for_type_gamme_v4_raw_seo.sql
-- Purpose: Fix TTFB regression (10.34s → <1s) by removing SEO processing
-- Impact: 5-7s gain by deferring SEO template processing to NestJS
-- ============================================================================

-- Problem:
-- V3 calls process_seo_template() 5 times (H1, Title, Desc, Content, Preview)
-- Each call: regexp_matches loops + 4-6 SELECT queries + 8+ regexp_replace
-- Total: ~5-7 seconds just for SEO processing

-- Solution:
-- V4 returns RAW templates without processing
-- NestJS handles processing with Redis cache (TTL 24h per gamme_id+type_id)
-- Scalable: app layer can scale horizontally

CREATE OR REPLACE FUNCTION get_pieces_for_type_gamme_v4(
  p_type_id INTEGER,
  p_pg_id INTEGER
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  -- CDN Supabase Storage
  v_cdn_base TEXT := 'https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public';
BEGIN

  -- ═══════════════════════════════════════════════════════════════════════════
  -- PARTIE 0: RÉCUPÉRER LES INFOS VÉHICULE ET GAMME (pour templates)
  -- ═══════════════════════════════════════════════════════════════════════════
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

  SELECT COALESCE(NULLIF(cg.mc_mf_prime, '')::INTEGER, 0)
  INTO v_mf_id
  FROM pieces_gamme pg
  LEFT JOIN catalog_gamme cg ON NULLIF(cg.mc_pg_id, '')::INTEGER = pg.pg_id
  WHERE pg.pg_id = p_pg_id;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- V4: SKIP SEO PROCESSING - Return raw templates + vehicle context
  -- NestJS will process with Redis cache
  -- ═══════════════════════════════════════════════════════════════════════════

  WITH
  -- 🚗 VEHICLE INFO
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
  motor_codes AS (
    SELECT COALESCE(STRING_AGG(tmc_code, ', '), '') as codes
    FROM auto_type_motor_code
    WHERE NULLIF(tmc_type_id, '')::INTEGER = p_type_id
  ),

  -- 📦 GAMME INFO
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
  -- PARTIE 3: PIÈCES (code V3)
  -- ═══════════════════════════════════════════════════════════════════════════

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

  oem_refs_with_position AS (
    SELECT
      prs.prs_ref as ref,
      REGEXP_REPLACE(
        UPPER(REPLACE(REPLACE(REPLACE(prs.prs_ref, ' ', ''), '-', ''), '.', '')),
        '^[A-Z](?=[0-9])',
        ''
      ) as ref_normalized,
      sp.filtre_gamme,
      sp.filtre_side,
      sp.is_accessory,
      CASE
        WHEN sp.is_accessory THEN 100
        WHEN sp.filtre_side = 'Avant' THEN 1
        WHEN sp.filtre_side = 'Arrière' THEN 2
        WHEN sp.filtre_side = 'Gauche' THEN 3
        WHEN sp.filtre_side = 'Droite' THEN 4
        ELSE 10
      END as group_priority,
      CASE
        WHEN prs.prs_ref ~ '^[A-Z0-9]{2,3} [0-9]{3} [0-9]{3} [A-Z0-9]{1,2}$' THEN 1
        WHEN prs.prs_ref ~ '^[A-Z0-9]{2,3} [0-9]{3} [0-9]{3}[A-Z0-9]{1,2}$' THEN 2
        WHEN prs.prs_ref ~ ' ' THEN 3
        ELSE 10
      END as format_score
    FROM pieces_ref_search prs
    INNER JOIN sorted_pieces sp ON prs.prs_piece_id = sp.id::TEXT
    INNER JOIN oem_brand ob ON prs.prs_prb_id = ob.prb_id
    WHERE prs.prs_kind = '3'
  ),

  oem_refs_unique_global AS (
    SELECT DISTINCT ON (ref_normalized)
      ref,
      ref_normalized,
      filtre_gamme,
      filtre_side,
      is_accessory
    FROM oem_refs_with_position
    ORDER BY
      ref_normalized,
      group_priority ASC,
      format_score ASC,
      LENGTH(ref) DESC
  ),

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

  oem_refs_global AS (
    SELECT DISTINCT ON (ref_normalized)
      ref
    FROM oem_refs_unique_global
    ORDER BY ref_normalized, LENGTH(ref) DESC
    LIMIT 50
  )

  -- ═══════════════════════════════════════════════════════════════════════════
  -- RÉSULTAT FINAL V4 - RAW SEO TEMPLATES (NO PROCESSING)
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

    -- ═══════════════════════════════════════════════════════════════════════════
    -- V4: RAW SEO TEMPLATES + CONTEXT (for NestJS processing with cache)
    -- ═══════════════════════════════════════════════════════════════════════════
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

    -- Context for template processing (needed by NestJS)
    'seo_context', jsonb_build_object(
      'type_id', p_type_id,
      'pg_id', p_pg_id,
      'mf_id', v_mf_id,
      'marque_name', v_marque_name,
      'marque_alias', v_marque_alias,
      'marque_id', v_marque_id,
      'modele_name', v_modele_name,
      'modele_alias', v_modele_alias,
      'modele_id', v_modele_id,
      'type_name', v_type_name,
      'type_alias', v_type_alias,
      'type_power_ps', v_type_power_ps
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
    'version', 'RPC_V4_RAW_SEO'
  ) INTO v_result;

  -- Ajouter la durée d'exécution
  v_duration_ms := EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)::INTEGER;
  v_result := v_result || jsonb_build_object('duration', v_duration_ms || 'ms');

  RETURN v_result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_pieces_for_type_gamme_v4(INTEGER, INTEGER) TO anon, authenticated, service_role;

-- ============================================================================
-- Verification:
-- SELECT get_pieces_for_type_gamme_v4(100600, 404);
-- Expected: Same data as V3 but much faster (no SEO processing)
-- ============================================================================

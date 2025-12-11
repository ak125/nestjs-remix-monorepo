-- ============================================================================
-- RPC Function: get_pieces_for_type_gamme V2 - VERSION UNIFIÉE
-- ============================================================================
-- Extension de get_pieces_for_type_gamme pour inclure TOUTES les données
-- nécessaires à une page /pieces/{gamme}/{marque}/{modele}/{type}.html
--
-- ⚡ NOUVELLES DONNÉES AJOUTÉES:
--   - vehicle_info: type, modele, marque (évite 3 requêtes séquentielles)
--   - gamme_info: pg_name, pg_alias, mf_id (évite 2 requêtes)
--   - seo_templates: h1, content, title, description BRUTS (évite 1 requête)
--   - oem_refs: références OEM filtrées par marque véhicule (évite 2 requêtes)
--   - motor_codes: codes moteur pour SEO (évite 1 requête)
--
-- RÉDUCTION ATTENDUE: ~33 requêtes → 1 RPC
-- PERFORMANCE: ~200-400ms au lieu de 2-5 secondes
--
-- Usage depuis NestJS:
--   const { data } = await this.supabase.rpc('get_pieces_for_type_gamme_v2', { 
--     p_type_id: 9045, 
--     p_pg_id: 4 
--   });
-- ============================================================================

CREATE OR REPLACE FUNCTION get_pieces_for_type_gamme_v2(
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
  -- CDN Supabase Storage (avec cache intégré)
  v_cdn_base TEXT := 'https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public';
BEGIN

  -- ═══════════════════════════════════════════════════════════════════════════
  -- PARTIE 1: DONNÉES UNIFIÉES (NOUVELLES)
  -- ═══════════════════════════════════════════════════════════════════════════
  
  WITH 
  -- 🚗 VEHICLE INFO: type + modele + marque en 1 seule requête
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
    JOIN auto_modele am ON am.modele_id = at.type_modele_id::INTEGER
    JOIN auto_marque amarq ON amarq.marque_id = am.modele_marque_id
    WHERE at.type_id::INTEGER = p_type_id
      AND at.type_display = '1'
    LIMIT 1
  ),
  
  -- 🔧 MOTOR CODES: codes moteur pour SEO
  motor_codes AS (
    SELECT COALESCE(STRING_AGG(tmc_code, ', '), '') as codes
    FROM auto_type_motor_code
    WHERE tmc_type_id::INTEGER = p_type_id
  ),
  
  -- 📦 GAMME INFO: pg_name, pg_alias, mf_id
  gamme_info AS (
    SELECT 
      pg.pg_id,
      pg.pg_name,
      pg.pg_alias,
      pg.pg_pic,
      COALESCE(cg.mc_mf_prime, '') as mf_id
    FROM pieces_gamme pg
    LEFT JOIN catalog_gamme cg ON cg.mc_pg_id::INTEGER = pg.pg_id
    WHERE pg.pg_id = p_pg_id
    LIMIT 1
  ),
  
  -- 📝 SEO TEMPLATES: templates bruts (traitement switches côté JS)
  seo_templates AS (
    SELECT 
      COALESCE(sgc_h1, '') as h1,
      COALESCE(sgc_content, '') as content,
      COALESCE(sgc_title, '') as title,
      COALESCE(sgc_descrip, '') as description,
      COALESCE(sgc_preview, '') as preview
    FROM __seo_gamme_car
    WHERE sgc_pg_id::INTEGER = p_pg_id
    LIMIT 1
  ),
  
  -- ═══════════════════════════════════════════════════════════════════════════
  -- PARTIE 2: PIÈCES (code existant optimisé)
  -- ═══════════════════════════════════════════════════════════════════════════
  
  -- 1. RELATIONS: Récupère les liens véhicule-pièce
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
  
  -- 2. Récupérer le nom de la gamme RACINE
  root_gamme AS (
    SELECT pg_id, pg_name, pg_parent
    FROM pieces_gamme
    WHERE pg_id = p_pg_id
    LIMIT 1
  ),
  
  -- 3. PIÈCES ACTIVES
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
  
  -- 4. MEILLEUR PRIX par pièce
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
  
  -- 5. PREMIÈRE IMAGE par pièce
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
  
  -- 6. TOUTES LES IMAGES par pièce
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
  
  -- 7. MARQUES (équipementiers)
  piece_brands AS (
    SELECT 
      pm_id,
      pm_name,
      pm_logo,
      pm_nb_stars
    FROM pieces_marque
    WHERE pm_id IN (SELECT DISTINCT COALESCE(rtp_pm_id, piece_pm_id::INTEGER) FROM active_pieces)
  ),
  
  -- 8. POSITIONS (side_filters)
  side_positions AS (
    SELECT 
      psf_id,
      psf_side
    FROM pieces_side_filtre
    WHERE psf_id IN (SELECT DISTINCT rtp_psf_id FROM active_pieces WHERE rtp_psf_id IS NOT NULL)
  ),
  
  -- 9. CRITÈRES de position
  criteria_positions AS (
    SELECT DISTINCT ON (pc_piece_id::INTEGER)
      pc_piece_id::INTEGER as piece_id,
      CASE 
        WHEN LOWER(pc_cri_value) LIKE '%essieu avant%' OR LOWER(pc_cri_value) = 'avant' THEN 'Avant'
        WHEN LOWER(pc_cri_value) LIKE '%essieu arrière%' OR LOWER(pc_cri_value) = 'arrière' THEN 'Arrière'
        WHEN LOWER(pc_cri_value) LIKE '%gauche%' OR LOWER(pc_cri_value) LIKE '%conducteur%' THEN 'Gauche'
        WHEN LOWER(pc_cri_value) LIKE '%droit%' OR LOWER(pc_cri_value) LIKE '%passager%' THEN 'Droite'
        ELSE NULL
      END as detected_position
    FROM pieces_criteria
    WHERE pc_piece_id::INTEGER IN (SELECT piece_id FROM active_pieces)
      AND pc_cri_id::TEXT = '100'
      AND pc_cri_value IS NOT NULL 
      AND pc_cri_value != ''
    ORDER BY pc_piece_id::INTEGER
  ),
  
  -- 10. RELATION CRITÈRES (spécifiques véhicule)
  relation_criteria_positions AS (
    SELECT DISTINCT ON (piece_id)
      rcp_piece_id::INTEGER as piece_id,
      CASE 
        WHEN LOWER(rcp_cri_value) LIKE '%essieu avant%' OR LOWER(rcp_cri_value) = 'avant' THEN 'Avant'
        WHEN LOWER(rcp_cri_value) LIKE '%essieu arrière%' OR LOWER(rcp_cri_value) = 'arrière' THEN 'Arrière'
        WHEN rcp_cri_value LIKE '%+L%' OR LOWER(rcp_cri_value) LIKE '%gauche%' THEN 'Gauche'
        WHEN rcp_cri_value LIKE '%+R%' OR LOWER(rcp_cri_value) LIKE '%droit%' THEN 'Droite'
        ELSE NULL
      END as detected_position
    FROM pieces_relation_criteria
    WHERE rcp_type_id::INTEGER = p_type_id
      AND rcp_pg_id::INTEGER = p_pg_id
      AND rcp_piece_id::INTEGER IN (SELECT piece_id FROM active_pieces)
      AND rcp_cri_value IS NOT NULL 
      AND rcp_cri_value != ''
    ORDER BY piece_id
  ),
  
  -- 11. ASSEMBLAGE des pièces
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
    LEFT JOIN piece_brands pm ON pm.pm_id = COALESCE(ap.rtp_pm_id, ap.piece_pm_id::INTEGER)
    LEFT JOIN side_positions sp ON sp.psf_id = ap.rtp_psf_id
    LEFT JOIN criteria_positions cp ON cp.piece_id = ap.piece_id
    LEFT JOIN relation_criteria_positions rcp ON rcp.piece_id = ap.piece_id
  ),
  
  -- 12. TRI des pièces
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
  
  -- 13. GROUPEMENT des pièces
  grouped AS (
    SELECT 
      filtre_gamme as group_gamme,
      filtre_side as group_side,
      is_accessory,
      CASE 
        WHEN filtre_side IS NOT NULL AND filtre_side != '' 
          THEN filtre_gamme || ' - ' || filtre_side
        ELSE filtre_gamme
      END as title_h2,
      jsonb_agg(
        jsonb_build_object(
          'id', id, 'nom', nom, 'reference', reference,
          'marque', marque, 'marque_id', marque_id, 'marque_logo', marque_logo,
          'prix_unitaire', prix_unitaire, 'prix_ttc', prix_ttc,
          'image', image, 'images', images, 'dispo', dispo, 'qualite', qualite
        ) ORDER BY prix_unitaire ASC NULLS LAST
      ) as pieces
    FROM sorted_pieces
    GROUP BY filtre_gamme, filtre_side, is_accessory
  ),
  
  -- 14. FILTRES (côté, qualité, marque)
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
  -- PARTIE 3: OEM REFS (filtrées par marque véhicule) - OPTIMISÉ AVEC INDEX
  -- Requiert: idx_prb_name_upper, idx_prs_piece_kind_prb (voir 005-create-indexes)
  -- ═══════════════════════════════════════════════════════════════════════════
  oem_brand AS (
    SELECT prb.prb_id
    FROM pieces_ref_brand prb
    INNER JOIN vehicle_info vi ON UPPER(prb.prb_name) = UPPER(vi.marque_name)
    LIMIT 1
  ),
  -- Utilise JOIN au lieu de IN (SELECT...) pour profiter des index
  oem_refs AS (
    SELECT DISTINCT prs.prs_ref as ref
    FROM pieces_ref_search prs
    INNER JOIN active_pieces ap ON prs.prs_piece_id = ap.piece_id::TEXT
    INNER JOIN oem_brand ob ON prs.prs_prb_id = ob.prb_id
    WHERE prs.prs_kind = '3'
    LIMIT 50  -- 50 refs suffisent pour SEO, réduit de 200
  )
  
  -- ═══════════════════════════════════════════════════════════════════════════
  -- RÉSULTAT FINAL UNIFIÉ
  -- ═══════════════════════════════════════════════════════════════════════════
  SELECT jsonb_build_object(
    -- 🚗 NOUVELLES DONNÉES UNIFIÉES
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
    'seo_templates', (
      SELECT jsonb_build_object(
        'h1', h1,
        'content', content,
        'title', title,
        'description', description,
        'preview', preview
      )
      FROM seo_templates
    ),
    'oem_refs', COALESCE((SELECT jsonb_agg(ref) FROM oem_refs), '[]'::jsonb),
    
    -- 📦 DONNÉES PIÈCES EXISTANTES
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
          'pieces', pieces
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
          'title_h2', title_h2, 'pieces', pieces
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
    'version', 'RPC_V2_UNIFIED'
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
GRANT EXECUTE ON FUNCTION get_pieces_for_type_gamme_v2(INTEGER, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION get_pieces_for_type_gamme_v2(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_pieces_for_type_gamme_v2(INTEGER, INTEGER) TO service_role;

-- ============================================================================
-- Documentation
-- ============================================================================
COMMENT ON FUNCTION get_pieces_for_type_gamme_v2 IS 
'⚡ RPC V2 UNIFIÉE - Toutes les données pour une page /pieces/{gamme}/{marque}/{modele}/{type}.html en 1 appel.

NOUVELLES DONNÉES:
- vehicle_info: type, modele, marque avec alias et images
- gamme_info: pg_name, pg_alias, mf_id pour SEO switches
- seo_templates: h1, content, title, description BRUTS (switches traités côté JS)
- oem_refs: références OEM filtrées par marque du véhicule

RÉDUCTION: ~33 requêtes → 1 RPC
PERFORMANCE: ~200-400ms au lieu de 2-5 secondes

Usage: supabase.rpc("get_pieces_for_type_gamme_v2", { p_type_id: 9045, p_pg_id: 4 })';

-- ============================================================================
-- Test
-- ============================================================================
-- SELECT get_pieces_for_type_gamme_v2(9045, 4);

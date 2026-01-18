-- ============================================================================
-- MIGRATION: Create rm_get_page_complete_v2 RPC
-- ============================================================================
-- Unified RPC that returns ALL data for a product listing page
-- Combines the best of:
-- - get_pieces_for_type_gamme_v3 (SEO, OEM, grouping)
-- - get_listing_products_for_build (quality scoring, stock status)
-- Plus NEW features:
-- - crossSelling (related gammes)
-- - validation/dataQuality
-- - filters with counts
-- - mineCodes/cnitCodes
--
-- Date: 2026-01-18
-- Version: v2.0.0
-- Performance target: ~400ms (single RPC, all data)
-- ============================================================================

CREATE OR REPLACE FUNCTION rm_get_page_complete_v2(
    p_gamme_id INT,
    p_vehicle_id BIGINT,
    p_limit INT DEFAULT 200
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_start TIMESTAMPTZ := clock_timestamp();
    v_result JSONB;
    v_duration_ms INTEGER;

    -- Vehicle context
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

    -- SEO processed
    v_seo_h1 TEXT;
    v_seo_title TEXT;
    v_seo_description TEXT;
    v_seo_content TEXT;
    v_seo_preview TEXT;

    -- CDN base
    v_cdn_base TEXT := 'https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public';
BEGIN
    -- =========================================================================
    -- INPUT VALIDATION
    -- =========================================================================
    IF p_gamme_id IS NULL OR p_vehicle_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', jsonb_build_object(
                'code', 'INVALID_PARAMS',
                'message', 'gamme_id and vehicle_id are required'
            )
        );
    END IF;

    IF p_limit IS NULL OR p_limit < 1 THEN
        p_limit := 200;
    ELSIF p_limit > 500 THEN
        p_limit := 500;
    END IF;

    -- =========================================================================
    -- PARTIE 0: RÉCUPÉRER CONTEXTE VÉHICULE (pour SEO)
    -- =========================================================================
    SELECT
        amarq.marque_name, amarq.marque_alias, amarq.marque_id,
        am.modele_name, am.modele_alias, am.modele_id,
        at.type_name, at.type_alias, at.type_power_ps
    INTO
        v_marque_name, v_marque_alias, v_marque_id,
        v_modele_name, v_modele_alias, v_modele_id,
        v_type_name, v_type_alias, v_type_power_ps
    FROM auto_type at
    JOIN auto_modele am ON am.modele_id = at.type_modele_id::INTEGER
    JOIN auto_marque amarq ON amarq.marque_id = am.modele_marque_id
    WHERE at.type_id::INTEGER = p_vehicle_id::INTEGER
      AND at.type_display = '1'
    LIMIT 1;

    -- Vérifier que le véhicule existe
    IF v_marque_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', jsonb_build_object(
                'code', 'VEHICLE_NOT_FOUND',
                'message', 'Vehicle not found for id=' || p_vehicle_id
            )
        );
    END IF;

    -- Récupérer mf_id pour les switches famille
    SELECT COALESCE(NULLIF(cg.mc_mf_prime, ''), '0')::INTEGER
    INTO v_mf_id
    FROM pieces_gamme pg
    LEFT JOIN catalog_gamme cg ON cg.mc_pg_id::INTEGER = pg.pg_id
    WHERE pg.pg_id = p_gamme_id;

    IF v_mf_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', jsonb_build_object(
                'code', 'GAMME_NOT_FOUND',
                'message', 'Gamme not found for id=' || p_gamme_id
            )
        );
    END IF;

    -- =========================================================================
    -- PARTIE 1: TRAITER LES TEMPLATES SEO
    -- =========================================================================
    SELECT
        process_seo_template(
            COALESCE(sgc_h1, ''),
            p_vehicle_id::INTEGER, p_gamme_id, v_mf_id,
            v_marque_name, v_marque_alias, v_marque_id,
            v_modele_name, v_modele_alias, v_modele_id,
            v_type_name, v_type_alias, v_type_power_ps
        ),
        process_seo_template(
            COALESCE(sgc_title, ''),
            p_vehicle_id::INTEGER, p_gamme_id, v_mf_id,
            v_marque_name, v_marque_alias, v_marque_id,
            v_modele_name, v_modele_alias, v_modele_id,
            v_type_name, v_type_alias, v_type_power_ps
        ),
        process_seo_template(
            COALESCE(sgc_descrip, ''),
            p_vehicle_id::INTEGER, p_gamme_id, v_mf_id,
            v_marque_name, v_marque_alias, v_marque_id,
            v_modele_name, v_modele_alias, v_modele_id,
            v_type_name, v_type_alias, v_type_power_ps
        ),
        process_seo_template(
            COALESCE(sgc_content, ''),
            p_vehicle_id::INTEGER, p_gamme_id, v_mf_id,
            v_marque_name, v_marque_alias, v_marque_id,
            v_modele_name, v_modele_alias, v_modele_id,
            v_type_name, v_type_alias, v_type_power_ps
        ),
        process_seo_template(
            COALESCE(sgc_preview, ''),
            p_vehicle_id::INTEGER, p_gamme_id, v_mf_id,
            v_marque_name, v_marque_alias, v_marque_id,
            v_modele_name, v_modele_alias, v_modele_id,
            v_type_name, v_type_alias, v_type_power_ps
        )
    INTO v_seo_h1, v_seo_title, v_seo_description, v_seo_content, v_seo_preview
    FROM __seo_gamme_car
    WHERE sgc_pg_id::INTEGER = p_gamme_id
    LIMIT 1;

    -- =========================================================================
    -- PARTIE 2: DONNÉES PRINCIPALES (CTEs)
    -- =========================================================================
    WITH
    -- 🚗 VEHICLE INFO COMPLET
    vehicle_info AS (
        SELECT
            at.type_id::INTEGER as type_id,
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
        WHERE at.type_id::INTEGER = p_vehicle_id::INTEGER
          AND at.type_display = '1'
        LIMIT 1
    ),

    -- 🔧 MOTOR CODES
    motor_codes AS (
        SELECT COALESCE(STRING_AGG(tmc_code, ', '), '') as codes
        FROM auto_type_motor_code
        WHERE tmc_type_id::INTEGER = p_vehicle_id::INTEGER
    ),

    -- 🔧 CNIT/MINE CODES (from auto_type_number_code)
    number_codes AS (
        SELECT
            COALESCE(STRING_AGG(DISTINCT tnc_code, ', ') FILTER (WHERE tnc_code IS NOT NULL AND tnc_code != ''), '') as mine_codes,
            COALESCE(STRING_AGG(DISTINCT tnc_cnit, ', ') FILTER (WHERE tnc_cnit IS NOT NULL AND tnc_cnit != ''), '') as cnit_codes
        FROM auto_type_number_code
        WHERE tnc_type_id::INTEGER = p_vehicle_id::INTEGER
    ),

    -- 📦 GAMME INFO
    gamme_info AS (
        SELECT
            pg.pg_id,
            pg.pg_name,
            pg.pg_alias,
            pg.pg_pic,
            pg.pg_ppa_id,
            pg.pg_parent,
            COALESCE(cg.mc_mf_prime, '') as mf_id
        FROM pieces_gamme pg
        LEFT JOIN catalog_gamme cg ON cg.mc_pg_id::INTEGER = pg.pg_id
        WHERE pg.pg_id = p_gamme_id
        LIMIT 1
    ),

    -- =========================================================================
    -- PARTIE 3: PIÈCES AVEC SCORING RM
    -- =========================================================================

    -- Relations véhicule-pièces (sans LIMIT pour avoir toutes les pièces)
    relations AS (
        SELECT DISTINCT
            rtp_piece_id::INTEGER as rtp_piece_id,
            rtp_psf_id::INTEGER as rtp_psf_id,
            rtp_pm_id::INTEGER as rtp_pm_id
        FROM pieces_relation_type
        WHERE rtp_type_id::INTEGER = p_vehicle_id::INTEGER
          AND rtp_pg_id::INTEGER = p_gamme_id
    ),

    root_gamme AS (
        SELECT pg_id, pg_name, pg_parent
        FROM pieces_gamme
        WHERE pg_id = p_gamme_id
        LIMIT 1
    ),

    -- Pièces actives avec infos de base
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

    -- Meilleurs prix par pièce (SANS filtre stock comme v1.5.0)
    best_prices AS (
        SELECT DISTINCT ON (NULLIF(pri_piece_id, '')::INTEGER)
            NULLIF(pri_piece_id, '')::INTEGER as pri_piece_id,
            COALESCE(ROUND(NULLIF(TRIM(pri_vente_ttc), '')::NUMERIC)::INT, 0) as pri_vente_ttc,
            COALESCE(ROUND(NULLIF(TRIM(pri_consigne_ttc), '')::NUMERIC)::INT, 0) as pri_consigne_ttc,
            pri_type,
            pri_dispo
        FROM pieces_price
        WHERE NULLIF(pri_piece_id, '')::INTEGER IN (SELECT piece_id FROM active_pieces)
        ORDER BY NULLIF(pri_piece_id, '')::INTEGER,
                 CASE pri_dispo WHEN '1' THEN 1 WHEN '2' THEN 2 WHEN '3' THEN 3 ELSE 4 END,
                 ROUND(NULLIF(TRIM(pri_vente_ttc), '')::NUMERIC)::INT ASC NULLS LAST
    ),

    -- Première image par pièce
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

    -- Marques de pièces
    piece_brands AS (
        SELECT
            pm_id, pm_name, pm_logo, pm_nb_stars, pm_oes, pm_quality
        FROM pieces_marque
        WHERE pm_id IN (SELECT DISTINCT COALESCE(rtp_pm_id, piece_pm_id::INTEGER) FROM active_pieces)
    ),

    -- Positions depuis pieces_side_filtre
    side_positions AS (
        SELECT psf_id, psf_side
        FROM pieces_side_filtre
        WHERE psf_id IN (SELECT DISTINCT rtp_psf_id FROM active_pieces WHERE rtp_psf_id IS NOT NULL)
    ),

    -- Positions depuis pieces_criteria
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
          AND pc_cri_value IS NOT NULL AND pc_cri_value != ''
        ORDER BY pc_piece_id::INTEGER
    ),

    -- Positions depuis pieces_relation_criteria
    relation_criteria_positions AS (
        SELECT DISTINCT ON (rcp_piece_id::INTEGER)
            rcp_piece_id::INTEGER as piece_id,
            CASE
                WHEN LOWER(rcp_cri_value) LIKE '%essieu avant%' OR LOWER(rcp_cri_value) = 'avant' THEN 'Avant'
                WHEN LOWER(rcp_cri_value) LIKE '%essieu arrière%' OR LOWER(rcp_cri_value) = 'arrière' THEN 'Arrière'
                WHEN rcp_cri_value LIKE '%+L%' OR LOWER(rcp_cri_value) LIKE '%gauche%' THEN 'Gauche'
                WHEN rcp_cri_value LIKE '%+R%' OR LOWER(rcp_cri_value) LIKE '%droit%' THEN 'Droite'
                ELSE NULL
            END as detected_position
        FROM pieces_relation_criteria
        WHERE rcp_type_id::INTEGER = p_vehicle_id::INTEGER
          AND rcp_pg_id::INTEGER = p_gamme_id
          AND rcp_piece_id::INTEGER IN (SELECT piece_id FROM active_pieces)
          AND rcp_cri_value IS NOT NULL AND rcp_cri_value != ''
        ORDER BY rcp_piece_id::INTEGER
    ),

    -- Assemblage des pièces avec SCORING RM
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
            -- Prix
            COALESCE(bp.pri_vente_ttc, 0) as prix_unitaire,
            (COALESCE(bp.pri_vente_ttc, 0) * COALESCE(ap.piece_qty_sale, 1))::NUMERIC as prix_ttc,
            COALESCE(bp.pri_consigne_ttc, 0) as prix_consigne,
            -- Stock status RM
            CASE
                WHEN bp.pri_dispo = '1' THEN 'IN_STOCK'
                WHEN bp.pri_dispo = '2' THEN 'LOW_STOCK'
                WHEN bp.pri_dispo = '3' THEN 'PREORDER'
                ELSE 'OUT_OF_STOCK'
            END as stock_status,
            bp.pri_dispo = '1' OR bp.pri_dispo = '2' as dispo,
            -- Quality RM (OE/EQUIV/ECO)
            CASE
                WHEN pm.pm_oes = '1' OR pm.pm_nb_stars = '6' OR pm.pm_quality = 'OE' THEN 'OE'
                WHEN COALESCE(NULLIF(pm.pm_nb_stars, '')::INTEGER, 0) >= 3 THEN 'EQUIV'
                ELSE 'ECO'
            END as quality,
            -- Score RM
            CASE
                WHEN pm.pm_oes = '1' OR pm.pm_nb_stars = '6' OR pm.pm_quality = 'OE' THEN 100
                WHEN COALESCE(NULLIF(pm.pm_nb_stars, '')::INTEGER, 0) >= 3 THEN 50
                ELSE 25
            END
            + CASE WHEN bp.pri_dispo = '1' THEN 10 WHEN bp.pri_dispo = '2' THEN 5 ELSE 0 END
            + CASE WHEN ap.piece_has_img THEN 5 ELSE 0 END
            - CASE WHEN COALESCE(bp.pri_vente_ttc, 0) > 50000 THEN 5 ELSE 0 END
            as score,
            -- Image
            CASE WHEN fi.pmi_folder IS NOT NULL AND fi.pmi_name IS NOT NULL
                THEN v_cdn_base || '/rack-images/' || fi.pmi_folder || '/' || fi.pmi_name_with_ext
                ELSE v_cdn_base || '/uploads/articles/no.png'
            END as image,
            -- Position (4 fallbacks + detection)
            COALESCE(
                rcp.detected_position,
                cp.detected_position,
                sp.psf_side,
                ap.piece_name_side,
                CASE
                    WHEN LOWER(ap.piece_name) ~ '(avant|front)' THEN 'Avant'
                    WHEN LOWER(ap.piece_name) ~ '(arrière|arriere|rear)' THEN 'Arrière'
                    WHEN LOWER(ap.piece_name) ~ '(gauche|left)' THEN 'Gauche'
                    WHEN LOWER(ap.piece_name) ~ '(droit|right)' THEN 'Droite'
                    ELSE NULL
                END
            ) as filtre_side
        FROM active_pieces ap
        LEFT JOIN best_prices bp ON bp.pri_piece_id = ap.piece_id
        LEFT JOIN first_images fi ON fi.piece_id_text = ap.piece_id::TEXT
        LEFT JOIN piece_brands pm ON pm.pm_id = COALESCE(ap.rtp_pm_id, ap.piece_pm_id::INTEGER)
        LEFT JOIN side_positions sp ON sp.psf_id = ap.rtp_psf_id
        LEFT JOIN criteria_positions cp ON cp.piece_id = ap.piece_id
        LEFT JOIN relation_criteria_positions rcp ON rcp.piece_id = ap.piece_id
    ),

    -- Pièces triées par score RM puis prix
    sorted_pieces AS (
        SELECT * FROM assembled_pieces
        ORDER BY
            CASE WHEN is_accessory THEN 1 ELSE 0 END,
            score DESC,
            CASE filtre_side
                WHEN 'Avant' THEN 1
                WHEN 'Arrière' THEN 2
                WHEN 'Gauche' THEN 3
                WHEN 'Droite' THEN 4
                ELSE 5
            END,
            prix_unitaire ASC NULLS LAST
        LIMIT p_limit
    ),

    -- =========================================================================
    -- PARTIE 4: OEM REFS (normalisation stricte)
    -- =========================================================================

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
                '^[A-Z](?=[0-9])', ''
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
            END as group_priority
        FROM pieces_ref_search prs
        INNER JOIN sorted_pieces sp ON prs.prs_piece_id = sp.id::TEXT
        INNER JOIN oem_brand ob ON prs.prs_prb_id = ob.prb_id
        WHERE prs.prs_kind = '3'
    ),

    oem_refs_unique_global AS (
        SELECT DISTINCT ON (ref_normalized)
            ref, ref_normalized, filtre_gamme, filtre_side, is_accessory
        FROM oem_refs_with_position
        ORDER BY ref_normalized, group_priority ASC, LENGTH(ref) DESC
    ),

    oem_refs_by_group AS (
        SELECT
            filtre_gamme, filtre_side, is_accessory,
            jsonb_agg(ref ORDER BY ref) as oem_refs,
            COUNT(*)::INTEGER as oem_refs_count
        FROM oem_refs_unique_global
        GROUP BY filtre_gamme, filtre_side, is_accessory
    ),

    oem_refs_global AS (
        SELECT ref FROM oem_refs_unique_global
        ORDER BY LENGTH(ref) DESC
        LIMIT 50
    ),

    -- =========================================================================
    -- PARTIE 5: GROUPED PIECES
    -- =========================================================================

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
                    'id', sp.id,
                    'nom', sp.nom,
                    'reference', sp.reference,
                    'marque', sp.marque,
                    'marque_id', sp.marque_id,
                    'prix_unitaire', sp.prix_unitaire,
                    'prix_ttc', sp.prix_ttc,
                    'image', sp.image,
                    'dispo', sp.dispo,
                    'quality', sp.quality,
                    'stock_status', sp.stock_status,
                    'score', sp.score
                ) ORDER BY sp.score DESC, sp.prix_unitaire ASC NULLS LAST
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

    -- =========================================================================
    -- PARTIE 6: FILTERS AVEC COUNTS
    -- =========================================================================

    brand_counts AS (
        SELECT marque_id, marque, COUNT(*)::INTEGER as cnt
        FROM sorted_pieces
        WHERE marque_id IS NOT NULL
        GROUP BY marque_id, marque
    ),

    quality_counts AS (
        SELECT quality, COUNT(*)::INTEGER as cnt
        FROM sorted_pieces
        GROUP BY quality
    ),

    side_counts AS (
        SELECT filtre_side as side, COUNT(*)::INTEGER as cnt
        FROM sorted_pieces
        WHERE filtre_side IS NOT NULL AND filtre_side != ''
        GROUP BY filtre_side
    ),

    -- =========================================================================
    -- PARTIE 7: CROSS-SELLING (gammes liées)
    -- =========================================================================

    cross_selling AS (
        SELECT
            pg.pg_id,
            pg.pg_name,
            pg.pg_alias,
            pg.pg_pic
        FROM pieces_gamme pg
        WHERE pg.pg_parent = (SELECT pg_parent FROM gamme_info)
          AND pg.pg_id != p_gamme_id
          AND pg.pg_display = '1'
          AND EXISTS (
              SELECT 1 FROM pieces_relation_type
              WHERE rtp_pg_id = pg.pg_id AND rtp_type_id = p_vehicle_id::INTEGER
          )
        LIMIT 6
    ),

    -- =========================================================================
    -- PARTIE 8: VALIDATION & DATA QUALITY
    -- =========================================================================

    data_quality AS (
        SELECT
            COUNT(*)::INTEGER as total,
            COUNT(*) FILTER (WHERE marque IS NOT NULL AND marque != 'Marque inconnue')::INTEGER as with_brand,
            COUNT(*) FILTER (WHERE has_image)::INTEGER as with_image,
            COUNT(*) FILTER (WHERE prix_unitaire > 0)::INTEGER as with_price
        FROM sorted_pieces
    )

    -- =========================================================================
    -- RÉSULTAT FINAL
    -- =========================================================================
    SELECT jsonb_build_object(
        'success', true,

        -- 📦 PRODUCTS (format RM avec scoring)
        'products', COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'piece_id', id,
                    'piece_reference', reference,
                    'piece_name', nom,
                    'pm_id', marque_id,
                    'pm_name', marque,
                    'price_ttc', prix_unitaire,
                    'quality', quality,
                    'stock_status', stock_status,
                    'piece_position', filtre_side,
                    'score', score,
                    'has_image', has_image,
                    -- Extra fields for frontend
                    'image', image,
                    'filtre_gamme', filtre_gamme,
                    'is_accessory', is_accessory
                )
            ) FROM sorted_pieces
        ), '[]'::jsonb),

        'count', (SELECT COUNT(*)::INTEGER FROM sorted_pieces),
        'minPrice', (SELECT MIN(prix_unitaire) FROM sorted_pieces WHERE prix_unitaire > 0),

        -- 📊 GROUPED PIECES (avec OEM par groupe)
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
            ) FROM grouped
        ), '[]'::jsonb),

        -- 🚗 VEHICLE INFO COMPLET
        'vehicleInfo', (
            SELECT jsonb_build_object(
                'typeId', type_id,
                'typeName', type_name,
                'typeAlias', type_alias,
                'typePowerPs', type_power_ps,
                'typePowerKw', type_power_kw,
                'typeYearFrom', type_year_from,
                'typeYearTo', type_year_to,
                'typeBody', type_body,
                'typeFuel', type_fuel,
                'typeEngine', type_engine,
                'typeLiter', type_liter,
                'modeleId', modele_id,
                'modeleName', modele_name,
                'modeleAlias', modele_alias,
                'modelePic', modele_pic,
                'marqueId', marque_id,
                'marqueName', marque_name,
                'marqueAlias', marque_alias,
                'marqueLogo', marque_logo,
                'motorCodesFormatted', (SELECT codes FROM motor_codes),
                'mineCodesFormatted', (SELECT mine_codes FROM number_codes),
                'cnitCodesFormatted', (SELECT cnit_codes FROM number_codes)
            ) FROM vehicle_info
        ),

        -- 📦 GAMME INFO
        'gamme', (
            SELECT jsonb_build_object(
                'pg_id', pg_id,
                'pg_name', pg_name,
                'pg_alias', pg_alias,
                'pg_pic', pg_pic,
                'pg_ppa_id', pg_ppa_id,
                'pg_parent', pg_parent
            ) FROM gamme_info
        ),

        -- 🎯 SEO PROCESSÉ
        'seo', jsonb_build_object(
            'h1', COALESCE(v_seo_h1, ''),
            'title', COALESCE(v_seo_title, ''),
            'description', COALESCE(v_seo_description, ''),
            'content', COALESCE(v_seo_content, ''),
            'preview', COALESCE(v_seo_preview, '')
        ),

        -- 🔧 OEM REFS
        'oemRefs', COALESCE((SELECT jsonb_agg(ref) FROM oem_refs_global), '[]'::jsonb),

        -- 🛒 CROSS-SELLING
        'crossSelling', COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'PG_ID', pg_id,
                    'PG_NAME', pg_name,
                    'PG_ALIAS', pg_alias,
                    'PG_IMAGE', pg_pic
                )
            ) FROM cross_selling
        ), '[]'::jsonb),

        -- 📊 FILTERS AVEC COUNTS
        'filters', jsonb_build_object(
            'brands', COALESCE((
                SELECT jsonb_agg(
                    jsonb_build_object('pm_id', marque_id, 'pm_name', marque, 'count', cnt)
                    ORDER BY cnt DESC
                ) FROM brand_counts
            ), '[]'::jsonb),
            'qualities', COALESCE((
                SELECT jsonb_agg(
                    jsonb_build_object('value', quality, 'count', cnt)
                    ORDER BY CASE quality WHEN 'OE' THEN 1 WHEN 'EQUIV' THEN 2 ELSE 3 END
                ) FROM quality_counts
            ), '[]'::jsonb),
            'sides', COALESCE((
                SELECT jsonb_agg(
                    jsonb_build_object('value', side, 'count', cnt)
                    ORDER BY CASE side WHEN 'Avant' THEN 1 WHEN 'Arrière' THEN 2
                        WHEN 'Gauche' THEN 3 WHEN 'Droite' THEN 4 ELSE 5 END
                ) FROM side_counts
            ), '[]'::jsonb),
            'price_range', jsonb_build_object(
                'min', (SELECT MIN(prix_unitaire) FROM sorted_pieces WHERE prix_unitaire > 0),
                'max', (SELECT MAX(prix_unitaire) FROM sorted_pieces)
            )
        ),

        -- ✅ VALIDATION
        'validation', (
            SELECT jsonb_build_object(
                'valid', total > 0,
                'relationsCount', total,
                'dataQuality', jsonb_build_object(
                    'quality', CASE WHEN total > 0 THEN
                        GREATEST(0, LEAST(100,
                            100
                            - (100 - (with_brand::NUMERIC / NULLIF(total, 0) * 100)) * 0.5
                            - (100 - (with_image::NUMERIC / NULLIF(total, 0) * 100)) * 0.3
                            - (100 - (with_price::NUMERIC / NULLIF(total, 0) * 100)) * 0.2
                        ))::INTEGER
                    ELSE 0 END,
                    'pieces_with_brand_percent', CASE WHEN total > 0 THEN (with_brand::NUMERIC / total * 100)::INTEGER ELSE 0 END,
                    'pieces_with_image_percent', CASE WHEN total > 0 THEN (with_image::NUMERIC / total * 100)::INTEGER ELSE 0 END,
                    'pieces_with_price_percent', CASE WHEN total > 0 THEN (with_price::NUMERIC / total * 100)::INTEGER ELSE 0 END
                )
            ) FROM data_quality
        )
    ) INTO v_result;

    -- Ajouter durée d'exécution
    v_duration_ms := EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start)::INTEGER;
    v_result := v_result || jsonb_build_object('duration_ms', v_duration_ms);

    RETURN v_result;

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', jsonb_build_object(
            'code', 'INTERNAL_ERROR',
            'message', SQLERRM
        ),
        'duration_ms', EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start)::INTEGER
    );
END;
$$;

-- ============================================================================
-- Permissions
-- ============================================================================
GRANT EXECUTE ON FUNCTION rm_get_page_complete_v2 TO service_role;

-- ============================================================================
-- Documentation
-- ============================================================================
COMMENT ON FUNCTION rm_get_page_complete_v2 IS
'v2.0.0: Complete RM Page Data RPC - CQRS Read Model

Unified RPC combining:
- get_pieces_for_type_gamme_v3 (SEO, OEM, grouping)
- get_listing_products_for_build (quality scoring, stock status)

NEW features in v2:
- crossSelling: Related gammes
- validation/dataQuality: Quality metrics
- filters with counts: Brand/quality/side counts
- motorCodes/mineCodes/cnitCodes: Vehicle codes

Parameters:
  - p_gamme_id: Product family ID (pieces_gamme.pg_id)
  - p_vehicle_id: Vehicle type ID (auto_type.type_id)
  - p_limit: Max products to return (default 200, max 500)

Response includes:
  - products: RM-scored products (OE/EQUIV/ECO, IN_STOCK/etc.)
  - grouped_pieces: Products grouped by gamme+side with OEM refs
  - vehicleInfo: Complete vehicle info with motorCodes
  - gamme: Gamme info
  - seo: Fully processed SEO (h1, title, description, content)
  - oemRefs: Normalized OEM references (global list)
  - crossSelling: Related gammes
  - filters: Brands/qualities/sides with counts
  - validation: Data quality metrics

Performance: ~400ms target (single RPC, all data)
Cache: Use Redis with TTL 3600s for production';

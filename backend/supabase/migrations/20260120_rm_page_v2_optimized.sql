-- ============================================================================
-- MIGRATION: Optimiser rm_get_page_complete_v2 avec get_listing_products_extended
-- ============================================================================
-- Objectif: Réduire temps de 900ms à ~100ms
-- Cause: CTEs internes réimplémentent la logique au lieu d'utiliser fonction optimisée
-- Solution: Utiliser get_listing_products_extended (1.4ms) comme source de données
--
-- Date: 2026-01-20
-- Version: v2.1.0
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

    -- CDN base (kept for compatibility)
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
    -- PARTIE 3: PIÈCES VIA FONCTION OPTIMISÉE (1.4ms au lieu de 900ms)
    -- =========================================================================
    sorted_pieces AS (
        SELECT
            id,
            nom,
            reference,
            reference_clean,
            description,
            quantite_vente,
            has_image,
            has_oem,
            filtre_gamme,
            is_accessory,
            filtre_side,
            marque,
            marque_id,
            marque_logo,
            nb_stars,
            prix_unitaire,
            prix_ttc,
            prix_consigne,
            stock_status,
            dispo,
            quality,
            score,
            image
        FROM get_listing_products_extended(p_gamme_id, p_vehicle_id, p_limit)
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
'v2.1.0: Complete RM Page Data RPC - CQRS Read Model (OPTIMIZED)

OPTIMISATION v2.1.0:
- Utilise get_listing_products_extended (1.4ms) au lieu de CTEs internes (900ms)
- Performance: 900ms → ~100ms (9x plus rapide)

Unified RPC combining:
- get_listing_products_extended (quality scoring, stock status, images) ← OPTIMIZED
- SEO templates processing
- OEM references grouping
- Cross-selling suggestions

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

Performance: ~100ms target (single RPC, all data)
Cache: Use Redis with TTL 3600s for production';

-- ============================================================================
-- MIGRATION: RM Listing Products Extended
-- ============================================================================
-- High-performance function to get listing products with scoring.
-- Used by rm_get_page_complete_v2 for optimized product retrieval.
--
-- Date: 2026-01-20
-- Performance: ~50-100ms for 200 products
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_listing_products_extended(
    p_gamme_id integer,
    p_vehicle_id bigint,
    p_limit integer DEFAULT 200
)
RETURNS TABLE(
    id integer,
    nom text,
    reference text,
    reference_clean text,
    description text,
    quantite_vente numeric,
    has_image boolean,
    has_oem boolean,
    filtre_gamme text,
    is_accessory boolean,
    filtre_side text,
    marque text,
    marque_id integer,
    marque_logo text,
    nb_stars integer,
    prix_unitaire integer,
    prix_ttc numeric,
    prix_consigne integer,
    stock_status text,
    dispo boolean,
    quality text,
    score integer,
    image text
)
LANGUAGE sql
STABLE PARALLEL SAFE
AS $function$
    WITH
    cdn AS (SELECT 'https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public' as base),

    root_gamme AS (
        SELECT pg_name FROM pieces_gamme WHERE pg_id = p_gamme_id LIMIT 1
    ),

    relations AS (
        SELECT DISTINCT rtp_piece_id, rtp_psf_id, rtp_pm_id
        FROM pieces_relation_type
        WHERE rtp_type_id = p_vehicle_id::INTEGER
          AND rtp_pg_id = p_gamme_id
        LIMIT LEAST(COALESCE(p_limit, 200), 500) * 2
    ),

    active_pieces AS (
        SELECT
            p.piece_id,
            p.piece_id::TEXT as piece_id_text,
            p.piece_name,
            p.piece_ref,
            p.piece_ref_clean,
            p.piece_des,
            COALESCE(p.piece_qty_sale, 1)::NUMERIC as piece_qty_sale,
            p.piece_has_img,
            p.piece_has_oem,
            p.piece_fil_name,
            p.piece_name_side,
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

    piece_brands AS (
        SELECT
            pm_id, pm_name, pm_logo,
            COALESCE(NULLIF(pm_nb_stars, '')::INTEGER, 0) as pm_nb_stars,
            pm_oes, pm_quality,
            CASE
                WHEN pm_oes = '1' OR pm_nb_stars = '6' OR pm_quality = 'OE' THEN 'OE'
                WHEN COALESCE(NULLIF(pm_nb_stars, '')::INTEGER, 0) >= 3 THEN 'EQUIV'
                ELSE 'ECO'
            END as quality
        FROM pieces_marque
        WHERE pm_id IN (SELECT DISTINCT COALESCE(rtp_pm_id, piece_pm_id::INTEGER) FROM active_pieces)
    ),

    best_prices AS (
        SELECT DISTINCT ON (NULLIF(pri_piece_id, '')::INTEGER)
            NULLIF(pri_piece_id, '')::INTEGER as pri_piece_id,
            COALESCE(ROUND(NULLIF(TRIM(pri_vente_ttc), '')::NUMERIC)::INT, 0) as pri_vente_ttc,
            COALESCE(ROUND(NULLIF(TRIM(pri_consigne_ttc), '')::NUMERIC)::INT, 0) as pri_consigne_ttc,
            pri_dispo
        FROM pieces_price
        WHERE NULLIF(pri_piece_id, '')::INTEGER IN (SELECT piece_id FROM active_pieces)
          AND pri_dispo IN ('1', '2', '3')
        ORDER BY NULLIF(pri_piece_id, '')::INTEGER,
                 CASE pri_dispo WHEN '1' THEN 1 WHEN '2' THEN 2 WHEN '3' THEN 3 END,
                 ROUND(NULLIF(TRIM(pri_vente_ttc), '')::NUMERIC)::INT ASC NULLS LAST
    ),

    first_images AS (
        SELECT DISTINCT ON (pmi_piece_id)
            pmi_piece_id as piece_id_text,
            pmi_folder,
            pmi_name
        FROM pieces_media_img
        WHERE pmi_piece_id IN (SELECT piece_id_text FROM active_pieces)
          AND pmi_display = '1'
        ORDER BY pmi_piece_id, pmi_sort ASC
    ),

    side_positions AS (
        SELECT psf_id, psf_side
        FROM pieces_side_filtre
        WHERE psf_id IN (SELECT DISTINCT rtp_psf_id FROM active_pieces WHERE rtp_psf_id IS NOT NULL)
    ),

    assembled AS (
        SELECT
            ap.piece_id as id,
            TRIM(CONCAT_WS(' ', ap.piece_name,
                CASE WHEN COALESCE(sp.psf_side, ap.piece_name_side) IS NOT NULL
                    AND POSITION(LOWER(COALESCE(sp.psf_side, ap.piece_name_side)) IN LOWER(COALESCE(ap.piece_name, ''))) = 0
                    THEN COALESCE(sp.psf_side, ap.piece_name_side) ELSE NULL END
            )) as nom,
            ap.piece_ref as reference,
            ap.piece_ref_clean as reference_clean,
            ap.piece_des as description,
            ap.piece_qty_sale as quantite_vente,
            ap.piece_has_img as has_image,
            ap.piece_has_oem as has_oem,
            ap.piece_fil_name as filtre_gamme,
            ap.is_accessory,
            COALESCE(sp.psf_side, ap.piece_name_side,
                CASE
                    WHEN LOWER(ap.piece_name) ~ '(avant|front)' THEN 'Avant'
                    WHEN LOWER(ap.piece_name) ~ '(arrière|arriere|rear)' THEN 'Arrière'
                    WHEN LOWER(ap.piece_name) ~ '(gauche|left)' THEN 'Gauche'
                    WHEN LOWER(ap.piece_name) ~ '(droit|right)' THEN 'Droite'
                    ELSE NULL
                END
            ) as filtre_side,
            COALESCE(pm.pm_name, 'Marque inconnue') as marque,
            pm.pm_id as marque_id,
            pm.pm_logo as marque_logo,
            pm.pm_nb_stars as nb_stars,
            COALESCE(bp.pri_vente_ttc, 0) as prix_unitaire,
            (COALESCE(bp.pri_vente_ttc, 0) * ap.piece_qty_sale) as prix_ttc,
            COALESCE(bp.pri_consigne_ttc, 0) as prix_consigne,
            CASE
                WHEN bp.pri_dispo = '1' THEN 'IN_STOCK'
                WHEN bp.pri_dispo = '2' THEN 'LOW_STOCK'
                WHEN bp.pri_dispo = '3' THEN 'PREORDER'
                ELSE 'OUT_OF_STOCK'
            END as stock_status,
            bp.pri_dispo = '1' OR bp.pri_dispo = '2' as dispo,
            pm.quality,
            CASE
                WHEN pm.quality = 'OE' THEN 100
                WHEN pm.quality = 'EQUIV' THEN 50
                ELSE 25
            END
            + CASE WHEN bp.pri_dispo = '1' THEN 10 WHEN bp.pri_dispo = '2' THEN 5 ELSE 0 END
            + CASE WHEN ap.piece_has_img THEN 5 ELSE 0 END
            - CASE WHEN COALESCE(bp.pri_vente_ttc, 0) > 50000 THEN 5 ELSE 0 END
            as score,
            CASE WHEN fi.pmi_folder IS NOT NULL AND fi.pmi_name IS NOT NULL
                THEN cdn.base || '/rack-images/' || fi.pmi_folder || '/' ||
                    CASE WHEN fi.pmi_name ~* '\.(webp|jpg|jpeg|png|gif)$' THEN fi.pmi_name ELSE fi.pmi_name || '.webp' END
                ELSE cdn.base || '/uploads/articles/no.png'
            END as image
        FROM active_pieces ap
        CROSS JOIN cdn
        LEFT JOIN best_prices bp ON bp.pri_piece_id = ap.piece_id
        LEFT JOIN first_images fi ON fi.piece_id_text = ap.piece_id_text
        LEFT JOIN piece_brands pm ON pm.pm_id = COALESCE(ap.rtp_pm_id, ap.piece_pm_id::INTEGER)
        LEFT JOIN side_positions sp ON sp.psf_id = ap.rtp_psf_id
    )

    SELECT
        a.id, a.nom, a.reference, a.reference_clean, a.description,
        a.quantite_vente, a.has_image, a.has_oem,
        a.filtre_gamme, a.is_accessory, a.filtre_side,
        a.marque, a.marque_id, a.marque_logo, a.nb_stars,
        a.prix_unitaire, a.prix_ttc, a.prix_consigne,
        a.stock_status, a.dispo, a.quality, a.score, a.image
    FROM assembled a
    ORDER BY
        CASE WHEN a.is_accessory THEN 1 ELSE 0 END,
        a.score DESC,
        CASE a.filtre_side
            WHEN 'Avant' THEN 1
            WHEN 'Arrière' THEN 2
            WHEN 'Gauche' THEN 3
            WHEN 'Droite' THEN 4
            ELSE 5
        END,
        a.prix_unitaire ASC NULLS LAST
    LIMIT LEAST(COALESCE(p_limit, 200), 500);
$function$;

-- ============================================================================
-- Permissions
-- ============================================================================
GRANT EXECUTE ON FUNCTION get_listing_products_extended TO service_role;

-- ============================================================================
-- Documentation
-- ============================================================================
COMMENT ON FUNCTION get_listing_products_extended IS 'High-performance product listing with RM scoring (OE/EQUIV/ECO, stock status)';

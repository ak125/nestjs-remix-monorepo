-- =============================================================================
-- Migration : prix exacts au centime dans la liste pièces × véhicule (R2)
-- Date      : 2026-11-18
-- Mandat    : CI (département 13, Ventes et commandes, demande de Marwane :
--             « corriger le pb des centimes »)
-- Scope     : 1 fonction, public.get_listing_products_extended_filtered
--             (appelée par rm_get_page_complete_v2, page R2). Aucune donnée
--             modifiée, aucune table touchée.
-- Forward-only. Ne réécrit AUCUNE migration historique.
-- =============================================================================
--
-- POURQUOI — la fonction arrondissait le prix à l'euro :
--   COALESCE(ROUND(NULLIF(TRIM(pri_vente_ttc), '')::NUMERIC)::INT, 0)
-- et déclarait prix_unitaire / prix_consigne en integer. Relevé du
-- 2026-11-18 (lecture seule) : rm_get_page_complete_v2(402, 17375) sert
-- TEXTAR 2314401 à 54 € alors que pieces_price et le panier portent 54,38 €.
-- 428 836 des 434 201 lignes vendables (dispo 1/2/3) ont des centimes.
--
-- CORRECTION — lire les colonnes numériques que lit le panier
-- (cart-data.service.ts : pri_vente_ttc_n) :
--   * pri_vente_ttc_n / pri_consigne_ttc_n à la place du texte arrondi ;
--     écart texte ↔ numérique = 0 ligne sur les 434 201 vendables, échelle
--     maximale 2 décimales (mesuré le 2026-11-18) ;
--   * prix_unitaire et prix_consigne passent d'integer à numeric ;
--   * le choix de la ligne de prix par pièce garde sa règle (dispo 1, 2, 3
--     puis prix le plus bas), le prix le plus bas étant comparé exact.
-- Tout le reste du corps est recopié de la définition servie
-- (pg_get_functiondef, 2026-11-18) : score, positions, images, tri, limite,
-- STABLE PARALLEL SAFE, search_path.
--
-- Le type de retour change : CREATE OR REPLACE ne le permet pas, d'où le
-- DROP puis CREATE dans la même transaction. Aucune dépendance pg_depend ;
-- rm_get_page_complete_v2 (plpgsql) l'appelle par son nom.
--
-- APRÈS APPLICATION — le cache Redis rm:page-v2 (TTL 1 h,
-- CACHE_STRATEGIES.RM.PAGE_V2) sert les anciens prix jusqu'à expiration ou
-- incrément de cache:gen:catalog.
--
-- DÉCISION OWNER AVANT APPLICATION (R-SEO-09) : le titre et la description
-- R2 citent le prix minimum (#MinPrice# « à partir de 9.00€ », « dès 9,00 € »).
-- Les gabarits ne changent pas, mais la donnée devient exacte : « 9.04€ »,
-- « 9,04 € ». Garder l'arrondi exige d'éditer rm-builder.service.ts, chemin
-- protégé par la garde 5 du dépôt (voir la PR).
-- =============================================================================

-- Garde-fous : le DROP prend un verrou exclusif sur une fonction appelée par
-- chaque page R2 ; ne pas attendre derrière un appel long. SET LOCAL : le
-- runner enveloppe le fichier dans BEGIN/COMMIT.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DROP FUNCTION IF EXISTS public.get_listing_products_extended_filtered(integer, bigint, integer);

CREATE OR REPLACE FUNCTION public.get_listing_products_extended_filtered(p_gamme_id integer, p_vehicle_id bigint, p_limit integer DEFAULT 200)
 RETURNS TABLE(id integer, nom text, reference text, reference_clean text, description text, quantite_vente numeric, has_image boolean, has_oem boolean, filtre_gamme text, is_accessory boolean, filtre_side text, marque text, marque_id integer, marque_logo text, nb_stars integer, prix_unitaire numeric, prix_ttc numeric, prix_consigne numeric, stock_status text, dispo boolean, quality text, score integer, image text)
 LANGUAGE sql
 STABLE PARALLEL SAFE
 SET search_path TO 'public'
AS $function$
    WITH
    cdn AS (SELECT 'https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public' as base),
    root_gamme AS (SELECT pg_name FROM pieces_gamme WHERE pg_id = p_gamme_id LIMIT 1),
    relations AS (
        SELECT DISTINCT rtp_piece_id, rtp_psf_id, rtp_pm_id
        FROM pieces_relation_type
        WHERE rtp_type_id = p_vehicle_id::INTEGER AND rtp_pg_id = p_gamme_id
          AND NOT EXISTS (SELECT 1 FROM _filter.rtp_pollution_ids f WHERE f.piece_id = pieces_relation_type.rtp_piece_id)
        LIMIT LEAST(COALESCE(p_limit, 200), 500) * 2
    ),
    active_pieces AS (
        SELECT p.piece_id, p.piece_id::TEXT as piece_id_text, p.piece_name, p.piece_ref, p.piece_ref_clean,
            p.piece_des, COALESCE(p.piece_qty_sale, 1)::NUMERIC as piece_qty_sale, p.piece_has_img, p.piece_has_oem,
            p.piece_fil_name, p.piece_name_side, p.piece_pm_id, r.rtp_psf_id, r.rtp_pm_id,
            CASE WHEN LOWER(p.piece_fil_name) LIKE LOWER(RTRIM(SPLIT_PART(rg.pg_name, ' ', 1), 's')) || '%' THEN false ELSE true END as is_accessory
        FROM pieces p
        INNER JOIN relations r ON p.piece_id = r.rtp_piece_id
        CROSS JOIN root_gamme rg
        WHERE p.piece_display = true
    ),
    piece_brands AS (
        SELECT pm_id, pm_name, pm_logo, COALESCE(NULLIF(pm_nb_stars, '')::INTEGER, 0) as pm_nb_stars, pm_oes, pm_quality,
            CASE WHEN pm_oes = '1' OR pm_nb_stars = '6' OR pm_quality = 'OE' THEN 'OE'
                 WHEN COALESCE(NULLIF(pm_nb_stars, '')::INTEGER, 0) >= 3 THEN 'EQUIV' ELSE 'ECO' END as quality
        FROM pieces_marque
        WHERE pm_id IN (SELECT DISTINCT COALESCE(rtp_pm_id, piece_pm_id::INTEGER) FROM active_pieces)
    ),
    best_prices AS (
        SELECT DISTINCT ON (NULLIF(pri_piece_id, '')::INTEGER)
            NULLIF(pri_piece_id, '')::INTEGER as pri_piece_id,
            COALESCE(pri_vente_ttc_n, 0) as pri_vente_ttc,
            COALESCE(pri_consigne_ttc_n, 0) as pri_consigne_ttc,
            pri_dispo
        FROM pieces_price
        WHERE NULLIF(pri_piece_id, '')::INTEGER IN (SELECT piece_id FROM active_pieces) AND pri_dispo IN ('1', '2', '3')
        ORDER BY NULLIF(pri_piece_id, '')::INTEGER,
                 CASE pri_dispo WHEN '1' THEN 1 WHEN '2' THEN 2 WHEN '3' THEN 3 END,
                 pri_vente_ttc_n ASC NULLS LAST
    ),
    first_images AS (
        SELECT DISTINCT ON (pmi_piece_id) pmi_piece_id as piece_id_text, pmi_folder, pmi_name
        FROM pieces_media_img
        WHERE pmi_piece_id IN (SELECT piece_id_text FROM active_pieces)
          AND pmi_display = '1'
          AND pmi_folder ~ '^[0-9]+$'
          AND pmi_name ~* '\.(jpg|jpeg|png|gif|webp|bmp)$'
        ORDER BY pmi_piece_id, pmi_sort ASC
    ),
    side_positions AS (
        SELECT psf_id, psf_side FROM pieces_side_filtre
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
                WHEN LOWER(pc_cri_value) LIKE '%supérieur%' OR LOWER(pc_cri_value) LIKE '%superieur%' THEN 'Supérieur'
                WHEN LOWER(pc_cri_value) LIKE '%inférieur%' OR LOWER(pc_cri_value) LIKE '%inferieur%' THEN 'Inférieur'
                WHEN LOWER(pc_cri_value) LIKE '%extérieur%' OR LOWER(pc_cri_value) LIKE '%exterieur%' THEN 'Extérieur'
                WHEN LOWER(pc_cri_value) LIKE '%intérieur%' OR LOWER(pc_cri_value) LIKE '%interieur%' THEN 'Intérieur'
                ELSE NULL
            END as detected_position
        FROM pieces_criteria
        WHERE NULLIF(pc_piece_id, '')::INTEGER IN (SELECT piece_id FROM active_pieces)
            AND pc_cri_id::TEXT = '100'
            AND pc_cri_value IS NOT NULL
            AND pc_cri_value != ''
            AND (LOWER(pc_cri_value) LIKE '%essieu%'
                OR LOWER(pc_cri_value) IN ('avant', 'arrière', 'arriere', 'gauche', 'droite')
                OR LOWER(pc_cri_value) LIKE '%gauche%' OR LOWER(pc_cri_value) LIKE '%droit%'
                OR LOWER(pc_cri_value) LIKE '%conducteur%' OR LOWER(pc_cri_value) LIKE '%passager%'
                OR LOWER(pc_cri_value) LIKE '%supérieur%' OR LOWER(pc_cri_value) LIKE '%superieur%'
                OR LOWER(pc_cri_value) LIKE '%inférieur%' OR LOWER(pc_cri_value) LIKE '%inferieur%'
                OR LOWER(pc_cri_value) LIKE '%extérieur%' OR LOWER(pc_cri_value) LIKE '%exterieur%'
                OR LOWER(pc_cri_value) LIKE '%intérieur%' OR LOWER(pc_cri_value) LIKE '%interieur%')
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
                WHEN LOWER(rcp_cri_value) LIKE '%supérieur%' OR LOWER(rcp_cri_value) LIKE '%superieur%' THEN 'Supérieur'
                WHEN LOWER(rcp_cri_value) LIKE '%inférieur%' OR LOWER(rcp_cri_value) LIKE '%inferieur%' THEN 'Inférieur'
                WHEN LOWER(rcp_cri_value) LIKE '%extérieur%' OR LOWER(rcp_cri_value) LIKE '%exterieur%' THEN 'Extérieur'
                WHEN LOWER(rcp_cri_value) LIKE '%intérieur%' OR LOWER(rcp_cri_value) LIKE '%interieur%' THEN 'Intérieur'
                ELSE NULL
            END as detected_position
        FROM pieces_relation_criteria
        WHERE rcp_type_id = p_vehicle_id::INTEGER
            AND rcp_pg_id = p_gamme_id
            AND rcp_piece_id IN (SELECT piece_id FROM active_pieces)
            AND rcp_cri_value IS NOT NULL
            AND rcp_cri_value != ''
            AND (LOWER(rcp_cri_value) LIKE '%essieu%'
                OR LOWER(rcp_cri_value) IN ('avant', 'arrière', 'arriere')
                OR rcp_cri_value LIKE '%+L%' OR rcp_cri_value LIKE '%+R%'
                OR LOWER(rcp_cri_value) LIKE '%gauche%' OR LOWER(rcp_cri_value) LIKE '%droit%'
                OR LOWER(rcp_cri_value) LIKE '%conducteur%' OR LOWER(rcp_cri_value) LIKE '%passager%'
                OR LOWER(rcp_cri_value) LIKE '%supérieur%' OR LOWER(rcp_cri_value) LIKE '%superieur%'
                OR LOWER(rcp_cri_value) LIKE '%inférieur%' OR LOWER(rcp_cri_value) LIKE '%inferieur%'
                OR LOWER(rcp_cri_value) LIKE '%extérieur%' OR LOWER(rcp_cri_value) LIKE '%exterieur%'
                OR LOWER(rcp_cri_value) LIKE '%intérieur%' OR LOWER(rcp_cri_value) LIKE '%interieur%')
        ORDER BY rcp_piece_id
    ),
    assembled AS (
        SELECT ap.piece_id as id,
            TRIM(CONCAT_WS(' ', ap.piece_name,
                CASE WHEN COALESCE(sp.psf_side, ap.piece_name_side) IS NOT NULL
                    AND POSITION(LOWER(COALESCE(sp.psf_side, ap.piece_name_side)) IN LOWER(COALESCE(ap.piece_name, ''))) = 0
                    THEN COALESCE(sp.psf_side, ap.piece_name_side) ELSE NULL END
            )) as nom,
            ap.piece_ref as reference, ap.piece_ref_clean as reference_clean, ap.piece_des as description,
            ap.piece_qty_sale as quantite_vente, ap.piece_has_img as has_image, ap.piece_has_oem as has_oem,
            ap.piece_fil_name as filtre_gamme, ap.is_accessory,
            COALESCE(rcp.detected_position, cp.detected_position, sp.psf_side, ap.piece_name_side,
                CASE WHEN LOWER(ap.piece_name) ~ '(avant|front)' THEN 'Avant'
                     WHEN LOWER(ap.piece_name) ~ '(arrière|arriere|rear)' THEN 'Arrière'
                     WHEN LOWER(ap.piece_name) ~ '(gauche|left)' THEN 'Gauche'
                     WHEN LOWER(ap.piece_name) ~ '(droit|right)' THEN 'Droite'
                     WHEN LOWER(ap.piece_name) ~ '(supérieur|superieur|upper)' THEN 'Supérieur'
                     WHEN LOWER(ap.piece_name) ~ '(inférieur|inferieur|lower)' THEN 'Inférieur'
                     WHEN LOWER(ap.piece_name) ~ '(extérieur|exterieur)' THEN 'Extérieur'
                     WHEN LOWER(ap.piece_name) ~ '(intérieur|interieur)' THEN 'Intérieur'
                     ELSE NULL END
            ) as filtre_side,
            COALESCE(pm.pm_name, 'Marque inconnue') as marque, pm.pm_id as marque_id, pm.pm_logo as marque_logo,
            pm.pm_nb_stars as nb_stars,
            COALESCE(bp.pri_vente_ttc, 0) as prix_unitaire,
            (COALESCE(bp.pri_vente_ttc, 0) * ap.piece_qty_sale) as prix_ttc,
            COALESCE(bp.pri_consigne_ttc, 0) as prix_consigne,
            CASE WHEN bp.pri_dispo = '1' THEN 'IN_STOCK' WHEN bp.pri_dispo = '2' THEN 'LOW_STOCK'
                 WHEN bp.pri_dispo = '3' THEN 'PREORDER' ELSE 'OUT_OF_STOCK' END as stock_status,
            bp.pri_dispo = '1' OR bp.pri_dispo = '2' as dispo, pm.quality,
            CASE WHEN pm.quality = 'OE' THEN 100 WHEN pm.quality = 'EQUIV' THEN 50 ELSE 25 END
            + CASE WHEN bp.pri_dispo = '1' THEN 10 WHEN bp.pri_dispo = '2' THEN 5 ELSE 0 END
            + CASE WHEN ap.piece_has_img THEN 5 ELSE 0 END
            - CASE WHEN COALESCE(bp.pri_vente_ttc, 0) > 50000 THEN 5 ELSE 0 END as score,
            CASE WHEN fi.pmi_folder IS NOT NULL AND fi.pmi_folder != ''
                  AND fi.pmi_name   IS NOT NULL AND fi.pmi_name   != ''
                THEN cdn.base || '/rack-images/' || fi.pmi_folder || '/' ||
                    CASE WHEN fi.pmi_name ~* '\.(webp|jpg|jpeg|png|gif)$' THEN fi.pmi_name ELSE fi.pmi_name || '.webp' END
                ELSE cdn.base || '/uploads/articles/no.png' END as image
        FROM active_pieces ap
        CROSS JOIN cdn
        LEFT JOIN best_prices bp ON bp.pri_piece_id = ap.piece_id
        LEFT JOIN first_images fi ON fi.piece_id_text = ap.piece_id_text
        LEFT JOIN piece_brands pm ON pm.pm_id = COALESCE(ap.rtp_pm_id, ap.piece_pm_id::INTEGER)
        LEFT JOIN side_positions sp ON sp.psf_id = ap.rtp_psf_id
        LEFT JOIN criteria_positions cp ON cp.piece_id = ap.piece_id
        LEFT JOIN relation_criteria_positions rcp ON rcp.piece_id = ap.piece_id
    )
    SELECT a.id, a.nom, a.reference, a.reference_clean, a.description,
        a.quantite_vente, a.has_image, a.has_oem, a.filtre_gamme, a.is_accessory, a.filtre_side,
        a.marque, a.marque_id, a.marque_logo, a.nb_stars,
        a.prix_unitaire, a.prix_ttc, a.prix_consigne, a.stock_status, a.dispo, a.quality, a.score, a.image
    FROM assembled a
    ORDER BY CASE WHEN a.is_accessory THEN 1 ELSE 0 END, a.score DESC,
        CASE a.filtre_side WHEN 'Avant' THEN 1 WHEN 'Arrière' THEN 2 WHEN 'Gauche' THEN 3 WHEN 'Droite' THEN 4
            WHEN 'Supérieur' THEN 5 WHEN 'Inférieur' THEN 6 WHEN 'Extérieur' THEN 7 WHEN 'Intérieur' THEN 8 ELSE 9 END,
        a.prix_unitaire ASC NULLS LAST
    LIMIT LEAST(COALESCE(p_limit, 200), 500);
$function$;

COMMENT ON FUNCTION public.get_listing_products_extended_filtered(integer, bigint, integer) IS
  'Session B 2026-04: filtered variant of get_listing_products_extended with NOT EXISTS on _filter.rtp_pollution_ids. 2026-11-18 (mandat CI): prix_unitaire/prix_consigne numeric exacts (pri_vente_ttc_n / pri_consigne_ttc_n, colonnes du panier), plus d''arrondi à l''euro. Rollback: 20261118_listing_prix_exact_centimes.down.sql.';

-- ACL relevée en lecture le 2026-11-18 : PUBLIC, postgres, anon, authenticated,
-- service_role ont EXECUTE. Le DROP la retire. Rétablie sans PUBLIC ni
-- authenticated (règle 2 de scripts/lint/check-definer-anon-surface.sh) : le
-- backend n'appelle qu'en service_role (PROD) ou anon (PREPROD READ_ONLY), et
-- rm_get_page_complete_v2, SECURITY DEFINER, l'exécute en tant que propriétaire.
-- Le REVOKE retire aussi l'EXECUTE que CREATE FUNCTION donne à PUBLIC et que les
-- privilèges par défaut donnent à authenticated. Le .down.sql rétablit l'ACL d'avant.
REVOKE ALL ON FUNCTION public.get_listing_products_extended_filtered(integer, bigint, integer) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.get_listing_products_extended_filtered(integer, bigint, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.get_listing_products_extended_filtered(integer, bigint, integer) TO service_role;

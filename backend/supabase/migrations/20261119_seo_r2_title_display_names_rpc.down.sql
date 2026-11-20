-- Rollback: 20261119_seo_r2_title_display_names_rpc
-- Remet `rm_get_page_complete_v2` au corps relevé en PROD le 2026-11-19
-- (md5(prosrc) 6bdec8f4fcd31754815892122338cb8d) : `seo_context` sans `modele_name_meta` ni
-- `type_name_meta`. Le titre R2 sert alors les noms bruts (casse normale
-- pour marque et modèle) ; un avertissement est journalisé une fois par
-- processus. Droits, volatilité et search_path conservés.
-- Garde : le corps en place doit être celui de la migration (ou celui
-- relevé, rejeu) ; sinon arrêt sans rien écrire.
-- L'engine est forward-only : ce fichier se lance à la main.
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL search_path = public, pg_temp;

DO $garde_retour$
DECLARE
  v_md5 text;
BEGIN
  SELECT md5(prosrc) INTO v_md5
    FROM pg_proc
   WHERE oid = 'public.rm_get_page_complete_v2(integer,bigint,integer)'::regprocedure;
  IF v_md5 IS DISTINCT FROM '59d376f3502fa4c21c4485d969e0b27c' AND v_md5 IS DISTINCT FROM '6bdec8f4fcd31754815892122338cb8d' THEN
    RAISE EXCEPTION 'mandat DW : corps de rm_get_page_complete_v2 inattendu (md5 %), ni celui de la migration ni celui relevé le 2026-11-19 ; rien n''est écrit', v_md5;
  END IF;
END
$garde_retour$;

CREATE OR REPLACE FUNCTION public.rm_get_page_complete_v2(p_gamme_id integer, p_vehicle_id bigint, p_limit integer DEFAULT 200)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_start TIMESTAMPTZ := clock_timestamp();
    v_result JSONB;
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
    v_cdn_base TEXT := 'https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public';
BEGIN
    IF p_gamme_id IS NULL OR p_vehicle_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'INVALID_PARAMS', 'message', 'gamme_id and vehicle_id are required'));
    END IF;
    IF p_limit IS NULL OR p_limit < 1 THEN p_limit := 200;
    ELSIF p_limit > 500 THEN p_limit := 500;
    END IF;

    SELECT amarq.marque_name, amarq.marque_alias, amarq.marque_id, am.modele_name, am.modele_alias, am.modele_id, at.type_name, at.type_alias, at.type_power_ps
    INTO v_marque_name, v_marque_alias, v_marque_id, v_modele_name, v_modele_alias, v_modele_id, v_type_name, v_type_alias, v_type_power_ps
    FROM auto_type at
    JOIN auto_modele am ON am.modele_id = at.type_modele_id::INTEGER
    JOIN auto_marque amarq ON amarq.marque_id = am.modele_marque_id
    WHERE at.type_id::INTEGER = p_vehicle_id::INTEGER AND at.type_display = '1'
    LIMIT 1;

    IF v_marque_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'VEHICLE_NOT_FOUND', 'message', 'Vehicle not found for id=' || p_vehicle_id));
    END IF;

    SELECT COALESCE(NULLIF(cg.mc_mf_prime, ''), '0')::INTEGER INTO v_mf_id
    FROM pieces_gamme pg
    LEFT JOIN catalog_gamme cg ON cg.mc_pg_id::INTEGER = pg.pg_id
    WHERE pg.pg_id = p_gamme_id;

    IF v_mf_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'GAMME_NOT_FOUND', 'message', 'Gamme not found for id=' || p_gamme_id));
    END IF;

    WITH
    vehicle_info AS (
        SELECT at.type_id::INTEGER as type_id, at.type_name, at.type_alias, at.type_power_ps, at.type_power_kw, at.type_year_from, at.type_year_to, at.type_body, at.type_fuel, at.type_engine, at.type_liter, am.modele_id, am.modele_name, am.modele_alias, am.modele_pic, amarq.marque_id, amarq.marque_name, amarq.marque_alias, amarq.marque_logo
        FROM auto_type at
        JOIN auto_modele am ON am.modele_id = at.type_modele_id::INTEGER
        JOIN auto_marque amarq ON amarq.marque_id = am.modele_marque_id
        WHERE at.type_id::INTEGER = p_vehicle_id::INTEGER AND at.type_display = '1'
        LIMIT 1
    ),
    motor_codes AS (
        SELECT COALESCE(STRING_AGG(tmc_code, ', '), '') as codes
        FROM auto_type_motor_code WHERE tmc_type_id::INTEGER = p_vehicle_id::INTEGER
    ),
    number_codes AS (
        SELECT COALESCE(STRING_AGG(DISTINCT tnc_code, ', ') FILTER (WHERE tnc_code IS NOT NULL AND tnc_code != ''), '') as mine_codes,
               COALESCE(STRING_AGG(DISTINCT tnc_cnit, ', ') FILTER (WHERE tnc_cnit IS NOT NULL AND tnc_cnit != ''), '') as cnit_codes
        FROM auto_type_number_code WHERE tnc_type_id::INTEGER = p_vehicle_id::INTEGER
    ),
    gamme_info AS (
        SELECT pg.pg_id, pg.pg_name, pg.pg_alias, pg.pg_pic, pg.pg_ppa_id, pg.pg_parent, COALESCE(cg.mc_mf_prime, '') as mf_id
        FROM pieces_gamme pg
        LEFT JOIN catalog_gamme cg ON cg.mc_pg_id::INTEGER = pg.pg_id
        WHERE pg.pg_id = p_gamme_id LIMIT 1
    ),
    sorted_pieces AS (
        SELECT id, nom, reference, reference_clean, description, quantite_vente, has_image, has_oem, filtre_gamme, is_accessory, filtre_side, marque, marque_id, marque_logo, nb_stars, prix_unitaire, prix_ttc, prix_consigne, stock_status, dispo, quality, score, image
        FROM get_listing_products_extended_filtered(p_gamme_id, p_vehicle_id, p_limit)
    ),
    oem_brand AS (
        SELECT prb.prb_id FROM pieces_ref_brand prb
        INNER JOIN vehicle_info vi ON UPPER(prb.prb_name) = UPPER(vi.marque_name) LIMIT 1
    ),
    oem_refs_with_position AS (
        SELECT prs.prs_ref as ref,
            REGEXP_REPLACE(UPPER(REPLACE(REPLACE(REPLACE(prs.prs_ref, ' ', ''), '-', ''), '.', '')), '^[A-Z](?=[0-9])', '') as ref_normalized,
            sp.filtre_gamme, sp.filtre_side, sp.is_accessory,
            CASE WHEN sp.is_accessory THEN 100 WHEN sp.filtre_side = 'Avant' THEN 1 WHEN sp.filtre_side = 'Arrière' THEN 2 WHEN sp.filtre_side = 'Gauche' THEN 3 WHEN sp.filtre_side = 'Droite' THEN 4 ELSE 10 END as group_priority
        FROM pieces_ref_search prs
        INNER JOIN sorted_pieces sp ON prs.prs_piece_id = sp.id::TEXT
        INNER JOIN oem_brand ob ON prs.prs_prb_id = ob.prb_id
        WHERE prs.prs_kind = '3'
    ),
    oem_refs_unique_global AS (
        SELECT DISTINCT ON (ref_normalized) ref, ref_normalized, filtre_gamme, filtre_side, is_accessory
        FROM oem_refs_with_position ORDER BY ref_normalized, group_priority ASC, LENGTH(ref) DESC
    ),
    oem_refs_by_group AS (
        SELECT filtre_gamme, filtre_side, is_accessory, jsonb_agg(ref ORDER BY ref) as oem_refs, COUNT(*)::INTEGER as oem_refs_count
        FROM oem_refs_unique_global GROUP BY filtre_gamme, filtre_side, is_accessory
    ),
    oem_refs_global AS (
        SELECT ref FROM oem_refs_unique_global ORDER BY LENGTH(ref) DESC LIMIT 50
    ),
    grouped AS (
        SELECT sp.filtre_gamme as group_gamme, sp.filtre_side as group_side, sp.is_accessory,
            CASE WHEN sp.filtre_side IS NOT NULL AND sp.filtre_side != '' THEN sp.filtre_gamme || ' - ' || sp.filtre_side ELSE sp.filtre_gamme END as title_h2,
            jsonb_agg(jsonb_build_object('id', sp.id, 'nom', sp.nom, 'reference', sp.reference, 'marque', sp.marque, 'marque_id', sp.marque_id,
                    'marque_logo', sp.marque_logo, 'prix_unitaire', sp.prix_unitaire, 'prix_ttc', sp.prix_ttc, 'image', sp.image, 'dispo', sp.dispo, 'quality', sp.quality, 'stock_status', sp.stock_status, 'score', sp.score) ORDER BY sp.score DESC, sp.prix_unitaire ASC NULLS LAST) as pieces,
            COALESCE(og.oem_refs, '[]'::jsonb) as oem_refs, COALESCE(og.oem_refs_count, 0) as oem_refs_count
        FROM sorted_pieces sp
        LEFT JOIN oem_refs_by_group og ON og.filtre_gamme IS NOT DISTINCT FROM sp.filtre_gamme AND og.filtre_side IS NOT DISTINCT FROM sp.filtre_side AND og.is_accessory = sp.is_accessory
        GROUP BY sp.filtre_gamme, sp.filtre_side, sp.is_accessory, og.oem_refs, og.oem_refs_count
    ),
    brand_counts AS (SELECT marque_id, marque, COUNT(*)::INTEGER as cnt FROM sorted_pieces WHERE marque_id IS NOT NULL GROUP BY marque_id, marque),
    quality_counts AS (SELECT quality, COUNT(*)::INTEGER as cnt FROM sorted_pieces GROUP BY quality),
    side_counts AS (SELECT filtre_side as side, COUNT(*)::INTEGER as cnt FROM sorted_pieces WHERE filtre_side IS NOT NULL AND filtre_side != '' GROUP BY filtre_side),
    cross_selling AS (
        SELECT pg.pg_id, pg.pg_name, pg.pg_alias, pg.pg_pic
        FROM pieces_gamme pg
        WHERE pg.pg_parent = (SELECT pg_parent FROM gamme_info) AND pg.pg_id != p_gamme_id AND pg.pg_display = '1'
          AND EXISTS (
            SELECT 1 FROM pieces_relation_type prt
            WHERE prt.rtp_pg_id = pg.pg_id AND prt.rtp_type_id = p_vehicle_id::INTEGER
              AND NOT EXISTS (SELECT 1 FROM _filter.rtp_pollution_ids f WHERE f.piece_id = prt.rtp_piece_id)
          )
        LIMIT 6
    ),
    data_quality AS (
        SELECT COUNT(*)::INTEGER as total,
            COUNT(*) FILTER (WHERE marque IS NOT NULL AND marque != 'Marque inconnue')::INTEGER as with_brand,
            COUNT(*) FILTER (WHERE has_image)::INTEGER as with_image,
            COUNT(*) FILTER (WHERE prix_unitaire > 0)::INTEGER as with_price
        FROM sorted_pieces
    )
    SELECT jsonb_build_object(
        'success', true,
        'products', COALESCE((SELECT jsonb_agg(jsonb_build_object('piece_id', id, 'piece_reference', reference, 'piece_name', nom, 'pm_id', marque_id, 'pm_name', marque,
                    'pm_logo', marque_logo, 'price_ttc', prix_unitaire, 'quality', quality, 'stock_status', stock_status, 'piece_position', filtre_side, 'score', score, 'has_image', has_image, 'image', image, 'filtre_gamme', filtre_gamme, 'is_accessory', is_accessory)) FROM sorted_pieces), '[]'::jsonb),
        'count', (SELECT COUNT(*)::INTEGER FROM sorted_pieces),
        'minPrice', (SELECT MIN(prix_unitaire) FROM sorted_pieces WHERE prix_unitaire > 0),
        'grouped_pieces', COALESCE((SELECT jsonb_agg(jsonb_build_object('filtre_gamme', group_gamme, 'filtre_side', group_side, 'title_h2', title_h2, 'pieces', pieces, 'oemRefs', oem_refs, 'oemRefsCount', oem_refs_count) ORDER BY CASE WHEN is_accessory THEN 1 ELSE 0 END, CASE group_side WHEN 'Avant' THEN 1 WHEN 'Arrière' THEN 2 WHEN 'Gauche' THEN 3 WHEN 'Droite' THEN 4 ELSE 5 END) FROM grouped), '[]'::jsonb),
        'vehicleInfo', (SELECT jsonb_build_object('typeId', type_id, 'typeName', type_name, 'typeAlias', type_alias, 'typePowerPs', type_power_ps, 'typePowerKw', type_power_kw, 'typeYearFrom', type_year_from, 'typeYearTo', type_year_to, 'typeBody', type_body, 'typeFuel', type_fuel, 'typeEngine', type_engine, 'typeLiter', type_liter, 'modeleId', modele_id, 'modeleName', modele_name, 'modeleAlias', modele_alias, 'modelePic', modele_pic, 'marqueId', marque_id, 'marqueName', marque_name, 'marqueAlias', marque_alias, 'marqueLogo', marque_logo, 'motorCodesFormatted', (SELECT codes FROM motor_codes), 'mineCodesFormatted', (SELECT mine_codes FROM number_codes), 'cnitCodesFormatted', (SELECT cnit_codes FROM number_codes)) FROM vehicle_info),
        'gamme', (SELECT jsonb_build_object('pg_id', pg_id, 'pg_name', pg_name, 'pg_alias', pg_alias, 'pg_pic', pg_pic, 'pg_ppa_id', pg_ppa_id, 'pg_parent', pg_parent) FROM gamme_info),
        'seo_raw', (SELECT jsonb_build_object('h1', COALESCE(sgc_h1, ''), 'title', COALESCE(sgc_title, ''), 'description', COALESCE(sgc_descrip, ''), 'content', COALESCE(sgc_content, ''), 'preview', COALESCE(sgc_preview, '')) FROM __seo_gamme_car WHERE sgc_pg_id::INTEGER = p_gamme_id LIMIT 1),
        'seo_context', jsonb_build_object('type_id', p_vehicle_id::INTEGER, 'pg_id', p_gamme_id, 'mf_id', v_mf_id, 'marque_name', v_marque_name, 'marque_alias', v_marque_alias, 'modele_name', v_modele_name, 'modele_alias', v_modele_alias, 'type_name', v_type_name, 'type_alias', v_type_alias, 'type_power_ps', v_type_power_ps),
        'seo', jsonb_build_object('h1', '', 'title', '', 'description', '', 'content', '', 'preview', ''),
        'oemRefs', COALESCE((SELECT jsonb_agg(ref) FROM oem_refs_global), '[]'::jsonb),
        'crossSelling', COALESCE((SELECT jsonb_agg(jsonb_build_object('PG_ID', pg_id, 'PG_NAME', pg_name, 'PG_ALIAS', pg_alias, 'PG_IMAGE', pg_pic)) FROM cross_selling), '[]'::jsonb),
        'filters', jsonb_build_object(
            'brands', COALESCE((SELECT jsonb_agg(jsonb_build_object('pm_id', marque_id, 'pm_name', marque, 'count', cnt) ORDER BY cnt DESC) FROM brand_counts), '[]'::jsonb),
            'qualities', COALESCE((SELECT jsonb_agg(jsonb_build_object('value', quality, 'count', cnt) ORDER BY CASE quality WHEN 'OE' THEN 1 WHEN 'EQUIV' THEN 2 ELSE 3 END) FROM quality_counts), '[]'::jsonb),
            'sides', COALESCE((SELECT jsonb_agg(jsonb_build_object('value', side, 'count', cnt) ORDER BY CASE side WHEN 'Avant' THEN 1 WHEN 'Arrière' THEN 2 WHEN 'Gauche' THEN 3 WHEN 'Droite' THEN 4 ELSE 5 END) FROM side_counts), '[]'::jsonb),
            'price_range', jsonb_build_object('min', (SELECT MIN(prix_unitaire) FROM sorted_pieces WHERE prix_unitaire > 0), 'max', (SELECT MAX(prix_unitaire) FROM sorted_pieces))
        ),
        'validation', (SELECT jsonb_build_object('valid', total > 0, 'relationsCount', total, 'dataQuality', jsonb_build_object('quality', CASE WHEN total > 0 THEN GREATEST(0, LEAST(100, 100 - (100 - (with_brand::NUMERIC / NULLIF(total, 0) * 100)) * 0.5 - (100 - (with_image::NUMERIC / NULLIF(total, 0) * 100)) * 0.3 - (100 - (with_price::NUMERIC / NULLIF(total, 0) * 100)) * 0.2))::INTEGER ELSE 0 END, 'pieces_with_brand_percent', CASE WHEN total > 0 THEN (with_brand::NUMERIC / total * 100)::INTEGER ELSE 0 END, 'pieces_with_image_percent', CASE WHEN total > 0 THEN (with_image::NUMERIC / total * 100)::INTEGER ELSE 0 END, 'pieces_with_price_percent', CASE WHEN total > 0 THEN (with_price::NUMERIC / total * 100)::INTEGER ELSE 0 END)) FROM data_quality)
    ) INTO v_result;

    v_duration_ms := EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start)::INTEGER;
    v_result := v_result || jsonb_build_object('duration_ms', v_duration_ms);
    RETURN v_result;

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'INTERNAL_ERROR', 'message', SQLERRM), 'duration_ms', EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start)::INTEGER);
END;
$function$;

COMMIT;

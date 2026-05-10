-- Migration : optimisation de la sous-requête `catalog` dans build_vehicle_page_payload
--
-- INC-2026-007 — Pages véhicule R8 503 transitoires
--
-- Diagnostic root-cause :
--   Phase 1 ADR-016 (commit fc9b94af, 21/04) a créé build_vehicle_page_payload avec une
--   sous-requête `catalog` qui force le planner sur pieces_relation_type_v2_pkey
--   (rtp_type_id, rtp_piece_id) 12 GB au lieu de l'index covering existant
--   idx_pieces_relation_type_type_id_composite (rtp_type_id, rtp_pg_id) 4 GB.
--
--   Cause : la jointure forcée sur pieces.piece_id (pour filtrer piece_display=true)
--   indique au planner qu'il a besoin de rtp_piece_id → choisit le PK 12 GB qui contient
--   les deux colonnes, scanne 18 384 rows pour produire 116 résultats (≈ 692 ms warm,
--   ≈ 2 s cold I/O).
--
-- Fix : décomposer la requête en deux phases.
--   Phase 1 : index-only scan sur idx_..._composite (4 GB), récupère les rtp_pg_id
--     distincts uniquement (skip totalement la jointure pieces).
--   Phase 2 : pour chaque candidat, EXISTS sur (1) pieces_gamme display+level,
--     (2) au moins une piece visible — chacun via index lookup ciblé.
--
-- Sémantique préservée : validé sur 10 types stale random (rtp_pg_id et piece_pg_id
-- produisent les mêmes ensembles dans 100% des cas testés).
--
-- Mesures (warm cache, type_id=18110) :
--   Avant : 692 ms / 18 384 row scans / Buffers hit=72 622 read=2 165
--   Après : 27.6 ms / 113 rows / Buffers hit=11 868 read=0
--
-- Cold path : reste lent (~2 s) à cause de l'I/O brut sur pieces_relation_type 47 GB.
-- Le 503 est évité structurellement par les Étapes 2+3+4 du plan (cron + trigger + garde-fou)
-- qui garantissent steady state stale=0 → aucun rebuild on-miss en prod.

CREATE OR REPLACE FUNCTION public.build_vehicle_page_payload(p_type_id integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
DECLARE
  v_result    JSONB;
  v_marque_id INTEGER;
BEGIN
  SELECT jsonb_build_object(
    'vehicle', (
      SELECT jsonb_build_object(
        'type_id', at.type_id,
        'type_name', at.type_name,
        'type_name_meta', at.type_name_meta,
        'type_alias', at.type_alias,
        'type_power_ps', at.type_power_ps,
        'type_power_kw', at.type_power_kw,
        'type_fuel', at.type_fuel,
        'type_body', at.type_body,
        'type_engine', at.type_engine,
        'type_liter', at.type_liter,
        'type_month_from', at.type_month_from,
        'type_year_from', at.type_year_from,
        'type_month_to', at.type_month_to,
        'type_year_to', at.type_year_to,
        'type_relfollow', at.type_relfollow,
        'modele_id', am.modele_id,
        'modele_name', am.modele_name,
        'modele_name_meta', am.modele_name_meta,
        'modele_alias', am.modele_alias,
        'modele_pic', am.modele_pic,
        'modele_ful_name', am.modele_ful_name,
        'modele_body', am.modele_body,
        'modele_relfollow', am.modele_relfollow,
        'modele_year_from', am.modele_year_from,
        'modele_year_to', am.modele_year_to,
        'marque_id', amarq.marque_id,
        'marque_name', amarq.marque_name,
        'marque_name_meta', amarq.marque_name_meta,
        'marque_name_meta_title', amarq.marque_name_meta_title,
        'marque_alias', amarq.marque_alias,
        'marque_logo', amarq.marque_logo,
        'marque_relfollow', amarq.marque_relfollow,
        'marque_top', amarq.marque_top
      )
      FROM auto_type at
      INNER JOIN auto_modele am ON am.modele_id::TEXT = at.type_modele_id
      INNER JOIN auto_marque amarq ON amarq.marque_id::SMALLINT = am.modele_marque_id
      WHERE at.type_id = p_type_id::TEXT
        AND at.type_display = '1'
      LIMIT 1
    ),
    'motor_codes', (
      SELECT COALESCE(jsonb_agg(tmc_code), '[]'::jsonb)
      FROM auto_type_motor_code
      WHERE tmc_type_id = p_type_id::TEXT
    ),
    'mine_codes', (
      SELECT COALESCE(jsonb_agg(DISTINCT tnc_code), '[]'::jsonb)
      FROM auto_type_number_code
      WHERE tnc_type_id = p_type_id::TEXT
        AND tnc_code IS NOT NULL
        AND tnc_code != ''
    ),
    'cnit_codes', (
      SELECT COALESCE(jsonb_agg(DISTINCT tnc_cnit), '[]'::jsonb)
      FROM auto_type_number_code
      WHERE tnc_type_id = p_type_id::TEXT
        AND tnc_cnit IS NOT NULL
        AND tnc_cnit != ''
    ),
    'seo_custom', (
      SELECT jsonb_build_object(
        'mta_title', mta_title,
        'mta_descrip', mta_descrip,
        'mta_keywords', mta_keywords,
        'mta_h1', mta_h1,
        'mta_content', mta_content,
        'mta_relfollow', mta_relfollow
      )
      FROM ___meta_tags_ariane
      WHERE mta_alias LIKE '%-' || p_type_id::TEXT
      LIMIT 1
    )
  ) INTO v_result;

  IF v_result IS NULL
     OR jsonb_typeof(v_result->'vehicle') = 'null'
     OR v_result->'vehicle' IS NULL THEN
    RETURN NULL;
  END IF;

  v_marque_id := (v_result->'vehicle'->>'marque_id')::INTEGER;

  v_result := v_result || jsonb_build_object(
    'blog_content', (
      SELECT jsonb_build_object(
        'bsm_id', bsm_id,
        'bsm_h1', bsm_h1,
        'bsm_content', bsm_content,
        'bsm_descrip', bsm_descrip
      )
      FROM __blog_seo_marque
      WHERE bsm_marque_id = v_marque_id::TEXT
      LIMIT 1
    )
  );

  -- ============================================================================
  -- OPTIMISATION INC-2026-007 : sous-requête `catalog` réécrite en deux phases
  -- ============================================================================
  -- Phase 1 (gamme_candidates) : index-only scan sur idx_pieces_relation_type_type_id_composite
  --   pour récupérer les rtp_pg_id distincts SANS toucher la table pieces.
  -- Phase 2 (visible_gammes) : EXISTS check ciblé pour vérifier la visibilité réelle
  --   d'au moins une pièce par gamme.
  -- Sémantique : équivalente à l'ancienne version (validé sur 10 types stale random).
  v_result := v_result || jsonb_build_object(
    'catalog', (
      WITH gamme_candidates AS (
        SELECT DISTINCT prt.rtp_pg_id AS pg_id
        FROM pieces_relation_type prt
        WHERE prt.rtp_type_id = p_type_id
      ),
      visible_gammes AS (
        SELECT gc.pg_id
        FROM gamme_candidates gc
        INNER JOIN pieces_gamme pg ON pg.pg_id = gc.pg_id
        WHERE pg.pg_display = '1'
          AND pg.pg_level IN ('1', '2')
          AND EXISTS (
            SELECT 1
            FROM pieces_relation_type prt2
            INNER JOIN pieces p ON p.piece_id = prt2.rtp_piece_id
            WHERE prt2.rtp_type_id = p_type_id
              AND prt2.rtp_pg_id = gc.pg_id
              AND p.piece_display = true
            LIMIT 1
          )
        LIMIT 500
      ),
      gamme_data AS (
        SELECT pg.pg_id, pg.pg_alias, pg.pg_name, pg.pg_name_meta, pg.pg_img, cg.mc_mf_id, cg.mc_sort
        FROM visible_gammes vg
        INNER JOIN pieces_gamme pg ON pg.pg_id = vg.pg_id
        INNER JOIN catalog_gamme cg ON cg.mc_pg_id = pg.pg_id::TEXT
      ),
      families_with_gammes AS (
        SELECT cf.mf_id, cf.mf_name, COALESCE(cf.mf_name_system, cf.mf_name) AS mf_name_display,
          cf.mf_description, cf.mf_pic, cf.mf_sort,
          jsonb_agg(
            jsonb_build_object(
              'pg_id', gd.pg_id,
              'pg_alias', gd.pg_alias,
              'pg_name', gd.pg_name,
              'pg_name_meta', gd.pg_name_meta,
              'pg_img', gd.pg_img,
              'mc_sort', gd.mc_sort
            ) ORDER BY gd.mc_sort::INTEGER NULLS LAST
          ) AS gammes
        FROM gamme_data gd
        INNER JOIN catalog_family cf ON cf.mf_id = gd.mc_mf_id
        WHERE cf.mf_display = '1'
        GROUP BY cf.mf_id, cf.mf_name, cf.mf_name_system, cf.mf_description, cf.mf_pic, cf.mf_sort
      )
      SELECT jsonb_build_object(
        'families', COALESCE(
          (SELECT jsonb_agg(
            jsonb_build_object(
              'mf_id', mf_id,
              'mf_name', mf_name_display,
              'mf_description', mf_description,
              'mf_pic', mf_pic,
              'gammes', gammes,
              'gammes_count', jsonb_array_length(gammes)
            ) ORDER BY mf_sort::INTEGER NULLS LAST
          ) FROM families_with_gammes),
          '[]'::jsonb
        ),
        'total_families', (SELECT COUNT(*) FROM families_with_gammes),
        'total_gammes', (SELECT COALESCE(SUM(jsonb_array_length(gammes)), 0) FROM families_with_gammes)
      )
    )
  );
  -- ============================================================================
  -- FIN OPTIMISATION INC-2026-007
  -- ============================================================================

  v_result := v_result || jsonb_build_object(
    'popular_parts', (
      SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
      FROM (
        SELECT DISTINCT ON (cgc.cgc_pg_id)
          cgc.cgc_pg_id::INTEGER AS pg_id,
          pg.pg_alias,
          pg.pg_name,
          pg.pg_name_meta,
          pg.pg_img
        FROM __cross_gamme_car_new cgc
        INNER JOIN pieces_gamme pg ON pg.pg_id::TEXT = cgc.cgc_pg_id
        WHERE cgc.cgc_type_id = p_type_id::TEXT
          AND cgc.cgc_level IN ('1', '2')
          AND pg.pg_display = '1'
        ORDER BY cgc.cgc_pg_id, cgc.cgc_level ASC
        LIMIT 8
      ) sub
    )
  );

  v_result := v_result || jsonb_build_object(
    'seo_validation', jsonb_build_object(
      'family_count', (v_result->'catalog'->>'total_families')::INTEGER,
      'gamme_count', (v_result->'catalog'->>'total_gammes')::INTEGER,
      'marque_relfollow', (v_result->'vehicle'->>'marque_relfollow')::INTEGER,
      'modele_relfollow', (v_result->'vehicle'->>'modele_relfollow')::INTEGER,
      'type_relfollow', (v_result->'vehicle'->>'type_relfollow')::INTEGER,
      'is_indexable', (
        (v_result->'catalog'->>'total_families')::INTEGER >= 3 AND
        (v_result->'catalog'->>'total_gammes')::INTEGER >= 5 AND
        COALESCE((v_result->'vehicle'->>'marque_relfollow')::INTEGER, 0) = 1 AND
        COALESCE((v_result->'vehicle'->>'modele_relfollow')::INTEGER, 0) = 1 AND
        COALESCE((v_result->'vehicle'->>'type_relfollow')::INTEGER, 0) = 1
      )
    )
  );

  v_result := v_result || jsonb_build_object(
    'success', TRUE,
    'type_id', p_type_id
  );

  RETURN v_result;
END;
$function$;

COMMENT ON FUNCTION public.build_vehicle_page_payload(integer) IS
  'INC-2026-007: sous-requete catalog optimisee (warm 27ms vs 692ms ancien). Cold path reste limite par I/O sur pieces_relation_type 47GB - protection structurelle assuree par cron + trigger auto_type + mark_stale_with_followup_rebuild garantissant steady state stale=0.';

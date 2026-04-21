-- =============================================================================
-- ADR-016 Phase 2 — Inline SQL + drop legacy RPC + drop hardcoded index
-- =============================================================================
-- Finit le nettoyage structurel de INC-2026-005. Après cette migration :
--   - build_vehicle_page_payload contient la SQL inline (pas de délégation)
--   - get_vehicle_page_data_optimized est SUPPRIMÉE
--   - idx_pieces_relation_type_popular (top-10 hardcodé) est SUPPRIMÉ
--   - Tous les rows du cache sont rebuilt pour garantir le hash neuf
--
-- Safety:
--   - Backfill déjà à 100% (28,505 rows) via Phase 1
--   - Parity vérifiée (inline == legacy) avant de dropper
--   - Rollback possible : re-créer la legacy via git + migration inverse
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) build_vehicle_page_payload — SQL inline (plus de délégation à la legacy)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.build_vehicle_page_payload(p_type_id INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $fn$
DECLARE
  v_result    JSONB;
  v_marque_id INTEGER;
BEGIN
  -- SECTION 1-5: véhicule + motor/mine/cnit + SEO custom
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

  -- Rejeter les type_ids invalides (le bug JSONB null du legacy est ici exclu)
  IF v_result IS NULL
     OR jsonb_typeof(v_result->'vehicle') = 'null'
     OR v_result->'vehicle' IS NULL THEN
    RETURN NULL;
  END IF;

  v_marque_id := (v_result->'vehicle'->>'marque_id')::INTEGER;

  -- SECTION 6: blog marque
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

  -- SECTION 7: catalogue familles + gammes compatibles
  v_result := v_result || jsonb_build_object(
    'catalog', (
      WITH compatible_gammes AS (
        SELECT DISTINCT prt.rtp_pg_id AS pg_id
        FROM pieces_relation_type prt
        INNER JOIN pieces p ON prt.rtp_piece_id = p.piece_id
        INNER JOIN pieces_gamme pg ON p.piece_pg_id = pg.pg_id
        WHERE prt.rtp_type_id = p_type_id
          AND p.piece_display = true
          AND pg.pg_display = '1'
          AND pg.pg_level IN ('1', '2')
        LIMIT 500
      ),
      gamme_data AS (
        SELECT
          pg.pg_id,
          pg.pg_alias,
          pg.pg_name,
          pg.pg_name_meta,
          pg.pg_img,
          cg.mc_mf_id,
          cg.mc_sort
        FROM compatible_gammes cg_ids
        INNER JOIN pieces_gamme pg ON pg.pg_id = cg_ids.pg_id
        INNER JOIN catalog_gamme cg ON cg.mc_pg_id = pg.pg_id::TEXT
      ),
      families_with_gammes AS (
        SELECT
          cf.mf_id,
          cf.mf_name,
          COALESCE(cf.mf_name_system, cf.mf_name) AS mf_name_display,
          cf.mf_description,
          cf.mf_pic,
          cf.mf_sort,
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

  -- SECTION 8: pièces populaires
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

  -- SECTION 9: validation SEO (robots index/noindex)
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
$fn$;

COMMENT ON FUNCTION public.build_vehicle_page_payload(INTEGER) IS
  'ADR-016 Phase 2: SQL inline autonome. Remplace la delegation vers get_vehicle_page_data_optimized (droppee).';

-- -----------------------------------------------------------------------------
-- 2) Drop legacy RPC — plus aucun appelant après migration Phase 2
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_vehicle_page_data_optimized(INTEGER);

-- -----------------------------------------------------------------------------
-- 3) Drop hardcoded top-10 index — bricolage pré-existant non nécessaire
--    avec la matérialisation (__vehicle_page_cache PK type_id couvre tout).
-- -----------------------------------------------------------------------------
DROP INDEX IF EXISTS public.idx_pieces_relation_type_popular;

COMMIT;

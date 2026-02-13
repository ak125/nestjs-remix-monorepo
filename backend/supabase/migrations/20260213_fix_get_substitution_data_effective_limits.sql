-- ============================================================================
-- FIX: get_substitution_data - LIMIT effectifs sur tableaux JSON agrégés
-- ============================================================================
-- Constat:
--   Plusieurs LIMIT étaient placés après jsonb_agg(...), donc sans effet
--   réel (une agrégation retourne déjà une seule ligne).
--
-- Correctifs:
--   - related_parts: LIMIT 6 appliqué en sous-requête ordonnée
--   - compatible_motors: LIMIT 20 appliqué avant agrégation
--   - compatible_gammes: LIMIT 50 appliqué avant agrégation
--
-- Date: 2026-02-13
-- ============================================================================

CREATE OR REPLACE FUNCTION get_substitution_data(
  p_gamme_alias TEXT,
  p_marque_alias TEXT DEFAULT NULL,
  p_modele_alias TEXT DEFAULT NULL,
  p_type_alias TEXT DEFAULT NULL,
  p_gamme_id INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_gamme_id INTEGER;
  v_gamme_name TEXT;
  v_gamme_alias TEXT;
  v_mf_id TEXT;
  v_mf_name TEXT;
  v_resolved_by TEXT := 'none';
  v_products_count INTEGER := 0;
  v_first_type_id INTEGER;
  v_result JSONB;
BEGIN
  -- 1a. Si gamme_id fourni
  IF p_gamme_id IS NOT NULL THEN
    SELECT pg.pg_id, pg.pg_name, pg.pg_alias, cg.mc_mf_id
    INTO v_gamme_id, v_gamme_name, v_gamme_alias, v_mf_id
    FROM pieces_gamme pg
    LEFT JOIN catalog_gamme cg ON cg.mc_pg_id = pg.pg_id::TEXT
    WHERE pg.pg_id = p_gamme_id
    LIMIT 1;
    IF v_gamme_id IS NOT NULL THEN
      v_resolved_by := 'exact';
    END IF;
  END IF;

  -- 1b. Match exact alias
  IF v_gamme_id IS NULL AND p_gamme_alias IS NOT NULL THEN
    SELECT pg.pg_id, pg.pg_name, pg.pg_alias, cg.mc_mf_id
    INTO v_gamme_id, v_gamme_name, v_gamme_alias, v_mf_id
    FROM pieces_gamme pg
    LEFT JOIN catalog_gamme cg ON cg.mc_pg_id = pg.pg_id::TEXT
    WHERE pg.pg_alias = LOWER(p_gamme_alias)
    LIMIT 1;
    IF v_gamme_id IS NOT NULL THEN
      v_resolved_by := 'exact';
    END IF;
  END IF;

  -- Famille
  IF v_mf_id IS NOT NULL THEN
    SELECT mf_name INTO v_mf_name
    FROM catalog_family
    WHERE mf_id = v_mf_id;
  END IF;

  -- Produits count
  IF v_gamme_id IS NOT NULL THEN
    SELECT COUNT(*)::INTEGER INTO v_products_count
    FROM pieces
    WHERE piece_pg_id = v_gamme_id;
  END IF;

  -- Résultat base
  v_result := jsonb_build_object(
    '_meta',
    jsonb_build_object(
      'gamme_found', v_gamme_id IS NOT NULL,
      'resolved_by', v_resolved_by,
      'products_count', v_products_count,
      'vehicle_found', false
    )
  );

  IF v_gamme_id IS NULL THEN
    v_result := v_result || jsonb_build_object(
      'suggestions',
      (
        SELECT COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'pg_id', s.pg_id,
              'pg_name', s.pg_name,
              'pg_alias', s.pg_alias,
              'reason', 'popular'
            )
            ORDER BY s.pg_name
          ),
          '[]'::jsonb
        )
        FROM (
          SELECT pg_id, pg_name, pg_alias
          FROM pieces_gamme
          WHERE pg_level = '1'
          ORDER BY pg_name
          LIMIT 5
        ) s
      )
    );
    RETURN v_result;
  END IF;

  -- Gamme trouvée
  v_result := v_result || jsonb_build_object(
    'gamme',
    jsonb_build_object(
      'pg_id', v_gamme_id,
      'pg_name', v_gamme_name,
      'pg_alias', v_gamme_alias,
      'mf_id', v_mf_id,
      'mf_name', v_mf_name
    )
  );

  -- Best-seller
  v_result := v_result || jsonb_build_object(
    'substitute',
    (
      SELECT jsonb_build_object(
        'piece_id', p.piece_id,
        'piece_name', p.piece_name,
        'piece_ref', COALESCE(p.piece_ref, ''),
        'pm_name', COALESCE(pm.pm_name, '')
      )
      FROM pieces p
      LEFT JOIN pieces_marque pm ON pm.pm_id = p.piece_pm_id::INTEGER
      WHERE p.piece_pg_id = v_gamme_id
        AND p.piece_display = '1'
      ORDER BY p.piece_qty_sale::INTEGER DESC NULLS LAST, p.piece_sort ASC NULLS LAST
      LIMIT 1
    )
  );

  -- Related parts (LIMIT 6 effectif)
  v_result := v_result || jsonb_build_object(
    'related_parts',
    (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'pg_id', rp.pg_id,
            'pg_name', rp.pg_name,
            'pg_alias', rp.pg_alias
          )
          ORDER BY rp.pg_name
        ),
        '[]'::jsonb
      )
      FROM (
        SELECT pg.pg_id, pg.pg_name, pg.pg_alias
        FROM pieces_gamme pg
        JOIN catalog_gamme cg ON cg.mc_pg_id = pg.pg_id::TEXT
        WHERE cg.mc_mf_id = v_mf_id
          AND pg.pg_id != v_gamme_id
        ORDER BY pg.pg_name
        LIMIT 6
      ) rp
    )
  );

  -- Motors compatibles enrichis (LIMIT 20 effectif)
  v_result := v_result || jsonb_build_object(
    'compatible_motors',
    (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'type_id', cm.type_id,
            'type_name', cm.type_name,
            'type_alias', cm.type_alias,
            'type_fuel', cm.type_fuel,
            'type_power_ps', cm.type_power_ps,
            'type_year_from', cm.type_year_from,
            'type_year_to', cm.type_year_to,
            'type_body', cm.type_body
          )
          ORDER BY cm.type_name, cm.type_id
        ),
        '[]'::jsonb
      )
      FROM (
        SELECT DISTINCT
          t.type_id::INTEGER AS type_id,
          t.type_name,
          t.type_alias,
          t.type_fuel,
          t.type_power_ps,
          t.type_year_from,
          t.type_year_to,
          t.type_body
        FROM __cross_gamme_car cgc
        JOIN auto_type t ON t.type_id = cgc.cgc_type_id
        WHERE cgc.cgc_pg_id = v_gamme_id::TEXT
          AND cgc.cgc_level IN ('1', '2', '3')
        ORDER BY t.type_name, t.type_id
        LIMIT 20
      ) cm
    )
  );

  -- Récupérer le premier type_id des motors compatibles
  SELECT t.type_id::INTEGER INTO v_first_type_id
  FROM __cross_gamme_car cgc
  JOIN auto_type t ON t.type_id = cgc.cgc_type_id
  WHERE cgc.cgc_pg_id = v_gamme_id::TEXT
    AND cgc.cgc_level IN ('1', '2', '3')
  LIMIT 1;

  -- Gammes compatibles (LIMIT 50 effectif)
  IF v_first_type_id IS NOT NULL THEN
    v_result := v_result || jsonb_build_object(
      'compatible_gammes',
      (
        SELECT COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'pg_id', cg.pg_id,
              'pg_name', cg.pg_name,
              'pg_alias', cg.pg_alias,
              'pg_pic', cg.pg_pic,
              'total_pieces', cg.total_pieces
            )
            ORDER BY cg.total_pieces DESC, cg.pg_id
          ),
          '[]'::jsonb
        )
        FROM (
          SELECT
            pg.pg_id,
            pg.pg_name,
            pg.pg_alias,
            pg.pg_pic,
            sub.total_pieces
          FROM (
            SELECT
              prt.rtp_pg_id::INTEGER AS pg_id,
              COUNT(DISTINCT prt.rtp_piece_id)::BIGINT AS total_pieces
            FROM pieces_relation_type prt
            INNER JOIN pieces p ON prt.rtp_piece_id = p.piece_id
            INNER JOIN pieces_gamme pg ON p.piece_pg_id = pg.pg_id
            WHERE prt.rtp_type_id = v_first_type_id
              AND p.piece_display = true
              AND pg.pg_display = '1'
              AND pg.pg_level IN ('1', '2')
            GROUP BY prt.rtp_pg_id
          ) sub
          JOIN pieces_gamme pg ON pg.pg_id = sub.pg_id
          ORDER BY sub.total_pieces DESC, pg.pg_id
          LIMIT 50
        ) cg
      )
    );
  ELSE
    v_result := v_result || jsonb_build_object('compatible_gammes', '[]'::jsonb);
  END IF;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION get_substitution_data IS
  'V4 - 2026-02-13: fix GROUP BY + LIMIT effectifs sur suggestions/related_parts/compatible_motors/compatible_gammes';

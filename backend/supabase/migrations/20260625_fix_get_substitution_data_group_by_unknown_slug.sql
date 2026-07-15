-- ============================================================================
-- FIX: get_substitution_data — erreur GROUP BY (chemin slug inconnu)
-- ============================================================================
-- Symptôme (confirmé live 2026-06-25, ligne 47 de la fonction) :
--   ERROR 42803: column "pieces_gamme.pg_name" must appear in the GROUP BY
--   clause or be used in an aggregate function
--
-- Déclencheur :
--   Branche `IF v_gamme_id IS NULL` (gamme non résolue). Le bloc `suggestions`
--   applique `ORDER BY pg_name` AU NIVEAU REQUÊTE sur un SELECT agrégé
--   (jsonb_agg). Postgres exige alors pg_name dans GROUP BY → la fonction lève
--   42803. Le service substitution catch l'erreur et renvoie gamme_found:false
--   → httpStatus 404. Conséquence :
--     • toute page R1 dont l'intent substitution échoue à résoudre v_gamme_id
--       renvoie un 404 sur une gamme pourtant valide (404 intermittent observé
--       sur /pieces/filtre-a-huile-7.html) ;
--     • tout slug réellement inconnu lève aussi l'erreur → ses « suggestions »
--       (bloc d'aide sur la page 404) ne sont jamais rendues.
--
-- Historique :
--   Le correctif d'origine (20260213_fix_get_substitution_data_group_by.sql)
--   triait/limitait en sous-requête AVANT jsonb_agg. Il a été PERDU lors de la
--   réécriture du 2026-03-15 (migrations unify_cross_gamme_car_new /
--   drop_cross_gamme_car_deprecated) qui a basculé la fonction sur
--   `__cross_gamme_car_new` en réintroduisant la forme buggée des suggestions.
--
-- Correctif (chirurgical) :
--   Réordonner/limiter dans une sous-requête `s`, puis agréger — exactement
--   comme les autres blocs sains. Le reste de la fonction (table
--   `__cross_gamme_car_new`, `SET search_path TO 'public'`, SECURITY DEFINER)
--   est préservé VERBATIM depuis la définition live.
--
-- Réversibilité : pur CREATE OR REPLACE d'une fonction (aucune donnée touchée,
--   aucun DDL de schéma). Rollback = ré-appliquer la définition précédente.
--
-- NB (hors scope, latent non-bloquant) : plusieurs LIMIT (related_parts 6,
--   compatible_motors 20, compatible_gammes 50) sont placés APRÈS jsonb_agg
--   donc inopérants (n'érigent aucune erreur). À corriger séparément si besoin
--   de borner la taille du payload — non requis pour lever le 404.
--
-- Date: 2026-06-25
-- ============================================================================

-- Garde-fous d'exécution (squawk require-timeout-settings) : borne l'attente de
-- lock et le temps d'exécution de ce CREATE OR REPLACE (DDL métadonnée rapide).
set statement_timeout = '5s';
set lock_timeout = '1s';

CREATE OR REPLACE FUNCTION public.get_substitution_data(
  p_gamme_alias text,
  p_marque_alias text DEFAULT NULL::text,
  p_modele_alias text DEFAULT NULL::text,
  p_type_alias text DEFAULT NULL::text,
  p_gamme_id integer DEFAULT NULL::integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  IF p_gamme_id IS NOT NULL THEN
    SELECT pg.pg_id, pg.pg_name, pg.pg_alias, cg.mc_mf_id
    INTO v_gamme_id, v_gamme_name, v_gamme_alias, v_mf_id
    FROM pieces_gamme pg
    LEFT JOIN catalog_gamme cg ON cg.mc_pg_id = pg.pg_id::TEXT
    WHERE pg.pg_id = p_gamme_id LIMIT 1;
    IF v_gamme_id IS NOT NULL THEN v_resolved_by := 'exact'; END IF;
  END IF;

  IF v_gamme_id IS NULL AND p_gamme_alias IS NOT NULL THEN
    SELECT pg.pg_id, pg.pg_name, pg.pg_alias, cg.mc_mf_id
    INTO v_gamme_id, v_gamme_name, v_gamme_alias, v_mf_id
    FROM pieces_gamme pg
    LEFT JOIN catalog_gamme cg ON cg.mc_pg_id = pg.pg_id::TEXT
    WHERE pg.pg_alias = LOWER(p_gamme_alias) LIMIT 1;
    IF v_gamme_id IS NOT NULL THEN v_resolved_by := 'exact'; END IF;
  END IF;

  IF v_mf_id IS NOT NULL THEN
    SELECT mf_name INTO v_mf_name FROM catalog_family WHERE mf_id = v_mf_id;
  END IF;

  IF v_gamme_id IS NOT NULL THEN
    SELECT COUNT(*)::INTEGER INTO v_products_count FROM pieces WHERE piece_pg_id = v_gamme_id;
  END IF;

  v_result := jsonb_build_object('_meta', jsonb_build_object(
    'gamme_found', v_gamme_id IS NOT NULL,
    'resolved_by', v_resolved_by,
    'products_count', v_products_count,
    'vehicle_found', false
  ));

  IF v_gamme_id IS NULL THEN
    -- FIX 42803 : trier/limiter en sous-requête, PUIS agréger.
    v_result := v_result || jsonb_build_object('suggestions', (
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
    ));
    RETURN v_result;
  END IF;

  v_result := v_result || jsonb_build_object('gamme', jsonb_build_object(
    'pg_id', v_gamme_id, 'pg_name', v_gamme_name, 'pg_alias', v_gamme_alias, 'mf_id', v_mf_id, 'mf_name', v_mf_name
  ));

  v_result := v_result || jsonb_build_object('substitute', (
    SELECT jsonb_build_object('piece_id', p.piece_id, 'piece_name', p.piece_name, 'piece_ref', COALESCE(p.piece_ref, ''), 'pm_name', COALESCE(pm.pm_name, ''))
    FROM pieces p LEFT JOIN pieces_marque pm ON pm.pm_id = p.piece_pm_id::INTEGER
    WHERE p.piece_pg_id = v_gamme_id AND p.piece_display = '1'
    ORDER BY p.piece_qty_sale::INTEGER DESC NULLS LAST, p.piece_sort ASC NULLS LAST LIMIT 1
  ));

  v_result := v_result || jsonb_build_object('related_parts', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('pg_id', pg.pg_id, 'pg_name', pg.pg_name, 'pg_alias', pg.pg_alias)), '[]'::jsonb)
    FROM pieces_gamme pg JOIN catalog_gamme cg ON cg.mc_pg_id = pg.pg_id::TEXT
    WHERE cg.mc_mf_id = v_mf_id AND pg.pg_id != v_gamme_id LIMIT 6
  ));

  v_result := v_result || jsonb_build_object('compatible_motors', (
    SELECT COALESCE(jsonb_agg(DISTINCT jsonb_build_object(
      'type_id', t.type_id::INTEGER,
      'type_name', t.type_name,
      'type_alias', t.type_alias,
      'type_fuel', t.type_fuel,
      'type_power_ps', t.type_power_ps,
      'type_year_from', t.type_year_from,
      'type_year_to', t.type_year_to,
      'type_body', t.type_body
    )), '[]'::jsonb)
    FROM __cross_gamme_car_new cgc
    JOIN auto_type t ON t.type_id = cgc.cgc_type_id
    WHERE cgc.cgc_pg_id = v_gamme_id::TEXT
      AND cgc.cgc_level IN ('1', '2', '3')
    LIMIT 20
  ));

  SELECT (t.type_id)::INTEGER INTO v_first_type_id
  FROM __cross_gamme_car_new cgc
  JOIN auto_type t ON t.type_id = cgc.cgc_type_id
  WHERE cgc.cgc_pg_id = v_gamme_id::TEXT
    AND cgc.cgc_level IN ('1', '2', '3')
  LIMIT 1;

  IF v_first_type_id IS NOT NULL THEN
    v_result := v_result || jsonb_build_object('compatible_gammes', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'pg_id', pg.pg_id,
        'pg_name', pg.pg_name,
        'pg_alias', pg.pg_alias,
        'pg_pic', pg.pg_pic,
        'total_pieces', sub.total_pieces
      ) ORDER BY sub.total_pieces DESC), '[]'::jsonb)
      FROM (
        SELECT
          prt.rtp_pg_id::INTEGER AS pg_id,
          COUNT(DISTINCT prt.rtp_piece_id)::BIGINT AS total_pieces
        FROM pieces_relation_type prt
        INNER JOIN pieces p ON prt.rtp_piece_id = p.piece_id
        INNER JOIN pieces_gamme pg ON p.piece_pg_id = pg.pg_id
        WHERE
          prt.rtp_type_id = v_first_type_id
          AND p.piece_display = true
          AND pg.pg_display = '1'
          AND pg.pg_level IN ('1', '2')
        GROUP BY prt.rtp_pg_id
      ) sub
      JOIN pieces_gamme pg ON pg.pg_id = sub.pg_id
      LIMIT 50
    ));
  ELSE
    v_result := v_result || jsonb_build_object('compatible_gammes', '[]'::jsonb);
  END IF;

  RETURN v_result;
END;
$function$;

COMMENT ON FUNCTION public.get_substitution_data IS
  'V5 - 2026-06-25: re-fix GROUP BY pg_name (chemin slug inconnu, ligne suggestions). Régression introduite par la réécriture cross_gamme_car_new du 2026-03-15. Sur __cross_gamme_car_new + search_path pinné.';

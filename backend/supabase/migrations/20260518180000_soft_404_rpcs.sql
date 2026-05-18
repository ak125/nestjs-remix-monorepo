-- 20260518180000_soft_404_rpcs.sql
-- Soft-404 R2 strategy : 2 RPC SECURITY DEFINER pour bypass RLS
-- (ADR-021 hardening + ADR-028 Option D READ_ONLY anon preprod).
-- Canon repo : 203 services `extends SupabaseBaseService` + `this.callRpc()`.
--
-- 1. get_soft_404_alternatives(type_id, pg_id, limit) → jsonb
--    Ranking multi-tier compat-aware (vehicles + gammes + relatedModels)
--    en pure SQL — 1 round-trip, RLS bypass.
-- 2. track_soft_404_event(pg_id, type_id, referrer, ua_class) → void
--    Append-only insert __soft_404_events.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- =============================================================================
-- get_soft_404_alternatives
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_soft_404_alternatives(
  p_type_id bigint,
  p_pg_id bigint,
  p_limit int DEFAULT 12
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_modele_id   int;
  v_target_marque_id   int;
  v_target_modele_parent int;
  v_target_power_ps    int;
  v_payload            jsonb;
BEGIN
  SELECT
    t.type_modele_id::int,
    t.type_marque_id::int,
    m.modele_parent::int,
    COALESCE(NULLIF(t.type_power_ps, '')::int, 0)
  INTO
    v_target_modele_id, v_target_marque_id, v_target_modele_parent, v_target_power_ps
  FROM auto_type t
  JOIN auto_modele m ON m.modele_id = t.type_modele_id::int
  WHERE t.type_id_i = p_type_id::int;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'alternativeVehicles', '[]'::jsonb,
      'alternativeGammes',   '[]'::jsonb,
      'relatedModels',       '[]'::jsonb
    );
  END IF;

  WITH
  tier_weights AS (
    SELECT 1 AS tier, 1.0::numeric AS weight
    UNION ALL SELECT 2, 0.8
    UNION ALL SELECT 3, 0.5
  ),
  -- Tier 1/2/3 véhicules : même marque, ayant cette gamme, sauf le type courant
  vehicle_candidates AS (
    SELECT
      t.type_id::text                                       AS type_id,
      COALESCE(t.type_name, '')                             AS type_name,
      t.type_alias                                          AS type_alias,
      COALESCE(t.type_fuel, '')                             AS type_fuel,
      COALESCE(t.type_power_ps, '')                         AS type_power_ps,
      COALESCE(t.type_year_from, '')                        AS type_year_from,
      COALESCE(t.type_year_to, '')                          AS type_year_to,
      m.modele_id,
      m.modele_name,
      m.modele_alias,
      m.modele_parent::int                                  AS modele_parent,
      ma.marque_id,
      ma.marque_name,
      ma.marque_alias,
      COALESCE(NULLIF(t.type_power_ps, '')::int, 0)         AS power_ps_num,
      CASE
        WHEN m.modele_id = v_target_modele_id THEN 1
        WHEN v_target_modele_parent IS NOT NULL
             AND m.modele_parent::int = v_target_modele_parent THEN 2
        ELSE 3
      END                                                   AS tier
    FROM auto_type t
    JOIN auto_modele m ON m.modele_id = t.type_modele_id::int
    JOIN auto_marque ma ON ma.marque_id = m.modele_marque_id
    WHERE t.type_marque_id::int = v_target_marque_id
      AND t.type_id_i <> p_type_id::int
      AND t.type_display = '1'
      AND t.type_relfollow = '1'
      AND EXISTS (
        SELECT 1 FROM pieces_relation_type r
        WHERE r.rtp_type_id = t.type_id_i AND r.rtp_pg_id = p_pg_id::int
      )
  ),
  vehicle_scored AS (
    SELECT vc.*,
      tw.weight * GREATEST(
        0.1::numeric,
        1::numeric - LEAST(1::numeric, ABS(vc.power_ps_num - v_target_power_ps)::numeric / 500)
      ) AS score
    FROM vehicle_candidates vc
    JOIN tier_weights tw ON tw.tier = vc.tier
  ),
  vehicle_ranked AS (
    SELECT *,
      ROW_NUMBER() OVER (PARTITION BY modele_id ORDER BY score DESC, type_id) AS rn_modele
    FROM vehicle_scored
  ),
  vehicle_top AS (
    SELECT *
    FROM vehicle_ranked
    WHERE rn_modele = 1
    ORDER BY score DESC, type_id
    LIMIT LEAST(6, p_limit)
  ),
  -- Gammes compatibles avec ce type, exclu pg_id courant
  gamme_counts AS (
    SELECT r.rtp_pg_id AS pg_id, COUNT(*) AS piece_count
    FROM pieces_relation_type r
    WHERE r.rtp_type_id = p_type_id::int
      AND r.rtp_pg_id <> p_pg_id::int
    GROUP BY r.rtp_pg_id
  ),
  -- Cluster V1 : freinage-arriere = [3859]. Cluster vide → tier 3 (fallback popularité).
  gamme_candidates AS (
    SELECT
      pg.pg_id,
      pg.pg_name,
      pg.pg_alias,
      pg.pg_pic,
      pg.pg_top,
      gc.piece_count,
      3 AS tier  -- V1 : tous tier 3 (cluster squelette, mémoire feedback_v1_first_dont_build_ultimate_engine_too_early)
    FROM gamme_counts gc
    JOIN pieces_gamme pg ON pg.pg_id = gc.pg_id
    WHERE pg.pg_display = '1'
  ),
  gamme_scored AS (
    SELECT gc.*,
      tw.weight * LN(1 + gc.piece_count) *
        CASE WHEN gc.pg_top = '1' THEN 1.2 ELSE 1.0 END AS score
    FROM gamme_candidates gc
    JOIN tier_weights tw ON tw.tier = gc.tier
  ),
  gamme_top AS (
    SELECT * FROM gamme_scored
    ORDER BY score DESC, pg_id
    LIMIT LEAST(8, p_limit)
  ),
  -- Modèles frères (même marque) ayant cette gamme, sauf modele courant
  related_models_pre AS (
    SELECT DISTINCT m.modele_id, m.modele_name, m.modele_alias
    FROM auto_modele m
    WHERE m.modele_marque_id = v_target_marque_id
      AND m.modele_id <> v_target_modele_id
      AND m.modele_display = 1
      AND EXISTS (
        SELECT 1
        FROM auto_type t
        JOIN pieces_relation_type r ON r.rtp_type_id = t.type_id_i
        WHERE t.type_modele_id::int = m.modele_id
          AND t.type_display = '1'
          AND t.type_relfollow = '1'
          AND r.rtp_pg_id = p_pg_id::int
      )
    ORDER BY m.modele_id
    LIMIT 4
  ),
  rep_types AS (
    SELECT
      rmp.modele_id,
      rmp.modele_name,
      rmp.modele_alias,
      (
        SELECT jsonb_build_object('type_id', t.type_id::text, 'type_alias', COALESCE(t.type_alias, ''))
        FROM auto_type t
        WHERE t.type_modele_id::int = rmp.modele_id
          AND t.type_display = '1'
          AND t.type_relfollow = '1'
          AND EXISTS (
            SELECT 1 FROM pieces_relation_type r
            WHERE r.rtp_type_id = t.type_id_i AND r.rtp_pg_id = p_pg_id::int
          )
        ORDER BY
          (SELECT COUNT(*) FROM pieces_relation_type r2
             WHERE r2.rtp_type_id = t.type_id_i AND r2.rtp_pg_id = p_pg_id::int) DESC,
          t.type_id_i ASC
        LIMIT 1
      ) AS rep
    FROM related_models_pre rmp
  ),
  related_marque AS (
    SELECT marque_id, marque_name, marque_alias
    FROM auto_marque
    WHERE marque_id = v_target_marque_id
  )
  SELECT jsonb_build_object(
    'alternativeVehicles',
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'type_id',        type_id,
          'type_name',      type_name,
          'type_alias',     type_alias,
          'type_fuel',      type_fuel,
          'type_power_ps',  type_power_ps,
          'type_year_from', type_year_from,
          'type_year_to',   type_year_to,
          'modele_id',      modele_id,
          'modele_name',    modele_name,
          'modele_alias',   modele_alias,
          'marque_id',      marque_id,
          'marque_name',    marque_name,
          'marque_alias',   marque_alias,
          'tier',           tier
        ) ORDER BY score DESC, type_id)
        FROM vehicle_top
      ), '[]'::jsonb),
    'alternativeGammes',
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'pg_id',       pg_id,
          'pg_name',     pg_name,
          'pg_alias',    pg_alias,
          'pg_pic',      pg_pic,
          'piece_count', piece_count,
          'tier',        tier
        ) ORDER BY score DESC, pg_id)
        FROM gamme_top
      ), '[]'::jsonb),
    'relatedModels',
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'modele_id',                 rt.modele_id,
          'modele_name',               rt.modele_name,
          'modele_alias',              rt.modele_alias,
          'marque_id',                 rm.marque_id,
          'marque_name',               rm.marque_name,
          'marque_alias',              rm.marque_alias,
          'representative_type_id',    (rt.rep->>'type_id'),
          'representative_type_alias', COALESCE(rt.rep->>'type_alias', '')
        ) ORDER BY rt.modele_id)
        FROM rep_types rt
        CROSS JOIN related_marque rm
        WHERE rt.rep IS NOT NULL
      ), '[]'::jsonb)
  ) INTO v_payload;

  RETURN v_payload;
END $$;

REVOKE ALL ON FUNCTION public.get_soft_404_alternatives(bigint, bigint, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_soft_404_alternatives(bigint, bigint, int)
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.get_soft_404_alternatives(bigint, bigint, int) IS
  'Soft-404 R2 : ranking multi-tier compat-aware (véhicules / gammes / modèles frères). '
  'Bypass RLS via SECURITY DEFINER. ADR-076-soft-404-r2-strategy. '
  'Cf. memoire feedback_seo_methodology_canon_20260506.';

-- =============================================================================
-- track_soft_404_event
-- =============================================================================
CREATE OR REPLACE FUNCTION public.track_soft_404_event(
  p_pg_id integer,
  p_type_id integer,
  p_referrer text DEFAULT NULL,
  p_ua_class text DEFAULT 'unknown'
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_ua_class NOT IN ('bot', 'browser', 'unknown') THEN
    RAISE EXCEPTION 'invalid ua_class: % (expected bot|browser|unknown)', p_ua_class;
  END IF;
  INSERT INTO __soft_404_events (pg_id, type_id, referrer, ua_class)
  VALUES (p_pg_id, p_type_id, p_referrer, p_ua_class);
END $$;

REVOKE ALL ON FUNCTION public.track_soft_404_event(integer, integer, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_soft_404_event(integer, integer, text, text)
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.track_soft_404_event(integer, integer, text, text) IS
  'Soft-404 R2 telemetry beacon (append-only insert __soft_404_events). '
  'Bypass RLS via SECURITY DEFINER. ADR-076-soft-404-r2-strategy. '
  'Validation ua_class IN (bot,browser,unknown).';

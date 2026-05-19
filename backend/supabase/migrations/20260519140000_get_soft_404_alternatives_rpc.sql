-- 20260519140000_get_soft_404_alternatives_rpc.sql
-- Source-of-truth for the get_soft_404_alternatives RPC (was orphan in DB).
-- Owner: seo-platform. ADR: ADR-soft-404-r2-strategy.
--
-- Context: PR #595 introduced the soft-404 R2 feature and TS-side query logic
-- in RmAlternativesService, but ADR-028 Option D (preprod = SUPABASE_ANON_KEY
-- only, READ_ONLY=true) means the anon role hits the RLS allow-list which
-- covers only service_role on auto_type/auto_modele/auto_marque/pieces_gamme/
-- pieces_relation_type. The TS path therefore returned empty arrays on preprod,
-- the controller's silent catch swallowed the (non-)error, and the Soft-404 R2
-- smoke step in the deploy job failed on all 5 fixtures since 2026-05-18 17:26
-- (run 26049337425 onward).
--
-- This RPC is SECURITY DEFINER so it bypasses RLS on the catalog tables when
-- invoked by anon. Same multi-tier ranking semantics as the (deleted) TS code.
--
-- Pattern canonique (squawk + .squawk.toml `assume_in_transaction = true`) :
--   - pas de BEGIN/COMMIT (le moteur Supabase wrap déjà la migration)
--   - SET LOCAL lock_timeout / statement_timeout en tête
--   - SECURITY DEFINER + SET search_path = public (anti hijacking)

-- squawk-ignore-file prefer-text-field
-- squawk-ignore-file prefer-bigint-over-int
--
-- Rationale (per 20260517_seo_r2_v2_outbox_relay_rpc.sql canon) :
--   The two rules fire on PL/pgSQL function definitions that reuse PostgreSQL
--   native parameter types (TEXT, INT). The function only owns its parameters
--   — no new persistent columns are introduced, so the project-wide TEXT/BIGINT
--   canon (vehicle-ops anti-patterns) does not apply.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE OR REPLACE FUNCTION public.get_soft_404_alternatives(
  p_type_id BIGINT,
  p_pg_id   BIGINT,
  p_limit   INTEGER DEFAULT 12
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_target_modele_id     int;
  v_target_marque_id     int;
  v_target_modele_parent int;
  v_target_power_ps      int;
  v_payload              jsonb;
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
  gamme_counts AS (
    SELECT r.rtp_pg_id AS pg_id, COUNT(*) AS piece_count
    FROM pieces_relation_type r
    WHERE r.rtp_type_id = p_type_id::int
      AND r.rtp_pg_id <> p_pg_id::int
    GROUP BY r.rtp_pg_id
  ),
  gamme_candidates AS (
    SELECT
      pg.pg_id,
      pg.pg_name,
      pg.pg_alias,
      pg.pg_pic,
      pg.pg_top,
      gc.piece_count,
      3 AS tier
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
END $function$;

COMMENT ON FUNCTION public.get_soft_404_alternatives(BIGINT, BIGINT, INTEGER) IS
  'Soft-404 R2 : ranking multi-tier compat-aware (véhicules / gammes / modèles frères). Bypass RLS via SECURITY DEFINER. ADR-soft-404-r2-strategy.';

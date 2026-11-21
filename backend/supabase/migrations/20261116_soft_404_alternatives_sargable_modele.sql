-- =============================================================================
-- Migration : get_soft_404_alternatives — jointure type → modèle indexable
-- Date      : 2026-11-16 (mandat AO)
-- Scope     : DEUX prédicats du corps de la fonction (CTE related_models_pre et
--             sous-requête rep_types). Signature, retour, langage, SECURITY
--             DEFINER, search_path, propriétaire, droits (proacl) et commentaire
--             inchangés : CREATE OR REPLACE conserve ACL, propriétaire et
--             commentaire. Aucune table, aucune donnée touchée.
-- Forward-only. Ne réécrit AUCUNE migration historique (20260518180000 reste
-- l'origine de la fonction).
-- =============================================================================
--
-- CAUSE (base réelle, transaction en lecture seule, 2026-11-15/16 UTC) :
--   __error_logs, 7 jours : 318 erreurs 503 « Alternatives temporairement
--   indisponibles » sur /api/rm/alternatives (2026-11-09 → 2026-11-15), appelant
--   = le loader SSR (127.0.0.1), 311 paires (type, gamme) distinctes.
--   Chaîne : le wrapper fetch du client Supabase coupe à 15 s
--   (supabase-base.service.ts, AbortSignal.timeout(15000)) → callRpc rend une
--   erreur → RmAlternativesService met UNAVAILABLE en cache 30 s → 503.
--
--   La fonction prend jusqu'à 41,9 s sur ces paires. EXPLAIN ANALYZE (7896/234,
--   20,9 s) : 18,9 s dans related_models_pre. Le prédicat
--       t.type_modele_id::int = m.modele_id
--   convertit la colonne TEXT auto_type.type_modele_id : l'index
--   idx_at_modele_id (sur la colonne texte) devient inutilisable, le planner
--   fait une Merge Semi Join sur les 9 834 types affichables de TOUTES les
--   marques × pieces_relation_type de la gamme (1 916 467 lignes lues,
--   1 558 148 heap fetches, ≈ 1,65 M buffers).
--
-- CORRECTIF : comparer en texte du côté de la constante de la ligne externe,
--       t.type_modele_id = m.modele_id::text
--       t.type_modele_id = rmp.modele_id::text
--   L'index idx_at_modele_id redevient utilisable (Nested Loop Semi Join,
--   1 ligne lue par type dans l'EXISTS).
--
-- ÉQUIVALENCE : les 53 959 lignes de auto_type portent un type_modele_id
--   entier canonique (^[1-9][0-9]*$, 0 exception, mesuré le 2026-11-15) ;
--   m.modele_id::text produit la même forme canonique, donc les deux
--   prédicats sélectionnent les mêmes lignes. Contrôle : md5 du jsonb rendu
--   identique sur 40/40 paires (20 paires en échec + 20 paires tirées de
--   __soft_404_events). Un type_modele_id non canonique (« 0123 », « 12 »)
--   ne serait plus joint : aujourd'hui il n'en existe aucun. Le filtre
--   type_marque_id::int de vehicle_candidates est laissé tel quel (bitmap
--   peu coûteux) ; aucun filtre marque n'est ajouté (318 types ont un
--   type_marque_id différent du modele_marque_id de leur modèle : il
--   changerait le résultat).
--
-- MESURES (même base, lecture seule) :
--   * 20 paires en échec, nouvelle version à froid puis originale :
--     max 9,6 s contre 39,7 s ; 0/20 au-delà de 15 s contre 5/20.
--   * Plan générique forcé (plan_cache_mode = force_generic_plan, comme
--     PL/pgSQL après 5 exécutions), 4 paires, à chaud : 67–88 ms contre
--     0,8–11,6 s ; le plan garde idx_at_modele_id.
--   * 20 paires tirées de __soft_404_events, à chaud : 32–210 ms contre
--     114–868 ms.
--   Coût résiduel à froid : gamme_counts (index-only scan avec heap fetches
--   sur pieces_relation_type, jamais vacuumée : 31,6 M tuples morts,
--   vacuum_count = autovacuum_count = 0). Hors périmètre de cette migration :
--   réglage de maintenance laissé à l'owner (voir RAPPORT-MANDAT-AO.md).
--
-- assume_in_transaction (squawk) : pas de BEGIN/COMMIT explicite. Timeouts requis
-- (squawk require-timeout-settings) avant CREATE OR REPLACE FUNCTION.
--
-- Droits : aucun GRANT ni REVOKE ici. CREATE OR REPLACE conserve la proacl
-- actuelle ; la fonction figure dans scripts/lint/definer-anon-allowlist.txt
-- (rendu public R2, smoke « Soft-404 R2 » de ci.yml).
--
-- RETOUR ARRIÈRE : 20261116_soft_404_alternatives_sargable_modele.down.sql
-- (rétablit les deux prédicats d'origine, donc la lenteur décrite ci-dessus).

SET lock_timeout = '5s';
SET statement_timeout = '30s';

CREATE OR REPLACE FUNCTION public.get_soft_404_alternatives(p_type_id bigint, p_pg_id bigint, p_limit integer DEFAULT 12)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
        WHERE t.type_modele_id = m.modele_id::text
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
        WHERE t.type_modele_id = rmp.modele_id::text
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

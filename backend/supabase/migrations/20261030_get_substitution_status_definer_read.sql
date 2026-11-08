-- =============================================================================
-- Migration : statut de substitution d'une gamme, sans les blocs de contenu
--             (lecture seule, pour le contrôle 404/410 des pages produit R1)
-- Date      : 2026-10-30
-- Scope     : UNE fonction créée, en lecture seule. Aucune table modifiée,
--             aucun droit de table touché, aucune donnée écrite, aucune autre
--             fonction touchée (get_substitution_data reste inchangée).
-- Forward-only. Ne réécrit AUCUNE migration historique.
-- =============================================================================
--
-- CONTEXTE
-- --------
-- Le loader de la page produit (frontend/app/routes/pieces.$slug.tsx) appelle
-- /api/substitution/check?vehicleOptions=false en parallèle des données de la
-- page, avec un abandon à 3 s. Il n'en lit que httpStatus : 404 (gamme
-- inconnue) ou 410 (gamme sans produit). Le service appelle pourtant
-- get_substitution_data, qui calcule six blocs, dont compatible_gammes
-- (jointure pieces_relation_type × pieces sur le premier véhicule compatible).
--
-- Mesuré le 2026-10-30 sur les données réelles, en lecture seule, sur les 20
-- gammes affichées G1/G2 qui ont le plus de produits : get_substitution_data
-- prend jusqu'à 6,3 s (etrier-de-frein 6 335 ms, alternateur 4 897 ms,
-- kit-d-embrayage 4 278 ms, demarreur 4 129 ms) ; 11 gammes sur 20 dépassent
-- 1 s. Au-delà de 3 s, le loader abandonne : la page attend 3 s, puis se rend
-- SANS contrôle 404/410. La même lecture limitée au statut prend 4 à 14 ms.
--
-- get_substitution_status rend exactement les clés `_meta` et `gamme` de
-- get_substitution_data, rien d'autre. Le service l'appelle en mode léger
-- (includeVehicleOptions=false) ; le mode complet garde get_substitution_data
-- (PR de code séparée, ouverte en brouillon jusqu'à l'application de cette
-- migration).
--
-- CORPS : extrait de get_substitution_data telle qu'en base le 2026-10-30
-- (= 20260625_fix_get_substitution_data_group_by_unknown_slug.sql), résolution
-- par identifiant puis par alias, famille, compte des produits, `_meta`,
-- `gamme`. Différences, et elles seules : relations qualifiées `public.` ;
-- blocs suggestions, substitute, related_parts, compatible_motors et
-- compatible_gammes retirés ; le bloc `gamme` placé sous
-- `IF v_gamme_id IS NOT NULL` au lieu du RETURN anticipé (même sortie).
--
-- ÉQUIVALENCE VÉRIFIÉE le 2026-10-30, sur les données réelles, transaction en
-- lecture seule (corps exécuté dans un bloc DO, comparé à
-- get_substitution_data(...) privée des cinq blocs retirés) : 55 cas sur 55
-- identiques — gammes avec et sans produits, par identifiant, par alias seul,
-- alias en majuscules, identifiant inconnu avec alias valide, gamme et alias
-- inconnus, aucun paramètre, gamme présente deux fois dans catalog_gamme, et
-- les 20 gammes G1/G2 les plus fournies.
--
-- SÛRETÉ
-- ------
--   * lecture seule (STABLE, aucun INSERT/UPDATE/DELETE) ;
--   * search_path = public, pg_temp (pg_temp en dernier) ; toutes les relations
--     du corps sont qualifiées `public.` ;
--   * EXECUTE retiré à PUBLIC, anon et authenticated (privilèges par défaut
--     Supabase), puis accordé à anon (container PREPROD READ_ONLY, qui appelle
--     déjà get_substitution_data en anon) et à service_role (PROD, DEV) ;
--   * PAS d'entrée dans scripts/lint/definer-anon-allowlist.txt : le REVOKE écrit
--     ci-dessous satisfait la règle 1 de check-definer-anon-surface.sh, comme pour
--     20261026_vehicle_api_definer_reads.sql.
--
-- SURFACE OUVERTE À ANON, ASSUMÉE
-- -------------------------------
-- Rien de plus que get_substitution_data, déjà exécutable par anon
-- (definer-anon-allowlist.txt) : un sous-ensemble strict de sa sortie.
--
-- assume_in_transaction (squawk) : pas de BEGIN/COMMIT explicite. Timeouts requis
-- (squawk require-timeout-settings) avant CREATE FUNCTION.
--
-- RETOUR ARRIÈRE : 20261030_get_substitution_status_definer_read.down.sql, à ne
-- lancer qu'APRÈS le retrait du code qui appelle la fonction.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

CREATE OR REPLACE FUNCTION public.get_substitution_status(
  p_gamme_alias text DEFAULT NULL::text,
  p_gamme_id integer DEFAULT NULL::integer
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_gamme_id INTEGER;
  v_gamme_name TEXT;
  v_gamme_alias TEXT;
  v_mf_id TEXT;
  v_mf_name TEXT;
  v_resolved_by TEXT := 'none';
  v_products_count INTEGER := 0;
  v_result JSONB;
BEGIN
  IF p_gamme_id IS NOT NULL THEN
    SELECT pg.pg_id, pg.pg_name, pg.pg_alias, cg.mc_mf_id
    INTO v_gamme_id, v_gamme_name, v_gamme_alias, v_mf_id
    FROM public.pieces_gamme pg
    LEFT JOIN public.catalog_gamme cg ON cg.mc_pg_id = pg.pg_id::TEXT
    WHERE pg.pg_id = p_gamme_id LIMIT 1;
    IF v_gamme_id IS NOT NULL THEN v_resolved_by := 'exact'; END IF;
  END IF;

  IF v_gamme_id IS NULL AND p_gamme_alias IS NOT NULL THEN
    SELECT pg.pg_id, pg.pg_name, pg.pg_alias, cg.mc_mf_id
    INTO v_gamme_id, v_gamme_name, v_gamme_alias, v_mf_id
    FROM public.pieces_gamme pg
    LEFT JOIN public.catalog_gamme cg ON cg.mc_pg_id = pg.pg_id::TEXT
    WHERE pg.pg_alias = LOWER(p_gamme_alias) LIMIT 1;
    IF v_gamme_id IS NOT NULL THEN v_resolved_by := 'exact'; END IF;
  END IF;

  IF v_mf_id IS NOT NULL THEN
    SELECT mf_name INTO v_mf_name FROM public.catalog_family WHERE mf_id = v_mf_id;
  END IF;

  IF v_gamme_id IS NOT NULL THEN
    SELECT COUNT(*)::INTEGER INTO v_products_count FROM public.pieces WHERE piece_pg_id = v_gamme_id;
  END IF;

  v_result := jsonb_build_object('_meta', jsonb_build_object(
    'gamme_found', v_gamme_id IS NOT NULL,
    'resolved_by', v_resolved_by,
    'products_count', v_products_count,
    'vehicle_found', false
  ));

  IF v_gamme_id IS NOT NULL THEN
    v_result := v_result || jsonb_build_object('gamme', jsonb_build_object(
      'pg_id', v_gamme_id, 'pg_name', v_gamme_name, 'pg_alias', v_gamme_alias, 'mf_id', v_mf_id, 'mf_name', v_mf_name
    ));
  END IF;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_substitution_status(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_substitution_status(text, integer) TO anon, service_role;

-- Garde de fin : la migration échoue (et rien n'est appliqué) si la fonction
-- n'est pas STABLE SECURITY DEFINER avec ce search_path, ou si les droits ne
-- sont pas ceux attendus.
DO $postcheck$
DECLARE
  v_oid oid := to_regprocedure('public.get_substitution_status(text, integer)');
BEGIN
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'ABORT: public.get_substitution_status(text, integer) absente (signature inattendue)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
     WHERE p.oid = v_oid
       AND p.prosecdef
       AND p.provolatile = 's'
       AND NOT p.proretset
       AND p.prorettype = 'jsonb'::regtype
       AND pg_get_userbyid(p.proowner) = 'postgres'
       AND p.proconfig = ARRAY['search_path=public, pg_temp']
  ) THEN
    RAISE EXCEPTION 'ABORT: état de get_substitution_status inattendu (STABLE SECURITY DEFINER jsonb, propriétaire postgres, search_path)';
  END IF;

  IF NOT has_function_privilege('anon', v_oid, 'EXECUTE')
     OR has_function_privilege('authenticated', v_oid, 'EXECUTE')
     OR NOT has_function_privilege('service_role', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'ABORT: droits EXECUTE inattendus sur get_substitution_status (attendu : anon et service_role côté API)';
  END IF;
END
$postcheck$;

-- =============================================================================
-- Vérification post-migration (lecture seule, à jouer après apply)
-- =============================================================================
--   SELECT p.oid::regprocedure, p.provolatile, p.prosecdef, p.proconfig, p.proacl
--     FROM pg_proc p
--    WHERE p.proname = 'get_substitution_status';
--   -- attendu : 1 ligne, s, true, {"search_path=public, pg_temp"},
--   --           {postgres=X/postgres,anon=X/postgres,service_role=X/postgres}
--
--   SELECT public.get_substitution_status(p_gamme_id => 78)
--        = public.get_substitution_data(p_gamme_alias => NULL, p_gamme_id => 78)
--          - ARRAY['suggestions','substitute','related_parts',
--                  'compatible_motors','compatible_gammes'];   -- true
-- =============================================================================

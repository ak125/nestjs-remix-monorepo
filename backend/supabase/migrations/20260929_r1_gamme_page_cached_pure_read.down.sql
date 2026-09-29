-- Rollback : 20260929_r1_gamme_page_cached_pure_read
-- (documentation d'intervention manuelle ; le runner ignore les .down.sql,
-- politique forward-only).
--
-- Restaure le corps de get_gamme_page_data_cached(integer) tel qu'il est servi
-- par la base live le 2026-09-29 (pg_get_functiondef, lecture seule), VERBATIM :
-- md5(prosrc) = d576e9b9fd198d4d832661b2371aa57d. C'est le corps de
-- 20260427_gamme_page_cache_build_fn.sql avec le search_path épinglé par
-- 20260616_vague5_pin_function_search_path.sql. La fonction live n'avait AUCUN
-- commentaire : le rollback le remet à NULL.
--
-- EFFET DU ROLLBACK — à lire avant de l'appliquer : sur un cache absent ou
-- périmé, la fonction STABLE rappelle rebuild_gamme_page_cache (VOLATILE, qui
-- écrit) ; sous PostgREST (transaction READ ONLY) chaque appel lève de nouveau
-- SQLSTATE 25006. L'endpoint RPC V2 redevient 503 pour les ~3 973 gammes
-- affichées sans ligne de cache, et leurs URL redeviennent des 404 produits
-- par cette erreur. C'est précisément le défaut que 20260929 corrige.
--
-- Les droits ne sont pas touchés (CREATE OR REPLACE conserve ACL et
-- propriétaire). Aucune table, colonne, valeur d'enum, index ni job pg_cron n'a
-- été créé par 20260929 : rien d'autre à défaire.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '15s';

CREATE OR REPLACE FUNCTION public.get_gamme_page_data_cached(p_pg_id integer)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cached_payload JSONB;
  v_cached_stale   BOOLEAN;
  v_built          BOOLEAN;
BEGIN
  SELECT payload, stale
    INTO v_cached_payload, v_cached_stale
    FROM public.__gamme_page_cache
    WHERE pg_id = p_pg_id;

  IF v_cached_payload IS NOT NULL AND v_cached_stale = FALSE THEN
    RETURN v_cached_payload::JSON;
  END IF;

  v_built := public.rebuild_gamme_page_cache(p_pg_id);

  IF v_built = FALSE THEN
    RETURN NULL;
  END IF;

  SELECT payload INTO v_cached_payload
    FROM public.__gamme_page_cache
    WHERE pg_id = p_pg_id;

  RETURN v_cached_payload::JSON;
END;
$function$;

COMMENT ON FUNCTION public.get_gamme_page_data_cached(integer) IS NULL;

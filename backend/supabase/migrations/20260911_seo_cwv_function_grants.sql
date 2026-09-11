-- =============================================================================
-- Migration : moindre privilège pour les fonctions d'agrégation CWV
-- Date      : 2026-09-11
-- Scope     : droits EXECUTE de 2 fonctions de public, rien d'autre
--               public.aggregate_cwv_hourly(timestamp with time zone)
--               public.detect_cwv_aggregation_coverage_gap(integer, integer, integer)
-- Forward-only. Ne réécrit AUCUNE migration historique. Aucun corps de fonction,
-- aucune table, aucun job pg_cron n'est modifié.
-- =============================================================================
--
-- CONTEXTE
-- --------
-- Les deux fonctions sont exécutées par pg_cron sous le rôle postgres, qui en est
-- le propriétaire :
--   • job cwv-hourly-aggregation         (5 * * * *)  → aggregate_cwv_hourly
--   • job cwv-aggregation-coverage-check (35 * * * *) → detect_cwv_aggregation_coverage_gap
-- Le scheduler NestJS qui appelait aggregate_cwv_hourly a été retiré par #1166
-- (pg_cron seul orchestrateur, 20260626_seo_cwv_aggregation_cron). Aucun appel de
-- ces deux noms dans backend/, frontend/ ni scripts/ en dehors des migrations et
-- du banc de test jetable scripts/db/test-cwv-daily-rum-exact-p75.sh.
--
-- Cette migration aligne leurs droits EXECUTE sur ceux des fonctions voisines de
-- la même chaîne (aggregate_cwv_daily_rum, detect_cwv_trend_divergence —
-- 20260911_seo_cwv_daily_rum_exact_p75) : EXECUTE réservé à service_role, le
-- propriétaire postgres conservant le sien.
--
-- RÔLES
-- -----
--   • postgres      — propriétaire, rôle des jobs pg_cron : entrée ACL inchangée.
--   • service_role  — EXECUTE conservé, tel que posé par les migrations créatrices
--                     (20260527_seo_cwv_aggregation, 20260601 / 20260626
--                     coverage_alert) ; GRANT rejoué pour un état final explicite.
--   • PUBLIC, anon, authenticated — EXECUTE retiré.
--
-- Rejouable : uniquement SET LOCAL, REVOKE, GRANT et un bloc DO en lecture seule.
--
-- ROLLBACK : pas de .down.sql. Si un appelant légitime est identifié, ré-accorder
-- EXECUTE à son seul rôle, puis le consigner dans une nouvelle migration forward :
--   GRANT EXECUTE ON FUNCTION <signature> TO <rôle de l'appelant>;
-- =============================================================================

-- Pas de BEGIN/COMMIT explicite : le moteur applique ce fichier dans une
-- transaction (chemin transactionnel d'apply-supabase-migration.py). SET LOCAL
-- borne les délais à cette transaction et ne déborde pas sur les migrations
-- suivantes du même run.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

REVOKE ALL ON FUNCTION public.aggregate_cwv_hourly(timestamp with time zone)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aggregate_cwv_hourly(timestamp with time zone)
  TO service_role;

REVOKE ALL ON FUNCTION public.detect_cwv_aggregation_coverage_gap(integer, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.detect_cwv_aggregation_coverage_gap(integer, integer, integer)
  TO service_role;

-- Post-condition : la transaction est annulée si l'état obtenu n'est pas celui
-- attendu (par exemple si le rôle d'application n'a pas pu modifier ces droits,
-- cas où PostgreSQL n'émet qu'un avertissement). Lecture du catalogue seulement,
-- via has_function_privilege ; aucune fonction applicative n'est appelée.
DO $postcheck$
DECLARE
  v_fn regprocedure;
BEGIN
  FOREACH v_fn IN ARRAY ARRAY[
    'public.aggregate_cwv_hourly(timestamp with time zone)'::regprocedure,
    'public.detect_cwv_aggregation_coverage_gap(integer, integer, integer)'::regprocedure
  ]
  LOOP
    IF has_function_privilege('public', v_fn, 'EXECUTE')
       OR has_function_privilege('anon', v_fn, 'EXECUTE')
       OR has_function_privilege('authenticated', v_fn, 'EXECUTE')
       OR NOT has_function_privilege('postgres', v_fn, 'EXECUTE')
       OR NOT has_function_privilege('service_role', v_fn, 'EXECUTE')
    THEN
      RAISE EXCEPTION 'ABORT: droits EXECUTE inattendus sur %', v_fn;
    END IF;
  END LOOP;
END
$postcheck$;

-- =============================================================================
-- Vérification post-migration (lecture seule, à jouer après apply)
-- =============================================================================
--   SELECT p.oid::regprocedure AS fn, p.proacl::text,
--          has_function_privilege('anon',          p.oid, 'EXECUTE') AS anon,
--          has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated,
--          has_function_privilege('service_role',  p.oid, 'EXECUTE') AS service_role,
--          has_function_privilege('postgres',      p.oid, 'EXECUTE') AS postgres
--     FROM pg_proc p
--    WHERE p.oid IN ('public.aggregate_cwv_hourly(timestamp with time zone)'::regprocedure,
--                    'public.detect_cwv_aggregation_coverage_gap(integer, integer, integer)'::regprocedure);
--   -- attendu : proacl = {postgres=X/postgres,service_role=X/postgres}
--   --           anon = false, authenticated = false, service_role = true, postgres = true
--
--   SELECT j.jobname, d.status, d.start_time
--     FROM cron.job_run_details d JOIN cron.job j USING (jobid)
--    WHERE j.jobname IN ('cwv-hourly-aggregation', 'cwv-aggregation-coverage-check')
--    ORDER BY d.start_time DESC LIMIT 4;
--   -- attendu : succeeded pour les exécutions postérieures à l'application
-- =============================================================================

-- Rollback : 20260924_vehicle_cache_trigger_rebuild_failure_observable
-- (documentation d'intervention manuelle ; le runner ignore les .down.sql,
-- politique forward-only).
--
-- Restaure le corps de trg_auto_type_rebuild_cache() tel qu'il est servi par la
-- base live le 2026-09-24 (pg_get_functiondef, lecture seule), VERBATIM :
-- md5(prosrc) = 44ce0363e9a0fd31919c6d0bb0bc56db. C'est le corps de
-- 20260425_trigger_auto_type_rebuild_vehicle_cache.sql avec le search_path
-- épinglé par 20260616_vague5_pin_function_search_path.sql, et le commentaire
-- live.
--
-- EFFET DU ROLLBACK — à lire avant de l'appliquer : un échec de rebuild
-- redevient un simple WARNING (exception) ou rien du tout (payload NULL), et un
-- type affichable peut de nouveau rester sans ligne de cache sans aucune trace.
-- C'est précisément le défaut que 20260924 corrige. Ne rouler en arrière que si
-- le signal lui-même pose problème, jamais pour le faire taire.
--
-- SECOND EFFET : le rollback retire aussi l'AUTO-RÉSOLUTION. Tout événement
-- alert_kind='vehicle_page_cache_trigger_rebuild_failed' encore OUVERT le
-- restera indéfiniment. Avant de rouler en arrière, refermer à la main ceux
-- dont la ligne de cache existe :
--   UPDATE public.__seo_event_log e
--      SET resolved_at = now(),
--          payload = e.payload || jsonb_build_object('resolution_kind', 'manual_after_rollback')
--    WHERE e.event_type = 'anomaly_detected'
--      AND e.payload->>'alert_kind' = 'vehicle_page_cache_trigger_rebuild_failed'
--      AND e.resolved_at IS NULL
--      AND EXISTS (SELECT 1 FROM public.__vehicle_page_cache c
--                   WHERE c.type_id = (e.payload->>'type_id')::int);
--
-- Les événements déjà écrits ne sont PAS supprimés : ce sont des faits
-- observés, pas de la configuration. Aucune table, colonne, valeur d'enum,
-- index ni job pg_cron n'a été créé par 20260924 : rien d'autre à défaire.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE OR REPLACE FUNCTION public.trg_auto_type_rebuild_cache()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_type_id_int INTEGER;
BEGIN
  v_type_id_int := NEW.type_id::INTEGER;

  IF (TG_OP = 'INSERT' AND NEW.type_display::INT = 1)
     OR (TG_OP = 'UPDATE' AND COALESCE(OLD.type_display, '0')::INT = 0 AND NEW.type_display::INT = 1)
  THEN
    BEGIN
      PERFORM public.rebuild_vehicle_page_cache(v_type_id_int);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'INC-2026-007: rebuild_vehicle_page_cache(%) failed in trigger: %',
        v_type_id_int, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.trg_auto_type_rebuild_cache() IS
  'INC-2026-007 Etape 3: pre-rebuild __vehicle_page_cache des qu''un type est insere ou active.';

REVOKE EXECUTE ON FUNCTION public.trg_auto_type_rebuild_cache() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.trg_auto_type_rebuild_cache() TO service_role;

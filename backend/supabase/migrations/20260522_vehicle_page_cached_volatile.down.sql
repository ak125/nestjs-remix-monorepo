-- Rollback for 20260522_vehicle_page_cached_volatile.sql
-- Restores get_vehicle_page_data_cached() to STABLE (its pre-fix volatility).
-- NOTE: reverting reintroduces the "cannot execute DELETE in a read-only transaction"
-- 503 for not-found / cold vehicles via PostgREST. Only roll back if the VOLATILE
-- change itself causes a regression.

CREATE OR REPLACE FUNCTION public.get_vehicle_page_data_cached(p_type_id integer)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
DECLARE
  v_cached_payload JSONB;
  v_cached_stale   BOOLEAN;
  v_built          BOOLEAN;
BEGIN
  SELECT payload, stale
    INTO v_cached_payload, v_cached_stale
    FROM public.__vehicle_page_cache
    WHERE type_id = p_type_id;

  IF v_cached_payload IS NOT NULL AND v_cached_stale = FALSE THEN
    RETURN v_cached_payload::JSON;
  END IF;

  v_built := public.rebuild_vehicle_page_cache(p_type_id);

  IF v_built = FALSE THEN
    RETURN json_build_object(
      'success', FALSE,
      'error', 'Vehicle not found',
      'type_id', p_type_id
    );
  END IF;

  SELECT payload INTO v_cached_payload
    FROM public.__vehicle_page_cache
    WHERE type_id = p_type_id;

  RETURN v_cached_payload::JSON;
END;
$function$;

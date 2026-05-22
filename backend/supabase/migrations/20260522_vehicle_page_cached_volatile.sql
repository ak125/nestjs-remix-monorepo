-- 20260522_vehicle_page_cached_volatile.sql
--
-- Fix GSC "Erreur serveur (5xx)" on /constructeurs/ (R8) vehicle pages.
--
-- ROOT CAUSE (confirmed via Postgres logs: "cannot execute DELETE in a read-only transaction"):
--   get_vehicle_page_data_cached() is declared STABLE, but its cold path calls
--   rebuild_vehicle_page_cache() which WRITES (__vehicle_page_cache DELETE on a
--   not-found vehicle, UPSERT on a good one). PostgREST runs STABLE/IMMUTABLE
--   functions inside a READ ONLY transaction, so that write fails. The backend's
--   callRpc() surfaces the error, and VehiclesController maps any non-not-found
--   error to HTTP 503 → not-found vehicles (type_display != '1', e.g. type_id 857,
--   ~25k rows) deterministically returned 503. Google retried forever and the GSC
--   fix-validation failed.
--
-- FIX: declare get_vehicle_page_data_cached() VOLATILE so PostgREST uses a
--   read-write transaction. The lazy cache write then succeeds; a not-found vehicle
--   returns {success:false} → VehicleRpcService throws DomainNotFoundException → the
--   controller returns 404, and the Remix loader (PR #690) renders 404 + noindex.
--   This also fixes a latent 503 for *cold* (uncached) good vehicles.
--
-- SAFETY: CREATE OR REPLACE only — no data, no schema, no signature change. The body
--   is byte-identical to the live definition; only STABLE → VOLATILE changes.
--   rebuild_vehicle_page_cache() is already VOLATILE; build_vehicle_page_payload()
--   stays STABLE (genuinely read-only). No other function references this one.
--   Reversible via 20260522_vehicle_page_cached_volatile.down.sql.

CREATE OR REPLACE FUNCTION public.get_vehicle_page_data_cached(p_type_id integer)
 RETURNS json
 LANGUAGE plpgsql
 VOLATILE SECURITY DEFINER
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

COMMENT ON FUNCTION public.get_vehicle_page_data_cached(integer) IS
  'Cache-first vehicle page payload. VOLATILE (not STABLE): lazily writes __vehicle_page_cache on miss via rebuild_vehicle_page_cache, so PostgREST must run it read-write. See 20260522_vehicle_page_cached_volatile.sql.';

-- @non_transactional
-- squawk-ignore-file ban-concurrent-index-creation-in-transaction
-- Native runner honors the marker above: concurrent index creation runs in autocommit.
-- Candidate only; requires owner review before any shared database application.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

ALTER TABLE public.__rag_change_events
  ADD COLUMN IF NOT EXISTS rce_projection_refreshed_at timestamptz;

-- Retrying repairs an INVALID index left by an interrupted concurrent build.
DROP INDEX CONCURRENTLY IF EXISTS public.idx_rce_projection_refresh_pending;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rce_projection_refresh_pending
  ON public.__rag_change_events (rce_id)
  WHERE rce_operation IN ('replace', 'withdraw') AND rce_projection_refreshed_at IS NULL;

-- Preserve the native RPC signature, transaction and service_role boundary.
CREATE OR REPLACE FUNCTION public.refresh_seo_projection_mvs()
RETURNS TABLE(view_name text, refreshed boolean)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
SET statement_timeout = '120s'
AS $function$
DECLARE
  captured_event_ids bigint[];
BEGIN
  -- Capture committed rows, never a sequence high-water mark: a lower ID may
  -- still be uncommitted. Later arrivals remain pending for a subsequent refresh.
  SELECT pg_catalog.array_agg(rce_id::bigint) INTO captured_event_ids
  FROM public.__rag_change_events
  WHERE rce_operation IN ('replace', 'withdraw') AND rce_projection_refreshed_at IS NULL;

  REFRESH MATERIALIZED VIEW public.mv_seo_entity_facts_current;
  REFRESH MATERIALIZED VIEW public.mv_seo_content_blocks_current;

  -- This acknowledges only the SEO projection, not other editorial consumers.
  -- An error here rolls back both materialized views as well as this ACK.
  UPDATE public.__rag_change_events
  SET rce_projection_refreshed_at = pg_catalog.clock_timestamp()
  WHERE rce_id = ANY(captured_event_ids) AND rce_projection_refreshed_at IS NULL;

  view_name := 'mv_seo_entity_facts_current'; refreshed := true; RETURN NEXT;
  view_name := 'mv_seo_content_blocks_current'; refreshed := true; RETURN NEXT;
END;
$function$;
REVOKE ALL ON FUNCTION public.refresh_seo_projection_mvs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_seo_projection_mvs() TO service_role;

RESET lock_timeout;
RESET statement_timeout;

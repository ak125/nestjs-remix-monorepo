-- Consolidates the 3 client-side polls of RagChangeWatcher into a single
-- server-side computation (1 HTTP round-trip instead of 3 scans + JS filter).
-- Semantics match the existing evaluateBreakerConditions() logic exactly.

CREATE OR REPLACE FUNCTION public.rag_watcher_breaker_metrics()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH r24 AS (
    SELECT
      COUNT(*)                                         AS total_24h,
      COUNT(*) FILTER (WHERE pcq_status = 'failed')    AS failed_24h
    FROM public.__pipeline_chain_queue
    WHERE pcq_created_at >= now() - interval '24 hours'
  ),
  p AS (
    SELECT COUNT(*) AS pending_count
    FROM public.__pipeline_chain_queue
    WHERE pcq_status = 'pending'
  ),
  h AS (
    SELECT pcq_pg_alias, COUNT(*) AS c
    FROM public.__pipeline_chain_queue
    WHERE pcq_created_at >= now() - interval '24 hours'
    GROUP BY pcq_pg_alias
    ORDER BY c DESC
    LIMIT 1
  )
  SELECT jsonb_build_object(
    'total_24h',     (SELECT total_24h FROM r24),
    'failed_24h',    (SELECT failed_24h FROM r24),
    'failed_ratio',  CASE
                       WHEN COALESCE((SELECT total_24h FROM r24), 0) = 0 THEN 0::numeric
                       ELSE ((SELECT failed_24h FROM r24)::numeric / (SELECT total_24h FROM r24))
                     END,
    'pending_count', COALESCE((SELECT pending_count FROM p), 0),
    'hotspot_alias', (SELECT pcq_pg_alias FROM h),
    'hotspot_count', COALESCE((SELECT c FROM h), 0)
  );
$$;

COMMENT ON FUNCTION public.rag_watcher_breaker_metrics() IS
  'Single-call circuit breaker metrics for RagChangeWatcherService. Returns {total_24h, failed_24h, failed_ratio, pending_count, hotspot_alias, hotspot_count}.';

REVOKE ALL ON FUNCTION public.rag_watcher_breaker_metrics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rag_watcher_breaker_metrics() TO service_role, authenticated;

-- Supports 24h time-range scans (hotspot + failed_ratio queries)
CREATE INDEX IF NOT EXISTS idx_pcq_created_at
  ON public.__pipeline_chain_queue (pcq_created_at DESC);

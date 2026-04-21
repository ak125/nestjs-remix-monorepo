-- =============================================================================
-- PREV-2 — RPC d'agrégation 5xx pour alerting générique
-- =============================================================================
-- Post-incident INC-2026-006 (2026-04-21, 67 min 503 /constructeurs/*).
--
-- Le problème actuel : aucune alerte ne se déclenche quand une classe d'URLs
-- tombe en 5xx en prod. L'incident du 21/04 a été détecté manuellement par
-- un smoke test, pas par une sonde. Durée avant détection : 25 min.
--
-- Cette RPC alimente scripts/monitoring/check-error-logs-5xx.sh, un cron
-- toutes les 5 min qui alerte par email si le seuil est dépassé.
--
-- ARCHITECTURE : identique à check_payment_tunnel_health (PREV-1).
--   - Appelée via PostgREST + service_role_key
--   - SECURITY DEFINER pour bypass RLS sur __error_logs
--   - Retour : compteurs globaux + breach flag + top 5 URLs affectées
--
-- COUVERTURE : toutes les routes qui passent par ErrorLogsInterceptor NestJS
-- (ie. toutes les routes HTTP). Contrairement aux smoke tests par URL
-- hardcodée (bricolage), cette alerte est générique et future-proof.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.check_error_logs_5xx_threshold(
  p_window_minutes integer DEFAULT 5,
  p_min_count integer DEFAULT 5
)
RETURNS TABLE(
  total_5xx bigint,
  distinct_urls bigint,
  threshold_breached boolean,
  top_urls jsonb,
  window_start timestamptz,
  window_end timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  WITH window_bounds AS (
    SELECT
      NOW() - make_interval(mins => p_window_minutes) AS win_start,
      NOW() AS win_end
  ),
  errors AS (
    SELECT
      -- Normaliser l'URL au path (enlever query string) pour le regroupement
      SPLIT_PART(COALESCE(err_url, ''), '?', 1) AS url_path,
      err_status,
      err_code,
      err_message,
      err_created_at
    FROM __error_logs, window_bounds
    WHERE err_created_at >= window_bounds.win_start
      AND (
        -- HTTP status explicite 5xx
        COALESCE(err_status, 0) >= 500
        -- OU exception NestJS avec statut 5xx implicite (err_status=NULL pour
        -- les Exception NestJS — le buffer __error_logs ne matérialise pas le
        -- HTTP status quand l'erreur vient d'un throw d'Exception).
        OR err_code IN (
          'ServiceUnavailableException',
          'InternalServerErrorException',
          'OperationFailedException',
          'GatewayTimeoutException',
          'BadGatewayException',
          'NotImplementedException'
        )
      )
      -- Exclure bruit d'health checks / bots qui échouent par design
      AND COALESCE(err_url, '') NOT LIKE '/.well-known/%'
      AND COALESCE(err_url, '') NOT LIKE '/robots.txt%'
      AND COALESCE(err_url, '') NOT LIKE '/favicon.ico%'
  ),
  aggregated AS (
    SELECT
      url_path,
      COUNT(*) AS url_count,
      -- Sample du dernier message/code pour diagnostic rapide
      (ARRAY_AGG(err_message ORDER BY err_created_at DESC))[1] AS last_message,
      (ARRAY_AGG(err_code    ORDER BY err_created_at DESC))[1] AS last_code,
      MAX(err_created_at)::text AS last_seen
    FROM errors
    GROUP BY url_path
  ),
  top AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'url',          url_path,
        'count',        url_count,
        'last_message', last_message,
        'last_code',    last_code,
        'last_seen',    last_seen
      )
      ORDER BY url_count DESC
    ) FILTER (WHERE url_path IS NOT NULL) AS urls_json
    FROM (
      SELECT * FROM aggregated
      ORDER BY url_count DESC
      LIMIT 5
    ) AS limited
  ),
  totals AS (
    SELECT
      COUNT(*)::bigint              AS tot,
      COUNT(DISTINCT url_path)::bigint AS nb_urls
    FROM errors
  )
  SELECT
    totals.tot,
    totals.nb_urls,
    (totals.tot >= p_min_count)   AS breached,
    COALESCE(top.urls_json, '[]'::jsonb) AS urls,
    window_bounds.win_start,
    window_bounds.win_end
  FROM totals, top, window_bounds;
$fn$;

COMMENT ON FUNCTION public.check_error_logs_5xx_threshold(integer,integer) IS
  'PREV-2 — Agrégation 5xx sur fenêtre glissante pour alerting externe. '
  'Retourne total/distinct_urls/breach + top 5 URLs avec sample message. '
  'Consommé par scripts/monitoring/check-error-logs-5xx.sh. '
  'Added 2026-04-21 post-incident INC-2026-006.';

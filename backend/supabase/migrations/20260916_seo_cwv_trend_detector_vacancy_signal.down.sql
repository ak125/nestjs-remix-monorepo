-- Rollback : 20260916_seo_cwv_trend_detector_vacancy_signal (documentation
-- d'intervention manuelle ; le runner ignore les .down.sql, politique
-- forward-only).
--
-- Restaure le corps de detect_cwv_trend_divergence tel que livré par
-- 20260911_seo_cwv_daily_rum_exact_p75.sql (extrait VERBATIM de ce fichier,
-- lignes 298-403), c'est-à-dire SANS le signal de vacance.
--
-- EFFET DU ROLLBACK — à lire avant de l'appliquer : la fonction redevient
-- incapable de distinguer « 0 régression trouvée sur N clés comparées » de
-- « 0 clé comparée, donc rien regardé ». C'est précisément le défaut que
-- 20260916 corrige. Ne rouler en arrière que si le signal lui-même pose
-- problème (bruit, coût), jamais pour « faire taire » la vacance : une garde
-- muette pendant une fenêtre d'évaluation est le risque, pas le symptôme.
--
-- Les événements anomaly_detected / alert_kind='cwv_trend_detector_vacant'
-- déjà écrits dans __seo_event_log ne sont PAS supprimés : ce sont des faits
-- observés, pas de la configuration. Les résoudre à la main si besoin
--   (UPDATE public.__seo_event_log SET resolved_at = now()
--     WHERE event_type = 'anomaly_detected'
--       AND payload->>'alert_kind' = 'cwv_trend_detector_vacant'
--       AND resolved_at IS NULL;).
--
-- Aucune colonne, aucun type, aucun job pg_cron n'a été créé par 20260916 :
-- il n'y a rien d'autre à défaire. Les droits EXECUTE (service_role) sont
-- conservés : CREATE OR REPLACE conserve l'ACL.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE OR REPLACE FUNCTION public.detect_cwv_trend_divergence()
RETURNS TABLE(alerts_inserted INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count INT := 0;
BEGIN
  WITH exact_days AS (
    -- Seuls les jours dotés d'un bloc exact. Un jour sans p75_exact n'apporte ni
    -- valeur ni n ; p75_value n'est jamais utilisé en repli.
    SELECT date, route_group, device, metric, p75_exact, n_exact
    FROM public.__seo_cwv_daily_rum
    WHERE date >= CURRENT_DATE - INTERVAL '35 days'
      AND date <  CURRENT_DATE
      AND ua_class = 'human'
      AND priority_tier = 'CWV_P0'
      AND metric IN ('LCP', 'INP')
      AND p75_exact IS NOT NULL
  ),
  recent AS (
    SELECT
      route_group, device, metric,
      sum(p75_exact * n_exact) / NULLIF(sum(n_exact), 0) AS p75_recent,
      sum(n_exact) AS samples_recent
    FROM exact_days
    WHERE date >= CURRENT_DATE - INTERVAL '7 days'
    GROUP BY route_group, device, metric
    HAVING sum(n_exact) >= 100  -- min samples pour alert valide (20260529)
  ),
  reference AS (
    SELECT
      route_group, device, metric,
      sum(p75_exact * n_exact) / NULLIF(sum(n_exact), 0) AS p75_ref,
      sum(n_exact) AS samples_reference
    FROM exact_days
    WHERE date < CURRENT_DATE - INTERVAL '8 days'
    GROUP BY route_group, device, metric
    HAVING sum(n_exact) >= 300
  ),
  recent_3d AS (
    SELECT
      route_group, device, metric,
      sum(p75_exact * n_exact) / NULLIF(sum(n_exact), 0) AS p75_3d,
      sum(n_exact) AS samples_3d
    FROM exact_days
    WHERE date >= CURRENT_DATE - INTERVAL '3 days'
    GROUP BY route_group, device, metric
    -- Même densité journalière que le plancher 7 j : n·7 ≥ 100·3.
    HAVING sum(n_exact) * 7 >= 100 * 3
  ),
  divergent AS (
    SELECT
      r.route_group, r.device, r.metric,
      r.p75_recent, ref.p75_ref, r3.p75_3d,
      r.samples_recent, ref.samples_reference, r3.samples_3d
    FROM recent r
    JOIN reference ref USING (route_group, device, metric)
    JOIN recent_3d r3 USING (route_group, device, metric)
    WHERE r.p75_recent > ref.p75_ref * 1.30
      AND r3.p75_3d   > ref.p75_ref * 1.30
  ),
  not_already_open AS (
    -- Dedup : skip si une alert non-resolved existe déjà sur même (rg, device, metric)
    SELECT dv.* FROM divergent dv
    WHERE NOT EXISTS (
      SELECT 1 FROM public.__seo_event_log e
      WHERE e.event_type = 'cwv.alert.internal_regression'
        AND e.resolved_at IS NULL
        AND e.created_at >= now() - INTERVAL '14 days'
        AND e.payload->>'route_group' = dv.route_group
        AND e.payload->>'device' = dv.device
        AND e.payload->>'metric' = dv.metric
    )
  )
  INSERT INTO public.__seo_event_log (event_type, entity_url, severity, payload)
  SELECT
    'cwv.alert.internal_regression'::public.seo_event_type,
    NULL,
    'high'::public.seo_severity,
    jsonb_build_object(
      'route_group', route_group,
      'device', device,
      'metric', metric,
      'p75_recent_ms', round(p75_recent::numeric, 0),
      'p75_reference_ms', round(p75_ref::numeric, 0),
      'p75_3d_ms', round(p75_3d::numeric, 0),
      'degradation_pct', round(((p75_recent - p75_ref) / NULLIF(p75_ref, 0) * 100)::numeric, 1),
      'samples_recent', samples_recent,
      'samples_3d', samples_3d,
      'samples_reference', samples_reference
    )
  FROM not_already_open;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  alerts_inserted := v_count;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.detect_cwv_trend_divergence() IS
  'Bloc 6 VOLATILE — détecte régressions CWV_P0 LCP/INP > 30% sur 7j vs référence (J-35..J-9) ET confirmé sur 3 derniers jours, sur p75_exact pondéré par n_exact (20260911). Jours sans bloc exact exclus, sans repli sur p75_value. Planchers n_exact : 7j ≥ 100, référence ≥ 300, 3j à densité égale (n·7 ≥ 100·3). Dedup 14j sur même (route_group, device, metric). INSERT __seo_event_log cwv.alert.internal_regression severity=high.';

REVOKE EXECUTE ON FUNCTION public.detect_cwv_trend_divergence() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.detect_cwv_trend_divergence() TO service_role;

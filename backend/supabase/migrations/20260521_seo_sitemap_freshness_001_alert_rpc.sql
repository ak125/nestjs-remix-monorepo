-- =====================================================
-- Commerce-Loop V1 — Étape 2 : sitemap freshness alert (001 — alert rule)
-- Date: 2026-05-21
-- Refs: plan commerce-loop-v1 étape 2
--       20260518_seo_control_002_rpcs.sql (définition d'origine de rpc_seo_alerts_v1)
--       20260521_seo_sitemap_freshness_000_enum.sql (DOIT s'appliquer AVANT — le
--         littéral 'sitemap_generation_complete' doit être un label ENUM valide ici)
--       feedback_no_external_canary_when_internal_observability_exists
-- =====================================================
--
-- Étend `rpc_seo_alerts_v1` avec une 3ᵉ source d'alerte : SITEMAP_STALE_V1.
-- Contrairement aux sources A (audit_findings) et B (event_log bad events) qui
-- alertent sur la PRÉSENCE de lignes, celle-ci alerte sur l'ABSENCE d'un heartbeat
-- `sitemap_generation_complete` dans les 26 dernières heures — pattern SRE canonique
-- "alert on absence of expected events". Le job nocturne (03:00 UTC) émet le
-- heartbeat ; s'il s'arrête (scheduler mort, échecs répétés), l'alerte high apparaît
-- dans le bloc Alerts du dashboard cockpit (#601) après 26h, sans surface externe.
--
-- CREATE OR REPLACE = redéfinition wholesale. Sources A+B reproduites À L'IDENTIQUE
-- depuis 002_rpcs (seule définition existante, aucune redéfinition postérieure
-- vérifiée). Forward-only ; rollback = ré-appliquer 002_rpcs.
--
-- Note warmup : avant le tout premier heartbeat (fraîche instance, ou PREPROD
-- READ_ONLY qui ne régénère jamais — ADR-028), SITEMAP_STALE_V1 est actif. C'est
-- correct (le sitemap n'a effectivement pas été régénéré) ; en steady-state PROD le
-- heartbeat nocturne éteint l'alerte. Gate : 7j post-merge → 0 alerte quand le
-- service tourne normalement.
-- =====================================================

SET lock_timeout = '2s';
SET statement_timeout = '30s';

CREATE OR REPLACE FUNCTION rpc_seo_alerts_v1(
  p_now TIMESTAMPTZ DEFAULT NOW(),
  p_limit INT DEFAULT 50
) RETURNS JSONB LANGUAGE sql STABLE AS $$
  WITH unified AS (
    -- Source A : audit findings unresolved (severity critical|high|medium)
    SELECT
      'audit_findings'::TEXT AS source,
      audit_type::TEXT AS alert_type,
      entity_url,
      severity::TEXT AS severity,
      detected_at,
      COALESCE(
        jsonb_strip_nulls(jsonb_build_object(
          'reason', payload->>'reason',
          'metric', payload->>'metric',
          'expected', payload->'expected'
        )),
        '{}'::jsonb
      ) AS payload_minimal
    FROM __seo_audit_findings
    WHERE resolved_at IS NULL
      AND severity IN ('critical', 'high', 'medium')
    UNION ALL
    -- Source B : event log unresolved (severity critical|high, anomalies+ingestion failures)
    SELECT
      'event_log'::TEXT,
      event_type::TEXT,
      entity_url,
      severity::TEXT,
      created_at,
      COALESCE(
        jsonb_strip_nulls(jsonb_build_object(
          'reason', payload->>'reason',
          'source', payload->>'source',
          'count', payload->'count'
        )),
        '{}'::jsonb
      )
    FROM __seo_event_log
    WHERE resolved_at IS NULL
      AND severity IN ('critical', 'high')
      AND event_type IN ('anomaly_detected', 'alert_sent', 'ingestion_run_failed')
    UNION ALL
    -- Source C : sitemap freshness — alert on ABSENCE of a completion heartbeat >26h
    -- (étape 2). Une seule ligne synthétique quand aucun `sitemap_generation_complete`
    -- récent n'existe. Réutilise __seo_event_log (#601), aucune surface externe.
    SELECT
      'sitemap_freshness'::TEXT,
      'SITEMAP_STALE_V1'::TEXT,
      NULL::TEXT,
      'high'::TEXT,
      p_now,
      jsonb_build_object(
        'reason', 'no sitemap_generation_complete heartbeat in last 26h',
        'threshold_hours', 26
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM __seo_event_log
      WHERE event_type = 'sitemap_generation_complete'
        AND created_at > p_now - INTERVAL '26 hours'
    )
  ),
  enriched AS (
    SELECT
      u.source,
      u.alert_type,
      u.entity_url,
      u.severity,
      u.detected_at,
      u.payload_minimal,
      _seo_resolve_operational_domain(u.alert_type) AS operational_domain,
      _seo_resolve_surface_key(u.entity_url) AS surface_key,
      ROUND(
        ((CASE u.severity
          WHEN 'critical' THEN 10
          WHEN 'high' THEN 5
          WHEN 'medium' THEN 2
          ELSE 1 END)::NUMERIC
        * (1 + COALESCE(LOG(GREATEST(1, COALESCE(gsc.clicks_7d, 0))), 0))::NUMERIC)::NUMERIC,
        2
      )::FLOAT8 AS business_impact_score
    FROM unified u
    LEFT JOIN LATERAL (
      SELECT SUM(clicks)::BIGINT AS clicks_7d
      FROM __seo_gsc_daily
      WHERE page = u.entity_url
        AND date >= p_now::DATE - 7
        AND date < p_now::DATE
    ) gsc ON TRUE
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'source', e.source,
        'alert_type', e.alert_type,
        'entity_url', e.entity_url,
        'surface_key', e.surface_key,
        'operational_domain', e.operational_domain,
        'severity', e.severity,
        'detected_at', e.detected_at,
        'payload_minimal', e.payload_minimal,
        'business_impact_score', e.business_impact_score,
        'impact_score_version', 'v1'
      )
      ORDER BY e.business_impact_score DESC, e.detected_at DESC
    ),
    '[]'::jsonb
  )
  FROM (
    SELECT *
    FROM enriched
    ORDER BY business_impact_score DESC, detected_at DESC
    LIMIT p_limit
  ) e;
$$;
COMMENT ON FUNCTION rpc_seo_alerts_v1(TIMESTAMPTZ, INT) IS
  'PR-SBD-1 v1 + étape 2 — Unresolved alerts UNION (audit_findings + event_log + sitemap freshness absence SITEMAP_STALE_V1) with operational_domain + surface_key + business_impact_score (severity weighted by page traffic). payload_minimal ≤ 3 keys (anti-bloat).';

-- CREATE OR REPLACE preserves privileges, but re-state them explicitly (canon 002_rpcs).
REVOKE ALL ON FUNCTION rpc_seo_alerts_v1(TIMESTAMPTZ, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rpc_seo_alerts_v1(TIMESTAMPTZ, INT) TO service_role;

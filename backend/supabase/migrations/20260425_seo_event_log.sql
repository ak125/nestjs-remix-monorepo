-- =====================================================
-- SEO Event Log — Unified events table (Phase 1)
-- Date: 2026-04-25
-- Refs: ADR-025-seo-department-architecture (DB lean design)
--       packages/seo-types/src/intelligence.ts (Zod mirror)
-- =====================================================
--
-- Single Postgres table replaces 3 originally proposed :
--   __seo_anomalies + __seo_alerts_log + __seo_monitoring_runs
--
-- Discrimination par event_type ENUM + payload_jsonb GIN-indexé.
-- Schemas Zod par variant (cf. seo-types/intelligence.ts) garantissent
-- la type safety au runtime côté NestJS.
-- =====================================================

-- ENUM type pour event_type (extensible via ALTER TYPE)
DO $$ BEGIN
    CREATE TYPE seo_event_type AS ENUM (
        'anomaly_detected',
        'alert_sent',
        'ingestion_run_started',
        'ingestion_run_completed',
        'ingestion_run_failed',
        'forecast_generated',
        'digest_sent'
    );
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

-- ENUM partagé severity (réutilisé Phase 2 audit_findings)
DO $$ BEGIN
    CREATE TYPE seo_severity AS ENUM ('critical', 'high', 'medium', 'low', 'info');
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

CREATE TABLE IF NOT EXISTS __seo_event_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type seo_event_type NOT NULL,
    entity_url TEXT,
    severity seo_severity NOT NULL DEFAULT 'info',
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ack_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_seo_event_log_type_created ON __seo_event_log (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_seo_event_log_entity_url ON __seo_event_log (entity_url) WHERE entity_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_seo_event_log_severity_unresolved ON __seo_event_log (severity, created_at DESC)
    WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_seo_event_log_payload_gin ON __seo_event_log USING GIN (payload);

COMMENT ON TABLE __seo_event_log IS 'Event log unifié SEO (anomalies + alerts + ingestion runs + forecasts + digests). Variants discriminés par event_type avec payload typé Zod.';

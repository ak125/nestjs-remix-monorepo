-- =====================================================
-- Commerce-Loop V1 — Étape 2 : sitemap freshness alert (000 — ENUM extension)
-- Date: 2026-05-21
-- Refs: plan commerce-loop-v1 étape 2 ("alert on absence of expected events")
--       20260425_seo_event_log.sql (table + ENUM seo_event_type)
--       20260521_seo_event_funnel_enum.sql (pattern ALTER TYPE ADD VALUE, guard pg_enum)
--       feedback_no_external_canary_when_internal_observability_exists (réutilise
--         __seo_event_log + rpc_seo_alerts_v1 livrés par #601, aucune surface externe)
-- =====================================================
--
-- Étend l'ENUM `seo_event_type` avec 2 events émis par le SitemapRegenerateProcessor
-- (heartbeat de régénération nocturne 03:00 UTC). Le bloc `001` (alert RPC) s'appuie
-- sur l'ABSENCE de `sitemap_generation_complete` >26h pour lever SITEMAP_STALE_V1.
--
--   sitemap_generation_complete → succès régénération (severity info, heartbeat)
--   sitemap_generation_failed   → échec régénération (severity high, forensics)
--
-- AUCUNE consommation ici — migration ordonnée AVANT l'émission ET avant le RPC `001`
-- qui référence le label en littéral (contrainte PG : un nouveau label ENUM ne peut
-- être utilisé dans la transaction qui l'ajoute). Additif. Idempotent (guard pg_enum).
-- Forward-only (ALTER TYPE ADD VALUE est irréversible en Postgres — pas de down).
-- =====================================================

-- Garde-fous obligatoires (squawk require-timeout-settings, ADR-064).
SET lock_timeout = '2s';
SET statement_timeout = '60s';

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'sitemap_generation_complete' AND enumtypid = 'seo_event_type'::regtype) THEN
        ALTER TYPE seo_event_type ADD VALUE 'sitemap_generation_complete';
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'sitemap_generation_failed' AND enumtypid = 'seo_event_type'::regtype) THEN
        ALTER TYPE seo_event_type ADD VALUE 'sitemap_generation_failed';
    END IF;
END $$;

COMMENT ON TYPE seo_event_type IS 'Event log unifié SEO + funnel diagnostic + heartbeat sitemap (étape 2). Variants discriminés par event_type, payload JSONB. Extensible via ALTER TYPE ADD VALUE.';

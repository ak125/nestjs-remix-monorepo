-- Migration : extend seo_event_type ENUM avec 5 runtime events.
--
-- Plan bloc 5 (CWV Runtime Observability). Réutilise __seo_event_log existant
-- au lieu de créer une table parallèle (canon
-- feedback_no_external_canary_when_internal_observability_exists "extend
-- l'infra alert").
--
-- Pattern ADR-045 / 20260514_seo_crux_field_history.sql — pas de schema change
-- __seo_event_log, juste extension ENUM dans un DO bloc PL/pgSQL (idempotent
-- via NOT EXISTS check, retry-safe).
--
-- 4 nouvelles valeurs (seo.runtime.bot_cwv_beacon est ajouté par bloc 3
-- migration 20260526_seo_cwv_raw.sql pour atomicité code↔schema — canon
-- owner "ENUM doit arriver AVANT l'usage en DB live") :
--   - seo.runtime.hydration_error      (bloc 5 — React/Remix hydration mismatch)
--   - seo.runtime.long_task            (bloc 5 — PerformanceObserver longtask > 200ms)
--   - seo.runtime.navigation_abort     (bloc 5 — useNavigation interrupted)
--   - seo.runtime.chunk_load_error     (bloc 5 — dynamic import failure)

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'seo.runtime.hydration_error'
          AND enumtypid = 'seo_event_type'::regtype
    ) THEN
        ALTER TYPE seo_event_type ADD VALUE 'seo.runtime.hydration_error';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'seo.runtime.long_task'
          AND enumtypid = 'seo_event_type'::regtype
    ) THEN
        ALTER TYPE seo_event_type ADD VALUE 'seo.runtime.long_task';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'seo.runtime.navigation_abort'
          AND enumtypid = 'seo_event_type'::regtype
    ) THEN
        ALTER TYPE seo_event_type ADD VALUE 'seo.runtime.navigation_abort';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'seo.runtime.chunk_load_error'
          AND enumtypid = 'seo_event_type'::regtype
    ) THEN
        ALTER TYPE seo_event_type ADD VALUE 'seo.runtime.chunk_load_error';
    END IF;
END $$;

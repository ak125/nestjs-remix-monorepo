-- =====================================================
-- Commerce-Loop V1 — Étape 4-A : funnel event taxonomy (outil diagnostic)
-- Date: 2026-05-21
-- Refs: plan commerce-loop-v1 étape 4 ("Mesure d'abord")
--       20260425_seo_event_log.sql (table + ENUM seo_event_type)
--       20260514_seo_crux_field_history.sql (pattern ALTER TYPE ADD VALUE)
--       ADR-027 (R5 sub-pages sunset ; le HUB /diagnostic-auto reste indexé)
--       packages/seo-types/src/intelligence.ts (Zod mirror)
-- =====================================================
--
-- Étend l'ENUM `seo_event_type` avec les 7 events du funnel de l'OUTIL diagnostic
-- (entonnoir d'acquisition central → conversion), pour localiser la fuite du
-- verdict Reality Audit 2026-05-20 (conversion_funnel 0,17 %).
--
-- Parcours mesuré (hub indexé → wizard → résultat → catalogue → produit → commande) :
--   diag_hub_view → diag_wizard_start → diag_analyze_complete
--   → diag_gamme_cta_click → r2_view → r2_add_to_cart → r2_order_placed
-- Les r2_* sont entry-agnostic (payload.referrer = diagnostic|organic|internal).
-- N'instrumente PAS les sous-pages noindex /diagnostic-auto/{slug} (ADR-027).
--
-- AUCUNE consommation ici — migration ordonnée AVANT l'émission (contrainte PG :
-- un nouveau label ENUM ne peut être utilisé dans la transaction qui l'ajoute).
-- Additif uniquement. Idempotent (guard pg_enum, 1 bloc/label). Forward-only.
-- =====================================================

-- Garde-fous obligatoires (squawk require-timeout-settings, ADR-064).
SET lock_timeout = '2s';
SET statement_timeout = '60s';

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'diag_hub_view' AND enumtypid = 'seo_event_type'::regtype) THEN
        ALTER TYPE seo_event_type ADD VALUE 'diag_hub_view';
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'diag_wizard_start' AND enumtypid = 'seo_event_type'::regtype) THEN
        ALTER TYPE seo_event_type ADD VALUE 'diag_wizard_start';
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'diag_analyze_complete' AND enumtypid = 'seo_event_type'::regtype) THEN
        ALTER TYPE seo_event_type ADD VALUE 'diag_analyze_complete';
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'diag_gamme_cta_click' AND enumtypid = 'seo_event_type'::regtype) THEN
        ALTER TYPE seo_event_type ADD VALUE 'diag_gamme_cta_click';
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'r2_view' AND enumtypid = 'seo_event_type'::regtype) THEN
        ALTER TYPE seo_event_type ADD VALUE 'r2_view';
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'r2_add_to_cart' AND enumtypid = 'seo_event_type'::regtype) THEN
        ALTER TYPE seo_event_type ADD VALUE 'r2_add_to_cart';
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'r2_order_placed' AND enumtypid = 'seo_event_type'::regtype) THEN
        ALTER TYPE seo_event_type ADD VALUE 'r2_order_placed';
    END IF;
END $$;

COMMENT ON TYPE seo_event_type IS 'Event log unifié SEO + funnel outil diagnostic → commande (étape 4-A). Variants discriminés par event_type, payload typé Zod (packages/seo-types/src/intelligence.ts).';

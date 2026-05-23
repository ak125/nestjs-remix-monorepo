-- =====================================================
-- Commerce-Loop V1A.0 — Intent Resolution canonical event
-- Date: 2026-05-24
-- Refs: plan commerce-loop-v1 étape 4-B V1A.0 (Intent Resolution)
--       20260425_seo_event_log.sql (table + ENUM seo_event_type)
--       20260521_seo_event_funnel_enum.sql (pattern ALTER TYPE ADD VALUE, PR #676)
--       ADR vault "Intent Resolution V1 doctrine" + "Diagnostic Resolution Outcome Event Canon"
-- =====================================================
--
-- Étend l'ENUM `seo_event_type` avec UN SEUL nouvel event_type canonique :
--   `diagnostic_resolution_outcome`
--
-- Discriminé au runtime par `payload->>'outcome_type'` :
--   - intent_resolved        (pipeline classify completed, safety_rail=false)
--   - safety_rail_triggered  (safety_rail=true)
--   - action_clicked         (depuis POST /handoff, tagué target_role)
--
-- Anti-cardinality explosion : 1 event_type au lieu de N (anti double-truth).
-- Dérivations KPI runtime via SQL :
--   to_commerce = action_clicked WHERE payload->>'target_role' IN ('R1','R2')
--   to_human    = action_clicked WHERE payload->>'target_role' = 'human'
--
-- Coexiste avec les 7 events funnel UI/commerce de PR #676 (diag_hub_view, etc.) :
-- couche orthogonale d'orchestration intent (vs couche tracking UI/commerce).
--
-- Additif uniquement. Idempotent (guard pg_enum). Forward-only.
-- =====================================================

SET lock_timeout = '2s';
SET statement_timeout = '60s';

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'diagnostic_resolution_outcome'
          AND enumtypid = 'seo_event_type'::regtype
    ) THEN
        ALTER TYPE seo_event_type ADD VALUE 'diagnostic_resolution_outcome';
    END IF;
END $$;

COMMENT ON TYPE seo_event_type IS 'Event log unifié SEO + funnel outil diagnostic (4-A PR #676) + canonical intent resolution (4-B V1A.0). Variants discriminés par event_type ; pour diagnostic_resolution_outcome, payload.outcome_type discrimine intent_resolved/safety_rail_triggered/action_clicked.';

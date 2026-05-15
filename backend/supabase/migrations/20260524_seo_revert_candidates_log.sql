-- =====================================================
-- SEO Revert Candidates Log — PR-E audit-trail for revert decisions
-- Date: 2026-05-24
-- Refs: Plan §8 Phase E
--       PR-D #539 (event store __seo_content_events)
--       PR-C #538 (OPA write gateway)
-- =====================================================
--
-- Append-only audit-trail des décisions prises par SeoRevertSelectorService.
-- Une ligne par tentative de revert (réussie OU rejetée → quarantine).
--
-- Mémoire stricte (feedback_deterministic_evidence_tiers_over_bayesian) :
-- une décision 'revert_to' ne peut cibler qu'un event applied avec source_kind
-- ∈ {human_curated, human_validated_llm, legacy_recovery+exact_match_*}.
-- Toute autre lineage → 'quarantine'. Ce log trace les deux décisions.
-- =====================================================

BEGIN;

CREATE TABLE IF NOT EXISTS __seo_revert_candidates_log (
    log_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id             TEXT NOT NULL,
    field_path           TEXT NOT NULL,

    decision             TEXT NOT NULL CHECK (decision IN ('revert_to', 'quarantine')),

    -- Si decision='revert_to', pointeur vers le content event cible (NULL sinon).
    target_event_id      UUID NULL REFERENCES __seo_content_events(event_id),
    target_source_kind   TEXT NULL,
    target_evidence_tier TEXT NULL,

    -- Si decision='quarantine', raison textuelle (NULL si revert).
    rejection_reason     TEXT NULL,
    inspected_event_count INTEGER NOT NULL DEFAULT 0,

    triggered_by         TEXT NOT NULL,    -- ex 'worker:h1-recovery', 'validator:j7'

    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seo_revert_log_asset
    ON __seo_revert_candidates_log (asset_id, field_path, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_seo_revert_log_decision
    ON __seo_revert_candidates_log (decision, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_seo_revert_log_triggered
    ON __seo_revert_candidates_log (triggered_by, created_at DESC);

COMMENT ON TABLE __seo_revert_candidates_log IS
    'PR-E append-only audit-trail des décisions du SeoRevertSelectorService. '
    'revert_to = lineage acceptable trouvée. quarantine = aucun event applied '
    'éligible (jamais revert vers unknown / heuristic_recent_change).';

ALTER TABLE __seo_revert_candidates_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_all ON __seo_revert_candidates_log;
CREATE POLICY service_role_all ON __seo_revert_candidates_log
    FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_read ON __seo_revert_candidates_log;
CREATE POLICY authenticated_read ON __seo_revert_candidates_log
    FOR SELECT TO authenticated USING (true);

COMMIT;

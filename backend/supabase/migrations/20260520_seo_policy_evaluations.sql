-- =====================================================
-- SEO Policy Evaluations — PR-C OPA Write Gateway audit-trail
-- Date: 2026-05-20
-- Refs: Plan SEO Governance Control Plane §6 Phase C
--       PR-V #279 (governance-vault: Rego policy + WASM bundle)
--       PR-B #535 (monorepo: seo-field-authority.yaml)
--
-- Append-only audit-trail des décisions OPA prises par
-- backend/src/modules/seo/governance/seo-content-write.service.ts à chaque
-- préflight d'écriture sur un champ SEO gouverné.
-- =====================================================

BEGIN;

CREATE TABLE IF NOT EXISTS __seo_policy_evaluations (
    evaluation_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id          TEXT NOT NULL,
    field_path        TEXT NOT NULL,
    policy_name       TEXT NOT NULL,
    input_snapshot    JSONB NOT NULL,
    decision          TEXT NOT NULL CHECK (decision IN ('allow', 'deny')),
    reason            TEXT NULL,
    policy_bundle_sha TEXT NOT NULL,
    evaluated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seo_policy_eval_asset
    ON __seo_policy_evaluations (asset_id, field_path, evaluated_at DESC);
CREATE INDEX IF NOT EXISTS idx_seo_policy_eval_decision
    ON __seo_policy_evaluations (decision, evaluated_at DESC);
CREATE INDEX IF NOT EXISTS idx_seo_policy_eval_bundle_sha
    ON __seo_policy_evaluations (policy_bundle_sha, evaluated_at DESC);
CREATE INDEX IF NOT EXISTS idx_seo_policy_eval_input_gin
    ON __seo_policy_evaluations USING GIN (input_snapshot);

COMMENT ON TABLE __seo_policy_evaluations IS
    'PR-C : audit-trail OPA des préflight de SeoContentWriteService. Append-only.';

ALTER TABLE __seo_policy_evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_all ON __seo_policy_evaluations;
CREATE POLICY service_role_all ON __seo_policy_evaluations
    FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_read ON __seo_policy_evaluations;
CREATE POLICY authenticated_read ON __seo_policy_evaluations
    FOR SELECT TO authenticated USING (true);

COMMIT;

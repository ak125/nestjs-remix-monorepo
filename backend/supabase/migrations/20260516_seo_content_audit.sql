-- =====================================================
-- SEO Content Audit — PR-A2 Audit persistence (append-only minimal)
-- Date: 2026-05-16
-- Refs: Plan SEO Governance Control Plane §4 Phase A2
--       PR-A1 #532 (forensic READ-ONLY, verdict empirique GO condition b
--                   le 2026-05-15, 13 strong candidates sur 23 audités,
--                   pattern réel = H1 shifting / cross-gamme misassignment,
--                   PAS « LLM overwrite » comme initialement suspecté).
--       Memory : feedback_forensic_strict_readonly_before_infra,
--                feedback_deterministic_evidence_tiers_over_bayesian,
--                feedback_branch_scope_discipline
-- =====================================================
--
-- Persiste les findings forensic de PR-A1 (script `scripts/seo/forensic/`)
-- pour requêtes croisées avec les phases suivantes (B Field Authority Registry,
-- C OPA Write Gateway, D Event Store, E Recovery Rollout).
--
-- Discipline append-only :
--   - Aucun UPDATE (immutable log)
--   - Aucune corrélation directe avec les colonnes H1 prod (sg_h1, sgpg_h1_override,
--     r1s_h1_override, mta_h1) — PR-A2 ne corrige PAS encore les H1
--   - Idempotence via UNIQUE (run_id, asset_id, field_path, observed_hash)
--     → ré-applique le `--persist` du script PR-A1 sans doublons
--
-- Pas dans PR-A2 :
--   - Pas de partitioning (volume négligeable : ~25 rows/run × ≤ 1 run/jour = <10k/an)
--   - Pas de matview (vue simple suffit, ajoutée seulement si Phase D / queries
--     downstream le justifient)
--   - Pas de embedding column (séparé en Phase F si jamais nécessaire)
--   - Pas de chain_hash (tamper-evident est Phase F+, hors scope)
--   - Pas d'UPDATE sur les tables H1 R1 (la recovery est Phase E uniquement)
-- =====================================================

BEGIN;

-- ── Table append-only ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS __seo_content_audit (
    audit_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identifiant du run forensic (généré par le script orchestrator).
    -- Permet de grouper les findings d'un même run pour traçabilité.
    run_id          TEXT NOT NULL,

    -- Asset identifier : 'r1_router:pg:filtres-huile' format canonique.
    asset_id        TEXT NOT NULL,

    -- Field path logique : 'h1', 'meta_title', 'meta_description' (extensible
    -- à mesure que d'autres champs SEO entrent dans le contrat).
    field_path      TEXT NOT NULL,

    -- Valeur courante observée + son hash SHA-256 (sur valeur normalisée NFC +
    -- trim + collapse-whitespace + lowercase). Hash partagé avec le script.
    observed_value  TEXT NOT NULL,
    observed_hash   TEXT NOT NULL,

    -- Tier d'evidence déterministe (lookup ordonné PR-A1, premier match wins).
    -- Cf. feedback_deterministic_evidence_tiers_over_bayesian — pas de Bayésien
    -- sans dataset labellisé. Confidence enum {high, medium, low} explicite.
    evidence_tier   TEXT NOT NULL CHECK (evidence_tier IN (
        'exact_match_snapshot',          -- __seo_snapshot_synthetic.h1_text
        'exact_match_event_log',         -- __seo_event_log.payload->>'h1'
        'exact_match_blog_advice',       -- __blog_advice* via ba_pg_id
        'exact_match_builder_template',  -- regex r7/r8 template match
        'heuristic_recent_change',       -- updated_at < 90j AND "pas cher" ≥ 2
        'unknown'                        -- aucun signal authoritative
    )),
    confidence      TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),

    -- Détails JSONB :
    --   - snapshot_id, event_log_id, blog_advice_id (selon source)
    --   - legacy_candidate, legacy_source (si tier ∈ exact_match_*)
    --   - scores: { current: {composite, has_gamme_name, …}, legacy: {…}, score_delta }
    --   - source_pattern (si tier=exact_match_builder_template)
    --   - audit_observed_at (timestamp issu du script, distinct du DEFAULT NOW())
    source_details  JSONB NOT NULL DEFAULT '{}'::jsonb,

    observed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Idempotence : même (run_id, asset_id, field_path, observed_hash) ne
    -- s'INSERT qu'une seule fois. Ré-applique le `--persist` sans doublon.
    -- Cf. Plan §4.A2 step 2 : « idempotent via hash unique sur asset_id +
    -- observed_hash + run_id ».
    CONSTRAINT __seo_content_audit_idempotent_uq
        UNIQUE (run_id, asset_id, field_path, observed_hash)
);

CREATE INDEX IF NOT EXISTS idx_seo_content_audit_asset
    ON __seo_content_audit (asset_id, field_path, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_seo_content_audit_tier
    ON __seo_content_audit (evidence_tier, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_seo_content_audit_run
    ON __seo_content_audit (run_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_seo_content_audit_source_details_gin
    ON __seo_content_audit USING GIN (source_details);

COMMENT ON TABLE __seo_content_audit IS
    'PR-A2 : persistance des findings forensic H1 (script scripts/seo/forensic/). '
    'Append-only, idempotent via UNIQUE (run_id, asset_id, field_path, observed_hash). '
    'Évidence déterministe (pas de Bayésien). Aucune correction des H1 ici — '
    'la recovery est Phase E. Verdict empirique PR-A1 #532 (2026-05-15) : H1 '
    'shifting / cross-gamme misassignment, pas LLM overwrite individuel.';

COMMENT ON COLUMN __seo_content_audit.run_id IS
    'Identifiant du run forensic (généré par l''orchestrator). Permet de grouper '
    'les findings d''un même run pour traçabilité et ré-application idempotente.';

COMMENT ON COLUMN __seo_content_audit.evidence_tier IS
    'Tier déterministe (lookup ordonné, premier match). Pas de Bayésien sans '
    'dataset labellisé (memory feedback_deterministic_evidence_tiers_over_bayesian).';

COMMENT ON COLUMN __seo_content_audit.source_details IS
    'JSONB : metadata du tier (snapshot_id, event_log_id, blog_advice_id), '
    'legacy_candidate/legacy_source, scores {current, legacy, score_delta}, '
    'audit_observed_at (timestamp issu du script).';

-- ── RLS — pattern __seo_event_log (service_role full, authenticated select) ──

ALTER TABLE __seo_content_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_all ON __seo_content_audit; -- APPROVED: idempotent re-create of RLS policy
CREATE POLICY service_role_all ON __seo_content_audit
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_read ON __seo_content_audit; -- APPROVED: idempotent re-create of RLS policy
CREATE POLICY authenticated_read ON __seo_content_audit
    FOR SELECT
    TO authenticated
    USING (true);

COMMIT;

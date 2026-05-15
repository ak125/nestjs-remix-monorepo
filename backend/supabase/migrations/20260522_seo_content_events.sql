-- =====================================================
-- SEO Content Events — PR-D Event Store minimal (append-only)
-- Date: 2026-05-22
-- Refs: Plan SEO Governance Control Plane §7 Phase D
--       PR-C #538 (OPA Write Gateway NestJS-only)
--       PR-B #535 (seo-field-authority.yaml)
--       PR-A2 #533 (__seo_content_audit append-only)
-- =====================================================
--
-- Discipline append-only :
--   - Aucun UPDATE (immutable log)
--   - Pas de partitioning V1 (volume négligeable : <10k events/an estimé)
--   - Pas de chain_hash V1 (tamper-evident est Phase F+ si compliance)
--   - Pas de embedding column V1 (séparé en Phase F si besoin sémantique)
--
-- Atomicité garantie via RPC seo_apply_h1_write : UPDATE H1 cible + INSERT
-- event sont dans la MÊME transaction Postgres. Aucun état possible "H1
-- modifié mais event absent".
-- =====================================================

BEGIN;

CREATE TABLE IF NOT EXISTS __seo_content_events (
    event_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Asset identifier canonique partagé avec __seo_content_audit (PR-A2)
    -- et __seo_policy_evaluations (PR-C). Format 'mta:<alias>' ou
    -- 'r1_router:pg:<pgId>' selon le target.
    asset_id        TEXT NOT NULL,
    field_path      TEXT NOT NULL,

    -- État du write dans son cycle de vie. Aligné plan §7 + §8 Phase E :
    --   proposed     — recovery worker propose une valeur (Phase E PR-E)
    --   applied      — gateway a effectivement écrit la cible (PR-D + PR-E)
    --   reverted     — auto-revert ou manual rollback (Phase E PR-E)
    --   quarantined  — chain de revert épuisée, attente humaine (Phase E PR-E)
    --   validated    — multi-source validation J+1/J+3/J+7 OK (Phase E PR-E)
    event_kind      TEXT NOT NULL CHECK (event_kind IN (
        'proposed', 'applied', 'reverted', 'quarantined', 'validated'
    )),

    -- Valeur écrite + son hash SHA-256 (sur valeur normalisée NFC + trim +
    -- collapse-whitespace + lowercase, même normalisation que PR-A1).
    value_text      TEXT NULL,    -- NULL pour validated/quarantined (pas une valeur écrite)
    value_hash      TEXT NOT NULL,

    -- Source de l'écriture, aligné enum seo-field-authority.yaml (PR-B) :
    -- human_curated, human_validated_llm, legacy_recovery, deterministic_builder,
    -- llm_generated_direct (jamais allow par OPA, mais peut apparaître en
    -- deny audit-trail historique pour traçabilité).
    -- Plus 2 valeurs hors-canon pour les seeds historiques :
    -- 'audit_bootstrap' (backfill depuis __seo_content_audit PR-A2),
    -- 'migration_seed' (insertion initiale via SQL migration).
    source_kind     TEXT NOT NULL,
    source_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    actor           TEXT NULL,

    -- Lien vers la décision OPA qui a autorisé cet event (PR-C). NULL pour
    -- les bootstrap events qui n'ont pas eu de décision OPA.
    evaluation_id   UUID NULL REFERENCES __seo_policy_evaluations(evaluation_id),

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seo_content_events_asset
    ON __seo_content_events (asset_id, field_path, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_seo_content_events_kind
    ON __seo_content_events (event_kind, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_seo_content_events_evaluation
    ON __seo_content_events (evaluation_id)
    WHERE evaluation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_seo_content_events_metadata_gin
    ON __seo_content_events USING GIN (source_metadata);

COMMENT ON TABLE __seo_content_events IS
    'PR-D Event Store minimal — append-only history des écritures sur les '
    'champs SEO gouvernés. Chaque applied event est créé atomiquement avec '
    'l''UPDATE de la cible H1 via RPC seo_apply_h1_write. Aucun état possible '
    '"H1 modifié mais event absent".';

-- ── Vue simple : valeur courante par (asset_id, field_path) ──────────────────
--
-- Vue NORMALE (pas matérialisée V1) ; le volume est négligeable. Migration
-- vers matview si queries downstream dépassent 100k events.

CREATE OR REPLACE VIEW __seo_content_assets_current_v AS
SELECT DISTINCT ON (asset_id, field_path)
    asset_id,
    field_path,
    value_text,
    value_hash,
    source_kind,
    source_metadata,
    actor,
    event_id AS latest_event_id,
    evaluation_id,
    created_at
FROM __seo_content_events
WHERE event_kind = 'applied'
ORDER BY asset_id, field_path, created_at DESC;

COMMENT ON VIEW __seo_content_assets_current_v IS
    'Projection courante : dernière valeur applied par (asset_id, field_path). '
    'Vue normale en V1, migrer vers matview si volume > 100k events.';

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE __seo_content_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_all ON __seo_content_events;
CREATE POLICY service_role_all ON __seo_content_events
    FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS authenticated_read ON __seo_content_events;
CREATE POLICY authenticated_read ON __seo_content_events
    FOR SELECT TO authenticated USING (true);

-- ── RPC seo_apply_h1_write : UPDATE H1 + INSERT event ATOMIC ─────────────────
--
-- Cœur de la garantie d'atomicité PR-D. Une seule transaction couvre :
--   1. INSERT __seo_policy_evaluations (decision='allow')
--   2. UPDATE de la colonne canonique H1 cible
--   3. INSERT __seo_content_events (event_kind='applied')
--
-- En cas d'erreur sur n'importe quelle étape, ROLLBACK complet : aucun
-- effet de bord partiel. Aucun état "H1 écrit sans event" possible.
--
-- Limité aux 4 colonnes canoniques PR-B (h1 field). Pour ajouter une
-- nouvelle cible (meta_title, etc.), enrichir la fonction OU créer une RPC
-- sœur. JAMAIS de SQL dynamique générique (injection risk + bypass control plane).

CREATE OR REPLACE FUNCTION seo_apply_h1_write(
    p_asset_id          TEXT,
    p_target_table      TEXT,
    p_target_column     TEXT,
    p_target_id_column  TEXT,
    p_target_id_value   TEXT,
    p_h1_value          TEXT,
    p_value_hash        TEXT,
    p_source_kind       TEXT,
    p_source_metadata   JSONB,
    p_actor             TEXT,
    p_policy_name       TEXT,
    p_policy_bundle_sha TEXT,
    p_input_snapshot    JSONB
) RETURNS TABLE(evaluation_id UUID, event_id UUID, rows_updated INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_evaluation_id UUID;
    v_event_id      UUID;
    v_rows_updated  INTEGER;
    v_sql           TEXT;
BEGIN
    -- Whitelist stricte des couples (table, colonne) acceptés. Refuse tout
    -- couple hors canon — JAMAIS de SQL dynamique générique.
    IF NOT (
        (p_target_table = '___meta_tags_ariane' AND p_target_column = 'mta_h1')
        OR (p_target_table = '__seo_r1_gamme_slots' AND p_target_column = 'r1s_h1_override')
        OR (p_target_table = '__seo_gamme_purchase_guide' AND p_target_column = 'sgpg_h1_override')
        OR (p_target_table = '__seo_gamme' AND p_target_column = 'sg_h1')
    ) THEN
        RAISE EXCEPTION 'seo_apply_h1_write: target (%, %) not in canonical h1 column whitelist',
            p_target_table, p_target_column;
    END IF;

    -- Whitelist des id_column par table.
    IF NOT (
        (p_target_table = '___meta_tags_ariane' AND p_target_id_column = 'mta_alias')
        OR (p_target_table = '__seo_r1_gamme_slots' AND p_target_id_column = 'r1s_pg_id')
        OR (p_target_table = '__seo_gamme_purchase_guide' AND p_target_id_column = 'sgpg_pg_id')
        OR (p_target_table = '__seo_gamme' AND p_target_id_column = 'sg_id')
    ) THEN
        RAISE EXCEPTION 'seo_apply_h1_write: id_column % not whitelisted for table %',
            p_target_id_column, p_target_table;
    END IF;

    -- Verrou par asset+field pour sérialiser admin-ui vs recovery worker
    -- (cf. plan §13 risques — pg_advisory_xact_lock relâché au commit).
    PERFORM pg_advisory_xact_lock(hashtext(p_asset_id || ':h1'));

    -- 1. INSERT décision OPA (allow path).
    INSERT INTO __seo_policy_evaluations (
        asset_id, field_path, policy_name, input_snapshot,
        decision, reason, policy_bundle_sha
    ) VALUES (
        p_asset_id, 'h1', p_policy_name, p_input_snapshot,
        'allow', NULL, p_policy_bundle_sha
    ) RETURNING __seo_policy_evaluations.evaluation_id INTO v_evaluation_id;

    -- 2. UPDATE de la cible. SQL dynamique nécessaire pour table+colonne
    --    paramétrées, mais les valeurs viennent de la whitelist ci-dessus —
    --    pas d'injection possible.
    v_sql := format(
        'UPDATE %I SET %I = $1 WHERE %I::text = $2',
        p_target_table, p_target_column, p_target_id_column
    );
    EXECUTE v_sql USING p_h1_value, p_target_id_value;
    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

    -- 3. INSERT event applied (atomic avec le UPDATE ci-dessus).
    INSERT INTO __seo_content_events (
        asset_id, field_path, event_kind, value_text, value_hash,
        source_kind, source_metadata, actor, evaluation_id
    ) VALUES (
        p_asset_id, 'h1', 'applied', p_h1_value, p_value_hash,
        p_source_kind, p_source_metadata, p_actor, v_evaluation_id
    ) RETURNING __seo_content_events.event_id INTO v_event_id;

    RETURN QUERY SELECT v_evaluation_id, v_event_id, v_rows_updated;
END;
$$;

GRANT EXECUTE ON FUNCTION seo_apply_h1_write(
    TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, JSONB
) TO service_role;

COMMENT ON FUNCTION seo_apply_h1_write IS
    'PR-D RPC atomique : INSERT policy_evaluation (allow) + UPDATE canonical h1 '
    'column + INSERT content_event (applied) en UNE seule transaction. Whitelist '
    'stricte des couples (table, colonne, id_column). Verrou pg_advisory_xact_lock '
    'par asset+field pour sérialiser admin-ui vs recovery worker. Service_role only.';

COMMIT;

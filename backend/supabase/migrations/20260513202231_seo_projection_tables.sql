-- ============================================================================
-- ADR-059 SEO Runtime Projection — Phase B PR-6a (migrations DB uniquement)
-- 7 tables (pattern kg_v3 réutilisé) + 3 enums + indexes + RLS + GRANTs explicites
--
-- AUCUN worker, AUCUN runner, AUCUN replay : ces composants vivent dans
-- PR-6b (workers BullMQ) et PR-6c (replay_projection.py + G1/G2).
--
-- Refs :
--   - ADR-059 vault PR #260 (accepted 2026-05-13)
--   - ADR-021 Database RLS Hardening Zero-Trust (RLS sur toutes nouvelles tables)
--   - feedback_supabase_grant_explicit_for_new_projects (GRANTs explicites)
--   - feedback_replay_sot_is_immutable_object_store (exports_snapshot_uri = SoT)
--   - feedback_versions_complete_for_deterministic_replay (builder/pipeline/extractor/runner)
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- Enums
-- ────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'seo_projection_version_status') THEN
    CREATE TYPE seo_projection_version_status AS ENUM ('draft', 'active', 'deprecated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'seo_projection_run_status') THEN
    CREATE TYPE seo_projection_run_status AS ENUM (
      'running', 'success', 'failed', 'aborted_contract_mismatch'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'seo_projection_trigger_kind') THEN
    CREATE TYPE seo_projection_trigger_kind AS ENUM ('cron', 'manual', 'replay');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'seo_projection_conflict_resolution') THEN
    CREATE TYPE seo_projection_conflict_resolution AS ENUM ('pending', 'resolved', 'ignored');
  END IF;
END$$;


-- ────────────────────────────────────────────────────────────────────────────
-- 1. __seo_projection_runs : audit trail + versions complètes (replay determinism)
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS __seo_projection_runs (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at                  timestamptz NOT NULL DEFAULT now(),
  ended_at                    timestamptz,
  status                      seo_projection_run_status NOT NULL DEFAULT 'running',
  entities_processed          integer NOT NULL DEFAULT 0 CHECK (entities_processed >= 0),
  conflicts_count             integer NOT NULL DEFAULT 0 CHECK (conflicts_count >= 0),

  -- Versions complètes (replay determinism per ADR-059 §"Versions complètes")
  projection_contract_version text NOT NULL CHECK (projection_contract_version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  builder_version             text NOT NULL CHECK (builder_version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  pipeline_version            text NOT NULL CHECK (pipeline_version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  extractor_version           text NOT NULL CHECK (extractor_version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  runner_version              text NOT NULL CHECK (runner_version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),

  -- Snapshot replay SoT (object-store tar.zst immutable per PR-5b)
  exports_snapshot_hash       text NOT NULL CHECK (exports_snapshot_hash ~ '^sha256:[a-f0-9]{64}$'),
  exports_snapshot_uri        text NOT NULL,

  -- Audit-only (NOT replay-authoritative — informational metadata)
  wiki_commit_sha             text NOT NULL,

  -- Trigger provenance + replay traceability
  trigger_kind                seo_projection_trigger_kind NOT NULL DEFAULT 'cron',
  replayed_from_run_id        uuid REFERENCES __seo_projection_runs(id) ON DELETE RESTRICT,

  error_message               text
);

CREATE INDEX IF NOT EXISTS idx_seo_projection_runs_started_at
  ON __seo_projection_runs (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_seo_projection_runs_status
  ON __seo_projection_runs (status);
CREATE INDEX IF NOT EXISTS idx_seo_projection_runs_trigger_kind
  ON __seo_projection_runs (trigger_kind);
CREATE INDEX IF NOT EXISTS idx_seo_projection_runs_replayed_from
  ON __seo_projection_runs (replayed_from_run_id)
  WHERE replayed_from_run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_seo_projection_runs_exports_snapshot_hash
  ON __seo_projection_runs (exports_snapshot_hash);

COMMENT ON TABLE __seo_projection_runs IS
  'ADR-059 §Versioning complet. 1 row par exécution runner. exports_snapshot_uri = replay SoT (tar.zst immutable object-store). wiki_commit_sha = informational-only audit metadata.';
COMMENT ON COLUMN __seo_projection_runs.wiki_commit_sha IS
  'INFORMATIONAL-ONLY audit. Replay SoT = exports_snapshot_uri (tar.zst). Anti git rewrite / force push.';


-- ────────────────────────────────────────────────────────────────────────────
-- 2. __seo_entity_fact_versions : versions historiques (kg_v3 pattern)
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS __seo_entity_fact_versions (
  version_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id           text NOT NULL CHECK (entity_id ~ '^(gamme|vehicle|constructeur|diagnostic):[a-z0-9-]+$'),
  fact_key            text NOT NULL CHECK (length(fact_key) BETWEEN 1 AND 200),
  fact_value          jsonb NOT NULL,
  source_id           text,

  -- kg_v3 pattern
  status              seo_projection_version_status NOT NULL DEFAULT 'draft',
  valid_from          timestamptz NOT NULL DEFAULT now(),
  valid_to            timestamptz,
  source_type         text,
  confidence_base     numeric(3,2) CHECK (confidence_base IS NULL OR (confidence_base >= 0 AND confidence_base <= 1)),
  content_hash        text NOT NULL CHECK (content_hash ~ '^sha256:[a-f0-9]{64}$'),

  -- Provenance
  source_wiki_commit  text NOT NULL,
  run_id              uuid NOT NULL REFERENCES __seo_projection_runs(id) ON DELETE RESTRICT,

  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seo_entity_fact_versions_entity_key
  ON __seo_entity_fact_versions (entity_id, fact_key);
CREATE INDEX IF NOT EXISTS idx_seo_entity_fact_versions_status
  ON __seo_entity_fact_versions (status);
CREATE INDEX IF NOT EXISTS idx_seo_entity_fact_versions_run
  ON __seo_entity_fact_versions (run_id);
CREATE INDEX IF NOT EXISTS idx_seo_entity_fact_versions_content_hash
  ON __seo_entity_fact_versions (content_hash);
CREATE UNIQUE INDEX IF NOT EXISTS uq_seo_entity_fact_versions_entity_key_hash
  ON __seo_entity_fact_versions (entity_id, fact_key, content_hash);

COMMENT ON TABLE __seo_entity_fact_versions IS
  'ADR-059 versions historiques. INSERT-only (jamais UPDATE, jamais DELETE — audit trail préservé). Rollback = UPDATE active_version_id sur __seo_entity_facts.';


-- ────────────────────────────────────────────────────────────────────────────
-- 3. __seo_entity_facts : current state pointer (active_version_id)
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS __seo_entity_facts (
  entity_id           text NOT NULL CHECK (entity_id ~ '^(gamme|vehicle|constructeur|diagnostic):[a-z0-9-]+$'),
  fact_key            text NOT NULL,
  active_version_id   uuid REFERENCES __seo_entity_fact_versions(version_id) ON DELETE RESTRICT,
  updated_at          timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (entity_id, fact_key)
);

CREATE INDEX IF NOT EXISTS idx_seo_entity_facts_entity_id
  ON __seo_entity_facts (entity_id);
CREATE INDEX IF NOT EXISTS idx_seo_entity_facts_active_version
  ON __seo_entity_facts (active_version_id);

COMMENT ON TABLE __seo_entity_facts IS
  'Current-state pointer per (entity_id, fact_key). active_version_id pointe vers __seo_entity_fact_versions. Rollback = UPDATE active_version_id, jamais DELETE.';


-- ────────────────────────────────────────────────────────────────────────────
-- 4. __seo_entity_sources : sources par entity
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS __seo_entity_sources (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id       text NOT NULL CHECK (entity_id ~ '^(gamme|vehicle|constructeur|diagnostic):[a-z0-9-]+$'),
  source_id       text NOT NULL,
  source_type     text NOT NULL,
  confidence_base numeric(3,2) CHECK (confidence_base IS NULL OR (confidence_base >= 0 AND confidence_base <= 1)),
  url             text,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  run_id          uuid REFERENCES __seo_projection_runs(id) ON DELETE RESTRICT,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seo_entity_sources_entity
  ON __seo_entity_sources (entity_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_seo_entity_sources_entity_source
  ON __seo_entity_sources (entity_id, source_id);


-- ────────────────────────────────────────────────────────────────────────────
-- 5. __seo_content_block_versions : versions historiques blocks
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS __seo_content_block_versions (
  version_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id           text NOT NULL CHECK (entity_id ~ '^(gamme|vehicle|constructeur|diagnostic):[a-z0-9-]+$'),
  role                text NOT NULL,
  section             text,
  content_md          text NOT NULL,

  status              seo_projection_version_status NOT NULL DEFAULT 'draft',
  valid_from          timestamptz NOT NULL DEFAULT now(),
  valid_to            timestamptz,
  content_hash        text NOT NULL CHECK (content_hash ~ '^sha256:[a-f0-9]{64}$'),

  source_wiki_commit  text NOT NULL,
  run_id              uuid NOT NULL REFERENCES __seo_projection_runs(id) ON DELETE RESTRICT,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seo_content_block_versions_entity_role
  ON __seo_content_block_versions (entity_id, role);
CREATE INDEX IF NOT EXISTS idx_seo_content_block_versions_status
  ON __seo_content_block_versions (status);
CREATE INDEX IF NOT EXISTS idx_seo_content_block_versions_run
  ON __seo_content_block_versions (run_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_seo_content_block_versions_entity_role_hash
  ON __seo_content_block_versions (entity_id, role, content_hash);


-- ────────────────────────────────────────────────────────────────────────────
-- 6. __seo_content_blocks : current state pointer
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS __seo_content_blocks (
  entity_id           text NOT NULL CHECK (entity_id ~ '^(gamme|vehicle|constructeur|diagnostic):[a-z0-9-]+$'),
  role                text NOT NULL,
  section             text,
  active_version_id   uuid REFERENCES __seo_content_block_versions(version_id) ON DELETE RESTRICT,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- COALESCE pour gérer section nullable (PG ne permet pas PK avec NULL)
CREATE UNIQUE INDEX IF NOT EXISTS uq_seo_content_blocks_entity_role_section
  ON __seo_content_blocks (entity_id, role, COALESCE(section, ''));
CREATE INDEX IF NOT EXISTS idx_seo_content_blocks_entity
  ON __seo_content_blocks (entity_id);
CREATE INDEX IF NOT EXISTS idx_seo_content_blocks_active_version
  ON __seo_content_blocks (active_version_id);


-- ────────────────────────────────────────────────────────────────────────────
-- 7. __seo_projection_conflicts : conflits non auto-appliqués (review humaine)
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS __seo_projection_conflicts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id           text NOT NULL CHECK (entity_id ~ '^(gamme|vehicle|constructeur|diagnostic):[a-z0-9-]+$'),
  fact_key            text,
  block_key           text,  -- e.g. "R3_CONSEILS:S2_DIAG"
  current_value       jsonb,
  proposed_value      jsonb,
  reason              text NOT NULL,
  resolution          seo_projection_conflict_resolution NOT NULL DEFAULT 'pending',
  resolved_at         timestamptz,
  resolved_by         text,
  resolution_notes    text,
  run_id              uuid NOT NULL REFERENCES __seo_projection_runs(id) ON DELETE RESTRICT,
  created_at          timestamptz NOT NULL DEFAULT now(),

  CHECK (fact_key IS NOT NULL OR block_key IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_seo_projection_conflicts_entity
  ON __seo_projection_conflicts (entity_id);
CREATE INDEX IF NOT EXISTS idx_seo_projection_conflicts_resolution
  ON __seo_projection_conflicts (resolution);
CREATE INDEX IF NOT EXISTS idx_seo_projection_conflicts_run
  ON __seo_projection_conflicts (run_id);
CREATE INDEX IF NOT EXISTS idx_seo_projection_conflicts_pending
  ON __seo_projection_conflicts (created_at DESC)
  WHERE resolution = 'pending';


-- ────────────────────────────────────────────────────────────────────────────
-- RLS zero-trust (ADR-021)
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE __seo_projection_runs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE __seo_entity_facts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE __seo_entity_fact_versions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE __seo_entity_sources         ENABLE ROW LEVEL SECURITY;
ALTER TABLE __seo_content_blocks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE __seo_content_block_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE __seo_projection_conflicts   ENABLE ROW LEVEL SECURITY;

-- AUCUNE policy SELECT pour anon/authenticated par défaut.
-- service_role bypass RLS (postgres role).
-- Lecture publique passera EXCLUSIVEMENT par RPC SECURITY DEFINER (PR-7).
-- Cohérent avec ADR-059 "No Direct Page SQL".


-- ────────────────────────────────────────────────────────────────────────────
-- GRANTs explicites (feedback_supabase_grant_explicit_for_new_projects)
-- ────────────────────────────────────────────────────────────────────────────

REVOKE ALL ON __seo_projection_runs        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON __seo_entity_facts           FROM PUBLIC, anon, authenticated;
REVOKE ALL ON __seo_entity_fact_versions   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON __seo_entity_sources         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON __seo_content_blocks         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON __seo_content_block_versions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON __seo_projection_conflicts   FROM PUBLIC, anon, authenticated;

-- service_role : SELECT + INSERT + UPDATE (PAS DELETE — ADR-059 §Rollback dit "jamais DELETE")
GRANT SELECT, INSERT, UPDATE ON __seo_projection_runs        TO service_role;
GRANT SELECT, INSERT, UPDATE ON __seo_entity_facts           TO service_role;
GRANT SELECT, INSERT, UPDATE ON __seo_entity_fact_versions   TO service_role;
GRANT SELECT, INSERT, UPDATE ON __seo_entity_sources         TO service_role;
GRANT SELECT, INSERT, UPDATE ON __seo_content_blocks         TO service_role;
GRANT SELECT, INSERT, UPDATE ON __seo_content_block_versions TO service_role;
GRANT SELECT, INSERT, UPDATE ON __seo_projection_conflicts   TO service_role;

-- Sequences (gen_random_uuid n'utilise pas de séquence ; safe net si futurs ALTER)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;

COMMIT;

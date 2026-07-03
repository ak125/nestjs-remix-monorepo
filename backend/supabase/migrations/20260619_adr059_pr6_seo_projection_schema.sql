-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- ADR-059 PR-6 — SEO Runtime Projection : schéma versionné (7 tables + 2 MV)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Canon : ADR-059 (accepted) + ADR-090 (accepted, §C1-C4 forward-writer).
-- Pattern kg_v3 réutilisé tel quel (cf. 20260125_kg_v3_versioning.sql) :
--   status draft→active→deprecated · valid_from/valid_to · source_type · confidence_base · content_hash.
--
-- PÉRIMÈTRE PR-6 (ce fichier) = SCHÉMA SEULEMENT (write-side) :
--   7 tables versionnées + 2 materialized views CONCURRENT-refresh-ready + RLS service_role-write.
-- HORS PÉRIMÈTRE (PR-7, séparé) = RPC `get_active_seo_projection` + GRANT EXECUTE anon + guards pages.
--   → tant que PR-7 n'est pas posée, AUCUN accès anon : read-path dark (flag SEO_PROJECTION_READ_ENABLED=false).
--
-- Risque : BAS — création de tables NEUVES (0 lock sur l'existant, 0 perte de données, aucune des 7
--   tables n'existe en DB). Additif + idempotent (IF NOT EXISTS partout). Réversible (rollback en pied).
-- ⚠️ NON auto-appliquée à la DB partagée (deployment.md axe 4) : revue owner + `apply_migration` manuel.
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- squawk-ignore-file require-concurrent-index-creation
--   assume_in_transaction=true (.squawk.toml) → CONCURRENTLY interdit en transaction ; toutes les
--   tables + MV sont NEUVES dans la transaction gérée par l'outil → 0 lock contention / 0 blocage writes.
-- Transaction gérée par l'outil de migration (assume_in_transaction=true). Timeouts requis (require-timeout-settings) :
SET lock_timeout = '5s';
SET statement_timeout = '60s';

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 1. __seo_projection_runs — audit trail (1 row / run), versioning replay     ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
CREATE TABLE IF NOT EXISTS __seo_projection_runs (
  run_id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_kind                 text NOT NULL CHECK (trigger_kind IN ('cron', 'manual', 'replay')),
  status                       text NOT NULL DEFAULT 'running'
                                 CHECK (status IN ('running', 'succeeded', 'failed')),
  -- replay determinism (ADR-059 §Versioning complet)
  projection_contract_version  text,
  writer_contract_version      text,                          -- ADR-090 Q1 : découplé du runner
  exports_snapshot_hash        text,                          -- sha256 du tarball (replay SoT)
  exports_snapshot_uri         text,                          -- /opt/automecanik/object-store/exports-snapshots/<sha256>.tar.zst
  wiki_commit_sha              text,                          -- audit-only, JAMAIS replay-authoritative (ADR-059)
  builder_version              text,
  pipeline_version             text,
  extractor_version            text,
  runner_version               text,
  replayed_from_run_id         uuid REFERENCES __seo_projection_runs(run_id) ON DELETE SET NULL,
  entities_written             bigint  NOT NULL DEFAULT 0,
  started_at                   timestamptz NOT NULL DEFAULT now(),
  finished_at                  timestamptz
);
COMMENT ON TABLE __seo_projection_runs IS
  'ADR-059 PR-6 : audit trail (1 row/run) du forward-writer SEO projection. exports_snapshot_uri = seule autorité replay (pas git).';

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 2. __seo_entity_facts — facts par entity (pointeur active_version_id)       ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
CREATE TABLE IF NOT EXISTS __seo_entity_facts (
  entity_id          text PRIMARY KEY,                        -- ex. 'gamme:plaquette-de-frein'
  entity_type        text NOT NULL CHECK (entity_type IN ('gamme', 'vehicle', 'constructeur', 'diagnostic')),
  slug               text NOT NULL,
  active_version_id  uuid,                                    -- FK ajoutée après la table versions (déférée)
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE __seo_entity_facts IS
  'ADR-059 PR-6 : facts par entity SEO. active_version_id pointe la version active (jamais SELECT direct frontend — RPC PR-7).';

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 3. __seo_entity_fact_versions — versions historiques (kg_v3 pattern)        ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
CREATE TABLE IF NOT EXISTS __seo_entity_fact_versions (
  version_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id         text NOT NULL REFERENCES __seo_entity_facts(entity_id) ON DELETE CASCADE,
  status            text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'deprecated')),
  valid_from        timestamptz NOT NULL DEFAULT now(),
  valid_to          timestamptz,
  source_type       text,
  confidence_base   double precision CHECK (confidence_base >= 0 AND confidence_base <= 1),
  content_hash      text NOT NULL,                            -- md5/sha du payload → no-op detection
  facts             jsonb NOT NULL DEFAULT '[]'::jsonb,       -- exports-seo.schema.json facts[]
  run_id            uuid REFERENCES __seo_projection_runs(run_id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE __seo_entity_fact_versions IS
  'ADR-059 PR-6 : versions immuables des facts (INSERT-new-version-NEVER-UPDATE, ADR-090 §C4 wouldRegress).';

-- FK différée entity_facts.active_version_id → fact_versions (les 2 tables existent maintenant)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_entity_facts_active_version') THEN
    ALTER TABLE __seo_entity_facts
      ADD CONSTRAINT fk_entity_facts_active_version
      FOREIGN KEY (active_version_id) REFERENCES __seo_entity_fact_versions(version_id) ON DELETE SET NULL;
  END IF;
END $$;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 4. __seo_entity_sources — sources par entity                                ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
CREATE TABLE IF NOT EXISTS __seo_entity_sources (
  source_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id    text NOT NULL REFERENCES __seo_entity_facts(entity_id) ON DELETE CASCADE,
  source_ref   text NOT NULL,
  kind         text,
  url          text,
  confidence   text CHECK (confidence IS NULL OR confidence IN ('high', 'medium', 'low')),
  run_id       uuid REFERENCES __seo_projection_runs(run_id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE __seo_entity_sources IS
  'ADR-059 PR-6 : provenance par entity (exports-seo.schema.json sources[]).';

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 5. __seo_content_blocks — blocks rôle-aware (pointeur active_version_id)     ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
CREATE TABLE IF NOT EXISTS __seo_content_blocks (
  block_id           text PRIMARY KEY,                        -- ex. 'gamme:plaquette-de-frein#R1#avoid-confusion'
  entity_id          text NOT NULL REFERENCES __seo_entity_facts(entity_id) ON DELETE CASCADE,
  role               text NOT NULL,                           -- R1/R2/R3/R6/R8…
  block_kind         text NOT NULL,
  active_version_id  uuid,                                    -- FK déférée
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE __seo_content_blocks IS
  'ADR-059 PR-6 : blocks de contenu rôle-aware projetés (consommés via RPC PR-7, jamais SELECT direct).';

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 6. __seo_content_block_versions — versions historiques de blocks            ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
CREATE TABLE IF NOT EXISTS __seo_content_block_versions (
  version_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id          text NOT NULL REFERENCES __seo_content_blocks(block_id) ON DELETE CASCADE,
  status            text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'deprecated')),
  valid_from        timestamptz NOT NULL DEFAULT now(),
  valid_to          timestamptz,
  source_type       text,
  confidence_base   double precision CHECK (confidence_base >= 0 AND confidence_base <= 1),
  content_hash      text NOT NULL,
  content           jsonb NOT NULL DEFAULT '{}'::jsonb,
  run_id            uuid REFERENCES __seo_projection_runs(run_id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE __seo_content_block_versions IS
  'ADR-059 PR-6 : versions immuables des blocks (INSERT-new-version-NEVER-UPDATE).';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_content_blocks_active_version') THEN
    ALTER TABLE __seo_content_blocks
      ADD CONSTRAINT fk_content_blocks_active_version
      FOREIGN KEY (active_version_id) REFERENCES __seo_content_block_versions(version_id) ON DELETE SET NULL;
  END IF;
END $$;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 7. __seo_projection_conflicts — conflits non auto-appliqués (wouldRegress)   ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
CREATE TABLE IF NOT EXISTS __seo_projection_conflicts (
  conflict_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id      text NOT NULL,
  block_id       text,
  conflict_kind  text NOT NULL,                               -- ex. 'would_regress', 'gate_blocked'
  resolution     text NOT NULL DEFAULT 'pending' CHECK (resolution IN ('pending', 'resolved', 'ignored')),
  detail         jsonb NOT NULL DEFAULT '{}'::jsonb,
  run_id         uuid REFERENCES __seo_projection_runs(run_id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  resolved_at    timestamptz
);
COMMENT ON TABLE __seo_projection_conflicts IS
  'ADR-059 PR-6 : conflits observables (ADR-090 §C4 no-rétro-régression) — jamais silencieux, resolution pending/resolved/ignored.';

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ Index (kg_v3 pattern : active-current + FK + temporel)                      ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
CREATE INDEX IF NOT EXISTS idx_seo_fact_versions_entity        ON __seo_entity_fact_versions (entity_id);
CREATE INDEX IF NOT EXISTS idx_seo_fact_versions_active_current ON __seo_entity_fact_versions (entity_id, status)
  WHERE status = 'active' AND valid_to IS NULL;
CREATE INDEX IF NOT EXISTS idx_seo_fact_versions_run           ON __seo_entity_fact_versions (run_id);
CREATE INDEX IF NOT EXISTS idx_seo_block_versions_block         ON __seo_content_block_versions (block_id);
CREATE INDEX IF NOT EXISTS idx_seo_block_versions_active_current ON __seo_content_block_versions (block_id, status)
  WHERE status = 'active' AND valid_to IS NULL;
CREATE INDEX IF NOT EXISTS idx_seo_blocks_entity_role          ON __seo_content_blocks (entity_id, role);
CREATE INDEX IF NOT EXISTS idx_seo_entity_sources_entity       ON __seo_entity_sources (entity_id);
CREATE INDEX IF NOT EXISTS idx_seo_conflicts_pending           ON __seo_projection_conflicts (resolution)
  WHERE resolution = 'pending';

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ RLS — service_role-write only ; AUCUN accès anon/authenticated direct       ║
-- ║ (lecture pages = via MV + RPC SECURITY DEFINER en PR-7, jamais SELECT table)║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
ALTER TABLE __seo_projection_runs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE __seo_entity_facts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE __seo_entity_fact_versions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE __seo_entity_sources           ENABLE ROW LEVEL SECURITY;
ALTER TABLE __seo_content_blocks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE __seo_content_block_versions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE __seo_projection_conflicts     ENABLE ROW LEVEL SECURITY;

-- RLS activée SANS policy anon/authenticated = deny-all par défaut pour ces rôles.
-- Le writer backend utilise service_role (bypass RLS). Policy explicite service_role pour la lisibilité d'intention :
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    '__seo_projection_runs','__seo_entity_facts','__seo_entity_fact_versions','__seo_entity_sources',
    '__seo_content_blocks','__seo_content_block_versions','__seo_projection_conflicts'
  ] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'service_role_all_' || t) THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true)',
        'service_role_all_' || t, t);
    END IF;
  END LOOP;
END $$;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ Materialized views — surface de lecture (CONCURRENT-refresh-ready)          ║
-- ║ REFRESH ... CONCURRENTLY exige un index UNIQUE → fourni ci-dessous.         ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_seo_entity_facts_current AS
  SELECT ef.entity_id, ef.entity_type, ef.slug,
         fv.version_id, fv.content_hash, fv.confidence_base, fv.facts, fv.valid_from
  FROM __seo_entity_facts ef
  JOIN __seo_entity_fact_versions fv ON fv.version_id = ef.active_version_id
  WHERE fv.status = 'active'
  WITH NO DATA;
CREATE UNIQUE INDEX IF NOT EXISTS uq_mv_seo_entity_facts_current ON mv_seo_entity_facts_current (entity_id);
COMMENT ON MATERIALIZED VIEW mv_seo_entity_facts_current IS
  'ADR-059 PR-6 : MV courante facts (active_version_id × status=active). REFRESH CONCURRENTLY hors-transaction (PR-6 worker).';

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_seo_content_blocks_current AS
  SELECT cb.block_id, cb.entity_id, cb.role, cb.block_kind,
         bv.version_id, bv.content_hash, bv.confidence_base, bv.content, bv.valid_from
  FROM __seo_content_blocks cb
  JOIN __seo_content_block_versions bv ON bv.version_id = cb.active_version_id
  WHERE bv.status = 'active'
  WITH NO DATA;
CREATE UNIQUE INDEX IF NOT EXISTS uq_mv_seo_content_blocks_current ON mv_seo_content_blocks_current (block_id);
COMMENT ON MATERIALIZED VIEW mv_seo_content_blocks_current IS
  'ADR-059 PR-6 : MV courante blocks rôle-aware. Lecture via RPC PR-7 (GRANT EXECUTE anon là-bas, pas ici).';


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- ROLLBACK (down) — réversible : aucune donnée applicative perdue (tables neuves).
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- BEGIN;
--   DROP MATERIALIZED VIEW IF EXISTS mv_seo_content_blocks_current;
--   DROP MATERIALIZED VIEW IF EXISTS mv_seo_entity_facts_current;
--   DROP TABLE IF EXISTS __seo_projection_conflicts;
--   DROP TABLE IF EXISTS __seo_content_block_versions;
--   DROP TABLE IF EXISTS __seo_content_blocks;
--   DROP TABLE IF EXISTS __seo_entity_sources;
--   DROP TABLE IF EXISTS __seo_entity_fact_versions;
--   DROP TABLE IF EXISTS __seo_entity_facts;
--   DROP TABLE IF EXISTS __seo_projection_runs;
-- COMMIT;

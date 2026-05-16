-- squawk-ignore-file adding-foreign-key-constraint
-- squawk-ignore-file require-concurrent-index-creation
--
-- Rationale (ADR-072) :
--   - `adding-foreign-key-constraint` : les ADD COLUMN ... REFERENCES sur
--     __seo_r8_pages et __seo_r2_pages portent sur des colonnes NOUVELLEMENT
--     créées (current_snapshot_id, NULL par défaut). Aucune row pré-existante ne
--     pointe vers __seo_r2_page_snapshot (table créée dans cette migration).
--     Le SHARE ROW EXCLUSIVE lock est sur des tables que personne ne lit ni
--     n'écrit pendant la migration (R2 v2 pas encore en production).
--   - `require-concurrent-index-creation` : indexes partiels sur la colonne
--     current_snapshot_id qui vient d'être ajoutée (toutes valeurs NULL au
--     moment de CREATE INDEX). CONCURRENTLY impossible dans migration tx
--     (assume_in_transaction = true côté .squawk.toml).
--
-- =============================================================================
-- ADR-072 — R2 v2 CQRS Snapshot Artifact + Outbox + R8 Snapshot Store
-- =============================================================================
--
-- 3 tables canon Round 8 paradigme architectural industry-standard :
--
--   1. __seo_r8_snapshot_store     — R8 Vehicle bounded context (immutable, versioned)
--   2. __seo_r2_page_snapshot      — R2 Render bounded context (immutable, content-addressed)
--   3. __seo_outbox_event           — Cross-context integration events transactional outbox
--
-- + ALTER pointer columns sur __seo_r8_pages et __seo_r2_pages (current_snapshot_id).
--
-- Référence industrie : Shopify Storefront CDN (pre-rendered products),
-- Sanity.io headless CMS (versioned documents), Vercel ISR (background regen +
-- cached read), Netflix Hollow (read-only memory datasets), Confluent transactional
-- outbox pattern, Microservices.io.
--
-- Canon strict :
--   - Tables snapshot = INSERT-only (No UPDATE/DELETE grant — immutable versioning)
--   - version_sha = sha256(canonical(input)) via fast-json-stable-stringify côté TS
--     (canon MEMORY feedback_deterministic_input_hash_canonical_json)
--   - RLS enabled, GRANT explicit service_role uniquement
--     (canon MEMORY feedback_supabase_grant_explicit_for_new_projects)
--   - Squawk-validated : timeout settings, BIGINT identity, idempotent IF NOT EXISTS
--
-- ADR : ADR-072-r2-cqrs-ddd-snapshot-artifact.md (vault commit 8ad4bf8a)
-- Plan source : /home/deploy/.claude/plans/le-contenu-de-r2-scalable-tower.md
-- =============================================================================

-- SET LOCAL pour bornes de safety (squawk require-timeout-settings).
SET LOCAL lock_timeout       = '5s';
SET LOCAL statement_timeout  = '60s';

-- =============================================================================
-- 1. __seo_r8_snapshot_store : R8 Vehicle Domain — immutable read model
-- =============================================================================
--
-- Stocke les versions persisted des R8VehicleSnapshot. R2 lit via JOIN
-- __seo_r8_pages.current_snapshot_id (jamais d'attente live, jamais de compose
-- runtime). Round 2 status enum strict : minimal | enriched | stale | failed.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.__seo_r8_snapshot_store (
  id                       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  type_id                  BIGINT NOT NULL,
  version_sha              TEXT NOT NULL UNIQUE,                   -- sha256(disambiguation_signature canonical JSON)
  disambiguation_signature JSONB NOT NULL,                          -- {power, body, years, engine_code, euro_norm, siblings[]}
  enrichment_status        TEXT NOT NULL CHECK (enrichment_status IN
    ('minimal', 'enriched', 'stale', 'failed')),
  source_lineage           JSONB,                                   -- {auto_type_updated_at, wiki_evidence_ids[], llm_model}
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.__seo_r8_snapshot_store IS
  'ADR-072 R8 Vehicle Domain bounded context — immutable versioned snapshot store. R2 reads only persisted (JOIN __seo_r8_pages.current_snapshot_id). Status enum strict Round 2 : minimal (DB-only seed) | enriched (WIKI validated) | stale (auto_type.updated_at > snapshot.created_at) | failed (LLM timeout, data corruption, source ban — does NOT block R2 compose, just returns review_required reason r8_enrichment_failed). No UPDATE/DELETE grant : versions immuables (corrige cascade coupling R8/R2 runtime).';

COMMENT ON COLUMN public.__seo_r8_snapshot_store.version_sha IS
  'sha256(canonical(disambiguation_signature)) via fast-json-stable-stringify côté TS. Content-addressed — recompute same signature → same version_sha → INSERT skipped (idempotent).';

CREATE INDEX IF NOT EXISTS idx_r8_snapshot_type_created
  ON public.__seo_r8_snapshot_store (type_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_r8_snapshot_version_sha
  ON public.__seo_r8_snapshot_store (version_sha);

CREATE INDEX IF NOT EXISTS idx_r8_snapshot_status_stale
  ON public.__seo_r8_snapshot_store (enrichment_status)
  WHERE enrichment_status = 'stale';                                 -- pour job nightly re-enrichment

ALTER TABLE public.__seo_r8_snapshot_store ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.__seo_r8_snapshot_store TO service_role;
-- No UPDATE/DELETE grant : versions immuables (CQRS canon)

-- =============================================================================
-- 2. __seo_r2_page_snapshot : R2 Render Domain — published artifact immutable
-- =============================================================================
--
-- Read model R2 v2. Runtime Remix lit __seo_r2_page_snapshot via JOIN
-- __seo_r2_pages.current_snapshot_id. Jamais de compose live (Rego deny
-- r2-runtime-read.rego ADR-072 §1).
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.__seo_r2_page_snapshot (
  id                       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pg_id                    BIGINT NOT NULL,
  type_id                  BIGINT NOT NULL,
  version_sha              TEXT NOT NULL UNIQUE,                   -- sha256(canonical(input + render_engine_version))
  compose_input_hash       TEXT NOT NULL,                           -- sha256(R8 version_sha + R1 hash + KG sigs + WIKI sigs)
  rendered_sections        JSONB NOT NULL,                          -- {S_HERO, S_VARIANT_DISAMBIGUATION, ..., S_COMPAT_DIFFERENCES, S_TECHNICAL_TABLE_COMPACT, S_SELECTION_WARNING}
  rendered_html_compact    TEXT,                                    -- HTML précalculé SSR fast path (optionnel, lazy)
  governance_decision      TEXT NOT NULL CHECK (governance_decision IN
    ('index', 'review_required', 'reject')),                       -- canon ADR-068 (no 'suppressed' auto)
  internal_difference_score NUMERIC(5,2) CHECK (
    internal_difference_score IS NULL OR
    (internal_difference_score >= 0 AND internal_difference_score <= 100)
  ),                                                                 -- canon ADR-070 Round 6
  l4_external_used         BOOLEAN NOT NULL DEFAULT false,           -- evidence externe consommée ?
  -- Lineage 4 inputs (traçabilité formule canon Round 5)
  r8_snapshot_version_sha  TEXT NOT NULL,
  r1_context_hash          TEXT NOT NULL,
  kg_fact_signatures       TEXT[] NOT NULL DEFAULT '{}',
  wiki_evidence_signatures TEXT[] NOT NULL DEFAULT '{}',
  -- OTel correlation (canon ADR-072 §6)
  trace_id                 TEXT,
  compose_run_id           UUID NOT NULL,
  -- Audit
  composed_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  composed_by_worker_id    TEXT NOT NULL,
  render_engine_version    TEXT NOT NULL                            -- SemVer ex: '2026.05.16-r2v2.0.0'
);

COMMENT ON TABLE public.__seo_r2_page_snapshot IS
  'ADR-072 R2 Render Domain bounded context — Published Snapshot Artifact immutable content-addressed. CQRS read-side : runtime Remix reads via __seo_r2_pages.current_snapshot_id pointer + Redis L1 cache (p95 < 50ms). No UPDATE/DELETE grant : versioning immuable (rollback = repointer current_snapshot_id atomique). Référence industrie : Shopify Storefront CDN, Sanity.io headless CMS, Vercel ISR, Netflix Hollow.';

COMMENT ON COLUMN public.__seo_r2_page_snapshot.version_sha IS
  'sha256(canonical(compose_input + render_engine_version)) via fast-json-stable-stringify. Content-addressed. Recompute même input → même version_sha → INSERT skipped (idempotent canon MEMORY feedback_deterministic_input_hash_canonical_json).';

COMMENT ON COLUMN public.__seo_r2_page_snapshot.governance_decision IS
  'Canon ADR-068 4 outcomes auto : index | review_required | reject. PAS suppressed (manual-only via admin UI, jamais pipeline).';

COMMENT ON COLUMN public.__seo_r2_page_snapshot.l4_external_used IS
  'Canon ADR-070 Round 6 INTERNAL DIFFERENCE EXHAUSTION. true si L4 Playwright/WIKI a été consommé, false si L0-L3 internes suffisants. Métrique OTel r2.compose.l4_external_called_rate doit rester < 30% canon ADR-072 §6.';

CREATE INDEX IF NOT EXISTS idx_r2_snapshot_pg_type_composed
  ON public.__seo_r2_page_snapshot (pg_id, type_id, composed_at DESC);

CREATE INDEX IF NOT EXISTS idx_r2_snapshot_version_sha
  ON public.__seo_r2_page_snapshot (version_sha);

CREATE INDEX IF NOT EXISTS idx_r2_snapshot_input_hash
  ON public.__seo_r2_page_snapshot (compose_input_hash);              -- pour dedup idempotent

ALTER TABLE public.__seo_r2_page_snapshot ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.__seo_r2_page_snapshot TO service_role;
-- No UPDATE/DELETE grant : versions immuables (CQRS canon)

-- =============================================================================
-- 3. __seo_outbox_event : transactional outbox pattern (cross-context events)
-- =============================================================================
--
-- Pattern industrie : Confluent (Kafka), Microservices.io, AWS DynamoDB
-- Streams. Garantit cohérence write-side ↔ event publication sans transactions
-- distribuées. OutboxRelayService BullMQ repeatable poll + relay vers queues
-- downstream (r2-content-gen, sitemap-regen, cloudflare-purge, etc.).
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.__seo_outbox_event (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  aggregate_type  TEXT NOT NULL,                                    -- 'R8VehicleSnapshot' | 'KGFact' | 'R2PageSnapshot' | ...
  aggregate_id    TEXT NOT NULL,                                    -- composite key per type (ex: "pg_id:type_id")
  event_type      TEXT NOT NULL,                                    -- 'R8SnapshotUpdated' | 'KGFactUpserted' | 'R2PagePublished' | ...
  payload         JSONB NOT NULL,
  trace_id        TEXT,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at    TIMESTAMPTZ,                                       -- NULL = pending; set when relayed to BullMQ
  attempts        BIGINT NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error      TEXT
);

COMMENT ON TABLE public.__seo_outbox_event IS
  'ADR-072 Transactional Outbox pattern (référence industrie : Confluent Kafka, Microservices.io, AWS DynamoDB Streams). OutboxRelayService BullMQ repeatable (concurrency 1, poll 5s, batch 100, FOR UPDATE SKIP LOCKED) pulls pending → publishes to downstream BullMQ queue ciblée selon event_type → UPDATE published_at = NOW(). Retry exponential backoff, dead-letter post 5 attempts.';

CREATE INDEX IF NOT EXISTS idx_outbox_pending
  ON public.__seo_outbox_event (occurred_at)
  WHERE published_at IS NULL;                                        -- hot path relay polling

CREATE INDEX IF NOT EXISTS idx_outbox_aggregate
  ON public.__seo_outbox_event (aggregate_type, aggregate_id, occurred_at DESC);

ALTER TABLE public.__seo_outbox_event ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.__seo_outbox_event TO service_role;
-- UPDATE allowed uniquement pour set published_at + attempts + last_error (relay state machine).
-- Pas de DELETE grant : audit-trail conservé (archivage cold storage déféré V2).

-- =============================================================================
-- 4. ALTER pointers : current_snapshot_id sur __seo_r8_pages et __seo_r2_pages
-- =============================================================================
--
-- Pointer atomic vers la version courante publiée. Rollback = repointer
-- current_snapshot_id vers version antérieure (canon ADR-072 §7 GitOps).
-- =============================================================================

-- __seo_r8_pages : current_snapshot_id pointer vers __seo_r8_snapshot_store
-- (table existe déjà depuis modules SEO R8 — ajout colonne idempotent)
ALTER TABLE public.__seo_r8_pages
  ADD COLUMN IF NOT EXISTS current_snapshot_id BIGINT
    REFERENCES public.__seo_r8_snapshot_store(id);

CREATE INDEX IF NOT EXISTS idx_r8_pages_current_snapshot
  ON public.__seo_r8_pages (current_snapshot_id)
  WHERE current_snapshot_id IS NOT NULL;

-- __seo_r2_pages : current_snapshot_id pointer vers __seo_r2_page_snapshot
-- (table existe depuis 20260515_seo_r2_v2_foundation.sql)
ALTER TABLE public.__seo_r2_pages
  ADD COLUMN IF NOT EXISTS current_snapshot_id BIGINT
    REFERENCES public.__seo_r2_page_snapshot(id);

CREATE INDEX IF NOT EXISTS idx_r2_pages_current_snapshot
  ON public.__seo_r2_pages (current_snapshot_id)
  WHERE current_snapshot_id IS NOT NULL;

-- =============================================================================
-- Comments documentaires sur les pointers
-- =============================================================================

COMMENT ON COLUMN public.__seo_r8_pages.current_snapshot_id IS
  'ADR-072 §3 GitOps pointer atomic vers la version courante publiée dans __seo_r8_snapshot_store. Rollback = UPDATE current_snapshot_id vers version antérieure (instantané, audit-trail conservé). R8SnapshotReaderService JOIN sur cette colonne pour fournir le R8VehicleSnapshot à R2 compose.';

COMMENT ON COLUMN public.__seo_r2_pages.current_snapshot_id IS
  'ADR-072 §3 GitOps pointer atomic vers la version courante publiée dans __seo_r2_page_snapshot. Runtime Remix Read-side lit via cette colonne (canon CQRS Rego r2-runtime-read.rego). Rollback = UPDATE atomique vers version antérieure.';

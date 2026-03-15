-- Migration: RAG Pipeline v2 — Phase 1 Ingestion Foundation
-- Tables: rag_documents + rag_document_versions + rag_job_history
-- Enrichments: __rag_knowledge new columns
-- Date: 2026-03-13

-- ── Table: rag_documents (document registry, DB = source of truth) ──

CREATE TABLE IF NOT EXISTS rag_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_source_key TEXT NOT NULL,
  normalized_source_key TEXT NOT NULL,

  -- Current version pointers
  current_staged_version_id UUID,
  current_published_version_id UUID,

  -- Lifecycle
  lifecycle_status TEXT NOT NULL DEFAULT 'ingested'
    CHECK (lifecycle_status IN (
      'ingested', 'staged', 'reviewed', 'published',
      'activated', 'archived', 'rejected', 'tombstoned'
    )),

  -- Trust & quality
  truth_level TEXT NOT NULL DEFAULT 'L2' CHECK (truth_level IN ('L1', 'L2', 'L3', 'L4')),
  tier TEXT CHECK (tier IN ('A', 'B', 'C', 'D')),
  health_score NUMERIC(3,2),
  quality_score NUMERIC(3,2),

  -- Fingerprints (latest)
  raw_hash TEXT,
  content_hash TEXT,
  publication_hash TEXT,

  -- Provenance (G4)
  source_url TEXT,
  source_type TEXT,
  gamme_aliases TEXT[] DEFAULT '{}',
  job_origin TEXT,

  -- Domain/category
  domain TEXT,
  category TEXT,
  kb_type TEXT,

  -- Phase Barrier (R4)
  phase1_status TEXT DEFAULT 'failed'
    CHECK (phase1_status IN ('passed', 'failed', 'quarantined')),

  -- Metadata
  pipeline_version TEXT DEFAULT '2.0',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT uq_rag_doc_canonical UNIQUE (canonical_source_key)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rag_docs_lifecycle ON rag_documents (lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_rag_docs_domain ON rag_documents (domain);
CREATE INDEX IF NOT EXISTS idx_rag_docs_truth ON rag_documents (truth_level);
CREATE INDEX IF NOT EXISTS idx_rag_docs_content_hash ON rag_documents (content_hash);
CREATE INDEX IF NOT EXISTS idx_rag_docs_publication_hash ON rag_documents (publication_hash);
CREATE INDEX IF NOT EXISTS idx_rag_docs_source_type ON rag_documents (source_type);

-- ── Table: rag_document_versions (immutable version history) ──

CREATE TABLE IF NOT EXISTS rag_document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES rag_documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,

  -- Hashes
  raw_hash TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  publication_hash TEXT,

  -- Content
  extracted_text TEXT,
  published_content TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  frontmatter JSONB DEFAULT '{}',

  -- Quality
  quality_score NUMERIC(3,2),
  validation_report JSONB,

  -- Pipeline traceability
  pipeline_version TEXT DEFAULT '2.0',
  extractor_version TEXT,
  classifier_version TEXT,

  -- Provenance
  source_url TEXT,
  truth_level TEXT CHECK (truth_level IN ('L1', 'L2', 'L3', 'L4')),
  job_id TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_rag_doc_version UNIQUE (document_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_rag_versions_doc ON rag_document_versions (document_id);
CREATE INDEX IF NOT EXISTS idx_rag_versions_content_hash ON rag_document_versions (content_hash);

-- ── Table: rag_job_history (job execution audit trail) ──

CREATE TABLE IF NOT EXISTS rag_job_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT NOT NULL,

  -- Status
  job_status TEXT NOT NULL DEFAULT 'queued'
    CHECK (job_status IN (
      'queued', 'processing', 'extracting', 'classifying',
      'deduplicating', 'validating', 'persisting',
      'completed', 'noop_completed', 'failed', 'cancelled'
    )),

  -- Source
  source_type TEXT NOT NULL CHECK (source_type IN ('pdf', 'web_url', 'markdown')),
  source TEXT NOT NULL,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('critical', 'high', 'normal', 'low', 'background')),

  -- Results
  document_id UUID REFERENCES rag_documents(id),
  idempotence_action TEXT,
  error_code TEXT,
  error_family TEXT,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  -- Fingerprints
  normalized_source_key TEXT,
  canonical_source_key TEXT,
  raw_hash TEXT,
  content_hash TEXT,

  -- State transitions
  transitions JSONB DEFAULT '[]',

  -- Post-publish
  post_publish_status TEXT DEFAULT 'not_requested'
    CHECK (post_publish_status IN (
      'not_requested', 'queued', 'running', 'skipped', 'completed', 'failed'
    )),

  -- Timing
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_rag_job_id UNIQUE (job_id)
);

CREATE INDEX IF NOT EXISTS idx_rag_jobs_status ON rag_job_history (job_status);
CREATE INDEX IF NOT EXISTS idx_rag_jobs_source ON rag_job_history (source_type);
CREATE INDEX IF NOT EXISTS idx_rag_jobs_canonical ON rag_job_history (canonical_source_key);
CREATE INDEX IF NOT EXISTS idx_rag_jobs_created ON rag_job_history (created_at DESC);

-- ── Enrich __rag_knowledge with Phase 1 columns ──

ALTER TABLE __rag_knowledge
  ADD COLUMN IF NOT EXISTS phase1_status TEXT DEFAULT 'failed'
    CHECK (phase1_status IN ('passed', 'failed', 'quarantined')),
  ADD COLUMN IF NOT EXISTS lifecycle_status TEXT DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS raw_hash TEXT,
  ADD COLUMN IF NOT EXISTS content_hash TEXT,
  ADD COLUMN IF NOT EXISTS publication_hash TEXT,
  ADD COLUMN IF NOT EXISTS normalized_source_key TEXT,
  ADD COLUMN IF NOT EXISTS canonical_source_key TEXT,
  ADD COLUMN IF NOT EXISTS gamme_aliases TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS job_origin TEXT,
  ADD COLUMN IF NOT EXISTS pipeline_version TEXT DEFAULT '1.0',
  ADD COLUMN IF NOT EXISTS quality_score NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS validation_report JSONB;

-- Index new columns
CREATE INDEX IF NOT EXISTS idx_rk_lifecycle ON __rag_knowledge (lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_rk_content_hash ON __rag_knowledge (content_hash);
CREATE INDEX IF NOT EXISTS idx_rk_canonical_key ON __rag_knowledge (canonical_source_key);

-- ── RLS ──

ALTER TABLE rag_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_job_history ENABLE ROW LEVEL SECURITY;

-- Service role: full access
CREATE POLICY IF NOT EXISTS rag_docs_service_all ON rag_documents
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS rag_versions_service_all ON rag_document_versions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS rag_jobs_service_all ON rag_job_history
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated: read-only
CREATE POLICY IF NOT EXISTS rag_docs_auth_read ON rag_documents
  FOR SELECT TO authenticated USING (true);

CREATE POLICY IF NOT EXISTS rag_versions_auth_read ON rag_document_versions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY IF NOT EXISTS rag_jobs_auth_read ON rag_job_history
  FOR SELECT TO authenticated USING (true);

-- ── Comment ──

COMMENT ON TABLE rag_documents IS 'RAG Pipeline v2 — Document registry (DB = source of truth for published corpus)';
COMMENT ON TABLE rag_document_versions IS 'RAG Pipeline v2 — Immutable version history per document';
COMMENT ON TABLE rag_job_history IS 'RAG Pipeline v2 — Job execution audit trail with state transitions';

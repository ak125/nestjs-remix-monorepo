-- ============================================================
-- Phase 1.5 — Normalization canonique et résolution d'identité
-- Adds canonical identity, classification, routing and collision
-- tracking columns to __rag_knowledge and rag_documents.
-- ============================================================

-- ── __rag_knowledge ────────────────────────────────────────────

ALTER TABLE __rag_knowledge
  ADD COLUMN IF NOT EXISTS phase15_status TEXT
    CHECK (phase15_status IN (
      'normalized', 'normalized_with_warnings',
      'blocked', 'quarantined', 'review_required'
    ));

ALTER TABLE __rag_knowledge
  ADD COLUMN IF NOT EXISTS canonical_doc_id UUID;

ALTER TABLE __rag_knowledge
  ADD COLUMN IF NOT EXISTS doc_family TEXT;

ALTER TABLE __rag_knowledge
  ADD COLUMN IF NOT EXISTS target_surface TEXT;

ALTER TABLE __rag_knowledge
  ADD COLUMN IF NOT EXISTS normalization_record JSONB;

ALTER TABLE __rag_knowledge
  ADD COLUMN IF NOT EXISTS collision_pack JSONB;

ALTER TABLE __rag_knowledge
  ADD COLUMN IF NOT EXISTS canonical_status TEXT
    CHECK (canonical_status IN (
      'canonical', 'provisional', 'ambiguous', 'blocked'
    ));

-- ── rag_documents ──────────────────────────────────────────────

ALTER TABLE rag_documents
  ADD COLUMN IF NOT EXISTS phase15_status TEXT
    CHECK (phase15_status IN (
      'normalized', 'normalized_with_warnings',
      'blocked', 'quarantined', 'review_required'
    ));

ALTER TABLE rag_documents
  ADD COLUMN IF NOT EXISTS canonical_doc_id UUID;

ALTER TABLE rag_documents
  ADD COLUMN IF NOT EXISTS doc_family TEXT;

ALTER TABLE rag_documents
  ADD COLUMN IF NOT EXISTS target_surface TEXT;

ALTER TABLE rag_documents
  ADD COLUMN IF NOT EXISTS normalization_record JSONB;

ALTER TABLE rag_documents
  ADD COLUMN IF NOT EXISTS collision_pack JSONB;

ALTER TABLE rag_documents
  ADD COLUMN IF NOT EXISTS canonical_status TEXT
    CHECK (canonical_status IN (
      'canonical', 'provisional', 'ambiguous', 'blocked'
    ));

-- ── Indexes ────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_rk_phase15_status
  ON __rag_knowledge (phase15_status);

CREATE INDEX IF NOT EXISTS idx_rk_doc_family
  ON __rag_knowledge (doc_family);

CREATE INDEX IF NOT EXISTS idx_rk_canonical_doc_id
  ON __rag_knowledge (canonical_doc_id);

CREATE INDEX IF NOT EXISTS idx_rd_phase15_status
  ON rag_documents (phase15_status);

-- ── Backfill: legacy docs (no pipeline_version) → normalized ──

UPDATE __rag_knowledge
  SET phase15_status = 'normalized',
      canonical_status = 'canonical'
  WHERE pipeline_version IS NULL
    AND phase15_status IS NULL;

UPDATE rag_documents
  SET phase15_status = 'normalized',
      canonical_status = 'canonical'
  WHERE pipeline_version IS NULL
    AND phase15_status IS NULL;

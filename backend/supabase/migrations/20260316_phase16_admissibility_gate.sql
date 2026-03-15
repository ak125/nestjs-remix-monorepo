-- Phase 1.6 — Business Admissibility Gate
-- Adds per-document admissibility status, readiness record, and publication flag.
-- Legacy docs (pipeline_version IS NULL) are backfilled as admissible.

-- ── __rag_knowledge columns ─────────────────────────────

ALTER TABLE __rag_knowledge
  ADD COLUMN IF NOT EXISTS phase16_status TEXT
    CHECK (phase16_status IN ('admissible', 'admissible_with_limits', 'enrichment_required', 'blocked'));

ALTER TABLE __rag_knowledge
  ADD COLUMN IF NOT EXISTS readiness_record JSONB;

ALTER TABLE __rag_knowledge
  ADD COLUMN IF NOT EXISTS publication_target_ready BOOLEAN DEFAULT false;

-- ── rag_documents columns ───────────────────────────────

ALTER TABLE rag_documents
  ADD COLUMN IF NOT EXISTS phase16_status TEXT
    CHECK (phase16_status IN ('admissible', 'admissible_with_limits', 'enrichment_required', 'blocked'));

ALTER TABLE rag_documents
  ADD COLUMN IF NOT EXISTS readiness_record JSONB;

ALTER TABLE rag_documents
  ADD COLUMN IF NOT EXISTS publication_target_ready BOOLEAN DEFAULT false;

-- ── Indexes ─────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_rk_phase16_status
  ON __rag_knowledge (phase16_status);

CREATE INDEX IF NOT EXISTS idx_rk_pub_target_ready
  ON __rag_knowledge (publication_target_ready)
  WHERE publication_target_ready = true;

CREATE INDEX IF NOT EXISTS idx_rd_phase16_status
  ON rag_documents (phase16_status);

CREATE INDEX IF NOT EXISTS idx_rd_pub_target_ready
  ON rag_documents (publication_target_ready)
  WHERE publication_target_ready = true;

-- ── Backfill legacy docs as admissible ──────────────────

UPDATE __rag_knowledge
  SET phase16_status = 'admissible',
      publication_target_ready = true
  WHERE pipeline_version IS NULL
    AND phase16_status IS NULL;

UPDATE rag_documents
  SET phase16_status = 'admissible',
      publication_target_ready = true
  WHERE pipeline_version IS NULL
    AND phase16_status IS NULL;

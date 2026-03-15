-- Migration: F1-GATE — Foundation Write Lock
-- Adds foundation_gate_passed derived boolean to rag_documents + __rag_knowledge
-- Date: 2026-03-14

-- ── Add foundation_gate_passed to __rag_knowledge ──

ALTER TABLE __rag_knowledge
  ADD COLUMN IF NOT EXISTS foundation_gate_passed BOOLEAN DEFAULT false;

-- ── Add foundation_gate_passed to rag_documents ──

ALTER TABLE rag_documents
  ADD COLUMN IF NOT EXISTS foundation_gate_passed BOOLEAN DEFAULT false;

-- ── Backfill: legacy docs (no pipeline_version) are trusted by default ──

UPDATE __rag_knowledge
  SET foundation_gate_passed = true
  WHERE pipeline_version IS NULL;

UPDATE rag_documents
  SET foundation_gate_passed = true
  WHERE pipeline_version IS NULL;

-- ── Backfill: pipeline v2 docs derive from phase1_status ──

UPDATE __rag_knowledge
  SET foundation_gate_passed = (phase1_status = 'passed')
  WHERE pipeline_version IS NOT NULL AND phase1_status IS NOT NULL;

UPDATE rag_documents
  SET foundation_gate_passed = (phase1_status = 'passed')
  WHERE pipeline_version IS NOT NULL AND phase1_status IS NOT NULL;

-- ── Index for fast guard lookups (partial: only non-passed) ──

CREATE INDEX IF NOT EXISTS idx_rk_foundation_gate
  ON __rag_knowledge (foundation_gate_passed)
  WHERE foundation_gate_passed = false;

CREATE INDEX IF NOT EXISTS idx_rag_docs_foundation_gate
  ON rag_documents (foundation_gate_passed)
  WHERE foundation_gate_passed = false;

-- ── Comment ──

COMMENT ON COLUMN __rag_knowledge.foundation_gate_passed IS 'F1-GATE: derived boolean — true when Phase 1 validation passed. Downstream phases check this before writing.';
COMMENT ON COLUMN rag_documents.foundation_gate_passed IS 'F1-GATE: derived boolean — true when Phase 1 validation passed. Downstream phases check this before writing.';

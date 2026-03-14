-- Phase 2 Orchestration + Evidence Grading
-- Vague A (P2.1) + Vague B (P2.4/P2.2) infrastructure columns
--
-- Adds JSONB columns to __rag_content_refresh_log for:
-- - execution_plan: resolved ExecutionPlan from registry
-- - section_eligibility: per-section eligibility map
-- - evidence_grade_map: source_id → grade mapping
-- - rag_sufficiency: per-section evidence sufficiency report
--
-- Non-destructive: all columns are nullable JSONB.

ALTER TABLE public.__rag_content_refresh_log
  ADD COLUMN IF NOT EXISTS execution_plan JSONB,
  ADD COLUMN IF NOT EXISTS section_eligibility JSONB,
  ADD COLUMN IF NOT EXISTS evidence_grade_map JSONB,
  ADD COLUMN IF NOT EXISTS rag_sufficiency JSONB;

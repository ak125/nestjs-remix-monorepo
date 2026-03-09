-- ============================================================
-- Migration: Agentic Engine Tables (Phase 1)
-- Date: 2026-03-12
-- Tables: 6 tables for agentic run lifecycle
-- ============================================================

-- ── 1. __agentic_runs ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS __agentic_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal TEXT NOT NULL CHECK (char_length(goal) >= 1),
  goal_type TEXT NOT NULL CHECK (char_length(goal_type) >= 1),
  phase TEXT NOT NULL DEFAULT 'created'
    CHECK (phase IN ('created','planning','solving','critiquing','verifying','arbitrating','applying','completed','failed','suspended')),
  plan JSONB,
  winning_branch_id UUID,
  critic_loops INT NOT NULL DEFAULT 0 CHECK (critic_loops >= 0),
  branches_total INT NOT NULL DEFAULT 0 CHECK (branches_total >= 0),
  branches_completed INT NOT NULL DEFAULT 0 CHECK (branches_completed >= 0),
  feature_flags JSONB NOT NULL DEFAULT '{}',
  correlation_id TEXT,
  triggered_by TEXT NOT NULL CHECK (char_length(triggered_by) >= 1),
  error_message TEXT,
  total_tokens_used INT NOT NULL DEFAULT 0 CHECK (total_tokens_used >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_ms INT
);

CREATE INDEX IF NOT EXISTS idx_agentic_runs_phase ON __agentic_runs (phase);
CREATE INDEX IF NOT EXISTS idx_agentic_runs_goal_type ON __agentic_runs (goal_type);
CREATE INDEX IF NOT EXISTS idx_agentic_runs_created_at ON __agentic_runs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agentic_runs_correlation ON __agentic_runs (correlation_id) WHERE correlation_id IS NOT NULL;

-- ── 2. __agentic_branches ──────────────────────────────────

CREATE TABLE IF NOT EXISTS __agentic_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES __agentic_runs(id) ON DELETE CASCADE,
  strategy_label TEXT NOT NULL CHECK (char_length(strategy_label) >= 1),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','running','completed','failed','pruned','rejected')),
  output JSONB,
  critic_score NUMERIC(5,2) CHECK (critic_score IS NULL OR (critic_score >= 0 AND critic_score <= 100)),
  critic_feedback TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agentic_branches_run_id ON __agentic_branches (run_id);
CREATE INDEX IF NOT EXISTS idx_agentic_branches_status ON __agentic_branches (status);

-- ── 3. __agentic_steps ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS __agentic_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES __agentic_branches(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES __agentic_runs(id) ON DELETE CASCADE,
  step_name TEXT NOT NULL CHECK (char_length(step_name) >= 1),
  step_type TEXT NOT NULL
    CHECK (step_type IN ('llm_call','db_query','db_write','gate_check','rag_fetch','validation','computation')),
  step_index INT NOT NULL CHECK (step_index >= 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','running','completed','failed','skipped')),
  input_hash TEXT,
  output JSONB,
  provider_used TEXT,
  tokens_used INT,
  duration_ms INT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agentic_steps_branch_id ON __agentic_steps (branch_id);
CREATE INDEX IF NOT EXISTS idx_agentic_steps_run_id ON __agentic_steps (run_id);

-- ── 4. __agentic_evidence ──────────────────────────────────
-- Append-only immutable ledger — never UPDATE or DELETE

CREATE TABLE IF NOT EXISTS __agentic_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES __agentic_runs(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES __agentic_branches(id) ON DELETE SET NULL,
  step_id UUID REFERENCES __agentic_steps(id) ON DELETE SET NULL,
  evidence_type TEXT NOT NULL
    CHECK (evidence_type IN ('llm_output','db_result','gate_check','rag_citation','human_input','computation')),
  content JSONB NOT NULL,
  provenance JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agentic_evidence_run_id ON __agentic_evidence (run_id);
CREATE INDEX IF NOT EXISTS idx_agentic_evidence_type ON __agentic_evidence (evidence_type);

-- ── 5. __agentic_checkpoints ────────────────────────────────

CREATE TABLE IF NOT EXISTS __agentic_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES __agentic_runs(id) ON DELETE CASCADE,
  phase TEXT NOT NULL
    CHECK (phase IN ('created','planning','solving','critiquing','verifying','arbitrating','applying','completed','failed','suspended')),
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agentic_checkpoints_run_id ON __agentic_checkpoints (run_id);

-- ── 6. __agentic_gate_results ───────────────────────────────

CREATE TABLE IF NOT EXISTS __agentic_gate_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES __agentic_runs(id) ON DELETE CASCADE,
  gate_name TEXT NOT NULL CHECK (char_length(gate_name) >= 1),
  gate_type TEXT NOT NULL CHECK (gate_type IN ('hard','soft')),
  verdict TEXT NOT NULL CHECK (verdict IN ('PASS','WARN','FAIL')),
  reason TEXT NOT NULL CHECK (char_length(reason) >= 1),
  evidence_id UUID REFERENCES __agentic_evidence(id) ON DELETE SET NULL,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agentic_gate_results_run_id ON __agentic_gate_results (run_id);
CREATE INDEX IF NOT EXISTS idx_agentic_gate_results_verdict ON __agentic_gate_results (verdict);

-- ── RLS (service_role only for now) ─────────────────────────

ALTER TABLE __agentic_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE __agentic_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE __agentic_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE __agentic_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE __agentic_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE __agentic_gate_results ENABLE ROW LEVEL SECURITY;

-- Allow service_role full access (default behavior with RLS enabled)
-- No public policies — tables are only accessible via service_role key

-- ── FK constraint: winning_branch_id ────────────────────────

ALTER TABLE __agentic_runs
  ADD CONSTRAINT fk_agentic_runs_winning_branch
  FOREIGN KEY (winning_branch_id) REFERENCES __agentic_branches(id) ON DELETE SET NULL;

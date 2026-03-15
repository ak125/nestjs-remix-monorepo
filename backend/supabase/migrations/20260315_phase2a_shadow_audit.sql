-- Phase 2A — Shadow Audit Results Table
-- Non-destructive audit results: legacy→canonical projection + G1-G5 governance verdicts.
-- Each row = one audit run. Full report stored as JSONB.

CREATE TABLE IF NOT EXISTS __phase2a_audit_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL DEFAULT '1.0.0',
  status TEXT NOT NULL CHECK (status IN ('running', 'complete', 'partial', 'failed')),
  total_artifacts INT NOT NULL DEFAULT 0,
  total_legacy_detected INT NOT NULL DEFAULT 0,
  total_collisions INT NOT NULL DEFAULT 0,
  total_blockers INT NOT NULL DEFAULT 0,
  summary JSONB NOT NULL DEFAULT '{}',
  report JSONB NOT NULL DEFAULT '{}',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  triggered_by TEXT NOT NULL DEFAULT 'admin'
);

-- RLS: service role only (backend-triggered audits)
ALTER TABLE __phase2a_audit_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access"
  ON __phase2a_audit_reports
  FOR ALL
  USING (auth.role() = 'service_role');

-- Index for querying recent audits
CREATE INDEX IF NOT EXISTS idx_phase2a_audit_started_at
  ON __phase2a_audit_reports (started_at DESC);

-- QA Audit H24 Tables
-- Created: 2026-03-10
-- Purpose: Store automated QA audit results from Playwright monitoring

-- 1. Runs table — one row per audit execution
CREATE TABLE IF NOT EXISTS __qa_audit_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  suite TEXT NOT NULL CHECK (suite IN ('functional', 'visual', 'seo-tech')),
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'pass', 'fail', 'error')),
  started_at TIMESTAMPTZ DEFAULT now(),
  finished_at TIMESTAMPTZ,
  total_tests INT DEFAULT 0,
  passed INT DEFAULT 0,
  failed INT DEFAULT 0,
  skipped INT DEFAULT 0,
  viewport TEXT,
  environment TEXT DEFAULT 'production',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Issues table — individual issues found per run
CREATE TABLE IF NOT EXISTS __qa_audit_issues (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES __qa_audit_runs(id) ON DELETE CASCADE,
  page_url TEXT NOT NULL,
  check_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'major', 'minor')),
  message TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  viewport TEXT,
  screenshot_path TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Alerts table — notifications sent per run
CREATE TABLE IF NOT EXISTS __qa_audit_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES __qa_audit_runs(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'webhook',
  payload JSONB NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_qa_runs_suite_started ON __qa_audit_runs(suite, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_qa_issues_run_id ON __qa_audit_issues(run_id);
CREATE INDEX IF NOT EXISTS idx_qa_issues_severity ON __qa_audit_issues(severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qa_alerts_run_id ON __qa_audit_alerts(run_id);

-- RLS: service_role only (no policies = block all anon/authenticated)
ALTER TABLE __qa_audit_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE __qa_audit_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE __qa_audit_alerts ENABLE ROW LEVEL SECURITY;

-- Migration: create __seo_ai_runs table for content generation observability
-- Applied via MCP on 2026-04-13 (this file is the reference copy for git)

CREATE TABLE IF NOT EXISTS __seo_ai_runs (
  id BIGSERIAL PRIMARY KEY,
  sar_pg_id INTEGER NOT NULL,
  sar_pg_alias TEXT,
  sar_role TEXT NOT NULL,
  sar_status TEXT NOT NULL CHECK (sar_status IN ('ok', 'failed', 'skipped')),
  sar_tokens_input INTEGER,
  sar_tokens_output INTEGER,
  sar_tokens_cached INTEGER DEFAULT 0,
  sar_cost_usd NUMERIC(10, 6),
  sar_duration_ms INTEGER,
  sar_content_length INTEGER,
  sar_h2_count INTEGER,
  sar_kw_score INTEGER,
  sar_lint_errors TEXT[],
  sar_error TEXT,
  sar_trigger TEXT CHECK (sar_trigger IN ('http', 'cron_inbox', 'bullmq', 'paperclip', 'manual', 'test')),
  sar_llm_model TEXT,
  sar_created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sar_pg_role ON __seo_ai_runs (sar_pg_id, sar_role);
CREATE INDEX IF NOT EXISTS idx_sar_created_at ON __seo_ai_runs (sar_created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sar_status ON __seo_ai_runs (sar_status);

COMMENT ON TABLE __seo_ai_runs IS 'Audit log for AI-powered content generation runs (R1/R3/R4/R6). Each row is one generate() call with metrics, cost, and lint results.';
COMMENT ON COLUMN __seo_ai_runs.sar_trigger IS 'Source that triggered the run: http=manual API call, cron_inbox=auto from inbox watcher, bullmq=queue processor, paperclip=AI-COS agent, manual=dev sync mode, test=unit tests';
COMMENT ON COLUMN __seo_ai_runs.sar_tokens_cached IS 'Number of tokens served from Anthropic prompt cache (system prompt). Lowers cost.';

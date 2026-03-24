-- RAG Pipeline Hardening: indexes + incidents table
-- Part of Lot 1+2 of the RAG pipeline hardening plan

-- ── Additional indexes for monitoring queries ──

CREATE INDEX IF NOT EXISTS idx_rce_rag_source
  ON __rag_change_events(rce_rag_source);

CREATE INDEX IF NOT EXISTS idx_rce_gamme_aliases
  ON __rag_change_events USING GIN(rce_gamme_aliases);

CREATE INDEX IF NOT EXISTS idx_pcq_pg_alias
  ON __pipeline_chain_queue(pcq_pg_alias);

CREATE INDEX IF NOT EXISTS idx_pcq_status_created
  ON __pipeline_chain_queue(pcq_status, pcq_created_at);

-- ── Circuit breaker incidents table ──

CREATE TABLE IF NOT EXISTS __rag_pipeline_incidents (
  rpi_id bigserial PRIMARY KEY,
  rpi_created_at timestamptz NOT NULL DEFAULT now(),
  rpi_type text NOT NULL,
  rpi_reason text NOT NULL,
  rpi_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  rpi_phase text NOT NULL DEFAULT 'C'
);

COMMENT ON TABLE __rag_pipeline_incidents IS 'Circuit breaker incident log for RAG merge pipeline';

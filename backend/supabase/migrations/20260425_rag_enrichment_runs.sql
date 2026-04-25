-- =============================================================================
-- ADR-029 P1 — RAG v2.1 Control Plane: enrichment_runs observability table
-- =============================================================================
--
-- Stocke un enrichment-report.json par exécution du pipeline d'enrichissement
-- des gammes RAG. Aligné sur:
--   .spec/00-canon/enrichment-report.schema.json
--   .spec/00-canon/conflict.schema.yaml
--
-- Producteur:
--   RagEnrichmentReportEmitterService (P1)
--
-- Consommateurs:
--   - skill `seo-gamme-audit` (lecture historique enrichissement par gamme)
--   - skill `pollution-scanner` (détection régressions silencieuses)
--   - dashboard SEO findings
--
-- RLS aligné ADR-021 (zero trust): lecture admin only, écriture service_role only.

CREATE TABLE IF NOT EXISTS __rag_enrichment_runs (
  run_id UUID PRIMARY KEY,
  alias TEXT NOT NULL,
  run_date DATE NOT NULL,

  execution_mode TEXT NOT NULL CHECK (execution_mode IN (
    'audit_only',
    'enrich_dry_run',
    'enrich_write',
    'qa_only',
    'qa_write',
    'index_ready_check'
  )),

  state_before TEXT NOT NULL CHECK (state_before IN (
    'v5_ssot', 'v5_audited', 'v5_enriched', 'v5_qa_passed',
    'v5_indexed', 'v5_blocked', 'v5_pending_review'
  )),
  state_after TEXT NOT NULL CHECK (state_after IN (
    'v5_ssot', 'v5_audited', 'v5_enriched', 'v5_qa_passed',
    'v5_indexed', 'v5_blocked', 'v5_pending_review'
  )),

  truth_level_before TEXT NOT NULL CHECK (truth_level_before IN ('L1', 'L2')),
  truth_level_after  TEXT NOT NULL CHECK (truth_level_after  IN ('L1', 'L2')),

  decision TEXT NOT NULL CHECK (decision IN (
    'PROMOTE_L1', 'KEEP_L2', 'BLOCKED', 'PENDING_REVIEW'
  )),
  reason TEXT NOT NULL,

  -- Payload validé contre enrichment-report.schema.json (jsonb pour requêtes)
  report_json JSONB NOT NULL,

  -- Conflits détectés ce run (vue agrégée; détail dans le frontmatter .md)
  conflicts_count INTEGER NOT NULL DEFAULT 0,
  conflicts_safety INTEGER NOT NULL DEFAULT 0,
  conflicts_technical INTEGER NOT NULL DEFAULT 0,
  conflicts_minor INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rag_runs_alias_date
  ON __rag_enrichment_runs(alias, run_date DESC);

CREATE INDEX IF NOT EXISTS idx_rag_runs_decision
  ON __rag_enrichment_runs(decision)
  WHERE decision IN ('BLOCKED', 'PENDING_REVIEW');

CREATE INDEX IF NOT EXISTS idx_rag_runs_created_at
  ON __rag_enrichment_runs(created_at DESC);

-- ── RLS (ADR-021 zero trust) ─────────────────────────────────────────────────

ALTER TABLE __rag_enrichment_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rag_runs_service_role_all ON __rag_enrichment_runs;
CREATE POLICY rag_runs_service_role_all
  ON __rag_enrichment_runs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Lecture admin via la connexion authentifiée NestJS (anon key + admin guard
-- côté application). Aucune policy 'authenticated' ouverte: l'accès passe par
-- le service_role en backend après vérification IsAdminGuard.

COMMENT ON TABLE __rag_enrichment_runs IS
  'ADR-029 P1: enrichment-report.json persisté par run du pipeline RAG v2.1';
COMMENT ON COLUMN __rag_enrichment_runs.report_json IS
  'Validé contre .spec/00-canon/enrichment-report.schema.json';
COMMENT ON COLUMN __rag_enrichment_runs.conflicts_count IS
  'Total des _conflicts[] détectés ce run (cf. conflict.schema.yaml)';

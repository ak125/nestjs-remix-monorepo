-- Rollback: 20260930_drop_archive_agentic_duplicate_indexes
-- Recrée les 6 index retirés, définitions relevées par `pg_get_indexdef` le 2026-09-30
-- avant le retrait. L'engine est forward-only : ce fichier se lance à la main, hors
-- transaction (CONCURRENTLY). Timeouts à 0 : un GUC omis hérite des 60 s du rôle
-- `postgres`.
-- Un build interrompu laisse un index INVALIDE que `IF NOT EXISTS` sauterait en
-- silence : dans ce cas, `DROP INDEX CONCURRENTLY IF EXISTS` puis relancer.
SET lock_timeout = 0;
SET statement_timeout = 0;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agentic_branches_run
  ON _archive.__agentic_branches USING btree (run_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agentic_checkpoints_run
  ON _archive.__agentic_checkpoints USING btree (run_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agentic_evidence_run
  ON _archive.__agentic_evidence USING btree (run_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agentic_gate_results_run
  ON _archive.__agentic_gate_results USING btree (run_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agentic_steps_branch
  ON _archive.__agentic_steps USING btree (branch_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agentic_steps_run
  ON _archive.__agentic_steps USING btree (run_id);

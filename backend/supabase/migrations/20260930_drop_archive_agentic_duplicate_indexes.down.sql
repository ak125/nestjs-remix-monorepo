-- Rollback: 20260930_drop_archive_agentic_duplicate_indexes
-- Recrée les 6 index retirés, définitions relevées par `pg_get_indexdef` le 2026-09-30
-- avant le retrait. L'engine est forward-only : ce fichier se lance à la main, hors
-- transaction (CONCURRENTLY). Timeouts à 0 : un GUC omis hérite des 60 s du rôle
-- `postgres`.
-- Un build interrompu laisse un index INVALIDE que `IF NOT EXISTS` sauterait en
-- silence : dans ce cas, `DROP INDEX CONCURRENTLY IF EXISTS` puis relancer.
--
-- Blocs R2 (sql-governance-rules.md) : chaque index recréé ici DOUBLE un jumeau
-- conservé de définition identique. Aucun gain de plan n'est attendu ; la seule raison
-- de lancer ce fichier est de revenir à l'état d'avant la migration. Volumes relevés
-- le 2026-09-30 (count(*) exact, taille = pg_table_size).
SET lock_timeout = 0;
SET statement_timeout = 0;

-- INDEX: idx_agentic_branches_run
-- Table: _archive.__agentic_branches (59 rows, 112 kB)
-- Pattern: WHERE/JOIN sur run_id, déjà servi par le jumeau idx_agentic_branches_run_id
-- Gain attendu: aucun (retour arrière, doublon du jumeau)
-- RPC concernees: aucune (schéma archivé, 0 écriture depuis le 2026-09-17)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agentic_branches_run
  ON _archive.__agentic_branches USING btree (run_id);

-- INDEX: idx_agentic_checkpoints_run
-- Table: _archive.__agentic_checkpoints (8 rows, 48 kB)
-- Pattern: WHERE/JOIN sur run_id, déjà servi par le jumeau idx_agentic_checkpoints_run_id
-- Gain attendu: aucun (retour arrière, doublon du jumeau)
-- RPC concernees: aucune (schéma archivé, 0 écriture depuis le 2026-09-17)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agentic_checkpoints_run
  ON _archive.__agentic_checkpoints USING btree (run_id);

-- INDEX: idx_agentic_evidence_run
-- Table: _archive.__agentic_evidence (158 rows, 128 kB)
-- Pattern: WHERE/JOIN sur run_id, déjà servi par le jumeau idx_agentic_evidence_run_id
-- Gain attendu: aucun (retour arrière, doublon du jumeau)
-- RPC concernees: aucune (schéma archivé, 0 écriture depuis le 2026-09-17)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agentic_evidence_run
  ON _archive.__agentic_evidence USING btree (run_id);

-- INDEX: idx_agentic_gate_results_run
-- Table: _archive.__agentic_gate_results (14 rows, 16 kB)
-- Pattern: WHERE/JOIN sur run_id, déjà servi par le jumeau idx_agentic_gate_results_run_id
-- Gain attendu: aucun (retour arrière, doublon du jumeau)
-- RPC concernees: aucune (schéma archivé, 0 écriture depuis le 2026-09-17)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agentic_gate_results_run
  ON _archive.__agentic_gate_results USING btree (run_id);

-- INDEX: idx_agentic_steps_branch
-- Table: _archive.__agentic_steps (107 rows, 160 kB)
-- Pattern: WHERE/JOIN sur branch_id, déjà servi par le jumeau idx_agentic_steps_branch_id
-- Gain attendu: aucun (retour arrière, doublon du jumeau)
-- RPC concernees: aucune (schéma archivé, 0 écriture depuis le 2026-09-17)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agentic_steps_branch
  ON _archive.__agentic_steps USING btree (branch_id);

-- INDEX: idx_agentic_steps_run
-- Table: _archive.__agentic_steps (107 rows, 160 kB)
-- Pattern: WHERE/JOIN sur run_id, déjà servi par le jumeau idx_agentic_steps_run_id
-- Gain attendu: aucun (retour arrière, doublon du jumeau)
-- RPC concernees: aucune (schéma archivé, 0 écriture depuis le 2026-09-17)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agentic_steps_run
  ON _archive.__agentic_steps USING btree (run_id);

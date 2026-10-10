-- Rollback: 20261010_diag_link_provenance
-- Retire les deux fonctions puis les 3 tables, dans l'ordre inverse des clés
-- étrangères (provenance et conflits référencent les runs). DESTRUCTIF :
-- l'historique des runs et des provenances est perdu, d'où le GO owner avant de le
-- lancer. L'engine est forward-only : ce fichier se lance à la main.
-- Couper d'abord DIAGNOSTIC_PROJECTION_ENABLED : un run en cours tiendrait les
-- verrous que les DROP attendent (lock_timeout borné, jamais hérité du rôle).
-- Auto-transactionnel : BEGIN / COMMIT portés par le fichier, SET LOCAL bornés à lui.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DROP FUNCTION IF EXISTS public.__diag_projection_record_failure(jsonb);
DROP FUNCTION IF EXISTS public.__diag_projection_apply(jsonb);
DROP TABLE IF EXISTS public.__diag_link_provenance;
DROP TABLE IF EXISTS public.__diag_projection_conflicts;
DROP TABLE IF EXISTS public.__diag_projection_runs;
COMMIT;

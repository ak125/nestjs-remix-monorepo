-- Rollback: 20261012_diag_projection_requires_review
-- Retire CHECK (reviewed) de la provenance et rend au CHECK des raisons de
-- conflit son ensemble de 20261010 (10 raisons, sans `not_reviewed`), validé.
-- L'engine est forward-only : ce fichier se lance à la main, sur GO owner.
-- Couper d'abord DIAGNOSTIC_PROJECTION_ENABLED et revenir au code d'avant
-- ADR-115 : le resolver actuel écrit des conflits `not_reviewed`, que le CHECK
-- rétabli refuse (run en échec), et un run en cours tiendrait les verrous que
-- les ALTER attendent (lock_timeout borné, jamais hérité du rôle).
-- Une ligne `not_reviewed` déjà écrite fait échouer ce rollback (le CHECK est
-- revalidé sur toutes les lignes) : l'historique des runs n'est jamais supprimé
-- en silence ; décider de son sort avant de relancer.
-- Auto-transactionnel : BEGIN / COMMIT portés par le fichier, SET LOCAL bornés à lui.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE public.__diag_link_provenance
  DROP CONSTRAINT IF EXISTS __diag_link_provenance_reviewed;
ALTER TABLE public.__diag_projection_conflicts
  DROP CONSTRAINT IF EXISTS __diag_projection_conflicts_reason_check;
ALTER TABLE public.__diag_projection_conflicts
  ADD CONSTRAINT __diag_projection_conflicts_reason_check CHECK (reason IN (
    'schema_invalid', 'not_a_cause_relation', 'unknown_symptom',
    'system_mismatch', 'no_matching_link', 'ambiguous_cause',
    'duplicate_relation', 'source_not_raw_proven',
    'cause_slug_mismatch', 'vehicle_scope_unsupported'));
COMMIT;

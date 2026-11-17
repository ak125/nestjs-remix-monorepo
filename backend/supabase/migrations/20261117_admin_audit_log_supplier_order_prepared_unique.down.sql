-- Rollback: 20261117_admin_audit_log_supplier_order_prepared_unique
-- Retire l'index unique partiel. Aucune donnée touchée. Après retrait, le
-- doublon entre deux processus redevient possible (le service garde son verrou
-- en mémoire et sa lecture préalable).
-- L'engine est forward-only : ce fichier se lance à la main.
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_temp;

DROP INDEX IF EXISTS public.uq_aal_supplier_order_prepared_line;

COMMIT;

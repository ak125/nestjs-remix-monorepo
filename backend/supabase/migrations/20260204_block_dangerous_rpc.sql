-- =====================================================
-- KILL-SWITCH DEV: Phase 2 - Bloquer RPC dangereux
-- Date: 2026-02-04
-- Révoque EXECUTE sur fonctions P0/P1 pour dev_readonly
-- =====================================================

BEGIN;

-- =====================================================
-- P0 CRITICAL (7 fonctions) - TOUJOURS BLOQUÉES
-- Impact: Suppression massive, rollback prod, SQL injection
-- =====================================================

-- delete_duplicates_batch - DELETE jusqu'à 31M lignes
DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION delete_duplicates_batch FROM dev_readonly;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- delete_first_records_batch - DELETE jusqu'à 31M lignes
DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION delete_first_records_batch FROM dev_readonly;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- rollback_switch - Rollback état production
DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION rollback_switch FROM dev_readonly;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- switch_to_next - Changement état production
DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION switch_to_next FROM dev_readonly;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- run_import_pipeline - Pipeline import non contrôlé
DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION run_import_pipeline FROM dev_readonly;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- apply_decisions_shadow - Application décisions batch
DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION apply_decisions_shadow FROM dev_readonly;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- exec_sql - CRITIQUE: Exécution SQL arbitraire
DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION exec_sql FROM dev_readonly;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- =====================================================
-- P1 HIGH (17 fonctions) - DDL et workflows sensibles
-- Impact: Création index, partitions, workflows batch
-- =====================================================

-- DDL/Index functions
DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION create_index_async FROM dev_readonly;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION create_composite_index_async FROM dev_readonly;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION create_rm_listing_products_partition FROM dev_readonly;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION ensure_rm_partition FROM dev_readonly;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- Workflow functions
DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION execute_diff_apply_workflow FROM dev_readonly;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION finalize_import_batch FROM dev_readonly;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION prepare_shadow_tables FROM dev_readonly;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- Quarantine management
DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION apply_quarantine_rules FROM dev_readonly;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION move_decisions_to_quarantine FROM dev_readonly;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION resolve_quarantine_item FROM dev_readonly;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- Brand/decision batch operations
DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION build_article_decisions FROM dev_readonly;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION build_brand_decisions FROM dev_readonly;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION normalize_batch_brands FROM dev_readonly;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION resolve_batch_brands FROM dev_readonly;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION resolve_brand_multilevel FROM dev_readonly;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION get_or_create_brand_nk FROM dev_readonly;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION validate_shadow FROM dev_readonly;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- Log
DO $$
BEGIN
  RAISE NOTICE 'Kill-switch DEV: 24 dangerous RPC functions blocked for dev_readonly';
END
$$;

COMMIT;

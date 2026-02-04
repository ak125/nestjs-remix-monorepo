-- =====================================================
-- KILL-SWITCH DEV: Script consolidé (toutes phases)
-- Date: 2026-02-04
-- À exécuter via Supabase Dashboard → SQL Editor
-- =====================================================

-- =====================================================
-- PHASE 1: Création rôle READ-ONLY
-- =====================================================

-- 1. Créer le rôle dev_readonly (s'il n'existe pas)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dev_readonly') THEN
    CREATE ROLE dev_readonly WITH
      LOGIN
      NOINHERIT
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOREPLICATION;
    RAISE NOTICE 'Role dev_readonly created successfully';
  ELSE
    RAISE NOTICE 'Role dev_readonly already exists, skipping creation';
  END IF;
END
$$;

-- 2. Révoquer tout par défaut
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM dev_readonly;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM dev_readonly;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM dev_readonly;

-- 3. Accorder USAGE sur le schema et SELECT uniquement sur tables
GRANT USAGE ON SCHEMA public TO dev_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO dev_readonly;

-- 4. Configurer les privilèges par défaut pour futures tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO dev_readonly;

-- 5. Bloquer explicitement les opérations d'écriture
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON ALL TABLES IN SCHEMA public FROM dev_readonly;

-- 6. Bloquer DDL (création d'objets)
REVOKE CREATE ON SCHEMA public FROM dev_readonly;

-- =====================================================
-- PHASE 2: Bloquer RPC dangereux
-- =====================================================

-- P0 CRITICAL (7 fonctions) - TOUJOURS BLOQUÉES
DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION delete_duplicates_batch FROM dev_readonly;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION delete_first_records_batch FROM dev_readonly;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION rollback_switch FROM dev_readonly;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION switch_to_next FROM dev_readonly;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION run_import_pipeline FROM dev_readonly;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION apply_decisions_shadow FROM dev_readonly;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION exec_sql FROM dev_readonly;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- P1 HIGH (17 fonctions) - DDL et workflows
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

-- =====================================================
-- PHASE 3: Protection tables critiques
-- =====================================================

-- Paiements
DO $$ BEGIN
  REVOKE ALL ON TABLE ic_postback FROM dev_readonly;
  GRANT SELECT ON TABLE ic_postback TO dev_readonly;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Commandes
DO $$ BEGIN
  REVOKE ALL ON TABLE "___xtr_order" FROM dev_readonly;
  GRANT SELECT ON TABLE "___xtr_order" TO dev_readonly;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE ALL ON TABLE "___xtr_order_line" FROM dev_readonly;
  GRANT SELECT ON TABLE "___xtr_order_line" TO dev_readonly;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Factures
DO $$ BEGIN
  REVOKE ALL ON TABLE "___xtr_invoice" FROM dev_readonly;
  GRANT SELECT ON TABLE "___xtr_invoice" TO dev_readonly;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE ALL ON TABLE "___xtr_invoice_line" FROM dev_readonly;
  GRANT SELECT ON TABLE "___xtr_invoice_line" TO dev_readonly;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Clients (PII/GDPR)
DO $$ BEGIN
  REVOKE ALL ON TABLE "___xtr_customer" FROM dev_readonly;
  GRANT SELECT ON TABLE "___xtr_customer" TO dev_readonly;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE ALL ON TABLE "___xtr_customer_billing_address" FROM dev_readonly;
  GRANT SELECT ON TABLE "___xtr_customer_billing_address" TO dev_readonly;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE ALL ON TABLE "___xtr_customer_delivery_address" FROM dev_readonly;
  GRANT SELECT ON TABLE "___xtr_customer_delivery_address" TO dev_readonly;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Users (auth)
DO $$ BEGIN
  REVOKE ALL ON TABLE users FROM dev_readonly;
  GRANT SELECT ON TABLE users TO dev_readonly;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Table audit des tentatives
CREATE TABLE IF NOT EXISTS _killswitch_audit (
  id BIGSERIAL PRIMARY KEY,
  attempted_at TIMESTAMPTZ DEFAULT NOW(),
  role_name TEXT,
  operation TEXT,
  table_name TEXT,
  blocked BOOLEAN DEFAULT TRUE,
  context JSONB
);

CREATE INDEX IF NOT EXISTS idx_killswitch_audit_date
  ON _killswitch_audit(attempted_at DESC);

GRANT INSERT ON TABLE _killswitch_audit TO dev_readonly;
GRANT USAGE, SELECT ON SEQUENCE _killswitch_audit_id_seq TO dev_readonly;

-- =====================================================
-- PHASE 4: Break-Glass Mechanism
-- =====================================================

CREATE TABLE IF NOT EXISTS _killswitch_breakglass (
  id SERIAL PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  granted_by TEXT NOT NULL,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  reason TEXT NOT NULL,
  tables_allowed TEXT[] NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  revoked_at TIMESTAMPTZ,
  revoked_by TEXT,
  CONSTRAINT breakglass_max_duration CHECK (
    expires_at <= granted_at + INTERVAL '24 hours'
  )
);

CREATE INDEX IF NOT EXISTS idx_breakglass_active
  ON _killswitch_breakglass(is_active, expires_at)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_breakglass_token
  ON _killswitch_breakglass(token_hash)
  WHERE is_active = TRUE;

-- Fonction: Vérifier si break-glass actif
CREATE OR REPLACE FUNCTION check_breakglass(p_token TEXT, p_table TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed BOOLEAN := FALSE;
BEGIN
  SELECT TRUE INTO v_allowed
  FROM _killswitch_breakglass
  WHERE token_hash = encode(sha256(p_token::bytea), 'hex')
    AND is_active = TRUE
    AND expires_at > NOW()
    AND (p_table = ANY(tables_allowed) OR 'ALL' = ANY(tables_allowed));

  INSERT INTO _killswitch_audit (role_name, operation, table_name, blocked, context)
  VALUES (
    current_user,
    'BREAKGLASS_CHECK',
    p_table,
    NOT COALESCE(v_allowed, FALSE),
    jsonb_build_object('token_provided', p_token IS NOT NULL, 'result', COALESCE(v_allowed, FALSE))
  );

  RETURN COALESCE(v_allowed, FALSE);
END;
$$;

-- Fonction: Accorder break-glass (admin only)
CREATE OR REPLACE FUNCTION grant_breakglass(
  p_token TEXT,
  p_granted_by TEXT,
  p_reason TEXT,
  p_tables TEXT[],
  p_hours INT DEFAULT 4
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id BIGINT;
  v_token_hash TEXT;
BEGIN
  IF p_hours > 24 THEN
    RAISE EXCEPTION 'Break-glass duration cannot exceed 24 hours';
  END IF;

  IF p_hours < 1 THEN
    RAISE EXCEPTION 'Break-glass duration must be at least 1 hour';
  END IF;

  IF p_token IS NULL OR length(p_token) < 16 THEN
    RAISE EXCEPTION 'Break-glass token must be at least 16 characters';
  END IF;

  IF p_reason IS NULL OR length(p_reason) < 10 THEN
    RAISE EXCEPTION 'Break-glass reason must be at least 10 characters';
  END IF;

  IF p_tables IS NULL OR array_length(p_tables, 1) = 0 THEN
    RAISE EXCEPTION 'Break-glass must specify at least one table';
  END IF;

  v_token_hash := encode(sha256(p_token::bytea), 'hex');

  IF EXISTS (SELECT 1 FROM _killswitch_breakglass WHERE token_hash = v_token_hash AND is_active = TRUE) THEN
    RAISE EXCEPTION 'This token is already in use for an active break-glass';
  END IF;

  INSERT INTO _killswitch_breakglass (
    token_hash, granted_by, reason, tables_allowed, expires_at
  ) VALUES (
    v_token_hash, p_granted_by, p_reason, p_tables,
    NOW() + (p_hours || ' hours')::INTERVAL
  ) RETURNING id INTO v_id;

  INSERT INTO _killswitch_audit (role_name, operation, table_name, blocked, context)
  VALUES (
    current_user, 'BREAKGLASS_GRANT', array_to_string(p_tables, ','), FALSE,
    jsonb_build_object('breakglass_id', v_id, 'granted_by', p_granted_by, 'hours', p_hours, 'reason', p_reason)
  );

  RETURN v_id;
END;
$$;

-- Fonction: Révoquer break-glass
CREATE OR REPLACE FUNCTION revoke_breakglass(p_id BIGINT, p_revoked_by TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_found BOOLEAN;
BEGIN
  UPDATE _killswitch_breakglass
  SET is_active = FALSE, revoked_at = NOW(), revoked_by = p_revoked_by
  WHERE id = p_id AND is_active = TRUE;

  v_found := FOUND;

  IF v_found THEN
    INSERT INTO _killswitch_audit (role_name, operation, table_name, blocked, context)
    VALUES (current_user, 'BREAKGLASS_REVOKE', NULL, FALSE, jsonb_build_object('breakglass_id', p_id, 'revoked_by', p_revoked_by));
  END IF;

  RETURN v_found;
END;
$$;

-- Fonction: Lister break-glass actifs
CREATE OR REPLACE FUNCTION list_active_breakglass()
RETURNS TABLE (
  id INT,
  granted_by TEXT,
  granted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  time_remaining INTERVAL,
  reason TEXT,
  tables_allowed TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    bg.id,
    bg.granted_by,
    bg.granted_at,
    bg.expires_at,
    bg.expires_at - NOW() AS time_remaining,
    bg.reason,
    bg.tables_allowed
  FROM _killswitch_breakglass bg
  WHERE bg.is_active = TRUE
    AND bg.expires_at > NOW()
  ORDER BY bg.expires_at ASC;
END;
$$;

-- Permissions
GRANT EXECUTE ON FUNCTION check_breakglass(TEXT, TEXT) TO dev_readonly;
GRANT EXECUTE ON FUNCTION list_active_breakglass() TO authenticated;
GRANT EXECUTE ON FUNCTION list_active_breakglass() TO service_role;

-- =====================================================
-- VÉRIFICATION FINALE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=====================================================';
  RAISE NOTICE 'KILL-SWITCH DEV: Installation terminée';
  RAISE NOTICE '=====================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Rôle: dev_readonly créé avec SELECT-only';
  RAISE NOTICE 'RPC: 24 fonctions dangereuses bloquées (P0/P1)';
  RAISE NOTICE 'Tables: 9 tables critiques protégées';
  RAISE NOTICE 'Break-glass: Mécanisme d''urgence installé';
  RAISE NOTICE '';
  RAISE NOTICE 'PROCHAINE ÉTAPE:';
  RAISE NOTICE '  ALTER ROLE dev_readonly WITH PASSWORD ''votre_mot_de_passe'';';
  RAISE NOTICE '';
END
$$;

-- Afficher le résultat
SELECT 'dev_readonly' as role_name,
       EXISTS(SELECT 1 FROM pg_roles WHERE rolname = 'dev_readonly') as role_exists,
       EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = '_killswitch_audit') as audit_table_exists,
       EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = '_killswitch_breakglass') as breakglass_table_exists;

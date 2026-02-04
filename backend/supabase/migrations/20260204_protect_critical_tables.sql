-- =====================================================
-- KILL-SWITCH DEV: Phase 3 - Protection tables critiques
-- Date: 2026-02-04
-- Double-vérification SELECT only sur tables sensibles
-- =====================================================

BEGIN;

-- =====================================================
-- PAIEMENTS - CRITIQUE (ic_postback)
-- =====================================================
DO $$ BEGIN
  REVOKE ALL ON TABLE ic_postback FROM dev_readonly;
  GRANT SELECT ON TABLE ic_postback TO dev_readonly;
  RAISE NOTICE 'Protected: ic_postback (payments)';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Table ic_postback does not exist, skipping';
END $$;

-- =====================================================
-- COMMANDES - CRITIQUE (___xtr_order*)
-- =====================================================
DO $$ BEGIN
  REVOKE ALL ON TABLE "___xtr_order" FROM dev_readonly;
  GRANT SELECT ON TABLE "___xtr_order" TO dev_readonly;
  RAISE NOTICE 'Protected: ___xtr_order (orders)';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Table ___xtr_order does not exist, skipping';
END $$;

DO $$ BEGIN
  REVOKE ALL ON TABLE "___xtr_order_line" FROM dev_readonly;
  GRANT SELECT ON TABLE "___xtr_order_line" TO dev_readonly;
  RAISE NOTICE 'Protected: ___xtr_order_line (order lines)';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Table ___xtr_order_line does not exist, skipping';
END $$;

DO $$ BEGIN
  REVOKE ALL ON TABLE "___xtr_order_status" FROM dev_readonly;
  GRANT SELECT ON TABLE "___xtr_order_status" TO dev_readonly;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE ALL ON TABLE "___xtr_order_line_status" FROM dev_readonly;
  GRANT SELECT ON TABLE "___xtr_order_line_status" TO dev_readonly;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE ALL ON TABLE "___xtr_order_line_equiv_ticket" FROM dev_readonly;
  GRANT SELECT ON TABLE "___xtr_order_line_equiv_ticket" TO dev_readonly;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- =====================================================
-- FACTURES - CRITIQUE (___xtr_invoice*)
-- =====================================================
DO $$ BEGIN
  REVOKE ALL ON TABLE "___xtr_invoice" FROM dev_readonly;
  GRANT SELECT ON TABLE "___xtr_invoice" TO dev_readonly;
  RAISE NOTICE 'Protected: ___xtr_invoice (invoices)';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Table ___xtr_invoice does not exist, skipping';
END $$;

DO $$ BEGIN
  REVOKE ALL ON TABLE "___xtr_invoice_line" FROM dev_readonly;
  GRANT SELECT ON TABLE "___xtr_invoice_line" TO dev_readonly;
  RAISE NOTICE 'Protected: ___xtr_invoice_line (invoice lines)';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Table ___xtr_invoice_line does not exist, skipping';
END $$;

-- =====================================================
-- CLIENTS - CRITIQUE PII/GDPR (___xtr_customer*)
-- =====================================================
DO $$ BEGIN
  REVOKE ALL ON TABLE "___xtr_customer" FROM dev_readonly;
  GRANT SELECT ON TABLE "___xtr_customer" TO dev_readonly;
  RAISE NOTICE 'Protected: ___xtr_customer (PII/GDPR)';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Table ___xtr_customer does not exist, skipping';
END $$;

DO $$ BEGIN
  REVOKE ALL ON TABLE "___xtr_customer_billing_address" FROM dev_readonly;
  GRANT SELECT ON TABLE "___xtr_customer_billing_address" TO dev_readonly;
  RAISE NOTICE 'Protected: ___xtr_customer_billing_address (PII)';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  REVOKE ALL ON TABLE "___xtr_customer_delivery_address" FROM dev_readonly;
  GRANT SELECT ON TABLE "___xtr_customer_delivery_address" TO dev_readonly;
  RAISE NOTICE 'Protected: ___xtr_customer_delivery_address (PII)';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- =====================================================
-- USERS - CRITIQUE (authentification)
-- =====================================================
DO $$ BEGIN
  REVOKE ALL ON TABLE users FROM dev_readonly;
  GRANT SELECT ON TABLE users TO dev_readonly;
  RAISE NOTICE 'Protected: users (auth)';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Table users does not exist, skipping';
END $$;

-- =====================================================
-- MESSAGES/SUPPORT - SENSIBLE (___xtr_msg)
-- =====================================================
DO $$ BEGIN
  REVOKE ALL ON TABLE "___xtr_msg" FROM dev_readonly;
  GRANT SELECT ON TABLE "___xtr_msg" TO dev_readonly;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- =====================================================
-- TABLE D'AUDIT - Suivi des tentatives bloquées
-- =====================================================
CREATE TABLE IF NOT EXISTS _killswitch_audit (
  id BIGSERIAL PRIMARY KEY,
  attempted_at TIMESTAMPTZ DEFAULT NOW(),
  role_name TEXT,
  operation TEXT,
  table_name TEXT,
  blocked BOOLEAN DEFAULT TRUE,
  context JSONB
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_killswitch_audit_date
  ON _killswitch_audit(attempted_at DESC);

-- Permettre à dev_readonly de logger ses tentatives bloquées
GRANT INSERT ON TABLE _killswitch_audit TO dev_readonly;
GRANT USAGE, SELECT ON SEQUENCE _killswitch_audit_id_seq TO dev_readonly;

-- Log final
DO $$
BEGIN
  RAISE NOTICE 'Kill-switch DEV: Critical tables protected with SELECT-only for dev_readonly';
  RAISE NOTICE 'Audit table _killswitch_audit created for tracking';
END
$$;

COMMIT;

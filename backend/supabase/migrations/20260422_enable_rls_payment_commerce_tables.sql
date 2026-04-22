-- =============================================================================
-- Migration : Enable RLS on payment/commerce internal tables (Vague 2a)
-- Date      : 2026-04-22
-- Severity  : HIGH (Supabase advisor — rls_disabled_in_public)
-- Scope     : Vague 2a / 5 — payment & commerce internal tables hors orders
-- Author    : Security advisor remediation
-- =============================================================================
--
-- Tables covered (all currently rls_disabled with FULL anon/authenticated grants)
--
--   - public.__paybox_gate_log        (4 rows)   Paybox callback rejection decisions
--   - public.__abandoned_cart_emails  (0 rows)   Abandoned cart email queue
--   - public.__write_audit_log        (1857 rows) WriteGuard audit trail
--   - public.__write_collision_ledger (0 rows)   WriteGuard collision events
--
-- Risk before this migration
-- --------------------------
--   - __write_audit_log exposes 1857 records of internal write operations.
--     A reader can map data lineage and forge fake audit entries.
--   - __paybox_gate_log leaks fraud-detection rejection patterns.
--   - __abandoned_cart_emails is a queue — anon could inject spam/phishing
--     payloads into the email send pipeline.
--
-- Backend impact
-- --------------
-- All writers use the service_role Supabase client:
--   - PaymentsModule.PayboxCallbackGateService → paymentDataService['supabase']
--   - CartModule.AbandonedCartDataService     → SupabaseBaseService
--   - WriteGuardLedgerService (backend/src/config/) → SupabaseBaseService
-- All inherit BYPASSRLS — zero runtime impact.
--
-- Strategy : same defense-in-depth as Vague 1.
--   1. REVOKE ALL on anon, authenticated
--   2. ENABLE ROW LEVEL SECURITY
--   3. Explicit service_role ALL policy via DO block (idempotent without
--      destructive policy removal — passes CI Migration Safety gate).
--
-- This migration was applied to prod via `mcp__supabase__apply_migration` on
-- 2026-04-22 (with an earlier DROP+CREATE form). The file is the canonical
-- source of truth for the change and supports replay.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) __paybox_gate_log
-- -----------------------------------------------------------------------------

REVOKE ALL ON TABLE public.__paybox_gate_log FROM anon, authenticated;
ALTER TABLE public.__paybox_gate_log ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = '__paybox_gate_log' AND policyname = '__paybox_gate_log_service_role_all') THEN
    CREATE POLICY __paybox_gate_log_service_role_all
      ON public.__paybox_gate_log AS PERMISSIVE FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2) __abandoned_cart_emails
-- -----------------------------------------------------------------------------

REVOKE ALL ON TABLE public.__abandoned_cart_emails FROM anon, authenticated;
ALTER TABLE public.__abandoned_cart_emails ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = '__abandoned_cart_emails' AND policyname = '__abandoned_cart_emails_service_role_all') THEN
    CREATE POLICY __abandoned_cart_emails_service_role_all
      ON public.__abandoned_cart_emails AS PERMISSIVE FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;
COMMENT ON TABLE public.__abandoned_cart_emails IS
  'Abandoned cart email send queue. RLS enabled 2026-04-22 — service_role only.';

-- -----------------------------------------------------------------------------
-- 3) __write_audit_log
-- -----------------------------------------------------------------------------

REVOKE ALL ON TABLE public.__write_audit_log FROM anon, authenticated;
ALTER TABLE public.__write_audit_log ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = '__write_audit_log' AND policyname = '__write_audit_log_service_role_all') THEN
    CREATE POLICY __write_audit_log_service_role_all
      ON public.__write_audit_log AS PERMISSIVE FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;
COMMENT ON TABLE public.__write_audit_log IS
  'WriteGuard successful-write audit trail. RLS enabled 2026-04-22 — service_role only.';

-- -----------------------------------------------------------------------------
-- 4) __write_collision_ledger
-- -----------------------------------------------------------------------------

REVOKE ALL ON TABLE public.__write_collision_ledger FROM anon, authenticated;
ALTER TABLE public.__write_collision_ledger ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = '__write_collision_ledger' AND policyname = '__write_collision_ledger_service_role_all') THEN
    CREATE POLICY __write_collision_ledger_service_role_all
      ON public.__write_collision_ledger AS PERMISSIVE FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;
COMMENT ON TABLE public.__write_collision_ledger IS
  'WriteGuard write-collision/conflict events. RLS enabled 2026-04-22 — service_role only.';

COMMIT;

-- =============================================================================
-- Post-migration verification
-- =============================================================================
--   SELECT relname, relrowsecurity
--   FROM   pg_class
--   WHERE  relname IN ('__paybox_gate_log','__abandoned_cart_emails',
--                      '__write_audit_log','__write_collision_ledger');
--   -- expected : relrowsecurity = true for all 4
--
--   SELECT grantee, table_name, privilege_type
--   FROM   information_schema.role_table_grants
--   WHERE  table_name IN ('__paybox_gate_log','__abandoned_cart_emails',
--                         '__write_audit_log','__write_collision_ledger')
--     AND  grantee IN ('anon','authenticated');
--   -- expected : 0 rows
--
-- =============================================================================

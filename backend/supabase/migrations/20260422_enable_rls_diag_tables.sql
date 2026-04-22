-- =============================================================================
-- Migration : Enable RLS on diagnostic engine tables (Vague 2c)
-- Date      : 2026-04-22
-- Severity  : MEDIUM (Supabase advisor — rls_disabled_in_public)
-- Scope     : Vague 2c / 5 — 8 __diag_* tables (KG diagnostic engine)
-- =============================================================================
--
-- Tables covered
--
--   - public.__diag_system                    (13 rows)  vehicle systems
--   - public.__diag_symptom                   (62 rows)  symptoms
--   - public.__diag_cause                     (58 rows)  causes
--   - public.__diag_symptom_cause_link        (162 rows) symptom <-> cause edges
--   - public.__diag_safety_rule               (21 rows)  safety rules
--   - public.__diag_session                   (101 rows) diag sessions
--   - public.__diag_maintenance_operation     (30 rows)  preventive maintenance ops
--   - public.__diag_maintenance_symptom_link  (75 rows)  maintenance <-> symptom
--
-- Risk before this migration
-- --------------------------
-- All 8 tables had RLS off and FULL anon/authenticated grants. Anon could
-- corrupt the diagnostic knowledge graph (false symptom-cause links → wrong
-- diagnoses surfaced to users), wipe safety rules, or harvest user diagnostic
-- sessions.
--
-- Backend impact
-- --------------
-- All access via backend NestJS (KG / diagnostic-engine module), service_role
-- client → BYPASSRLS → zero runtime impact. Frontend has NO direct access.
-- Per memory `diagnostic-engine-breezy-eagle.md`, search is delegated to
-- /api/rag/search via the backend.
--
-- Strategy : standard (REVOKE + RLS ON + service_role policy via DO block).
-- Idempotent without destructive policy removal — passes CI Migration Safety
-- gate without any `-- APPROVED:` overrides.
--
-- Applied to prod 2026-04-22 (earlier DROP+CREATE form). Canonical replay file.
-- =============================================================================

BEGIN;

-- ALTER TABLE in alphabetical order for review readability

REVOKE ALL ON TABLE public.__diag_cause FROM anon, authenticated;
ALTER TABLE public.__diag_cause ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = '__diag_cause' AND policyname = '__diag_cause_service_role_all') THEN
    CREATE POLICY __diag_cause_service_role_all ON public.__diag_cause
      AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

REVOKE ALL ON TABLE public.__diag_maintenance_operation FROM anon, authenticated;
ALTER TABLE public.__diag_maintenance_operation ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = '__diag_maintenance_operation' AND policyname = '__diag_maintenance_operation_service_role_all') THEN
    CREATE POLICY __diag_maintenance_operation_service_role_all ON public.__diag_maintenance_operation
      AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

REVOKE ALL ON TABLE public.__diag_maintenance_symptom_link FROM anon, authenticated;
ALTER TABLE public.__diag_maintenance_symptom_link ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = '__diag_maintenance_symptom_link' AND policyname = '__diag_maintenance_symptom_link_service_role_all') THEN
    CREATE POLICY __diag_maintenance_symptom_link_service_role_all ON public.__diag_maintenance_symptom_link
      AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

REVOKE ALL ON TABLE public.__diag_safety_rule FROM anon, authenticated;
ALTER TABLE public.__diag_safety_rule ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = '__diag_safety_rule' AND policyname = '__diag_safety_rule_service_role_all') THEN
    CREATE POLICY __diag_safety_rule_service_role_all ON public.__diag_safety_rule
      AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

REVOKE ALL ON TABLE public.__diag_session FROM anon, authenticated;
ALTER TABLE public.__diag_session ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = '__diag_session' AND policyname = '__diag_session_service_role_all') THEN
    CREATE POLICY __diag_session_service_role_all ON public.__diag_session
      AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

REVOKE ALL ON TABLE public.__diag_symptom FROM anon, authenticated;
ALTER TABLE public.__diag_symptom ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = '__diag_symptom' AND policyname = '__diag_symptom_service_role_all') THEN
    CREATE POLICY __diag_symptom_service_role_all ON public.__diag_symptom
      AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

REVOKE ALL ON TABLE public.__diag_symptom_cause_link FROM anon, authenticated;
ALTER TABLE public.__diag_symptom_cause_link ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = '__diag_symptom_cause_link' AND policyname = '__diag_symptom_cause_link_service_role_all') THEN
    CREATE POLICY __diag_symptom_cause_link_service_role_all ON public.__diag_symptom_cause_link
      AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

REVOKE ALL ON TABLE public.__diag_system FROM anon, authenticated;
ALTER TABLE public.__diag_system ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = '__diag_system' AND policyname = '__diag_system_service_role_all') THEN
    CREATE POLICY __diag_system_service_role_all ON public.__diag_system
      AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMIT;

-- =============================================================================
-- Verification
--   SELECT relname, relrowsecurity FROM pg_class WHERE relname LIKE '__diag_%';
-- =============================================================================

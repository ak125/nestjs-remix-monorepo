-- =============================================================================
-- Migration : Enable RLS on internal/admin tables (Vague 2d)
-- Date      : 2026-04-22
-- Severity  : MEDIUM (Supabase advisor — rls_disabled_in_public + policy_exists_rls_disabled)
-- Scope     : Vague 2d / 5 — 15 internal tables (RAG, SEO, errors, agent, tecdoc)
-- =============================================================================
--
-- Tables covered (all with FULL anon/authenticated grants and RLS off)
--
--   Agent / errors :
--     __agent_runs                (5 rows)
--     __error_logs                (11179 rows)
--
--   RAG :
--     __rag_change_events         (554 rows)
--     __rag_check_history         (3 rows)
--     __rag_content_refresh_log   (913 rows)  -- already has service_role policy
--     __rag_pipeline_incidents    (30 rows)
--     __rag_readiness             (1219 rows)
--
--   SEO :
--     __seo_ai_runs               (0 rows)
--     __seo_gamme_gsc_baseline    (0 rows)
--     __seo_gamme_links           (1199 rows)
--     __seo_keyword_results       (8702 rows)
--     __seo_r1_image_prompts      (70 rows)
--     __seo_r4_batch_runs         (1 row)
--
--   Tecdoc :
--     __tecdoc_import_log         (0 rows)
--     __tecdoc_supplier_mapping   (846 rows)
--
-- Frontend audit
-- --------------
-- Zero direct supabase-js calls. Only `__seo_r1_image_prompts` is referenced
-- in `frontend/app/types/admin-r1.types.ts` as a TypeScript type mirror
-- (comment only).
--
-- Special case
-- ------------
-- `__rag_content_refresh_log` already has a `_service_role_all` policy. This
-- migration only ENABLE RLS on it — no policy creation needed (already exists).
-- It's also flagged separately by the advisor as `policy_exists_rls_disabled`.
--
-- Idempotency strategy
-- --------------------
-- Policies are created via `DO $$ BEGIN IF NOT EXISTS (…) THEN CREATE POLICY …
-- END IF; END $$;` blocks. This is idempotent without destructive policy
-- removal, so the migration replays cleanly on a fresh DB and passes the CI
-- Migration Safety gate without any `-- APPROVED:` overrides.
--
-- This migration was applied to prod via `mcp__supabase__apply_migration` on
-- 2026-04-22 (with an earlier DROP+CREATE form). The file is the canonical
-- source of truth for the change and supports replay.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Agent / errors
-- -----------------------------------------------------------------------------

REVOKE ALL ON TABLE public.__agent_runs FROM anon, authenticated;
ALTER TABLE public.__agent_runs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = '__agent_runs' AND policyname = '__agent_runs_service_role_all') THEN
    CREATE POLICY __agent_runs_service_role_all ON public.__agent_runs
      AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

REVOKE ALL ON TABLE public.__error_logs FROM anon, authenticated;
ALTER TABLE public.__error_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = '__error_logs' AND policyname = '__error_logs_service_role_all') THEN
    CREATE POLICY __error_logs_service_role_all ON public.__error_logs
      AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- RAG
-- -----------------------------------------------------------------------------

REVOKE ALL ON TABLE public.__rag_change_events FROM anon, authenticated;
ALTER TABLE public.__rag_change_events ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = '__rag_change_events' AND policyname = '__rag_change_events_service_role_all') THEN
    CREATE POLICY __rag_change_events_service_role_all ON public.__rag_change_events
      AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

REVOKE ALL ON TABLE public.__rag_check_history FROM anon, authenticated;
ALTER TABLE public.__rag_check_history ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = '__rag_check_history' AND policyname = '__rag_check_history_service_role_all') THEN
    CREATE POLICY __rag_check_history_service_role_all ON public.__rag_check_history
      AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- __rag_content_refresh_log : policy `_all_service_role` already exists (created earlier)
REVOKE ALL ON TABLE public.__rag_content_refresh_log FROM anon, authenticated;
ALTER TABLE public.__rag_content_refresh_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.__rag_pipeline_incidents FROM anon, authenticated;
ALTER TABLE public.__rag_pipeline_incidents ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = '__rag_pipeline_incidents' AND policyname = '__rag_pipeline_incidents_service_role_all') THEN
    CREATE POLICY __rag_pipeline_incidents_service_role_all ON public.__rag_pipeline_incidents
      AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

REVOKE ALL ON TABLE public.__rag_readiness FROM anon, authenticated;
ALTER TABLE public.__rag_readiness ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = '__rag_readiness' AND policyname = '__rag_readiness_service_role_all') THEN
    CREATE POLICY __rag_readiness_service_role_all ON public.__rag_readiness
      AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- SEO
-- -----------------------------------------------------------------------------

REVOKE ALL ON TABLE public.__seo_ai_runs FROM anon, authenticated;
ALTER TABLE public.__seo_ai_runs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = '__seo_ai_runs' AND policyname = '__seo_ai_runs_service_role_all') THEN
    CREATE POLICY __seo_ai_runs_service_role_all ON public.__seo_ai_runs
      AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

REVOKE ALL ON TABLE public.__seo_gamme_gsc_baseline FROM anon, authenticated;
ALTER TABLE public.__seo_gamme_gsc_baseline ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = '__seo_gamme_gsc_baseline' AND policyname = '__seo_gamme_gsc_baseline_service_role_all') THEN
    CREATE POLICY __seo_gamme_gsc_baseline_service_role_all ON public.__seo_gamme_gsc_baseline
      AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

REVOKE ALL ON TABLE public.__seo_gamme_links FROM anon, authenticated;
ALTER TABLE public.__seo_gamme_links ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = '__seo_gamme_links' AND policyname = '__seo_gamme_links_service_role_all') THEN
    CREATE POLICY __seo_gamme_links_service_role_all ON public.__seo_gamme_links
      AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

REVOKE ALL ON TABLE public.__seo_keyword_results FROM anon, authenticated;
ALTER TABLE public.__seo_keyword_results ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = '__seo_keyword_results' AND policyname = '__seo_keyword_results_service_role_all') THEN
    CREATE POLICY __seo_keyword_results_service_role_all ON public.__seo_keyword_results
      AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

REVOKE ALL ON TABLE public.__seo_r1_image_prompts FROM anon, authenticated;
ALTER TABLE public.__seo_r1_image_prompts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = '__seo_r1_image_prompts' AND policyname = '__seo_r1_image_prompts_service_role_all') THEN
    CREATE POLICY __seo_r1_image_prompts_service_role_all ON public.__seo_r1_image_prompts
      AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

REVOKE ALL ON TABLE public.__seo_r4_batch_runs FROM anon, authenticated;
ALTER TABLE public.__seo_r4_batch_runs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = '__seo_r4_batch_runs' AND policyname = '__seo_r4_batch_runs_service_role_all') THEN
    CREATE POLICY __seo_r4_batch_runs_service_role_all ON public.__seo_r4_batch_runs
      AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Tecdoc
-- -----------------------------------------------------------------------------

REVOKE ALL ON TABLE public.__tecdoc_import_log FROM anon, authenticated;
ALTER TABLE public.__tecdoc_import_log ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = '__tecdoc_import_log' AND policyname = '__tecdoc_import_log_service_role_all') THEN
    CREATE POLICY __tecdoc_import_log_service_role_all ON public.__tecdoc_import_log
      AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

REVOKE ALL ON TABLE public.__tecdoc_supplier_mapping FROM anon, authenticated;
ALTER TABLE public.__tecdoc_supplier_mapping ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = '__tecdoc_supplier_mapping' AND policyname = '__tecdoc_supplier_mapping_service_role_all') THEN
    CREATE POLICY __tecdoc_supplier_mapping_service_role_all ON public.__tecdoc_supplier_mapping
      AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMIT;

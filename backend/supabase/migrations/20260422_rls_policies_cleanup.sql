-- =============================================================================
-- Migration : RLS policies cleanup (Vague 2e)
-- Date      : 2026-04-22
-- Severity  : MEDIUM (Supabase advisor — rls_enabled_no_policy + rls_policy_always_true)
-- Scope     : Vague 2e / 5
-- =============================================================================
--
-- Two distinct fixes :
--
-- A) `rls_enabled_no_policy` (18 tables)
--    ------------------------------------
--    Tables already had RLS enabled but ZERO policy. Combined with the FULL
--    anon/authenticated grants still present, this is an inconsistent state :
--    grants are dormant only because RLS-with-no-policy = deny by default
--    (apart from service_role's BYPASSRLS). If anyone ever turns RLS off,
--    the grants reactivate.
--    Fix : REVOKE + CREATE explicit service_role policy via DO block.
--
-- B) `rls_policy_always_true` (4 tables)
--    -----------------------------------
--    - kg_feedback_events / kg_truth_labels :
--        legacy `_insert_authenticated` and `_select_authenticated` policies
--        allow any authenticated user to INSERT/SELECT all rows USING (true).
--        Zero code path uses these (frontend has no direct supabase client,
--        backend uses service_role only). Remove the authenticated policies,
--        keep the existing service_role policy.
--    - seo_link_clicks / seo_link_impressions :
--        legacy `Allow anonymous inserts` (anon INSERT WITH CHECK true) and
--        `Allow admin read` (admin SELECT via auth.uid()) — designed for
--        client-side tracking, but the frontend has no supabase-js client and
--        the backend `seo-link-tracking.service.ts` already uses service_role.
--        Remove both, replace with service_role-only policy.
--
-- All targets : zero frontend supabase-js calls confirmed via repo grep.
--
-- Idempotency strategy
-- --------------------
-- New policy creations use `DO $$ BEGIN IF NOT EXISTS … END $$;` blocks
-- (no destructive removal, replays cleanly).
-- The 8 actual policy removals (legacy unsafe policies) use the standard
-- removal statement with individually-written `-- APPROVED:` comments
-- explaining why each removal is safe and necessary.
--
-- This migration was applied to prod via `mcp__supabase__apply_migration` on
-- 2026-04-22 (with an earlier DROP+CREATE form for the new policies). The
-- file is the canonical source of truth and supports replay.
-- =============================================================================

BEGIN;

-- =============================================================================
-- A) rls_enabled_no_policy : 18 tables — REVOKE + service_role policy
-- =============================================================================

-- QA audit
REVOKE ALL ON TABLE public.__qa_audit_alerts FROM anon, authenticated;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = '__qa_audit_alerts' AND policyname = '__qa_audit_alerts_service_role_all') THEN
    CREATE POLICY __qa_audit_alerts_service_role_all ON public.__qa_audit_alerts
      AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

REVOKE ALL ON TABLE public.__qa_audit_issues FROM anon, authenticated;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = '__qa_audit_issues' AND policyname = '__qa_audit_issues_service_role_all') THEN
    CREATE POLICY __qa_audit_issues_service_role_all ON public.__qa_audit_issues
      AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

REVOKE ALL ON TABLE public.__qa_audit_runs FROM anon, authenticated;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = '__qa_audit_runs' AND policyname = '__qa_audit_runs_service_role_all') THEN
    CREATE POLICY __qa_audit_runs_service_role_all ON public.__qa_audit_runs
      AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- SEO audit/observable
REVOKE ALL ON TABLE public.__seo_audit_history FROM anon, authenticated;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = '__seo_audit_history' AND policyname = '__seo_audit_history_service_role_all') THEN
    CREATE POLICY __seo_audit_history_service_role_all ON public.__seo_audit_history
      AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

REVOKE ALL ON TABLE public.__seo_observable_policy FROM anon, authenticated;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = '__seo_observable_policy' AND policyname = '__seo_observable_policy_service_role_all') THEN
    CREATE POLICY __seo_observable_policy_service_role_all ON public.__seo_observable_policy
      AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- SEO R2/R4/R5/R6
REVOKE ALL ON TABLE public.__seo_r2_keyword_plan FROM anon, authenticated;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = '__seo_r2_keyword_plan' AND policyname = '__seo_r2_keyword_plan_service_role_all') THEN
    CREATE POLICY __seo_r2_keyword_plan_service_role_all ON public.__seo_r2_keyword_plan
      AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

REVOKE ALL ON TABLE public.__seo_r4_keyword_plan FROM anon, authenticated;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = '__seo_r4_keyword_plan' AND policyname = '__seo_r4_keyword_plan_service_role_all') THEN
    CREATE POLICY __seo_r4_keyword_plan_service_role_all ON public.__seo_r4_keyword_plan
      AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

REVOKE ALL ON TABLE public.__seo_r5_keyword_plan FROM anon, authenticated;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = '__seo_r5_keyword_plan' AND policyname = '__seo_r5_keyword_plan_service_role_all') THEN
    CREATE POLICY __seo_r5_keyword_plan_service_role_all ON public.__seo_r5_keyword_plan
      AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

REVOKE ALL ON TABLE public.__seo_r6_image_prompts FROM anon, authenticated;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = '__seo_r6_image_prompts' AND policyname = '__seo_r6_image_prompts_service_role_all') THEN
    CREATE POLICY __seo_r6_image_prompts_service_role_all ON public.__seo_r6_image_prompts
      AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

REVOKE ALL ON TABLE public.__seo_r6_keyword_plan FROM anon, authenticated;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = '__seo_r6_keyword_plan' AND policyname = '__seo_r6_keyword_plan_service_role_all') THEN
    CREATE POLICY __seo_r6_keyword_plan_service_role_all ON public.__seo_r6_keyword_plan
      AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- SEO R8 (8 tables)
REVOKE ALL ON TABLE public.__seo_r8_engine_family_stats FROM anon, authenticated;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = '__seo_r8_engine_family_stats' AND policyname = '__seo_r8_engine_family_stats_service_role_all') THEN
    CREATE POLICY __seo_r8_engine_family_stats_service_role_all ON public.__seo_r8_engine_family_stats
      AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

REVOKE ALL ON TABLE public.__seo_r8_fingerprints FROM anon, authenticated;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = '__seo_r8_fingerprints' AND policyname = '__seo_r8_fingerprints_service_role_all') THEN
    CREATE POLICY __seo_r8_fingerprints_service_role_all ON public.__seo_r8_fingerprints
      AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

REVOKE ALL ON TABLE public.__seo_r8_keyword_plan FROM anon, authenticated;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = '__seo_r8_keyword_plan' AND policyname = '__seo_r8_keyword_plan_service_role_all') THEN
    CREATE POLICY __seo_r8_keyword_plan_service_role_all ON public.__seo_r8_keyword_plan
      AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

REVOKE ALL ON TABLE public.__seo_r8_page_versions FROM anon, authenticated;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = '__seo_r8_page_versions' AND policyname = '__seo_r8_page_versions_service_role_all') THEN
    CREATE POLICY __seo_r8_page_versions_service_role_all ON public.__seo_r8_page_versions
      AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

REVOKE ALL ON TABLE public.__seo_r8_pages FROM anon, authenticated;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = '__seo_r8_pages' AND policyname = '__seo_r8_pages_service_role_all') THEN
    CREATE POLICY __seo_r8_pages_service_role_all ON public.__seo_r8_pages
      AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

REVOKE ALL ON TABLE public.__seo_r8_qa_reviews FROM anon, authenticated;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = '__seo_r8_qa_reviews' AND policyname = '__seo_r8_qa_reviews_service_role_all') THEN
    CREATE POLICY __seo_r8_qa_reviews_service_role_all ON public.__seo_r8_qa_reviews
      AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

REVOKE ALL ON TABLE public.__seo_r8_regeneration_queue FROM anon, authenticated;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = '__seo_r8_regeneration_queue' AND policyname = '__seo_r8_regeneration_queue_service_role_all') THEN
    CREATE POLICY __seo_r8_regeneration_queue_service_role_all ON public.__seo_r8_regeneration_queue
      AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

REVOKE ALL ON TABLE public.__seo_r8_similarity_index FROM anon, authenticated;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = '__seo_r8_similarity_index' AND policyname = '__seo_r8_similarity_index_service_role_all') THEN
    CREATE POLICY __seo_r8_similarity_index_service_role_all ON public.__seo_r8_similarity_index
      AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- =============================================================================
-- B) rls_policy_always_true : 4 tables — remove legacy unsafe policies
--    Each removal is approved individually with the specific safety reason.
-- =============================================================================

-- kg_feedback_events : legacy authenticated INSERT/SELECT policies (zero code uses them)
REVOKE ALL ON TABLE public.kg_feedback_events FROM anon, authenticated;
DROP POLICY IF EXISTS kg_feedback_insert_authenticated ON public.kg_feedback_events; -- APPROVED: legacy policy authorizes any authenticated user to INSERT freely (WITH CHECK true) — zero code path uses this; backend uses service_role only
DROP POLICY IF EXISTS kg_feedback_select_authenticated ON public.kg_feedback_events; -- APPROVED: legacy policy authorizes any authenticated user to SELECT all rows (USING true) — zero code path uses this; backend uses service_role only
-- kg_feedback_all_service stays in place (service_role policy already correct)

-- kg_truth_labels : same pattern
REVOKE ALL ON TABLE public.kg_truth_labels FROM anon, authenticated;
DROP POLICY IF EXISTS kg_truth_labels_insert_authenticated ON public.kg_truth_labels; -- APPROVED: legacy policy authorizes any authenticated user to INSERT freely (WITH CHECK true) — zero code path uses this; backend uses service_role only
DROP POLICY IF EXISTS kg_truth_labels_select_authenticated ON public.kg_truth_labels; -- APPROVED: legacy policy authorizes any authenticated user to SELECT all rows (USING true) — zero code path uses this; backend uses service_role only
-- kg_truth_labels_all_service stays in place

-- seo_link_clicks : remove legacy public-role policies, replace with service_role
REVOKE ALL ON TABLE public.seo_link_clicks FROM anon, authenticated;
DROP POLICY IF EXISTS "Allow anonymous inserts on seo_link_clicks" ON public.seo_link_clicks; -- APPROVED: legacy `{public}` INSERT policy with WITH CHECK true allowed any caller to inject click events — frontend has no direct supabase-js client, backend uses service_role
DROP POLICY IF EXISTS "Allow admin read on seo_link_clicks" ON public.seo_link_clicks;        -- APPROVED: legacy `{public}` SELECT policy gated on auth.uid() admin check — bypassed by service_role admin tooling, no longer needed
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = 'seo_link_clicks' AND policyname = 'seo_link_clicks_service_role_all') THEN
    CREATE POLICY seo_link_clicks_service_role_all ON public.seo_link_clicks
      AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- seo_link_impressions : same pattern
REVOKE ALL ON TABLE public.seo_link_impressions FROM anon, authenticated;
DROP POLICY IF EXISTS "Allow anonymous inserts on seo_link_impressions" ON public.seo_link_impressions; -- APPROVED: legacy `{public}` INSERT policy with WITH CHECK true allowed any caller to inject impression events — frontend has no direct supabase-js client, backend uses service_role
DROP POLICY IF EXISTS "Allow admin read on seo_link_impressions" ON public.seo_link_impressions;        -- APPROVED: legacy `{public}` SELECT policy gated on auth.uid() admin check — bypassed by service_role admin tooling, no longer needed
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
    AND tablename = 'seo_link_impressions' AND policyname = 'seo_link_impressions_service_role_all') THEN
    CREATE POLICY seo_link_impressions_service_role_all ON public.seo_link_impressions
      AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMIT;

-- =============================================================================
-- Migration : Drop legacy USING(true) policies on internal tables (Vague 4a)
-- Date      : 2026-04-22
-- Severity  : HIGH (anon read on KG) / MEDIUM (authenticated/public on internal)
-- Scope     : Vague 4a — 25 unsafe USING(true) policies removed
-- =============================================================================
--
-- Background
-- ----------
-- During Vague 2e remediation, we discovered 102 `USING(true)` policies on
-- public/authenticated/anon roles that were NOT flagged by the Supabase
-- advisor (lower severity threshold). This migration tackles the 25 most
-- dangerous ones — internal/KG tables that have no business being readable
-- by anon or general authenticated users.
--
-- The remaining ~72 `USING(true)` policies are on legitimate-public tables
-- (catalog, blog, sitemap, SEO content used for SSR rendering) and require
-- a separate architectural decision before action (Vague 4b).
--
-- Strategy
-- --------
-- Each removal is intentional and individually justified with `-- APPROVED:`
-- comments to satisfy the CI Migration Safety gate honestly. All target
-- tables already have a service_role policy (created during vagues 1-2e),
-- so backend access is preserved without changes.
--
-- Smoke-tested in transaction on prod DB 2026-04-22:
--   23 tables, 0 always_true public/anon/auth policies remaining,
--   1 service_role policy preserved per table.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- A) HIGH severity — anon SELECT USING(true) on KG core (2)
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS kg_edges_select_anon ON public.kg_edges; -- APPROVED: anon could read the entire KG edge graph (USING true) — KG is internal metier data, never meant for anon access. service_role policy preserved.
DROP POLICY IF EXISTS kg_nodes_select_anon ON public.kg_nodes; -- APPROVED: anon could read all KG nodes (USING true) — KG is internal metier data, never meant for anon access. service_role policy preserved.

-- -----------------------------------------------------------------------------
-- B) MEDIUM severity — authenticated SELECT USING(true) on internal tables (19)
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS __quality_gamme_scores_select_authenticated ON public.__quality_gamme_scores; -- APPROVED: any authenticated user could read internal gamme quality scores (USING true) — admin-only data. service_role policy preserved.
DROP POLICY IF EXISTS __quality_page_scores_select_authenticated ON public.__quality_page_scores; -- APPROVED: any authenticated user could read internal page quality scores (USING true) — admin-only data. service_role policy preserved.
DROP POLICY IF EXISTS authenticated_read ON public.__rag_web_ingest_jobs; -- APPROVED: any authenticated user could read RAG web ingest jobs (USING true) — admin pipeline data. service_role policy preserved.
DROP POLICY IF EXISTS __seo_observable_select_authenticated ON public.__seo_observable; -- APPROVED: any authenticated user could read SEO observables (USING true) — internal SEO data. service_role policy preserved.
DROP POLICY IF EXISTS authenticated_select ON public.__seo_r3_image_prompts; -- APPROVED: any authenticated user could read R3 image prompts (USING true) — admin SEO data. service_role policy preserved.
DROP POLICY IF EXISTS "Allow authenticated read on experiments" ON public.crawl_budget_experiments; -- APPROVED: any authenticated user could read crawl budget experiments (USING true) — admin SEO infra data. service_role policy preserved.
DROP POLICY IF EXISTS "Allow authenticated read on metrics" ON public.crawl_budget_metrics; -- APPROVED: any authenticated user could read crawl budget metrics (USING true) — admin SEO infra data. service_role policy preserved.
DROP POLICY IF EXISTS ga_select_authenticated ON public.gamme_aggregates; -- APPROVED: any authenticated user could read full gamme aggregates (USING true) — internal SEO/business data. service_role policy preserved.
DROP POLICY IF EXISTS gamme_seo_audit_select_authenticated ON public.gamme_seo_audit; -- APPROVED: any authenticated user could read SEO audit history (USING true) — admin SEO data. service_role policy preserved.
DROP POLICY IF EXISTS gamme_seo_metrics_select_authenticated ON public.gamme_seo_metrics; -- APPROVED: any authenticated user could read SEO metrics (USING true) — internal SEO data. service_role policy preserved.
DROP POLICY IF EXISTS kg_edge_history_select_authenticated ON public.kg_edge_history; -- APPROVED: any authenticated user could read KG edge history (USING true) — internal KG audit data. service_role policy preserved.
DROP POLICY IF EXISTS kg_edges_select_authenticated ON public.kg_edges; -- APPROVED: any authenticated user could read all KG edges (USING true) — internal KG data. service_role policy preserved.
DROP POLICY IF EXISTS kg_config_select_authenticated ON public.kg_feedback_config; -- APPROVED: any authenticated user could read KG feedback config (USING true) — admin KG config. service_role policy preserved.
DROP POLICY IF EXISTS kg_node_history_select_authenticated ON public.kg_node_history; -- APPROVED: any authenticated user could read KG node history (USING true) — internal KG audit data. service_role policy preserved.
DROP POLICY IF EXISTS kg_nodes_select_authenticated ON public.kg_nodes; -- APPROVED: any authenticated user could read all KG nodes (USING true) — internal KG data. service_role policy preserved.
DROP POLICY IF EXISTS kg_rag_mapping_select_authenticated ON public.kg_rag_mapping; -- APPROVED: any authenticated user could read KG/RAG mapping (USING true) — internal KG data. service_role policy preserved.
DROP POLICY IF EXISTS kg_rag_sync_log_select_authenticated ON public.kg_rag_sync_log; -- APPROVED: any authenticated user could read KG/RAG sync log (USING true) — admin pipeline data. service_role policy preserved.
DROP POLICY IF EXISTS kg_cache_select_authenticated ON public.kg_reasoning_cache; -- APPROVED: any authenticated user could read KG reasoning cache (USING true) — internal KG state. service_role policy preserved.
DROP POLICY IF EXISTS kg_adjustments_select_authenticated ON public.kg_weight_adjustments; -- APPROVED: any authenticated user could read KG weight adjustments (USING true) — internal KG tuning data. service_role policy preserved.

-- -----------------------------------------------------------------------------
-- C) MEDIUM severity — public SELECT USING(true) on KG tables (4)
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS kg_case_outcomes_select_all ON public.kg_case_outcomes; -- APPROVED: legacy {public} SELECT policy with USING true on KG case outcomes — KG is internal, no public exposure intended. service_role policy preserved.
DROP POLICY IF EXISTS kg_cases_select_all ON public.kg_cases; -- APPROVED: legacy {public} SELECT policy with USING true on KG cases — KG is internal, no public exposure intended. service_role policy preserved.
DROP POLICY IF EXISTS kg_learning_log_select_all ON public.kg_learning_log; -- APPROVED: legacy {public} SELECT policy with USING true on KG learning log — KG is internal, no public exposure intended. service_role policy preserved.
DROP POLICY IF EXISTS kg_safety_triggers_select_all ON public.kg_safety_triggers; -- APPROVED: legacy {public} SELECT policy with USING true on KG safety triggers — KG is internal, no public exposure intended. service_role policy preserved.

COMMIT;

-- =============================================================================
-- Post-migration verification
-- =============================================================================
--   SELECT tablename, COUNT(*) FILTER (WHERE qual='true' AND roles::text NOT LIKE '%service_role%')
--   FROM pg_policies
--   WHERE schemaname = 'public'
--     AND tablename IN (... above 23 tables ...)
--   GROUP BY tablename;
--   -- expected : all 0 (only service_role policies remain)
--
--   SELECT tablename, COUNT(*) FILTER (WHERE roles::text LIKE '%service_role%')
--   FROM pg_policies WHERE schemaname = 'public' AND tablename IN (...)
--   GROUP BY tablename;
--   -- expected : 1 service_role policy per table (preserved)
--
-- =============================================================================

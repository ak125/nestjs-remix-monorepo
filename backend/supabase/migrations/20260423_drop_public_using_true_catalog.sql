-- =============================================================================
-- Migration : Drop public USING(true) policies on catalog/blog/SEO tables (Vague 4b deferred)
-- Date      : 2026-04-23
-- Severity  : MEDIUM (defense in depth — zero-trust hardening of public-facing tables)
-- Scope     : Vague 4b deferred — 73 policies dropped, 59 service_role policies created
-- =============================================================================
--
-- BACKGROUND
-- ----------
-- During Vague 4b column-level audit, we verified that 73 tables flagged with
-- legacy `Enable read access for all users` policies (public role SELECT
-- USING true) contain only legitimately-public catalog/blog/SEO/sitemap
-- content (no passwords, tokens, PII, payment data, or admin credentials —
-- those were handled in Vague 4b-critical PR #120).
--
-- However, the policies are still attack surface : they let anyone with the
-- public anon key bulk-export the entire catalog via PostgREST. The audit
-- also confirmed:
--   - Frontend has no direct supabase-js anon calls on these tables
--   - Backend uses SUPABASE_SERVICE_ROLE_KEY for all reads
--   - Scripts use service_role
--   - No CI/cron/external consumer detected
--
-- This migration applies a zero-trust hardening:
--   1. DROP the 73 legacy public USING(true) policies (each with an
--      individual APPROVED comment honestly stating the audit basis)
--   2. CREATE service_role policies on the 59 tables that don't have one yet
--      (DO block IF NOT EXISTS, idempotent without destructive removal)
--   3. REVOKE ALL on anon, authenticated grants (defense in depth)
--
-- AFTER THIS MIGRATION
-- --------------------
-- - 73 fewer rls_policy_always_true advisor flags
-- - All 73 tables locked down to service_role only (anon = deny by default)
-- - Future legitimate public consumers must request explicit policies
--   (best practice: opt-in to public exposure, not opt-out)
--
-- ROLLBACK
-- --------
-- If a missed consumer breaks (highly unlikely after audit), the rollback is
-- table-by-table : recreate the relevant `Enable read access for all users`
-- policy with the original USING(true) clause. Better : create a narrowly
-- scoped policy (e.g., SELECT USING (some_condition)) for the actual
-- legitimate consumer.
--
-- This migration was generated programmatically from the live DB state
-- (advisor + pg_policies query + audit results). Each statement references
-- the actual policy name as it exists in prod.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) DROP 73 legacy {public} USING(true) policies (with individual APPROVED)
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Enable read access for all users" ON public.___footer_menu; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.___header_menu; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "___legal_pages_select_all" ON public.___legal_pages; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.___meta_tags_ariane; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.___xtr_delivery_agent; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.___xtr_delivery_ape_corse; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.___xtr_delivery_ape_domtom1; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.___xtr_delivery_ape_domtom2; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.___xtr_delivery_ape_france; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.___xtr_order_line_status; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.___xtr_order_status; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.___xtr_supplier; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.___xtr_supplier_link_pm; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.__blog_advice; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.__blog_advice_cross; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.__blog_advice_h2; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.__blog_advice_h3; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.__blog_guide; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.__blog_guide_h2; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.__blog_guide_h3; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.__blog_meta_tags_ariane; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.__blog_seo_marque; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.__cross_gamme_car_new; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "editorial_read_all" ON public.__seo_brand_editorial; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.__seo_equip_gamme; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.__seo_family_gamme_car_switch; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.__seo_gamme; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.__seo_gamme_car; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.__seo_gamme_car_switch; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.__seo_gamme_conseil; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.__seo_gamme_info; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "__seo_gamme_purchase_guide_select_all" ON public.__seo_gamme_purchase_guide; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.__seo_item_switch; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.__seo_marque; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "__seo_reference_select_all" ON public.__seo_reference; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.__seo_type_switch; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.__sitemap_blog; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.__sitemap_marque; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.__sitemap_motorisation; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "__sitemap_p_link_select_all" ON public.__sitemap_p_link; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.__sitemap_p_xml; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.__sitemap_search_link; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.am_2022_suppliers; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "auto_marque_select_all" ON public.auto_marque; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "auto_modele_select_all" ON public.auto_modele; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "auto_modele_group_select_all" ON public.auto_modele_group; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "auto_modele_robot_select_all" ON public.auto_modele_robot; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.auto_type; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.auto_type_motor_code; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.auto_type_motor_fuel; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.auto_type_number_code; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.cars_engine; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.catalog_family; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.catalog_gamme; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "gamme_filter_criteria_select_all" ON public.gamme_filter_criteria; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "pieces_select_all" ON public.pieces; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.pieces_criteria; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.pieces_criteria_group; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.pieces_criteria_link; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.pieces_details; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.pieces_gamme; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.pieces_gamme_cross; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.pieces_list; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.pieces_marque; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.pieces_media_img; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.pieces_price; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.pieces_ref_brand; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.pieces_ref_oem; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "pieces_relation_criteria_select_all" ON public.pieces_relation_criteria; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "pieces_side_filtre_select_all" ON public.pieces_side_filtre; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.pieces_status; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "quantity_discounts_select_all" ON public.quantity_discounts; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.
DROP POLICY IF EXISTS "shipping_rates_cache_select_all" ON public.shipping_rates_cache; -- APPROVED: legacy {public} SELECT USING(true) policy on public catalog/SEO/blog/sitemap table — Vague 4b audit confirmed: backend uses service_role only, no frontend supabase-js direct call, no anon-key REST fetch on this table. Replaced by service_role-only policy.

-- -----------------------------------------------------------------------------
-- 2) CREATE 59 service_role policies (idempotent via DO block IF NOT EXISTS)
-- -----------------------------------------------------------------------------

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='___footer_menu' AND policyname='___footer_menu_service_role_all') THEN CREATE POLICY ___footer_menu_service_role_all ON public.___footer_menu AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='___header_menu' AND policyname='___header_menu_service_role_all') THEN CREATE POLICY ___header_menu_service_role_all ON public.___header_menu AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='___meta_tags_ariane' AND policyname='___meta_tags_ariane_service_role_all') THEN CREATE POLICY ___meta_tags_ariane_service_role_all ON public.___meta_tags_ariane AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='___xtr_delivery_agent' AND policyname='___xtr_delivery_agent_service_role_all') THEN CREATE POLICY ___xtr_delivery_agent_service_role_all ON public.___xtr_delivery_agent AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='___xtr_delivery_ape_corse' AND policyname='___xtr_delivery_ape_corse_service_role_all') THEN CREATE POLICY ___xtr_delivery_ape_corse_service_role_all ON public.___xtr_delivery_ape_corse AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='___xtr_delivery_ape_domtom1' AND policyname='___xtr_delivery_ape_domtom1_service_role_all') THEN CREATE POLICY ___xtr_delivery_ape_domtom1_service_role_all ON public.___xtr_delivery_ape_domtom1 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='___xtr_delivery_ape_domtom2' AND policyname='___xtr_delivery_ape_domtom2_service_role_all') THEN CREATE POLICY ___xtr_delivery_ape_domtom2_service_role_all ON public.___xtr_delivery_ape_domtom2 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='___xtr_delivery_ape_france' AND policyname='___xtr_delivery_ape_france_service_role_all') THEN CREATE POLICY ___xtr_delivery_ape_france_service_role_all ON public.___xtr_delivery_ape_france AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='___xtr_order_line_status' AND policyname='___xtr_order_line_status_service_role_all') THEN CREATE POLICY ___xtr_order_line_status_service_role_all ON public.___xtr_order_line_status AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='___xtr_order_status' AND policyname='___xtr_order_status_service_role_all') THEN CREATE POLICY ___xtr_order_status_service_role_all ON public.___xtr_order_status AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='___xtr_supplier' AND policyname='___xtr_supplier_service_role_all') THEN CREATE POLICY ___xtr_supplier_service_role_all ON public.___xtr_supplier AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='___xtr_supplier_link_pm' AND policyname='___xtr_supplier_link_pm_service_role_all') THEN CREATE POLICY ___xtr_supplier_link_pm_service_role_all ON public.___xtr_supplier_link_pm AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__blog_advice' AND policyname='__blog_advice_service_role_all') THEN CREATE POLICY __blog_advice_service_role_all ON public.__blog_advice AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__blog_advice_cross' AND policyname='__blog_advice_cross_service_role_all') THEN CREATE POLICY __blog_advice_cross_service_role_all ON public.__blog_advice_cross AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__blog_advice_h2' AND policyname='__blog_advice_h2_service_role_all') THEN CREATE POLICY __blog_advice_h2_service_role_all ON public.__blog_advice_h2 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__blog_advice_h3' AND policyname='__blog_advice_h3_service_role_all') THEN CREATE POLICY __blog_advice_h3_service_role_all ON public.__blog_advice_h3 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__blog_guide' AND policyname='__blog_guide_service_role_all') THEN CREATE POLICY __blog_guide_service_role_all ON public.__blog_guide AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__blog_guide_h2' AND policyname='__blog_guide_h2_service_role_all') THEN CREATE POLICY __blog_guide_h2_service_role_all ON public.__blog_guide_h2 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__blog_guide_h3' AND policyname='__blog_guide_h3_service_role_all') THEN CREATE POLICY __blog_guide_h3_service_role_all ON public.__blog_guide_h3 AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__blog_meta_tags_ariane' AND policyname='__blog_meta_tags_ariane_service_role_all') THEN CREATE POLICY __blog_meta_tags_ariane_service_role_all ON public.__blog_meta_tags_ariane AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__blog_seo_marque' AND policyname='__blog_seo_marque_service_role_all') THEN CREATE POLICY __blog_seo_marque_service_role_all ON public.__blog_seo_marque AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__cross_gamme_car_new' AND policyname='__cross_gamme_car_new_service_role_all') THEN CREATE POLICY __cross_gamme_car_new_service_role_all ON public.__cross_gamme_car_new AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_brand_editorial' AND policyname='__seo_brand_editorial_service_role_all') THEN CREATE POLICY __seo_brand_editorial_service_role_all ON public.__seo_brand_editorial AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_equip_gamme' AND policyname='__seo_equip_gamme_service_role_all') THEN CREATE POLICY __seo_equip_gamme_service_role_all ON public.__seo_equip_gamme AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_family_gamme_car_switch' AND policyname='__seo_family_gamme_car_switch_service_role_all') THEN CREATE POLICY __seo_family_gamme_car_switch_service_role_all ON public.__seo_family_gamme_car_switch AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_gamme' AND policyname='__seo_gamme_service_role_all') THEN CREATE POLICY __seo_gamme_service_role_all ON public.__seo_gamme AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_gamme_car' AND policyname='__seo_gamme_car_service_role_all') THEN CREATE POLICY __seo_gamme_car_service_role_all ON public.__seo_gamme_car AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_gamme_car_switch' AND policyname='__seo_gamme_car_switch_service_role_all') THEN CREATE POLICY __seo_gamme_car_switch_service_role_all ON public.__seo_gamme_car_switch AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_gamme_conseil' AND policyname='__seo_gamme_conseil_service_role_all') THEN CREATE POLICY __seo_gamme_conseil_service_role_all ON public.__seo_gamme_conseil AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_gamme_info' AND policyname='__seo_gamme_info_service_role_all') THEN CREATE POLICY __seo_gamme_info_service_role_all ON public.__seo_gamme_info AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_item_switch' AND policyname='__seo_item_switch_service_role_all') THEN CREATE POLICY __seo_item_switch_service_role_all ON public.__seo_item_switch AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_marque' AND policyname='__seo_marque_service_role_all') THEN CREATE POLICY __seo_marque_service_role_all ON public.__seo_marque AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__seo_type_switch' AND policyname='__seo_type_switch_service_role_all') THEN CREATE POLICY __seo_type_switch_service_role_all ON public.__seo_type_switch AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__sitemap_blog' AND policyname='__sitemap_blog_service_role_all') THEN CREATE POLICY __sitemap_blog_service_role_all ON public.__sitemap_blog AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__sitemap_marque' AND policyname='__sitemap_marque_service_role_all') THEN CREATE POLICY __sitemap_marque_service_role_all ON public.__sitemap_marque AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__sitemap_motorisation' AND policyname='__sitemap_motorisation_service_role_all') THEN CREATE POLICY __sitemap_motorisation_service_role_all ON public.__sitemap_motorisation AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__sitemap_p_xml' AND policyname='__sitemap_p_xml_service_role_all') THEN CREATE POLICY __sitemap_p_xml_service_role_all ON public.__sitemap_p_xml AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='__sitemap_search_link' AND policyname='__sitemap_search_link_service_role_all') THEN CREATE POLICY __sitemap_search_link_service_role_all ON public.__sitemap_search_link AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='am_2022_suppliers' AND policyname='am_2022_suppliers_service_role_all') THEN CREATE POLICY am_2022_suppliers_service_role_all ON public.am_2022_suppliers AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='auto_type' AND policyname='auto_type_service_role_all') THEN CREATE POLICY auto_type_service_role_all ON public.auto_type AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='auto_type_motor_code' AND policyname='auto_type_motor_code_service_role_all') THEN CREATE POLICY auto_type_motor_code_service_role_all ON public.auto_type_motor_code AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='auto_type_motor_fuel' AND policyname='auto_type_motor_fuel_service_role_all') THEN CREATE POLICY auto_type_motor_fuel_service_role_all ON public.auto_type_motor_fuel AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='auto_type_number_code' AND policyname='auto_type_number_code_service_role_all') THEN CREATE POLICY auto_type_number_code_service_role_all ON public.auto_type_number_code AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='cars_engine' AND policyname='cars_engine_service_role_all') THEN CREATE POLICY cars_engine_service_role_all ON public.cars_engine AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='catalog_family' AND policyname='catalog_family_service_role_all') THEN CREATE POLICY catalog_family_service_role_all ON public.catalog_family AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='catalog_gamme' AND policyname='catalog_gamme_service_role_all') THEN CREATE POLICY catalog_gamme_service_role_all ON public.catalog_gamme AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pieces_criteria' AND policyname='pieces_criteria_service_role_all') THEN CREATE POLICY pieces_criteria_service_role_all ON public.pieces_criteria AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pieces_criteria_group' AND policyname='pieces_criteria_group_service_role_all') THEN CREATE POLICY pieces_criteria_group_service_role_all ON public.pieces_criteria_group AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pieces_criteria_link' AND policyname='pieces_criteria_link_service_role_all') THEN CREATE POLICY pieces_criteria_link_service_role_all ON public.pieces_criteria_link AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pieces_details' AND policyname='pieces_details_service_role_all') THEN CREATE POLICY pieces_details_service_role_all ON public.pieces_details AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pieces_gamme' AND policyname='pieces_gamme_service_role_all') THEN CREATE POLICY pieces_gamme_service_role_all ON public.pieces_gamme AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pieces_gamme_cross' AND policyname='pieces_gamme_cross_service_role_all') THEN CREATE POLICY pieces_gamme_cross_service_role_all ON public.pieces_gamme_cross AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pieces_list' AND policyname='pieces_list_service_role_all') THEN CREATE POLICY pieces_list_service_role_all ON public.pieces_list AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pieces_marque' AND policyname='pieces_marque_service_role_all') THEN CREATE POLICY pieces_marque_service_role_all ON public.pieces_marque AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pieces_media_img' AND policyname='pieces_media_img_service_role_all') THEN CREATE POLICY pieces_media_img_service_role_all ON public.pieces_media_img AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pieces_price' AND policyname='pieces_price_service_role_all') THEN CREATE POLICY pieces_price_service_role_all ON public.pieces_price AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pieces_ref_brand' AND policyname='pieces_ref_brand_service_role_all') THEN CREATE POLICY pieces_ref_brand_service_role_all ON public.pieces_ref_brand AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pieces_ref_oem' AND policyname='pieces_ref_oem_service_role_all') THEN CREATE POLICY pieces_ref_oem_service_role_all ON public.pieces_ref_oem AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pieces_status' AND policyname='pieces_status_service_role_all') THEN CREATE POLICY pieces_status_service_role_all ON public.pieces_status AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;

-- -----------------------------------------------------------------------------
-- 3) REVOKE 73x anon/authenticated grants (defense in depth)
-- -----------------------------------------------------------------------------

REVOKE ALL ON public.___footer_menu FROM anon, authenticated;
REVOKE ALL ON public.___header_menu FROM anon, authenticated;
REVOKE ALL ON public.___legal_pages FROM anon, authenticated;
REVOKE ALL ON public.___meta_tags_ariane FROM anon, authenticated;
REVOKE ALL ON public.___xtr_delivery_agent FROM anon, authenticated;
REVOKE ALL ON public.___xtr_delivery_ape_corse FROM anon, authenticated;
REVOKE ALL ON public.___xtr_delivery_ape_domtom1 FROM anon, authenticated;
REVOKE ALL ON public.___xtr_delivery_ape_domtom2 FROM anon, authenticated;
REVOKE ALL ON public.___xtr_delivery_ape_france FROM anon, authenticated;
REVOKE ALL ON public.___xtr_order_line_status FROM anon, authenticated;
REVOKE ALL ON public.___xtr_order_status FROM anon, authenticated;
REVOKE ALL ON public.___xtr_supplier FROM anon, authenticated;
REVOKE ALL ON public.___xtr_supplier_link_pm FROM anon, authenticated;
REVOKE ALL ON public.__blog_advice FROM anon, authenticated;
REVOKE ALL ON public.__blog_advice_cross FROM anon, authenticated;
REVOKE ALL ON public.__blog_advice_h2 FROM anon, authenticated;
REVOKE ALL ON public.__blog_advice_h3 FROM anon, authenticated;
REVOKE ALL ON public.__blog_guide FROM anon, authenticated;
REVOKE ALL ON public.__blog_guide_h2 FROM anon, authenticated;
REVOKE ALL ON public.__blog_guide_h3 FROM anon, authenticated;
REVOKE ALL ON public.__blog_meta_tags_ariane FROM anon, authenticated;
REVOKE ALL ON public.__blog_seo_marque FROM anon, authenticated;
REVOKE ALL ON public.__cross_gamme_car_new FROM anon, authenticated;
REVOKE ALL ON public.__seo_brand_editorial FROM anon, authenticated;
REVOKE ALL ON public.__seo_equip_gamme FROM anon, authenticated;
REVOKE ALL ON public.__seo_family_gamme_car_switch FROM anon, authenticated;
REVOKE ALL ON public.__seo_gamme FROM anon, authenticated;
REVOKE ALL ON public.__seo_gamme_car FROM anon, authenticated;
REVOKE ALL ON public.__seo_gamme_car_switch FROM anon, authenticated;
REVOKE ALL ON public.__seo_gamme_conseil FROM anon, authenticated;
REVOKE ALL ON public.__seo_gamme_info FROM anon, authenticated;
REVOKE ALL ON public.__seo_gamme_purchase_guide FROM anon, authenticated;
REVOKE ALL ON public.__seo_item_switch FROM anon, authenticated;
REVOKE ALL ON public.__seo_marque FROM anon, authenticated;
REVOKE ALL ON public.__seo_reference FROM anon, authenticated;
REVOKE ALL ON public.__seo_type_switch FROM anon, authenticated;
REVOKE ALL ON public.__sitemap_blog FROM anon, authenticated;
REVOKE ALL ON public.__sitemap_marque FROM anon, authenticated;
REVOKE ALL ON public.__sitemap_motorisation FROM anon, authenticated;
REVOKE ALL ON public.__sitemap_p_link FROM anon, authenticated;
REVOKE ALL ON public.__sitemap_p_xml FROM anon, authenticated;
REVOKE ALL ON public.__sitemap_search_link FROM anon, authenticated;
REVOKE ALL ON public.am_2022_suppliers FROM anon, authenticated;
REVOKE ALL ON public.auto_marque FROM anon, authenticated;
REVOKE ALL ON public.auto_modele FROM anon, authenticated;
REVOKE ALL ON public.auto_modele_group FROM anon, authenticated;
REVOKE ALL ON public.auto_modele_robot FROM anon, authenticated;
REVOKE ALL ON public.auto_type FROM anon, authenticated;
REVOKE ALL ON public.auto_type_motor_code FROM anon, authenticated;
REVOKE ALL ON public.auto_type_motor_fuel FROM anon, authenticated;
REVOKE ALL ON public.auto_type_number_code FROM anon, authenticated;
REVOKE ALL ON public.cars_engine FROM anon, authenticated;
REVOKE ALL ON public.catalog_family FROM anon, authenticated;
REVOKE ALL ON public.catalog_gamme FROM anon, authenticated;
REVOKE ALL ON public.gamme_filter_criteria FROM anon, authenticated;
REVOKE ALL ON public.pieces FROM anon, authenticated;
REVOKE ALL ON public.pieces_criteria FROM anon, authenticated;
REVOKE ALL ON public.pieces_criteria_group FROM anon, authenticated;
REVOKE ALL ON public.pieces_criteria_link FROM anon, authenticated;
REVOKE ALL ON public.pieces_details FROM anon, authenticated;
REVOKE ALL ON public.pieces_gamme FROM anon, authenticated;
REVOKE ALL ON public.pieces_gamme_cross FROM anon, authenticated;
REVOKE ALL ON public.pieces_list FROM anon, authenticated;
REVOKE ALL ON public.pieces_marque FROM anon, authenticated;
REVOKE ALL ON public.pieces_media_img FROM anon, authenticated;
REVOKE ALL ON public.pieces_price FROM anon, authenticated;
REVOKE ALL ON public.pieces_ref_brand FROM anon, authenticated;
REVOKE ALL ON public.pieces_ref_oem FROM anon, authenticated;
REVOKE ALL ON public.pieces_relation_criteria FROM anon, authenticated;
REVOKE ALL ON public.pieces_side_filtre FROM anon, authenticated;
REVOKE ALL ON public.pieces_status FROM anon, authenticated;
REVOKE ALL ON public.quantity_discounts FROM anon, authenticated;
REVOKE ALL ON public.shipping_rates_cache FROM anon, authenticated;

COMMIT;

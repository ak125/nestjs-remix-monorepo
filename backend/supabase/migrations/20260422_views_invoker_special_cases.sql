-- =============================================================================
-- Migration : SECURITY DEFINER views — special cases (Vague 3f / final)
-- Date      : 2026-04-22
-- Severity  : MEDIUM (Supabase advisor — security_definer_view)
-- Scope     : Vague 3f / 7 — 4 INVOKER + 3 KEEP DEFINER, all 7 REVOKE
-- =============================================================================
--
-- Two strategies in this final vague :
--
-- A) CONVERT INVOKER + REVOKE (4 views)
--    Investigated callsites (cf. .spec/reports/security/vague3-…audit-…)
--    confirmed these views are accessed only from backend service_role.
--    No frontend supabase-js, no anon callsite.
--      - __sitemap_p_link_index   (sitemap generator backend service_role)
--      - __sitemap_vehicules      (sitemap generator backend service_role)
--      - __pg_gammes              (catalog alias view, 7+ backend usages)
--      - v_pieces_seo_safe        (orphaned, no callsite — locking down)
--
-- B) KEEP DEFINER + REVOKE (3 views)
--    These views read from `tecdoc_map` and/or `tecdoc_raw` schemas.
--    `service_role` does NOT have USAGE on those schemas (verified
--    2026-04-22 via has_schema_privilege). Converting to INVOKER would
--    break service_role consumers because the caller (service_role) lacks
--    cross-schema access. The advisor `security_definer_view` flag will
--    persist on these 3 views — but the actual public exposure is closed
--    via REVOKE. Resolving the advisor flag fully requires either granting
--    USAGE on tecdoc_* to service_role (broader change) or replacing the
--    DEFINER pattern with a SECURITY INVOKER function — both out of scope
--    of this PR.
--      - __tecdoc_losch_log                (reads tecdoc_map.losch_log)
--      - v_tecdoc_dlnr_reconciliation      (reads tecdoc_map.* + tecdoc_raw.t400)
--      - v_tecdoc_unlinked_pieces_reason   (reads tecdoc_map.* via subqueries)
--
-- Backend impact
-- --------------
-- Zero. All consumers are admin tooling / RPC backend (service_role).
-- Frontend has no direct supabase-js calls.
--
-- Smoke-tested in transaction on prod DB 2026-04-22:
--   4 INVOKER views: options=security_invoker=true, public_grants=0
--   3 KEEP DEFINER views: options=null (DEFINER), public_grants=0
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- A) CONVERT INVOKER + REVOKE (4 views)
-- -----------------------------------------------------------------------------

ALTER VIEW public.__sitemap_p_link_index   SET (security_invoker = true);
ALTER VIEW public.__sitemap_vehicules      SET (security_invoker = true);
ALTER VIEW public.__pg_gammes              SET (security_invoker = true);
ALTER VIEW public.v_pieces_seo_safe        SET (security_invoker = true);

REVOKE ALL ON public.__sitemap_p_link_index FROM anon, authenticated;
REVOKE ALL ON public.__sitemap_vehicules    FROM anon, authenticated;
REVOKE ALL ON public.__pg_gammes            FROM anon, authenticated;
REVOKE ALL ON public.v_pieces_seo_safe      FROM anon, authenticated;

-- -----------------------------------------------------------------------------
-- B) KEEP DEFINER + REVOKE only (3 views — cross-schema tecdoc constraint)
-- -----------------------------------------------------------------------------

REVOKE ALL ON public.__tecdoc_losch_log              FROM anon, authenticated;
REVOKE ALL ON public.v_tecdoc_dlnr_reconciliation    FROM anon, authenticated;
REVOKE ALL ON public.v_tecdoc_unlinked_pieces_reason FROM anon, authenticated;

COMMIT;

-- =============================================================================
-- Post-migration verification
-- =============================================================================
--   SELECT relname, array_to_string(reloptions, ',') AS options FROM pg_class
--   WHERE relname IN (... above 7 views ...) AND relkind = 'v';
--
--   SELECT grantee, table_name FROM information_schema.role_table_grants
--   WHERE table_name IN (... above 7 views ...)
--     AND grantee IN ('anon','authenticated');
--   -- expected : 0 rows (REVOKE applied to all 7)
-- =============================================================================

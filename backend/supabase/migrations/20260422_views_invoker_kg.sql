-- =============================================================================
-- Migration : Convert KG views from SECURITY DEFINER to SECURITY INVOKER (Vague 3a)
-- Date      : 2026-04-22
-- Severity  : MEDIUM (Supabase advisor — security_definer_view)
-- Scope     : Vague 3a / 7 — 10 KG (Knowledge Graph) views
-- =============================================================================
--
-- Problem
-- -------
-- These 10 views are currently `SECURITY DEFINER`, which means they execute
-- with the rights of the view creator (typically `postgres` superuser) instead
-- of the caller's rights. Combined with the FULL anon/authenticated grants
-- (now obsolete), this allows any caller with the `SUPABASE_ANON_KEY` to read
-- KG data via PostgREST — bypassing the RLS we just put on `kg_*` tables in
-- vagues 1-2e.
--
-- Views covered (audit cf. .spec/reports/security/vague3-security-definer-views-audit-20260422.md)
--
--   - kg_active_nodes              (kg_nodes lookup)
--   - kg_active_edges              (kg_edges lookup)
--   - kg_diagnosis_stats           (kg_edges + kg_nodes aggregate)
--   - kg_observables_with_context  (kg_nodes lookup)
--   - kg_feedback_stats            (kg_feedback_events + kg_nodes aggregate)
--   - kg_maintenance_summary       (kg_edges + kg_nodes aggregate)
--   - kg_truth_labels_dashboard    (kg_nodes aggregate)
--   - kg_truth_labels_stats        (kg_truth_labels aggregate)
--   - kg_rag_sync_stats            (kg_rag_sync_log aggregate)
--   - kg_rag_sync_errors           (kg_rag_sync_log filter)
--
-- Backend impact
-- --------------
-- All callers are backend service_role (BYPASSRLS) — zero runtime impact.
-- Frontend has NO direct supabase-js calls to these views. Confirmed via
-- exhaustive grep on backend/src and frontend/app.
--
-- Strategy
-- --------
--   1. ALTER VIEW … SET (security_invoker = true) — view runs with caller's
--      rights, respecting RLS on underlying tables.
--   2. REVOKE ALL on anon, authenticated — close the public surface in
--      defense-in-depth (in addition to RLS on underlying tables).
--   3. service_role keeps access via BYPASSRLS (no explicit GRANT needed,
--      and tables already have service_role policies from vagues 1-2e).
--
-- Smoke-tested in transaction (BEGIN/ROLLBACK) on prod DB 2026-04-22:
--   options=security_invoker=true on all 10 views, public_grants=0.
--
-- Idempotency : ALTER VIEW SET option is idempotent. REVOKE on already-empty
-- grants is a no-op.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) Convert all 10 KG views to SECURITY INVOKER
-- -----------------------------------------------------------------------------

ALTER VIEW public.kg_active_nodes              SET (security_invoker = true);
ALTER VIEW public.kg_active_edges              SET (security_invoker = true);
ALTER VIEW public.kg_diagnosis_stats           SET (security_invoker = true);
ALTER VIEW public.kg_observables_with_context  SET (security_invoker = true);
ALTER VIEW public.kg_feedback_stats            SET (security_invoker = true);
ALTER VIEW public.kg_maintenance_summary       SET (security_invoker = true);
ALTER VIEW public.kg_truth_labels_dashboard    SET (security_invoker = true);
ALTER VIEW public.kg_truth_labels_stats        SET (security_invoker = true);
ALTER VIEW public.kg_rag_sync_stats            SET (security_invoker = true);
ALTER VIEW public.kg_rag_sync_errors           SET (security_invoker = true);

-- -----------------------------------------------------------------------------
-- 2) REVOKE public role grants (defense in depth)
-- -----------------------------------------------------------------------------

REVOKE ALL ON public.kg_active_nodes              FROM anon, authenticated;
REVOKE ALL ON public.kg_active_edges              FROM anon, authenticated;
REVOKE ALL ON public.kg_diagnosis_stats           FROM anon, authenticated;
REVOKE ALL ON public.kg_observables_with_context  FROM anon, authenticated;
REVOKE ALL ON public.kg_feedback_stats            FROM anon, authenticated;
REVOKE ALL ON public.kg_maintenance_summary       FROM anon, authenticated;
REVOKE ALL ON public.kg_truth_labels_dashboard    FROM anon, authenticated;
REVOKE ALL ON public.kg_truth_labels_stats        FROM anon, authenticated;
REVOKE ALL ON public.kg_rag_sync_stats            FROM anon, authenticated;
REVOKE ALL ON public.kg_rag_sync_errors           FROM anon, authenticated;

COMMIT;

-- =============================================================================
-- Post-migration verification (run manually after apply)
-- =============================================================================
--
--   SELECT relname, array_to_string(reloptions, ',') AS options
--   FROM   pg_class
--   WHERE  relname LIKE 'kg_%' AND relkind = 'v';
--   -- expected : 'security_invoker=true' on all 10 KG views
--
--   SELECT grantee, table_name
--   FROM   information_schema.role_table_grants
--   WHERE  table_name LIKE 'kg_%' AND grantee IN ('anon','authenticated');
--   -- expected : 0 rows for the 10 KG views
--
--   -- Re-run Supabase advisor : the 10 `security_definer_view` rows for
--   -- kg_* views must disappear.
--
-- =============================================================================

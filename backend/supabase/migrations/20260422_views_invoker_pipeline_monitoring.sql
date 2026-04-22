-- =============================================================================
-- Migration : Convert pipeline + DB monitoring views to SECURITY INVOKER (Vague 3c)
-- Date      : 2026-04-22
-- Severity  : MEDIUM (Supabase advisor — security_definer_view)
-- Scope     : Vague 3c / 7 — 9 views (pipeline 5 + DB monitoring 4)
-- =============================================================================
--
-- Views covered (cf. .spec/reports/security/vague3-security-definer-views-audit-20260422.md)
--
-- A) Pipeline & substitution (5)
--   - v_pipeline_dashboard       (pipeline_event_log)
--   - v_pipeline_batch_summary   (pipeline_event_log aggregate)
--   - v_pipeline_step_stats      (pipeline_event_log aggregate)
--   - v_substitution_funnel      (__substitution_logs aggregate)
--   - v_substitution_daily       (__substitution_logs aggregate)
--
-- B) DB monitoring (4)
--   - v_index_usage              (pg_stat_user_indexes)
--   - v_table_health             (pg_stat_user_tables)
--   - v_performance_monitoring   (pg_stat_user_tables)
--   - v_import_lock_status       (pipeline_event_log + is_import_running())
--
-- Backend impact
-- --------------
-- Zero. All consumers are admin tools / RPC backend (service_role). Frontend
-- has no direct supabase-js calls. The 4 DB monitoring views read pg_stat_*
-- system views which are world-readable in Postgres (no RLS impact).
--
-- Strategy : same as vagues 3a/3b.
--   1. ALTER VIEW … SET (security_invoker = true)
--   2. REVOKE ALL on anon, authenticated
--   3. service_role keeps access via BYPASSRLS
--
-- Smoke-tested in transaction on prod DB 2026-04-22:
--   options=security_invoker=true on all 9 views, public_grants=0.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- A) Pipeline & substitution
-- -----------------------------------------------------------------------------

ALTER VIEW public.v_pipeline_dashboard      SET (security_invoker = true);
ALTER VIEW public.v_pipeline_batch_summary  SET (security_invoker = true);
ALTER VIEW public.v_pipeline_step_stats     SET (security_invoker = true);
ALTER VIEW public.v_substitution_funnel     SET (security_invoker = true);
ALTER VIEW public.v_substitution_daily      SET (security_invoker = true);

REVOKE ALL ON public.v_pipeline_dashboard      FROM anon, authenticated;
REVOKE ALL ON public.v_pipeline_batch_summary  FROM anon, authenticated;
REVOKE ALL ON public.v_pipeline_step_stats     FROM anon, authenticated;
REVOKE ALL ON public.v_substitution_funnel     FROM anon, authenticated;
REVOKE ALL ON public.v_substitution_daily      FROM anon, authenticated;

-- -----------------------------------------------------------------------------
-- B) DB monitoring
-- -----------------------------------------------------------------------------

ALTER VIEW public.v_index_usage             SET (security_invoker = true);
ALTER VIEW public.v_table_health            SET (security_invoker = true);
ALTER VIEW public.v_performance_monitoring  SET (security_invoker = true);
ALTER VIEW public.v_import_lock_status      SET (security_invoker = true);

REVOKE ALL ON public.v_index_usage             FROM anon, authenticated;
REVOKE ALL ON public.v_table_health            FROM anon, authenticated;
REVOKE ALL ON public.v_performance_monitoring  FROM anon, authenticated;
REVOKE ALL ON public.v_import_lock_status      FROM anon, authenticated;

COMMIT;

-- =============================================================================
-- Migration : REVOKE anon EXECUTE — PROVABLY-safe subset only (Vague 5b)
-- Date      : 2026-06-16
-- Severity  : WARN (anon_/authenticated_security_definer_function_executable)
-- Scope     : Vague 5b — the **read-path-verified** subset of the 199 definer-exec
--             WARN deferred from the dropped broad migration #5.
-- =============================================================================
--
-- WHY A NARROW SUBSET (lesson from the dropped #5)
-- -----------------------------------------------
-- The broad "REVOKE EXECUTE FROM PUBLIC on all 130 definer RPCs" (original #5) was
-- DROPPED: in READ_ONLY mode (PREPROD, ADR-028 Option D) the backend runs its WHOLE
-- Supabase client as `anon`, so SECURITY DEFINER page-render RPCs must stay
-- anon-executable or the E2E smoke breaks. So we only revoke functions that are
-- **provably never executed as anon at runtime**:
--
--   • 7 TRIGGER functions — fire in DML context regardless of the EXECUTE grant, and
--     PostgREST does not expose trigger functions as RPC endpoints. Revoke = harmless.
--       enforce_agent_write_scope, fn_kp_validated_enqueue, trg_auto_type_rebuild_cache,
--       trg_invalidate_r1_from_{gamme_links,image_prompts,purchase_guide,seo_gamme}
--   • 6 pg_cron-scheduled functions — invoked by the cron scheduler role (not anon),
--     zero reference in backend/src or scripts (verified by grep). Cron jobs:
--       cwv-{raw,hourly,daily-rum}-rotation, observability-/snapshot-partition-rotation,
--       cwv-trend-divergence-detection.
--       detect_cwv_trend_divergence, maintain_cwv_{daily_rum,hourly,raw}_partitions,
--       maintain_observability_partitions, maintain_snapshot_partitions
--
-- KEPT anon-executable (NOT revoked here) — owner/follow-up (vague-5b-full)
-- -----------------------------------------------------------------------
--   • 114 functions referenced by backend `.rpc()` → run as anon in READ_ONLY → MUST stay.
--   • 8 grep-zero but NOT provably safe: build_vehicle_page_payload (page-render!),
--     check_agent_write_allowed, resolve_agent_write_scope, get_supplier_unified_stats,
--     invalidate_r1_caches, refresh_gamme_seo_dashboard, __load_tecdoc_raw, seo_apply_h1_write.
--     These need per-function read-path verification (may be called by a cache-build /
--     another function on a read route) before any revoke — deferred, NOT guessed.
--   • 7 auth/commerce/payment carveout — owner-gated (vague-5 doc §7).
--
-- IDEMPOTENCY : REVOKE on an already-revoked grant = no-op. service_role keeps EXECUTE
-- (explicit GRANT below + it already holds a direct grant). Reversible.
--   ROLLBACK : GRANT EXECUTE ON FUNCTION public.<fn>(<args>) TO PUBLIC;  -- (restore default)
--
-- NOT auto-applied: shared DB → owner-gated apply (runbook in the vague-5 doc).
-- =============================================================================

BEGIN;

-- Self-verify (fail-closed): the 7 "trigger" functions MUST be RETURNS trigger before we
-- revoke their EXECUTE. A non-trigger here could be a PostgREST-exposed RPC with an anon
-- read-path caller (the exact trap that sank the broad #5) → abort rather than risk it.
-- (Verified 2026-06-16: all 7 have prorettype = trigger; this asserts it at apply time.)
DO $assert$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n
  FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
  WHERE ns.nspname = 'public'
    AND p.proname IN ('enforce_agent_write_scope','fn_kp_validated_enqueue','trg_auto_type_rebuild_cache',
      'trg_invalidate_r1_from_gamme_links','trg_invalidate_r1_from_image_prompts',
      'trg_invalidate_r1_from_purchase_guide','trg_invalidate_r1_from_seo_gamme')
    AND p.prorettype <> 'pg_catalog.trigger'::regtype;
  IF n > 0 THEN
    RAISE EXCEPTION 'vague5b abort: % of the 7 "trigger" fns are NOT RETURNS trigger — re-verify read-path before revoke', n;
  END IF;
END $assert$;

REVOKE EXECUTE ON FUNCTION public.detect_cwv_trend_divergence() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.detect_cwv_trend_divergence() TO service_role;
REVOKE EXECUTE ON FUNCTION public.enforce_agent_write_scope() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.enforce_agent_write_scope() TO service_role;
REVOKE EXECUTE ON FUNCTION public.fn_kp_validated_enqueue() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_kp_validated_enqueue() TO service_role;
REVOKE EXECUTE ON FUNCTION public.maintain_cwv_daily_rum_partitions(p_lookahead_months integer, p_retention_months integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.maintain_cwv_daily_rum_partitions(p_lookahead_months integer, p_retention_months integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.maintain_cwv_hourly_partitions(p_lookahead_days integer, p_retention_days integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.maintain_cwv_hourly_partitions(p_lookahead_days integer, p_retention_days integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.maintain_cwv_raw_partitions(p_lookahead_days integer, p_retention_days integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.maintain_cwv_raw_partitions(p_lookahead_days integer, p_retention_days integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.maintain_observability_partitions(p_lookahead_months integer, p_retention_months integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.maintain_observability_partitions(p_lookahead_months integer, p_retention_months integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.maintain_snapshot_partitions(p_lookahead_days integer, p_retention_days integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.maintain_snapshot_partitions(p_lookahead_days integer, p_retention_days integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.trg_auto_type_rebuild_cache() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.trg_auto_type_rebuild_cache() TO service_role;
REVOKE EXECUTE ON FUNCTION public.trg_invalidate_r1_from_gamme_links() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.trg_invalidate_r1_from_gamme_links() TO service_role;
REVOKE EXECUTE ON FUNCTION public.trg_invalidate_r1_from_image_prompts() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.trg_invalidate_r1_from_image_prompts() TO service_role;
REVOKE EXECUTE ON FUNCTION public.trg_invalidate_r1_from_purchase_guide() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.trg_invalidate_r1_from_purchase_guide() TO service_role;
REVOKE EXECUTE ON FUNCTION public.trg_invalidate_r1_from_seo_gamme() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.trg_invalidate_r1_from_seo_gamme() TO service_role;

COMMIT;

-- Post-apply: advisor anon_/authenticated_security_definer_function_executable drops by
-- these 13 functions. Verify backend smoke still green (these are never called as anon).
-- =============================================================================

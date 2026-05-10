-- =============================================================================
-- Migration : Convert v_tecdoc_activation_candidates to SECURITY INVOKER (Vague 3e)
-- Date      : 2026-04-22
-- Severity  : MEDIUM (Supabase advisor — security_definer_view)
-- Scope     : Vague 3e / 7 — 1 view (tecdoc activation candidates, public-only deps)
-- =============================================================================
--
-- View covered
--   v_tecdoc_activation_candidates
--
-- Why this is in vague 3e (separate from vague 3f tecdoc views)
-- -------------------------------------------------------------
-- The other v_tecdoc_* views (v_tecdoc_dlnr_reconciliation,
-- v_tecdoc_unlinked_pieces_reason, __tecdoc_losch_log) read from the
-- `tecdoc_map` and/or `tecdoc_raw` schemas — service_role does NOT have
-- USAGE on those schemas (verified 2026-04-22), so they MUST stay DEFINER.
--
-- This view (v_tecdoc_activation_candidates) reads ONLY from public.* tables
-- (pieces, pieces_marque, pieces_gamme, gamme_aggregates, pieces_relation_type,
-- auto_type, pieces_media_img) — confirmed via pg_get_viewdef inspection.
-- Hence it can safely be converted to SECURITY INVOKER like other public-only
-- views.
--
-- Backend impact
-- --------------
-- Zero. Admin tooling only (service_role). No frontend supabase-js calls.
--
-- Smoke-tested in transaction on prod DB 2026-04-22:
--   options=security_invoker=true, public_grants=0.
-- =============================================================================

BEGIN;

ALTER VIEW public.v_tecdoc_activation_candidates SET (security_invoker = true);
REVOKE ALL ON public.v_tecdoc_activation_candidates FROM anon, authenticated;

COMMIT;

-- =============================================================================
-- Migration : REVOKE anon/authenticated EXECUTE on SECURITY DEFINER RPCs (Vague 5)
-- Date      : 2026-06-16
-- Severity  : WARN (anon_security_definer_function_executable ×62
--                   + authenticated_security_definer_function_executable ×137)
-- Scope     : Vague 5 — 130 SECURITY DEFINER, non-extension public functions that
--             anon/authenticated can EXECUTE. A SECURITY DEFINER function runs with
--             the owner's rights (BYPASSRLS); exposing it to the public anon role is
--             a privilege-escalation surface. This REVOKEs the public-role EXECUTE
--             grant; service_role keeps EXECUTE (functions stay callable server-side).
--
-- RUNTIME-SAFETY EVIDENCE (verified 2026-06-16 — zero impact)
-- ----------------------------------------------------------
--   • Frontend: ZERO @supabase/supabase-js clients / .rpc() / direct anon RPC calls.
--   • Every repo script hitting /rest/v1/rpc/* uses SUPABASE_SERVICE_ROLE_KEY
--     (check-payment-tunnel, check-error-logs-5xx, wiki brand-fiche, table-check).
--   • Backend NestJS uses service_role (ADR-028 Option D anon fallback is read-only
--     PREPROD and does not RPC these). → no anon/authenticated runtime caller exists.
--   • service_role retains EXECUTE (default Supabase grant, not revoked here).
--
-- CARVED OUT — NOT in this migration (owner-gated, see audit doc §Owner actions)
-- ----------------------------------------------------------------------------
-- 7 auth/commerce/payment-sensitive DEFINER functions are anon-executable and must
-- NOT be auto-touched (payments.md). They are a SEPARATE, CRITICAL finding:
--     create_order_atomic, cancel_order_atomic, mark_order_paid_atomic,
--     append_order_event, auth_email_exists, auth_resolve_user,
--     check_payment_tunnel_health
-- → prepared REVOKEs live in the audit doc for explicit owner authorization.
--
-- IDEMPOTENCY : REVOKE on an already-revoked grant is a no-op. Reversible.
--   ROLLBACK : GRANT EXECUTE ON FUNCTION public.<fn>(<args>) TO authenticated;  -- (only if a real need is proven)
--
-- NOT auto-applied: shared DB → owner-gated apply + PREPROD smoke recommended.
-- =============================================================================

BEGIN;

REVOKE EXECUTE ON FUNCTION public.__gov_m1_table_sizes() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.__gov_m1_table_sizes() TO service_role;
REVOKE EXECUTE ON FUNCTION public.__gov_m2_index_sizes() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.__gov_m2_index_sizes() TO service_role;
REVOKE EXECUTE ON FUNCTION public.__gov_m3_stale_stats() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.__gov_m3_stale_stats() TO service_role;
REVOKE EXECUTE ON FUNCTION public.__gov_m4_dead_tuples() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.__gov_m4_dead_tuples() TO service_role;
REVOKE EXECUTE ON FUNCTION public.__gov_m5_seq_scans() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.__gov_m5_seq_scans() TO service_role;
REVOKE EXECUTE ON FUNCTION public.__gov_m6_unused_indexes() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.__gov_m6_unused_indexes() TO service_role;
REVOKE EXECUTE ON FUNCTION public.__load_tecdoc_raw(p_table_id text, p_rows jsonb) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.__load_tecdoc_raw(p_table_id text, p_rows jsonb) TO service_role;
REVOKE EXECUTE ON FUNCTION public.__seo_admin_job_accept(p_job_type text, p_idempotency_key text, p_input jsonb, p_actor text, p_trace_id text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.__seo_admin_job_accept(p_job_type text, p_idempotency_key text, p_input jsonb, p_actor text, p_trace_id text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.__seo_admin_job_transition(p_job_id uuid, p_new_status text, p_result jsonb, p_error text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.__seo_admin_job_transition(p_job_id uuid, p_new_status text, p_result jsonb, p_error text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.__seo_outbox_claim_batch(p_limit integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.__seo_outbox_claim_batch(p_limit integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.__seo_r8_publish_snapshot(p_type_id bigint, p_version_sha text, p_disambiguation_signature jsonb, p_enrichment_status text, p_source_lineage jsonb, p_event_reason text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.__seo_r8_publish_snapshot(p_type_id bigint, p_version_sha text, p_disambiguation_signature jsonb, p_enrichment_status text, p_source_lineage jsonb, p_event_reason text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.acquire_import_lock() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.acquire_import_lock() TO service_role;
REVOKE EXECUTE ON FUNCTION public.add_to_quarantine(p_batch_id integer, p_entity_type character varying, p_source_key character varying, p_reason character varying, p_reason_details jsonb, p_internal_id integer, p_priority integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.add_to_quarantine(p_batch_id integer, p_entity_type character varying, p_source_key character varying, p_reason character varying, p_reason_details jsonb, p_internal_id integer, p_priority integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.aggregate_cwv_daily_rum(p_target_date date) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.aggregate_cwv_daily_rum(p_target_date date) TO service_role;
REVOKE EXECUTE ON FUNCTION public.aggregate_cwv_hourly(p_target_hour timestamp with time zone) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.aggregate_cwv_hourly(p_target_hour timestamp with time zone) TO service_role;
REVOKE EXECUTE ON FUNCTION public.all_gates_passed(p_import_id integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.all_gates_passed(p_import_id integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.append_gamme_alias(p_source_prefix text, p_alias text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.append_gamme_alias(p_source_prefix text, p_alias text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.apply_decisions_shadow(p_batch_id integer, p_entity_type character varying) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.apply_decisions_shadow(p_batch_id integer, p_entity_type character varying) TO service_role;
REVOKE EXECUTE ON FUNCTION public.apply_quarantine_rules(p_batch_id integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.apply_quarantine_rules(p_batch_id integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.build_article_decisions(p_batch_id integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.build_article_decisions(p_batch_id integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.build_brand_decisions(p_batch_id integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.build_brand_decisions(p_batch_id integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.build_gamme_page_payload(p_pg_id integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.build_gamme_page_payload(p_pg_id integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.build_vehicle_page_payload(p_type_id integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.build_vehicle_page_payload(p_type_id integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.can_merge_batch(p_batch_id integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.can_merge_batch(p_batch_id integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.check_agent_write_allowed(p_table text, p_operation text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.check_agent_write_allowed(p_table text, p_operation text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.check_all_gates(p_batch_id integer, p_entity_type character varying) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.check_all_gates(p_batch_id integer, p_entity_type character varying) TO service_role;
REVOKE EXECUTE ON FUNCTION public.check_anti_purge(p_table_name text, p_current_count integer, p_threshold numeric) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.check_anti_purge(p_table_name text, p_current_count integer, p_threshold numeric) TO service_role;
REVOKE EXECUTE ON FUNCTION public.check_breakglass(p_token text, p_table text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.check_breakglass(p_token text, p_table text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.check_error_logs_5xx_threshold(p_window_minutes integer, p_min_count integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.check_error_logs_5xx_threshold(p_window_minutes integer, p_min_count integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.check_gate(p_import_id integer, p_gate_number integer, p_passed boolean, p_details jsonb, p_blocker_reason text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.check_gate(p_import_id integer, p_gate_number integer, p_passed boolean, p_details jsonb, p_blocker_reason text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.check_gate_g0(p_batch_id integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.check_gate_g0(p_batch_id integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.check_gate_g1(p_batch_id integer, p_entity_type character varying) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.check_gate_g1(p_batch_id integer, p_entity_type character varying) TO service_role;
REVOKE EXECUTE ON FUNCTION public.check_gate_g2(p_batch_id integer, p_entity_type character varying) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.check_gate_g2(p_batch_id integer, p_entity_type character varying) TO service_role;
REVOKE EXECUTE ON FUNCTION public.check_gate_g3(p_batch_id integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.check_gate_g3(p_batch_id integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.check_gate_g4(p_batch_id integer, p_entity_type character varying) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.check_gate_g4(p_batch_id integer, p_entity_type character varying) TO service_role;
REVOKE EXECUTE ON FUNCTION public.check_manifest_complete(p_import_id integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.check_manifest_complete(p_import_id integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_pipeline_logs(p_days integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.cleanup_old_pipeline_logs(p_days integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.complete_pipeline_step(p_batch_id integer, p_step character varying, p_counts jsonb, p_status character varying, p_error text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.complete_pipeline_step(p_batch_id integer, p_step character varying, p_counts jsonb, p_status character varying, p_error text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.create_batch_contract(p_import_id integer, p_entity_type character varying, p_expected_count integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.create_batch_contract(p_import_id integer, p_entity_type character varying, p_expected_count integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.create_batch_contract_v2(p_batch_id integer, p_entity_type character varying, p_expected_count integer, p_expected_tables text[], p_min_rowcounts jsonb, p_source_checksums jsonb, p_source_version character varying) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.create_batch_contract_v2(p_batch_id integer, p_entity_type character varying, p_expected_count integer, p_expected_tables text[], p_min_rowcounts jsonb, p_source_checksums jsonb, p_source_version character varying) TO service_role;
REVOKE EXECUTE ON FUNCTION public.create_composite_index_async(p_table_name text, p_columns text[], p_include_columns text[], p_index_name text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.create_composite_index_async(p_table_name text, p_columns text[], p_include_columns text[], p_index_name text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.create_import_batch(p_source_system character varying, p_source_file character varying, p_source_hash character varying, p_metadata jsonb) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.create_import_batch(p_source_system character varying, p_source_file character varying, p_source_hash character varying, p_metadata jsonb) TO service_role;
REVOKE EXECUTE ON FUNCTION public.create_index_async(p_table_name text, p_column_name text, p_index_name text, p_index_type text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.create_index_async(p_table_name text, p_column_name text, p_index_name text, p_index_type text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.create_rm_listing_products_partition(p_gamme_id integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.create_rm_listing_products_partition(p_gamme_id integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.detect_cwv_trend_divergence() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.detect_cwv_trend_divergence() TO service_role;
REVOKE EXECUTE ON FUNCTION public.detect_quality_outliers(p_window_days integer, p_drop_pct numeric, p_role_id text, p_metric_name text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.detect_quality_outliers(p_window_days integer, p_drop_pct numeric, p_role_id text, p_metric_name text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.diagnose_symptoms(p_symptoms text[], p_context jsonb) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.diagnose_symptoms(p_symptoms text[], p_context jsonb) TO service_role;
REVOKE EXECUTE ON FUNCTION public.enforce_agent_write_scope() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.enforce_agent_write_scope() TO service_role;
REVOKE EXECUTE ON FUNCTION public.ensure_next_quality_history_partition() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.ensure_next_quality_history_partition() TO service_role;
REVOKE EXECUTE ON FUNCTION public.ensure_rm_partition(p_gamme_id integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.ensure_rm_partition(p_gamme_id integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.execute_diff_apply_workflow(p_batch_id integer, p_entity_type character varying, p_auto_switch boolean) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.execute_diff_apply_workflow(p_batch_id integer, p_entity_type character varying, p_auto_switch boolean) TO service_role;
REVOKE EXECUTE ON FUNCTION public.fail_pipeline_step(p_batch_id integer, p_step character varying, p_error text, p_counts jsonb) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.fail_pipeline_step(p_batch_id integer, p_step character varying, p_error text, p_counts jsonb) TO service_role;
REVOKE EXECUTE ON FUNCTION public.finalize_import_batch(p_batch_id integer, p_status character varying) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.finalize_import_batch(p_batch_id integer, p_status character varying) TO service_role;
REVOKE EXECUTE ON FUNCTION public.fn_kp_validated_enqueue() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_kp_validated_enqueue() TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_batch_report(p_batch_id integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_batch_report(p_batch_id integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_brand_bestsellers_optimized(p_marque_id integer, p_limit_vehicles integer, p_limit_parts integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_brand_bestsellers_optimized(p_marque_id integer, p_limit_vehicles integer, p_limit_parts integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_brand_page_data_optimized(p_marque_id integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_brand_page_data_optimized(p_marque_id integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_context_questions(p_subsystem character varying) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_context_questions(p_subsystem character varying) TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_cwv_dashboard(p_from_date date, p_to_date date, p_priority_tier text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_cwv_dashboard(p_from_date date, p_to_date date, p_priority_tier text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_cwv_funnel_correlation(p_from_ts timestamp with time zone, p_to_ts timestamp with time zone) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_cwv_funnel_correlation(p_from_ts timestamp with time zone, p_to_ts timestamp with time zone) TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_decision_report(p_batch_id integer, p_entity_type character varying) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_decision_report(p_batch_id integer, p_entity_type character varying) TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_gamme_page_data_cached(p_pg_id integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_gamme_page_data_cached(p_pg_id integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_gamme_page_data_optimized(p_pg_id integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_gamme_page_data_optimized(p_pg_id integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_homepage_data_optimized() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_homepage_data_optimized() TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_import_gate_report(p_import_id integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_import_gate_report(p_import_id integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_nk_stats() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_nk_stats() TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_observe_only_impact_stats(p_days integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_observe_only_impact_stats(p_days integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_oem_refs_for_vehicle(p_type_id integer, p_pg_id integer, p_marque_name text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_oem_refs_for_vehicle(p_type_id integer, p_pg_id integer, p_marque_name text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_or_create_brand_nk(p_brand_name text, p_internal_id integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_or_create_brand_nk(p_brand_name text, p_internal_id integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_piece_detail(p_piece_id integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_piece_detail(p_piece_id integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_pieces_for_type_gamme(p_type_id integer, p_pg_id integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_pieces_for_type_gamme(p_type_id integer, p_pg_id integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_pieces_for_type_gamme_v2(p_type_id integer, p_pg_id integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_pieces_for_type_gamme_v2(p_type_id integer, p_pg_id integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_pieces_for_type_gamme_v3(p_type_id integer, p_pg_id integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_pieces_for_type_gamme_v3(p_type_id integer, p_pg_id integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_pieces_for_type_gamme_v4(p_type_id integer, p_pg_id integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_pieces_for_type_gamme_v4(p_type_id integer, p_pg_id integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_purchase_excluded_ids() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_purchase_excluded_ids() TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_quarantine_dashboard(p_status character varying, p_entity_type character varying, p_batch_id integer, p_limit integer, p_offset integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_quarantine_dashboard(p_status character varying, p_entity_type character varying, p_batch_id integer, p_limit integer, p_offset integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_quarantine_stats() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_quarantine_stats() TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_r1_related_blocks_cached(p_pg_id integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_r1_related_blocks_cached(p_pg_id integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_rag_coverage_summary() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_rag_coverage_summary() TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_seo_excluded_ids(p_entity_type character varying) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_seo_excluded_ids(p_entity_type character varying) TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_seo_reference_by_slug(p_slug text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_seo_reference_by_slug(p_slug text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_soft_404_alternatives(p_type_id bigint, p_pg_id bigint, p_limit integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_soft_404_alternatives(p_type_id bigint, p_pg_id bigint, p_limit integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_substitution_data(p_gamme_alias text, p_marque_alias text, p_modele_alias text, p_type_alias text, p_gamme_id integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_substitution_data(p_gamme_alias text, p_marque_alias text, p_modele_alias text, p_type_alias text, p_gamme_id integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_supplier_unified_stats(p_search text, p_display text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_supplier_unified_stats(p_search text, p_display text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_symptoms_by_subsystem(p_subsystem character varying) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_symptoms_by_subsystem(p_subsystem character varying) TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_vehicle_page_data_cached(p_type_id integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_vehicle_page_data_cached(p_type_id integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.grant_breakglass(p_token text, p_granted_by text, p_reason text, p_tables text[], p_hours integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.grant_breakglass(p_token text, p_granted_by text, p_reason text, p_tables text[], p_hours integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.init_import_gates(p_import_id integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.init_import_gates(p_import_id integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.invalidate_r1_caches(p_pg_id integer, p_reason text, p_targets text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.invalidate_r1_caches(p_pg_id integer, p_reason text, p_targets text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.is_quarantined(p_entity_type character varying, p_internal_id integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.is_quarantined(p_entity_type character varying, p_internal_id integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.list_active_breakglass() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.list_active_breakglass() TO service_role;
REVOKE EXECUTE ON FUNCTION public.log_pipeline_event(p_batch_id integer, p_step character varying, p_context jsonb) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.log_pipeline_event(p_batch_id integer, p_step character varying, p_context jsonb) TO service_role;
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
REVOKE EXECUTE ON FUNCTION public.mark_stale_with_followup_rebuild(p_type_ids integer[], p_reason text, p_rebuild_immediately boolean) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.mark_stale_with_followup_rebuild(p_type_ids integer[], p_reason text, p_rebuild_immediately boolean) TO service_role;
REVOKE EXECUTE ON FUNCTION public.move_decisions_to_quarantine(p_batch_id integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.move_decisions_to_quarantine(p_batch_id integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.normalize_batch_brands(p_batch_id integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.normalize_batch_brands(p_batch_id integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.populate_golden_set(p_limit integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.populate_golden_set(p_limit integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.prepare_shadow_tables(p_batch_id integer, p_entity_type character varying) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.prepare_shadow_tables(p_batch_id integer, p_entity_type character varying) TO service_role;
REVOKE EXECUTE ON FUNCTION public.rebuild_gamme_page_cache(p_pg_id integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.rebuild_gamme_page_cache(p_pg_id integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.rebuild_vehicle_page_cache(p_type_id integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.rebuild_vehicle_page_cache(p_type_id integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.refresh_gamme_seo_dashboard() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.refresh_gamme_seo_dashboard() TO service_role;
REVOKE EXECUTE ON FUNCTION public.refresh_stale_gamme_cache(p_batch_size integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.refresh_stale_gamme_cache(p_batch_size integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.refresh_stale_vehicle_cache(p_batch_size integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.refresh_stale_vehicle_cache(p_batch_size integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.release_import_lock() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.release_import_lock() TO service_role;
REVOKE EXECUTE ON FUNCTION public.resolve_agent_write_scope() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.resolve_agent_write_scope() TO service_role;
REVOKE EXECUTE ON FUNCTION public.resolve_batch_brands(p_batch_id integer, p_source_system character varying) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.resolve_batch_brands(p_batch_id integer, p_source_system character varying) TO service_role;
REVOKE EXECUTE ON FUNCTION public.resolve_brand_multilevel(p_source_system character varying, p_source_key character varying, p_brand_name text, p_batch_id integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.resolve_brand_multilevel(p_source_system character varying, p_source_key character varying, p_brand_name text, p_batch_id integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.resolve_quarantine_item(p_q_id integer, p_action character varying, p_reviewed_by character varying, p_notes text, p_target_internal_id integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.resolve_quarantine_item(p_q_id integer, p_action character varying, p_reviewed_by character varying, p_notes text, p_target_internal_id integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.resolve_type_id_remap(p_old_id integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.resolve_type_id_remap(p_old_id integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.revoke_breakglass(p_id bigint, p_revoked_by text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.revoke_breakglass(p_id bigint, p_revoked_by text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.rm_get_listing_page(p_gamme_id integer, p_vehicle_id bigint, p_filters jsonb, p_sort text, p_page integer, p_per_page integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.rm_get_listing_page(p_gamme_id integer, p_vehicle_id bigint, p_filters jsonb, p_sort text, p_page integer, p_per_page integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.rm_get_page_complete(p_gamme_id integer, p_vehicle_id bigint, p_limit integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.rm_get_page_complete(p_gamme_id integer, p_vehicle_id bigint, p_limit integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.rm_get_page_complete_v2(p_gamme_id integer, p_vehicle_id bigint, p_limit integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.rm_get_page_complete_v2(p_gamme_id integer, p_vehicle_id bigint, p_limit integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.rm_health() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.rm_health() TO service_role;
REVOKE EXECUTE ON FUNCTION public.rollback_switch(p_entity_type character varying) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.rollback_switch(p_entity_type character varying) TO service_role;
REVOKE EXECUTE ON FUNCTION public.run_import_pipeline(p_batch_id integer, p_skip_gates boolean) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.run_import_pipeline(p_batch_id integer, p_skip_gates boolean) TO service_role;
REVOKE EXECUTE ON FUNCTION public.seo_apply_h1_write(p_asset_id text, p_target_table text, p_target_column text, p_target_id_column text, p_target_id_value text, p_h1_value text, p_value_hash text, p_source_kind text, p_source_metadata jsonb, p_actor text, p_policy_name text, p_policy_bundle_sha text, p_input_snapshot jsonb) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.seo_apply_h1_write(p_asset_id text, p_target_table text, p_target_column text, p_target_id_column text, p_target_id_value text, p_h1_value text, p_value_hash text, p_source_kind text, p_source_metadata jsonb, p_actor text, p_policy_name text, p_policy_bundle_sha text, p_input_snapshot jsonb) TO service_role;
REVOKE EXECUTE ON FUNCTION public.switch_to_next(p_entity_type character varying) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.switch_to_next(p_entity_type character varying) TO service_role;
REVOKE EXECUTE ON FUNCTION public.track_soft_404_event(p_pg_id integer, p_type_id integer, p_referrer text, p_ua_class text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.track_soft_404_event(p_pg_id integer, p_type_id integer, p_referrer text, p_ua_class text) TO service_role;
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
REVOKE EXECUTE ON FUNCTION public.update_batch_contract(p_contract_id integer, p_received_count integer, p_validated_count integer, p_rejected_count integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.update_batch_contract(p_contract_id integer, p_received_count integer, p_validated_count integer, p_rejected_count integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.validate_shadow(p_batch_id integer, p_entity_type character varying) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.validate_shadow(p_batch_id integer, p_entity_type character varying) TO service_role;
COMMIT;

-- Post-apply: re-run advisor (security) → anon_/authenticated_security_definer_
-- function_executable drop to the 7 carved-out functions only (closed separately
-- by owner authorization).
-- =============================================================================

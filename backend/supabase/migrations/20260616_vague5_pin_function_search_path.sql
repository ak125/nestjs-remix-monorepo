-- =============================================================================
-- Migration : Pin search_path on mutable-search_path functions (Vague 5)
-- Date      : 2026-06-16
-- Severity  : WARN (Supabase advisor — function_search_path_mutable ×337)
-- Scope     : Vague 5 — 337 non-extension public functions/procedures with no
--             pinned search_path. Prevents search_path-injection (a function with
--             a role-mutable search_path can be hijacked via a malicious schema /
--             pg_temp object), the higher risk being the SECURITY DEFINER ones.
-- =============================================================================
--
-- VALUE CHOICE : `SET search_path = public`
-- -------------------------------------------
-- Matches the project's existing convention (38 of 44 already-pinned functions
-- use exactly `public`; pg_catalog is always implicitly searched first). This is
-- the SAFE retrofit: every function flagged here currently runs with NO pinned
-- path, i.e. resolves against the caller's default path (public) and works today
-- → pinning to `public` preserves resolution. (Supabase's stricter `''` would
-- force full schema-qualification and break unqualified references — rejected.)
-- The 3 in-public extensions (pg_trgm/unaccent/vector) live in `public`, so
-- trigram/vector operators keep resolving under this path.
--
-- SCOPE GUARD : extension-owned functions (pg_depend deptype='e') are excluded —
-- they cannot/should not be ALTERed and are not flagged by the advisor.
--
-- IDEMPOTENCY : ALTER FUNCTION ... SET is idempotent (re-applying sets the same
-- value). No behavior change, no privilege change. Fully reversible.
--   ROLLBACK : ALTER FUNCTION public.<fn>(<args>) RESET search_path;  -- per function
--
-- NOT auto-applied: shared DB → owner-gated apply (runbook in
-- docs/security/vague5-rls-drift-tail-20260616.md).
-- =============================================================================

BEGIN;

ALTER FUNCTION public.__marketing_set_updated_at() SET search_path = public;
ALTER FUNCTION public.__seo_brand_editorial_set_updated_at() SET search_path = public;
ALTER FUNCTION public.__seo_ensure_monthly_partitions(p_months_ahead integer) SET search_path = public;
ALTER FUNCTION public.__seo_observable_updated_at() SET search_path = public;
ALTER FUNCTION public.__seo_r2_set_updated_at() SET search_path = public;
ALTER FUNCTION public.__seo_r8_set_updated_at() SET search_path = public;
ALTER FUNCTION public._seo_is_synthetic_query(p_query text) SET search_path = public;
ALTER FUNCTION public._seo_resolve_operational_domain(p_alert_type text) SET search_path = public;
ALTER FUNCTION public._seo_resolve_surface_key(p_url text) SET search_path = public;
ALTER FUNCTION public._seo_top_queries_for_page_jsonb(p_page text, p_window_days integer, p_now timestamp with time zone, p_limit integer) SET search_path = public;
ALTER FUNCTION public.acquire_import_lock() SET search_path = public;
ALTER FUNCTION public.acquire_rebuild_job(p_worker_id text) SET search_path = public;
ALTER FUNCTION public.add_to_quarantine(p_batch_id integer, p_entity_type character varying, p_source_key character varying, p_reason character varying, p_reason_details jsonb, p_internal_id integer, p_priority integer) SET search_path = public;
ALTER FUNCTION public.aggregate_seo_link_metrics() SET search_path = public;
ALTER FUNCTION public.all_gates_passed(p_import_id integer) SET search_path = public;
ALTER FUNCTION public.analyze_duplicates() SET search_path = public;
ALTER FUNCTION public.append_gamme_alias(p_source_prefix text, p_alias text) SET search_path = public;
ALTER FUNCTION public.apply_decisions_shadow(p_batch_id integer, p_entity_type character varying) SET search_path = public;
ALTER FUNCTION public.apply_quarantine_rules(p_batch_id integer) SET search_path = public;
-- auth_email_exists / auth_resolve_user EXCLUDED — payments.md carveout (owner-gated, doc §7)
ALTER FUNCTION public.auto_promote_to_v1() SET search_path = public;
ALTER FUNCTION public.backfill_seo_keywords_type_ids(p_batch_size integer, p_pg_id integer) SET search_path = public;
ALTER FUNCTION public.build_article_decisions(p_batch_id integer) SET search_path = public;
ALTER FUNCTION public.build_brand_decisions(p_batch_id integer) SET search_path = public;
ALTER FUNCTION public.build_gamme_page_payload(p_pg_id integer) SET search_path = public;
ALTER FUNCTION public.build_vehicle_page_payload(p_type_id integer) SET search_path = public;
ALTER FUNCTION public.calc_article_bf(p_brand_norm text, p_ref_norm text, p_ean text, p_product_type text, p_key_dims text) SET search_path = public;
ALTER FUNCTION public.calc_brand_bf(p_brand_name text) SET search_path = public;
ALTER FUNCTION public.calc_business_fingerprint(VARIADIC p_parts text[]) SET search_path = public;
ALTER FUNCTION public.calc_vehicle_bf(p_make text, p_model text, p_engine text, p_year_from integer, p_year_to integer) SET search_path = public;
ALTER FUNCTION public.calculate_product_score(p_quality rm_quality_enum, p_stock_status rm_stock_status_enum, p_has_image boolean, p_price integer, p_piece_name text, p_gamme_name text) SET search_path = public;
ALTER FUNCTION public.calculate_quality_score(p_issues jsonb) SET search_path = public;
ALTER FUNCTION public.calculate_text_similarity(p_text_a text, p_text_b text) SET search_path = public;
ALTER FUNCTION public.can_merge_batch(p_batch_id integer) SET search_path = public;
ALTER FUNCTION public.catalog_accessory_link_activate(p_batch_id uuid, p_main_pg_id integer, p_accessory_pg_ids integer[], p_operator text, p_dry_run boolean) SET search_path = public;
ALTER FUNCTION public.catalog_accessory_link_rollback_batch(p_batch_id uuid) SET search_path = public;
ALTER FUNCTION public.catalog_activation_plan(p_brand_pm_id integer) SET search_path = public;
ALTER FUNCTION public.catalog_display_activate(p_batch_id uuid, p_supplier text, p_operator text, p_dry_run boolean) SET search_path = public;
ALTER FUNCTION public.catalog_display_quarantine(p_batch_id uuid, p_supplier text, p_operator text, p_dry_run boolean, p_gamme_ids integer[]) SET search_path = public;
ALTER FUNCTION public.catalog_display_rollback_batch(p_batch_id uuid, p_supplier text) SET search_path = public;
ALTER FUNCTION public.catalog_gamme_display_activate(p_batch_id uuid, p_supplier text, p_operator text, p_dry_run boolean) SET search_path = public;
ALTER FUNCTION public.catalog_gamme_display_rollback_batch(p_batch_id uuid, p_supplier text) SET search_path = public;
ALTER FUNCTION public.catalog_universal_gammes() SET search_path = public;
ALTER FUNCTION public.check_all_content_lengths(p_content jsonb) SET search_path = public;
ALTER FUNCTION public.check_all_gates(p_batch_id integer, p_entity_type character varying) SET search_path = public;
ALTER FUNCTION public.check_anti_purge(p_table_name text, p_current_count integer, p_threshold numeric) SET search_path = public;
ALTER FUNCTION public.check_confusion_pairs(p_content text, p_zone character varying) SET search_path = public;
ALTER FUNCTION public.check_database_health() SET search_path = public;
ALTER FUNCTION public.check_gate(p_import_id integer, p_gate_number integer, p_passed boolean, p_details jsonb, p_blocker_reason text) SET search_path = public;
ALTER FUNCTION public.check_gate_g0(p_batch_id integer) SET search_path = public;
ALTER FUNCTION public.check_gate_g1(p_batch_id integer, p_entity_type character varying) SET search_path = public;
ALTER FUNCTION public.check_gate_g2(p_batch_id integer, p_entity_type character varying) SET search_path = public;
ALTER FUNCTION public.check_gate_g3(p_batch_id integer) SET search_path = public;
ALTER FUNCTION public.check_gate_g4(p_batch_id integer, p_entity_type character varying) SET search_path = public;
ALTER FUNCTION public.check_manifest_complete(p_import_id integer) SET search_path = public;
ALTER FUNCTION public.check_product_completeness_v2(p_product_data jsonb, p_family_id character varying, p_product_type character varying) SET search_path = public;
ALTER FUNCTION public.check_rm_products_integrity() SET search_path = public;
ALTER FUNCTION public.check_threshold(p_family character varying, p_gate character varying, p_metric character varying, p_actual_value numeric) SET search_path = public;
ALTER FUNCTION public.check_v2_uniqueness() SET search_path = public;
ALTER FUNCTION public.check_vehicle_compatibility_full(p_content text, p_zone character varying, p_pg_id integer, p_type_id integer, p_has_vehicle_selector boolean, p_has_compatibility_link boolean) SET search_path = public;
ALTER FUNCTION public.cleanup_expired_carts() SET search_path = public;
ALTER FUNCTION public.cleanup_expired_password_resets() SET search_path = public;
ALTER FUNCTION public.cleanup_old_error_logs() SET search_path = public;
ALTER FUNCTION public.cleanup_old_pipeline_logs(p_days integer) SET search_path = public;
ALTER FUNCTION public.complete_pipeline_step(p_batch_id integer, p_step character varying, p_counts jsonb, p_status character varying, p_error text) SET search_path = public;
ALTER FUNCTION public.complete_rebuild_job(p_worker_id text, p_gamme_id integer, p_vehicle_id bigint, p_success boolean, p_data_version uuid, p_error_code text, p_error_message text, p_duration_ms integer, p_product_count integer, p_brand_count integer) SET search_path = public;
ALTER FUNCTION public.compute_seo_indexable(p_build_status rm_build_status_enum, p_product_count integer, p_family_id integer) SET search_path = public;
ALTER FUNCTION public.count_references_fts(search_term text, system_filter text) SET search_path = public;
ALTER FUNCTION public.count_words(p_text text) SET search_path = public;
ALTER FUNCTION public.create_batch_contract(p_import_id integer, p_entity_type character varying, p_expected_count integer) SET search_path = public;
ALTER FUNCTION public.create_batch_contract_v2(p_batch_id integer, p_entity_type character varying, p_expected_count integer, p_expected_tables text[], p_min_rowcounts jsonb, p_source_checksums jsonb, p_source_version character varying) SET search_path = public;
ALTER FUNCTION public.create_composite_index_async(p_table_name text, p_columns text[], p_include_columns text[], p_index_name text) SET search_path = public;
ALTER FUNCTION public.create_import_batch(p_source_system character varying, p_source_file character varying, p_source_hash character varying, p_metadata jsonb) SET search_path = public;
ALTER FUNCTION public.create_index_async(p_table_name text, p_column_name text, p_index_name text, p_index_type text) SET search_path = public;
ALTER FUNCTION public.create_rm_listing_products_partition(p_gamme_id integer) SET search_path = public;
ALTER FUNCTION public.decode_html_entities(input text) SET search_path = public;
ALTER FUNCTION public.delete_duplicates_batch(batch_size integer, max_deletions integer) SET search_path = public;
ALTER FUNCTION public.delete_first_records_batch(batch_size integer, max_deletions integer) SET search_path = public;
ALTER FUNCTION public.detect_quality_outliers(p_window_days integer, p_drop_pct numeric, p_role_id text, p_metric_name text) SET search_path = public;
ALTER FUNCTION public.determine_indexation_status(p_score integer, p_has_blocker boolean, p_blocker_types text[]) SET search_path = public;
ALTER FUNCTION public.determine_product_quality(p_pm_oes text, p_pm_nb_stars text, p_pm_quality text) SET search_path = public;
ALTER FUNCTION public.determine_stock_status(p_pri_dispo text) SET search_path = public;
ALTER FUNCTION public.diagnose_symptoms(p_symptoms text[], p_context jsonb) SET search_path = public;
ALTER FUNCTION public.enrich_s2_diag_from_observables_batch(p_dry_run boolean) SET search_path = public;
ALTER FUNCTION public.ensure_next_quality_history_partition() SET search_path = public;
ALTER FUNCTION public.ensure_rm_partition(p_gamme_id integer) SET search_path = public;
ALTER FUNCTION public.evaluate_rule_condition(p_condition jsonb, p_content text, p_product_data jsonb, p_cart_data jsonb, p_pg_id integer) SET search_path = public;
ALTER FUNCTION public.evaluate_rule_condition(p_condition jsonb, p_content text, p_entity_type character varying, p_pg_id integer, p_famille character varying, p_zone_contents jsonb) SET search_path = public;
ALTER FUNCTION public.execute_diff_apply_workflow(p_batch_id integer, p_entity_type character varying, p_auto_switch boolean) SET search_path = public;
ALTER FUNCTION public.extract_vehicle_keywords(p_pg_id integer) SET search_path = public;
ALTER FUNCTION public.fail_pipeline_step(p_batch_id integer, p_step character varying, p_error text, p_counts jsonb) SET search_path = public;
ALTER FUNCTION public.finalize_import_batch(p_batch_id integer, p_status character varying) SET search_path = public;
ALTER FUNCTION public.fix_utf8_encoding(input_text text) SET search_path = public;
ALTER FUNCTION public.fn_auto_restore_accents_r1_meta() SET search_path = public;
ALTER FUNCTION public.fn_auto_restore_accents_r1_slots() SET search_path = public;
ALTER FUNCTION public.fn_auto_restore_accents_r3() SET search_path = public;
ALTER FUNCTION public.fn_auto_restore_accents_r6() SET search_path = public;
ALTER FUNCTION public.fn_cascade_delete_gamme_content() SET search_path = public;
ALTER FUNCTION public.fn_invalidate_sgpg_gatekeeper() SET search_path = public;
ALTER FUNCTION public.fn_kp_validated_enqueue() SET search_path = public;
ALTER FUNCTION public.fn_r6_kp_validated_enqueue() SET search_path = public;
ALTER FUNCTION public.fn_rag_content_changed() SET search_path = public;
ALTER FUNCTION public.fn_skp_canon_check() SET search_path = public;
ALTER FUNCTION public.fn_warn_orphan_pg_id() SET search_path = public;
ALTER FUNCTION public.get_active_image_folders() SET search_path = public;
ALTER FUNCTION public.get_all_seo_observables_for_sitemap() SET search_path = public;
ALTER FUNCTION public.get_all_seo_references() SET search_path = public;
ALTER FUNCTION public.get_alternative_gammes_for_vehicle(p_type_id integer, p_exclude_gamme_id integer, p_limit integer) SET search_path = public;
ALTER FUNCTION public.get_alternative_vehicles_for_gamme(p_gamme_id integer, p_exclude_type_id integer, p_limit integer) SET search_path = public;
ALTER FUNCTION public.get_audit_stats_by_admin() SET search_path = public;
ALTER FUNCTION public.get_audit_stats_by_type() SET search_path = public;
ALTER FUNCTION public.get_auto_types_batch(p_type_ids bigint[]) SET search_path = public;
ALTER FUNCTION public.get_automecanik_id(p_external_id character varying, p_entity_type character varying) SET search_path = public;
ALTER FUNCTION public.get_batch_report(p_batch_id integer) SET search_path = public;
ALTER FUNCTION public.get_brand_bestsellers_optimized(p_marque_id integer, p_limit_vehicles integer, p_limit_parts integer) SET search_path = public;
ALTER FUNCTION public.get_brand_page_data_optimized(p_marque_id integer) SET search_path = public;
ALTER FUNCTION public.get_brands_with_pieces() SET search_path = public;
ALTER FUNCTION public.get_buying_guide_with_r1_slots(p_pg_id text) SET search_path = public;
ALTER FUNCTION public.get_catalog_families_for_vehicle(p_type_id integer) SET search_path = public;
ALTER FUNCTION public.get_catalog_families_for_vehicle_optimized(p_type_id integer) SET search_path = public;
ALTER FUNCTION public.get_catalog_hierarchy_optimized() SET search_path = public;
ALTER FUNCTION public.get_catalog_legacy(p_limit integer) SET search_path = public;
ALTER FUNCTION public.get_catalog_mapping_stats() SET search_path = public;
ALTER FUNCTION public.get_catalog_type_ids_for_gamme(p_pg_id integer) SET search_path = public;
ALTER FUNCTION public.get_context_questions(p_subsystem character varying) SET search_path = public;
ALTER FUNCTION public.get_crawl_activity_by_day(p_days integer) SET search_path = public;
ALTER FUNCTION public.get_decision_report(p_batch_id integer, p_entity_type character varying) SET search_path = public;
ALTER FUNCTION public.get_equipementiers_list(p_search text, p_display text, p_limit integer, p_offset integer) SET search_path = public;
ALTER FUNCTION public.get_external_id(p_automecanik_id integer, p_entity_type character varying) SET search_path = public;
ALTER FUNCTION public.get_extras_v4_type_ids(p_pg_id integer) SET search_path = public;
ALTER FUNCTION public.get_facet_config(p_gamme_id integer, p_family_id integer) SET search_path = public;
ALTER FUNCTION public.get_family_completeness_stats(p_family character varying, p_limit integer) SET search_path = public;
ALTER FUNCTION public.get_gamme_composite_scores(p_aliases text[]) SET search_path = public;
ALTER FUNCTION public.get_gamme_data_v3(p_pg_id integer) SET search_path = public;
ALTER FUNCTION public.get_gamme_families() SET search_path = public;
ALTER FUNCTION public.get_gamme_page_data(p_pg_id integer) SET search_path = public;
ALTER FUNCTION public.get_gamme_page_data_cached(p_pg_id integer) SET search_path = public;
ALTER FUNCTION public.get_gamme_page_data_optimized(p_pg_id integer) SET search_path = public;
ALTER FUNCTION public.get_gamme_price_preview(p_pg_id integer, p_limit integer) SET search_path = public;
ALTER FUNCTION public.get_gamme_product_counts() SET search_path = public;
ALTER FUNCTION public.get_gamme_seo_completeness() SET search_path = public;
ALTER FUNCTION public.get_gammes_for_family_and_vehicle(p_type_id integer, p_mf_id integer) SET search_path = public;
ALTER FUNCTION public.get_gammes_with_pieces() SET search_path = public;
ALTER FUNCTION public.get_homepage_data_optimized() SET search_path = public;
ALTER FUNCTION public.get_import_gate_report(p_import_id integer) SET search_path = public;
ALTER FUNCTION public.get_listing_products_extended(p_gamme_id integer, p_vehicle_id bigint, p_limit integer) SET search_path = public;
ALTER FUNCTION public.get_listing_products_extended_filtered(p_gamme_id integer, p_vehicle_id bigint, p_limit integer) SET search_path = public;
ALTER FUNCTION public.get_listing_products_for_build_v2(p_gamme_id integer, p_vehicle_id bigint, p_limit integer) SET search_path = public;
ALTER FUNCTION public.get_merchant_center_feed_v1(p_limit integer, p_offset integer) SET search_path = public;
ALTER FUNCTION public.get_missing_v4_type_ids(p_pg_id integer) SET search_path = public;
ALTER FUNCTION public.get_nk_stats() SET search_path = public;
ALTER FUNCTION public.get_observable_stats_per_gamme() SET search_path = public;
ALTER FUNCTION public.get_observable_symptoms_for_gamme(p_pg_id integer) SET search_path = public;
ALTER FUNCTION public.get_observe_only_impact_stats(p_days integer) SET search_path = public;
ALTER FUNCTION public.get_oem_refs_for_vehicle(p_type_id integer, p_pg_id integer, p_marque_name text) SET search_path = public;
ALTER FUNCTION public.get_or_create_brand_nk(p_brand_name text, p_internal_id integer) SET search_path = public;
ALTER FUNCTION public.get_page_quality_features() SET search_path = public;
ALTER FUNCTION public.get_piece_detail(p_piece_id integer) SET search_path = public;
ALTER FUNCTION public.get_pieces_for_type_gamme(p_type_id integer, p_pg_id integer) SET search_path = public;
ALTER FUNCTION public.get_pieces_for_type_gamme_v2(p_type_id integer, p_pg_id integer) SET search_path = public;
ALTER FUNCTION public.get_purchase_excluded_ids() SET search_path = public;
ALTER FUNCTION public.get_quarantine_dashboard(p_status character varying, p_entity_type character varying, p_batch_id integer, p_limit integer, p_offset integer) SET search_path = public;
ALTER FUNCTION public.get_quarantine_stats() SET search_path = public;
ALTER FUNCTION public.get_r1_related_blocks_cached(p_pg_id integer) SET search_path = public;
ALTER FUNCTION public.get_r5_redirect_target(p_slug text) SET search_path = public;
ALTER FUNCTION public.get_rag_coverage_summary() SET search_path = public;
ALTER FUNCTION public.get_reference_system_facets() SET search_path = public;
ALTER FUNCTION public.get_seo_excluded_ids(p_entity_type character varying) SET search_path = public;
ALTER FUNCTION public.get_seo_observable_by_slug(p_slug text) SET search_path = public;
ALTER FUNCTION public.get_seo_observable_featured(p_limit integer) SET search_path = public;
ALTER FUNCTION public.get_seo_observables_by_cluster(p_cluster_id text, p_limit integer) SET search_path = public;
ALTER FUNCTION public.get_seo_quality_daily_stats(p_date date) SET search_path = public;
ALTER FUNCTION public.get_seo_reference_by_slug(p_slug text) SET search_path = public;
ALTER FUNCTION public.get_staging_stats(p_import_id integer) SET search_path = public;
ALTER FUNCTION public.get_substitution_data(p_gamme_alias text, p_marque_alias text, p_modele_alias text, p_type_alias text, p_gamme_id integer) SET search_path = public;
ALTER FUNCTION public.get_supplier_display_stats() SET search_path = public;
ALTER FUNCTION public.get_supplier_unified_stats(p_search text, p_display text) SET search_path = public;
ALTER FUNCTION public.get_symptoms_by_subsystem(p_subsystem character varying) SET search_path = public;
ALTER FUNCTION public.get_threshold(p_family character varying, p_gate character varying, p_metric character varying) SET search_path = public;
ALTER FUNCTION public.get_top_money_gammes(p_limit integer) SET search_path = public;
ALTER FUNCTION public.get_vehicle_compatible_gammes_php(p_type_id integer) SET search_path = public;
ALTER FUNCTION public.get_vehicle_page_data_cached(p_type_id integer) SET search_path = public;
ALTER FUNCTION public.get_vlevel_champions(p_pg_id integer) SET search_path = public;
ALTER FUNCTION public.get_vlevel_dashboard(p_pg_id integer, p_limit integer, p_offset integer) SET search_path = public;
ALTER FUNCTION public.get_vlevel_data(p_pg_id integer) SET search_path = public;
ALTER FUNCTION public.get_vlevel_section_k_extras(p_pg_id integer) SET search_path = public;
ALTER FUNCTION public.get_vlevel_section_k_metrics(p_pg_id integer) SET search_path = public;
ALTER FUNCTION public.get_vlevel_section_k_missing(p_pg_id integer) SET search_path = public;
ALTER FUNCTION public.heartbeat_rebuild_job(p_worker_id text, p_gamme_id integer, p_vehicle_id bigint) SET search_path = public;
ALTER FUNCTION public.immutable_unaccent(text) SET search_path = public;
ALTER FUNCTION public.increment_cache_hit(p_cache_id uuid) SET search_path = public;
ALTER FUNCTION public.init_import_gates(p_import_id integer) SET search_path = public;
ALTER FUNCTION public.invalidate_r1_caches(p_pg_id integer, p_reason text, p_targets text) SET search_path = public;
ALTER FUNCTION public.is_import_running() SET search_path = public;
ALTER FUNCTION public.is_quarantined(p_entity_type character varying, p_internal_id integer) SET search_path = public;
ALTER FUNCTION public.jsonb_object_keys_count(p_json jsonb) SET search_path = public;
ALTER FUNCTION public.kg_approve_node(p_entity_id uuid, p_reviewer text, p_notes text) SET search_path = public;
ALTER FUNCTION public.kg_auto_infer_outcomes(p_days_threshold integer) SET search_path = public;
ALTER FUNCTION public.kg_calculate_adapted_interval(p_rule_id uuid, p_is_urban boolean, p_is_diesel boolean, p_is_aggressive boolean, p_is_heavy_load boolean, p_is_extreme boolean) SET search_path = public;
ALTER FUNCTION public.kg_calculate_bayesian_weight(p_edge_id uuid, p_min_feedback integer) SET search_path = public;
ALTER FUNCTION public.kg_calculate_confidence_score(p_current_km integer, p_maintenance_records jsonb, p_ctx_phase text, p_ctx_temp text, p_ctx_speed text, p_observable_count integer, p_vehicle_id uuid, p_engine_family_code text, p_has_dtc boolean) SET search_path = public;
ALTER FUNCTION public.kg_calculate_risk_level(p_rule_id uuid, p_current_km integer, p_last_service_km integer) SET search_path = public;
ALTER FUNCTION public.kg_calculate_truth_label_reliability(p_label_id uuid) SET search_path = public;
ALTER FUNCTION public.kg_calculate_weight_with_truth_labels(p_edge_id uuid, p_min_labels integer) SET search_path = public;
ALTER FUNCTION public.kg_cases_updated_at() SET search_path = public;
ALTER FUNCTION public.kg_check_safety_gate(p_observable_ids uuid[]) SET search_path = public;
ALTER FUNCTION public.kg_deprecate_node(p_entity_id uuid, p_deprecated_by text, p_reason text) SET search_path = public;
ALTER FUNCTION public.kg_diagnose_by_labels(p_observable_labels text[], p_engine_family_code text, p_confidence_threshold double precision, p_limit integer) SET search_path = public;
ALTER FUNCTION public.kg_diagnose_contextual(p_observable_labels text[], p_ctx_phase text, p_ctx_temp text, p_ctx_speed text, p_engine_family_code text, p_confidence_threshold double precision, p_limit integer) SET search_path = public;
ALTER FUNCTION public.kg_diagnose_vehicle_aware(p_observable_ids uuid[], p_vehicle_id uuid, p_engine_family_code text, p_confidence_threshold double precision, p_limit integer) SET search_path = public;
ALTER FUNCTION public.kg_diagnose_with_explainable_score(p_observable_ids uuid[], p_vehicle_id uuid, p_engine_family_code text, p_current_km integer, p_last_maintenance_records jsonb, p_ctx_phase text, p_ctx_temp text, p_ctx_speed text, p_limit integer) SET search_path = public;
ALTER FUNCTION public.kg_diagnose_with_safety(p_observable_ids uuid[], p_vehicle_id uuid, p_engine_family_code text, p_current_km integer, p_skip_diagnosis_if_critical boolean) SET search_path = public;
ALTER FUNCTION public.kg_explain_diagnosis_result(p_diagnosis_result jsonb) SET search_path = public;
ALTER FUNCTION public.kg_find_actions_for_fault(p_fault_id uuid) SET search_path = public;
ALTER FUNCTION public.kg_find_faults_from_observables(p_observable_ids uuid[]) SET search_path = public;
ALTER FUNCTION public.kg_find_parts_for_fault(p_fault_id uuid) SET search_path = public;
ALTER FUNCTION public.kg_generate_batch_explanations(p_fault_ids uuid[], p_matched_observable_ids uuid[], p_ctx_phase text, p_ctx_temp text, p_ctx_speed text) SET search_path = public;
ALTER FUNCTION public.kg_generate_explainable_diagnostic(p_fault_id uuid, p_matched_observable_ids uuid[], p_ctx_phase text, p_ctx_temp text, p_ctx_speed text) SET search_path = public;
ALTER FUNCTION public.kg_get_edge_type_weight_multiplier(p_edge_type text) SET search_path = public;
ALTER FUNCTION public.kg_get_input_type_confidence(p_input_type text) SET search_path = public;
ALTER FUNCTION public.kg_get_learning_stats() SET search_path = public;
ALTER FUNCTION public.kg_get_vehicle_maintenance_schedule(p_engine_family_code text, p_current_km integer, p_vehicle_age_months integer, p_last_maintenance_km integer, p_last_maintenance_date date) SET search_path = public;
ALTER FUNCTION public.kg_get_vehicle_recalls(p_engine_family_code text) SET search_path = public;
ALTER FUNCTION public.kg_quality_report() SET search_path = public;
ALTER FUNCTION public.kg_rag_file_needs_sync(p_file_path text, p_file_hash text) SET search_path = public;
ALTER FUNCTION public.kg_rag_get_node_id(p_file_path text, p_item_id text) SET search_path = public;
ALTER FUNCTION public.kg_rag_record_sync(p_file_path text, p_file_hash text, p_category text, p_nodes_created integer, p_nodes_updated integer, p_edges_created integer, p_edges_updated integer, p_errors_count integer, p_errors_detail jsonb, p_affected_node_ids uuid[], p_affected_edge_ids uuid[], p_duration_ms integer) SET search_path = public;
ALTER FUNCTION public.kg_rag_upsert_mapping(p_file_path text, p_item_id text, p_item_type text, p_kg_node_id uuid) SET search_path = public;
ALTER FUNCTION public.kg_record_case(p_observable_ids uuid[], p_predicted_fault_id uuid, p_predicted_score double precision, p_vehicle_context jsonb, p_user_id uuid, p_session_id text) SET search_path = public;
ALTER FUNCTION public.kg_record_feedback(p_event_type text, p_feedback_source text, p_edge_id uuid, p_fault_id uuid, p_observable_ids uuid[], p_diagnosis_cache_id uuid, p_feedback_data jsonb, p_user_id uuid, p_session_id text) SET search_path = public;
ALTER FUNCTION public.kg_record_outcome(p_case_id uuid, p_outcome_status text, p_actual_fault_id uuid, p_feedback_source text) SET search_path = public;
ALTER FUNCTION public.kg_record_truth_label(p_diagnosis_cache_id uuid, p_edge_ids uuid[], p_fault_id uuid, p_outcome_confirmed boolean, p_confirmation_method text, p_replaced_part_pg_id integer, p_confirmation_date date, p_confirmation_km integer, p_evidence_data jsonb, p_verification_quality text, p_submitted_by text, p_submitted_by_user_id uuid, p_order_id text, p_notes text) SET search_path = public;
ALTER FUNCTION public.kg_reject_node(p_entity_id uuid, p_reviewer text, p_notes text) SET search_path = public;
ALTER FUNCTION public.kg_safety_triggers_updated_at() SET search_path = public;
ALTER FUNCTION public.kg_submit_for_review(p_entity_type text, p_entity_id uuid, p_submitted_by text) SET search_path = public;
ALTER FUNCTION public.kg_truth_labels_updated_at() SET search_path = public;
ALTER FUNCTION public.kg_update_updated_at() SET search_path = public;
ALTER FUNCTION public.log_pipeline_event(p_batch_id integer, p_step character varying, p_context jsonb) SET search_path = public;
ALTER FUNCTION public.log_seo_quality_check(p_table character varying, p_record_id character varying, p_field character varying, p_before text, p_after text, p_rules jsonb, p_score_before integer, p_score_after integer, p_created_by character varying) SET search_path = public;
ALTER FUNCTION public.log_sitemap_generation(p_run_id uuid, p_bucket text, p_status text, p_urls_total integer, p_files_generated integer, p_duration_ms integer, p_error text) SET search_path = public;
ALTER FUNCTION public.maintain_pricing_decision_snapshot_partitions() SET search_path = public;
ALTER FUNCTION public.maintain_supplier_offer_snapshot_partitions() SET search_path = public;
ALTER FUNCTION public.map_facets_to_filter_keys(p_enabled_facets jsonb) SET search_path = public;
-- mark_order_paid_atomic EXCLUDED — payments.md carveout (Paybox callback, owner-gated, doc §7)
ALTER FUNCTION public.mark_stale_with_followup_rebuild(p_type_ids integer[], p_reason text, p_rebuild_immediately boolean) SET search_path = public;
ALTER FUNCTION public.match_keyword_text_to_vehicle(p_text text) SET search_path = public;
ALTER FUNCTION public.match_keyword_text_to_vehicle_batch(p_texts text[]) SET search_path = public;
ALTER FUNCTION public.match_keyword_to_type(p_model text, p_variant text, p_energy text, p_keyword text) SET search_path = public;
ALTER FUNCTION public.match_keywords_batch(p_pg_id integer) SET search_path = public;
ALTER FUNCTION public.match_keywords_batch_clean(p_pg_id integer) SET search_path = public;
ALTER FUNCTION public.merge_staging_brands(p_import_id integer) SET search_path = public;
ALTER FUNCTION public.migrate_psf_plaquettes() SET search_path = public;
ALTER FUNCTION public.move_decisions_to_quarantine(p_batch_id integer) SET search_path = public;
ALTER FUNCTION public.normalize_batch_brands(p_batch_id integer) SET search_path = public;
ALTER FUNCTION public.normalize_brand_name(p_name text) SET search_path = public;
ALTER FUNCTION public.populate_golden_set(p_limit integer) SET search_path = public;
ALTER FUNCTION public.populate_search_vector_batch() SET search_path = public;
ALTER FUNCTION public.populate_search_vector_small_batch(start_id integer, batch_size integer) SET search_path = public;
ALTER FUNCTION public.prepare_shadow_tables(p_batch_id integer, p_entity_type character varying) SET search_path = public;
ALTER FUNCTION public.pricing_activate_chunk(p_batch_id uuid, p_chunk_id uuid, p_supplier text, p_operator text, p_rows jsonb) SET search_path = public;
ALTER FUNCTION public.pricing_commit_chunk(p_batch_id uuid, p_chunk_id uuid, p_supplier text, p_operator text, p_rows jsonb, p_activate boolean) SET search_path = public;
ALTER FUNCTION public.pricing_cost_bucket_aggregates() SET search_path = public;
ALTER FUNCTION public.pricing_rollback_batch(p_batch_id uuid, p_supplier text) SET search_path = public;
ALTER FUNCTION public.process_prix_pas_cher(p_text text, p_type_id integer) SET search_path = public;
ALTER FUNCTION public.process_seo_switch(p_text text, p_marker text, p_switches jsonb, p_type_id integer, p_offset integer) SET search_path = public;
ALTER FUNCTION public.process_seo_template(p_template text, p_type_id integer, p_pg_id integer, p_mf_id integer, p_marque_name text, p_marque_alias text, p_marque_id integer, p_modele_name text, p_modele_alias text, p_modele_id integer, p_type_name text, p_type_alias text, p_type_power_ps text) SET search_path = public;
ALTER FUNCTION public.propagate_vlevel_per_typeid(p_pg_id bigint) SET search_path = public;
ALTER FUNCTION public.purge_seo_interpolation_alerts(days_to_keep integer) SET search_path = public;
ALTER FUNCTION public.rag_best_truth(levels text[]) SET search_path = public;
ALTER FUNCTION public.rag_is_section(src text) SET search_path = public;
ALTER FUNCTION public.rag_parent_source(src text) SET search_path = public;
ALTER FUNCTION public.rag_tsvector_update() SET search_path = public;
ALTER FUNCTION public.rebuild_gamme_page_cache(p_pg_id integer) SET search_path = public;
ALTER FUNCTION public.rebuild_vehicle_page_cache(p_type_id integer) SET search_path = public;
ALTER FUNCTION public.refresh_equipementier_counts() SET search_path = public;
ALTER FUNCTION public.refresh_gamme_aggregates(p_pg_id integer) SET search_path = public;
ALTER FUNCTION public.refresh_gamme_seo_dashboard() SET search_path = public;
ALTER FUNCTION public.refresh_stale_gamme_cache(p_batch_size integer) SET search_path = public;
ALTER FUNCTION public.refresh_stale_vehicle_cache(p_batch_size integer) SET search_path = public;
ALTER FUNCTION public.release_import_lock() SET search_path = public;
ALTER FUNCTION public.resolve_batch_brands(p_batch_id integer, p_source_system character varying) SET search_path = public;
ALTER FUNCTION public.resolve_brand_multilevel(p_source_system character varying, p_source_key character varying, p_brand_name text, p_batch_id integer) SET search_path = public;
ALTER FUNCTION public.resolve_gamme_alias(input_alias text) SET search_path = public;
ALTER FUNCTION public.resolve_quarantine_item(p_q_id integer, p_action character varying, p_reviewed_by character varying, p_notes text, p_target_internal_id integer) SET search_path = public;
ALTER FUNCTION public.resolve_type_id_remap(p_old_id integer) SET search_path = public;
ALTER FUNCTION public.restore_french_accents(input_text text) SET search_path = public;
ALTER FUNCTION public.rollback_switch(p_entity_type character varying) SET search_path = public;
ALTER FUNCTION public.rpc_seo_alerts_v1(p_now timestamp with time zone, p_limit integer) SET search_path = public;
ALTER FUNCTION public.rpc_seo_control_snapshot_v1(p_range text, p_now timestamp with time zone) SET search_path = public;
ALTER FUNCTION public.rpc_seo_conversion_v1(p_window_days integer, p_now timestamp with time zone, p_limit integer) SET search_path = public;
ALTER FUNCTION public.rpc_seo_low_ctr_v1(p_window_days integer, p_now timestamp with time zone, p_min_impressions integer, p_max_ctr numeric, p_limit integer) SET search_path = public;
ALTER FUNCTION public.rpc_seo_low_ctr_v2(p_window_days integer, p_now timestamp with time zone, p_min_impressions integer, p_max_ctr numeric, p_limit integer) SET search_path = public;
ALTER FUNCTION public.rpc_seo_low_ctr_v3(p_window_days integer, p_now timestamp with time zone, p_min_impressions integer, p_max_ctr numeric, p_limit integer, p_coverage_min_ratio numeric) SET search_path = public;
ALTER FUNCTION public.rpc_seo_ready_gammes(p_min_kw integer) SET search_path = public;
ALTER FUNCTION public.rpc_seo_top_losers_v1(p_window_days integer, p_now timestamp with time zone, p_limit integer) SET search_path = public;
ALTER FUNCTION public.rpc_seo_traffic_v1(p_window_days integer, p_now timestamp with time zone) SET search_path = public;
ALTER FUNCTION public.run_import_pipeline(p_batch_id integer, p_skip_gates boolean) SET search_path = public;
ALTER FUNCTION public.safe_jsonb_array_length(x jsonb) SET search_path = public;
ALTER FUNCTION public.search_pieces_fts(search_term text) SET search_path = public;
ALTER FUNCTION public.search_pieces_hybrid(search_term text, result_limit integer) SET search_path = public;
ALTER FUNCTION public.search_rag_knowledge(p_query text, p_limit integer, p_domain text, p_min_truth_level text) SET search_path = public;
ALTER FUNCTION public.search_references_fts(search_term text, system_filter text, page_num integer, page_size integer) SET search_path = public;
ALTER FUNCTION public.search_references_trigram(search_term text, system_filter text, page_num integer, page_size integer) SET search_path = public;
ALTER FUNCTION public.search_seo_observable_by_dtc(p_dtc_code text) SET search_path = public;
ALTER FUNCTION public.suggest_references(search_term text) SET search_path = public;
ALTER FUNCTION public.supplier_offer_snapshot_reject_mutation() SET search_path = public;
ALTER FUNCTION public.switch_to_next(p_entity_type character varying) SET search_path = public;
ALTER FUNCTION public.sync_keywords_to_gamme_aggregates() SET search_path = public;
ALTER FUNCTION public.sync_sitemap_p_link_to_seo_page() SET search_path = public;
ALTER FUNCTION public.table_exists(schema_name text, table_name text) SET search_path = public;
ALTER FUNCTION public.test_pieces_relation_access(p_type_id integer) SET search_path = public;
ALTER FUNCTION public.trg_auto_type_rebuild_cache() SET search_path = public;
ALTER FUNCTION public.trg_invalidate_r1_from_gamme_links() SET search_path = public;
ALTER FUNCTION public.trg_invalidate_r1_from_image_prompts() SET search_path = public;
ALTER FUNCTION public.trg_invalidate_r1_from_purchase_guide() SET search_path = public;
ALTER FUNCTION public.trg_invalidate_r1_from_seo_gamme() SET search_path = public;
ALTER FUNCTION public.trg_prevent_customer_admin_overlap() SET search_path = public;
ALTER FUNCTION public.trg_r1_gamme_slots_updated_at() SET search_path = public;
ALTER FUNCTION public.update_batch_contract(p_contract_id integer, p_received_count integer, p_validated_count integer, p_rejected_count integer) SET search_path = public;
ALTER FUNCTION public.update_cart_totals() SET search_path = public;
ALTER FUNCTION public.update_cart_totals_simple() SET search_path = public;
ALTER FUNCTION public.update_pieces_search_vector() SET search_path = public;
ALTER FUNCTION public.update_quantity_discounts_updated_at() SET search_path = public;
ALTER FUNCTION public.update_quarantine_timestamp() SET search_path = public;
ALTER FUNCTION public.update_ref_search_vector() SET search_path = public;
ALTER FUNCTION public.update_reviews_updated_at() SET search_path = public;
ALTER FUNCTION public.update_seo_keywords_updated_at() SET search_path = public;
ALTER FUNCTION public.update_support_tickets_updated_at() SET search_path = public;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public.update_v2_repetitions_on_change() SET search_path = public;
ALTER FUNCTION public.update_v2_repetitions_on_delete() SET search_path = public;
ALTER FUNCTION public.upsert_catalog_mapping(p_external_id character varying, p_automecanik_id integer, p_entity_type character varying, p_source character varying, p_version character varying) SET search_path = public;
ALTER FUNCTION public.validate_content_full(p_context character varying, p_pg_id integer, p_famille character varying, p_content text) SET search_path = public;
ALTER FUNCTION public.validate_shadow(p_batch_id integer, p_entity_type character varying) SET search_path = public;
ALTER FUNCTION public.validate_staging_brands(p_import_id integer) SET search_path = public;
ALTER FUNCTION public.validate_vlevel_integrity() SET search_path = public;
COMMIT;

-- Post-apply: re-run advisor (security) → function_search_path_mutable rows = 0.
-- Verify : SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
--   WHERE n.nspname='public' AND p.prokind IN ('f','p')
--     AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig,'{}'::text[])) c WHERE c LIKE 'search_path=%')
--     AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid=p.oid AND d.deptype='e');
--   -- expected : 0
-- =============================================================================

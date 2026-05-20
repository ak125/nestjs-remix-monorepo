-- Reality Audit table — Phase 0.5 du plan Reality Audit Business-First
-- Capture snapshot historique du bottleneck SEO réel (indexation / intent / funnel / viability / UX)
-- Pas de FK, pas de RLS spécifique (lecture admin/service uniquement, écriture par collector backend)

CREATE TABLE IF NOT EXISTS __seo_reality_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  captured_at timestamptz NOT NULL DEFAULT now(),
  pg_id int NULL,  -- NULL = audit site-wide ; sinon gamme-level
  -- A. Indexation (GSC Coverage 28j)
  pages_submitted int NULL,
  pages_discovered int NULL,
  pages_indexed int NULL,
  pages_noindex_intentional int NULL,
  pages_noindex_involuntary int NULL,
  canonical_correct_pct numeric(5,2) NULL,
  duplication_clusters_count int NULL,
  sitemap_last_processed timestamptz NULL,
  -- B. Intent match (sample manuel sur top 1-5 pages par gamme)
  intent_sample_size int NULL,
  intent_match_count int NULL,
  intent_mismatch_examples jsonb NULL,  -- [{url, our_intent, serp_dominant_intent, gap}]
  -- C. Conversion funnel (GA4 + ___xtr_order 28j)
  organic_sessions_28d int NULL,
  organic_addtocart_28d int NULL,
  organic_orders_28d int NULL,
  organic_revenue_28d numeric(10,2) NULL,
  funnel_dropoff_steps jsonb NULL,
  -- C.bis BASELINE pour futur KPI "commande SEO attribuable"
  baseline_orders_seo_attributable_28d int NULL,
  baseline_orders_attribution_method text NULL CHECK (baseline_orders_attribution_method IN ('ga4_last_touch','ga4_first_touch','ga4_data_driven','manual_cross_ref','none')),
  baseline_window_start date NULL,
  baseline_window_end date NULL,
  -- D. Business viability
  margin_estimate_pct numeric(5,2) NULL,
  margin_estimate_method text NULL CHECK (margin_estimate_method IN ('cost_of_goods','price_proxy','unknown','none')),
  stock_coverage_pct numeric(5,2) NULL,
  avg_delivery_days numeric(4,1) NULL,
  sav_return_rate_pct numeric(5,2) NULL,
  compatibility_trust_score smallint NULL CHECK (compatibility_trust_score BETWEEN 0 AND 100),
  business_viability_score smallint NULL CHECK (business_viability_score BETWEEN 0 AND 100),
  business_viability_tier text NULL CHECK (business_viability_tier IN ('high','medium','low','unviable')),
  -- E. UX & confiance achat (spécifique pièces auto)
  mobile_ux_friction_score smallint NULL CHECK (mobile_ux_friction_score BETWEEN 0 AND 100),
  time_to_compatibility_seconds_p50 int NULL,
  search_to_product_confidence_score smallint NULL CHECK (search_to_product_confidence_score BETWEEN 0 AND 100),
  -- E.bis Mesures funnel auto fines
  mobile_vs_desktop_dropoff_pct numeric(5,2) NULL,
  compatibility_validation_success_pct numeric(5,2) NULL,
  search_exit_after_compatibility_check_pct numeric(5,2) NULL,
  -- E.ter Compat trust loss signals
  vehicle_selector_abandon_pct numeric(5,2) NULL,
  compatibility_error_report_rate numeric(5,4) NULL,
  returning_user_after_failed_search_pct numeric(5,2) NULL,
  -- E.quater Selector pathologies & friction extrême
  vehicle_selector_time_seconds_p95 int NULL,
  compatibility_override_manual_help_rate numeric(5,4) NULL,
  mobile_vehicle_selector_failure_pct numeric(5,2) NULL,
  -- E.quinquies Selector retries + catalog/SAV conflicts + landing-to-selector
  selector_retry_count_p50 smallint NULL,
  compatibility_conflict_rate numeric(5,4) NULL,
  organic_to_selector_start_pct numeric(5,2) NULL,
  -- E.sexies Backtracking + support + abandon-after-failure
  selector_backtrack_rate numeric(5,4) NULL,
  support_contact_before_checkout_pct numeric(5,2) NULL,
  organic_bounce_after_selector_failure_pct numeric(5,2) NULL,
  -- Métadonnées qualité audit
  data_availability_pct numeric(5,2) NULL,  -- % des colonnes décisives effectivement remplies
  -- Verdict
  dominant_problem text NULL CHECK (dominant_problem IN ('content_quality','indexation','intent_mismatch','conversion_funnel','business_unviable','mixed','unknown')),
  notes text NULL  -- documenter colonnes NULL (MISSING) + caveats
);

CREATE INDEX IF NOT EXISTS idx_reality_audit_captured ON __seo_reality_audit (captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_reality_audit_pg_id ON __seo_reality_audit (pg_id, captured_at DESC) WHERE pg_id IS NOT NULL;

COMMENT ON TABLE __seo_reality_audit IS
  'Snapshot historique du bottleneck SEO réel (Phase 0.5 du plan Reality Audit Business-First). Une row par run de collector (site-wide OU par gamme pilote). Verdict dominant_problem oriente la décision : content_quality | indexation | intent_mismatch | conversion_funnel | business_unviable.';

COMMENT ON COLUMN __seo_reality_audit.dominant_problem IS
  'Verdict business : SI conversion_funnel → pivot Commerce-Loop V1 ; SI indexation → fix canonical/sitemap ; SI intent_mismatch → re-archi URL ; SI business_unviable → re-prio gammes ; SI content_quality → mini Evidence Guard V1 (NOUVEAU plan).';

COMMENT ON COLUMN __seo_reality_audit.data_availability_pct IS
  'Confiance audit : % colonnes décisives effectivement remplies. < 60 = verdict avec confiance dégradée, document gaps dans notes.';

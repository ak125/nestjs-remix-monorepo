-- =====================================================
-- PR-SBD-1 Task 1 Step 11 — Indexes CONCURRENTLY (non-transactional)
-- Date: 2026-05-18
-- Refs: .claude/plans/verifier-existant-avant-et-ethereal-firefly.md
--       docs/seo/audit-orders-cart-link.md
--       docs/seo/explain-analyze-pr-sbd-1.md (gate merge)
-- =====================================================
--
-- CREATE INDEX CONCURRENTLY cannot run inside a transaction block.
-- Apply each statement separately (psql \i or migration runner with
-- non-transactional support).
--
-- Existing indexes already covering Task 1 needs (kept, NOT recreated) :
--   - idx_gsc_daily_page_date (page, date DESC)               ← 20260425
--   - idx_gsc_daily_query_date (query, date DESC)             ← 20260425
--   - idx_seo_event_log_severity_unresolved                   ← 20260425
--   - idx_seo_audit_findings_severity_open                    ← 20260426
--   - idx_ga4_daily_page_date (page, date DESC)               ← 20260425
--
-- 4 NEW indexes added below (not duplicated, complementary access paths) :
-- =====================================================

-- Index 1 : (date, page) covering — for windowed scans grouped by page
-- Complements existing (page, date DESC) by giving date-first access path
-- Used by : rpc_seo_traffic_v1, rpc_seo_top_losers_v1, rpc_seo_low_ctr_v1
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gsc_daily_date_page
  ON __seo_gsc_daily (date, page);

-- Index 2 : query-level breakdown per page (LATERAL for top_queries_sample)
-- Used by : _seo_top_queries_for_page_jsonb (LATERAL inside rpc_seo_top_losers_v1)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gsc_daily_page_query_date
  ON __seo_gsc_daily (page, query, date)
  WHERE query IS NOT NULL;

-- Index 3 : Conversion Gap JOIN — order lines by website URL filtered "real" entries
-- Used by : rpc_seo_conversion_v1 (Bloc 4, conditional Phase A.6)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_xtr_order_line_website_url_paid
  ON ___xtr_order_line (orl_website_url)
  WHERE orl_website_url IS NOT NULL
    AND orl_website_url <> 'System';

-- Index 4 : Conversion Gap JOIN — orders by date filtered paid
-- Used by : rpc_seo_conversion_v1 (Bloc 4, conditional Phase A.6)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_xtr_order_date_paid
  ON ___xtr_order (ord_date)
  WHERE ord_is_pay = '1';

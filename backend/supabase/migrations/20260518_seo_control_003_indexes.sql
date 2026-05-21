-- @non_transactional
-- squawk-ignore-file ban-concurrent-index-creation-in-transaction
-- =====================================================
-- PR-SBD-1 Task 1 Step 11 — Indexes CONCURRENTLY (non-transactional)
-- Date: 2026-05-18
-- Refs: .claude/plans/verifier-existant-avant-et-ethereal-firefly.md
--       docs/seo/audit-orders-cart-link.md
--       docs/seo/explain-analyze-pr-sbd-1.md (gate merge)
-- =====================================================
--
-- Squawk directive : `ban-concurrent-index-creation-in-transaction` ignored
-- file-wide because this migration is EXPLICITLY non-transactional.
--
-- The canonical engine (scripts/ci/apply-supabase-migration.py) wraps every
-- migration in BEGIN/COMMIT UNLESS it finds the `-- @non_transactional` marker
-- in the first 20 lines (see is_non_transactional_header). The marker above is
-- REQUIRED here: without it the engine would run these statements inside a
-- transaction and CREATE INDEX CONCURRENTLY would raise SQLSTATE 25001. With
-- it, the engine runs in autocommit and each CONCURRENTLY build is standalone.
-- Cf. existing patterns 20260120_rm_expression_index.sql / 20260128_add_index_pieces_*.sql.
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

-- CONCURRENTLY index builds can take minutes on large tables (GSC daily has
-- ~30M rows). lock_timeout protects against blocking concurrent writers ;
-- statement_timeout is intentionally permissive (30min) — index build is the
-- expected slow operation. This timeout pair applies to each CREATE INDEX
-- below since they share the same session.
set lock_timeout = '2s';
set statement_timeout = '30min';

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

-- squawk-ignore-file require-concurrent-index-creation
-- Justification: every target table is empty or tiny at apply time
-- (__seo_gsc_daily 0 rows, ___xtr_order_line ~2.5k, ___xtr_order ~1.7k). The
-- index build holds its lock sub-millisecond, so an atomic in-transaction
-- CREATE INDEX is preferred over CONCURRENTLY (no benefit at this scale, and
-- CONCURRENTLY cannot run in a transaction). Same policy as 20260520_order_landing_attribution.
-- =====================================================
-- PR-SBD-1 Task 1 Step 11 — Indexes (transactional, plain CREATE INDEX)
-- Date: 2026-05-18 (index strategy revised 2026-05-21)
-- Refs: .claude/plans/verifier-existant-avant-et-ethereal-firefly.md
--       docs/seo/audit-orders-cart-link.md
--       docs/seo/explain-analyze-pr-sbd-1.md (gate merge)
-- =====================================================
--
-- Index strategy (revised 2026-05-21) : plain CREATE INDEX inside a transaction.
-- The original draft used CREATE INDEX CONCURRENTLY assuming __seo_gsc_daily was
-- already large (~30M rows). Empirically the target tables are empty or tiny at
-- apply time — __seo_gsc_daily: 0 rows, ___xtr_order_line: ~2.5k rows,
-- ___xtr_order: ~1.7k rows — so each build is sub-millisecond and a plain,
-- atomic in-transaction CREATE INDEX is the correct, lowest-risk choice. Building
-- on the (currently empty) GSC table now is ideal: instant, and the index is
-- maintained as rows arrive. This mirrors the policy already documented in the
-- sibling migration 20260520_order_landing_attribution.
--
-- If __seo_gsc_daily ever grows past ~1M rows AND needs a NEW index added while
-- under concurrent write load, add a dedicated CONCURRENTLY migration then. Note
-- the canonical engine (scripts/ci/apply-supabase-migration.py) currently runs a
-- migration file as a single multi-statement execute, which Postgres treats as
-- one implicit transaction even in autocommit — so a CONCURRENTLY migration must
-- contain a SINGLE statement (one index) until the engine learns to split.
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

set lock_timeout = '5s';
set statement_timeout = '60s';

-- Index 1 : (date, page) covering — for windowed scans grouped by page
-- Complements existing (page, date DESC) by giving date-first access path
-- Used by : rpc_seo_traffic_v1, rpc_seo_top_losers_v1, rpc_seo_low_ctr_v1
CREATE INDEX IF NOT EXISTS idx_gsc_daily_date_page
  ON __seo_gsc_daily (date, page);

-- Index 2 : query-level breakdown per page (LATERAL for top_queries_sample)
-- Used by : _seo_top_queries_for_page_jsonb (LATERAL inside rpc_seo_top_losers_v1)
CREATE INDEX IF NOT EXISTS idx_gsc_daily_page_query_date
  ON __seo_gsc_daily (page, query, date)
  WHERE query IS NOT NULL;

-- Index 3 : Conversion Gap JOIN — order lines by website URL filtered "real" entries
-- Used by : rpc_seo_conversion_v1 (Bloc 4, conditional Phase A.6)
CREATE INDEX IF NOT EXISTS idx_xtr_order_line_website_url_paid
  ON ___xtr_order_line (orl_website_url)
  WHERE orl_website_url IS NOT NULL
    AND orl_website_url <> 'System';

-- Index 4 : Conversion Gap JOIN — orders by date filtered paid
-- Used by : rpc_seo_conversion_v1 (Bloc 4, conditional Phase A.6)
CREATE INDEX IF NOT EXISTS idx_xtr_order_date_paid
  ON ___xtr_order (ord_date)
  WHERE ord_is_pay = '1';

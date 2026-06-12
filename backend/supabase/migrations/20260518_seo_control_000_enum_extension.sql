-- squawk-ignore-file require-enum-value-ordering
-- =====================================================
-- PR-SBD-1 Task 1 Step 0 — Enum extension for dashboard audit log
-- Date: 2026-05-18
-- Refs: docs/seo/audit-orders-cart-link.md
--       .claude/plans/verifier-existant-avant-et-ethereal-firefly.md
-- =====================================================
--
-- Extends `seo_event_type` ENUM with 'dashboard_view' for audit access logging
-- by the SEO Control Dashboard service (deduped via Redis SET NX 15min).
--
-- Background : __seo_event_log.event_type is a strict ENUM (cf migration
-- 20260425_seo_event_log.sql, comment "extensible via ALTER TYPE").
-- Without this extension, the dashboard audit INSERT would fail with
-- "invalid input value for enum seo_event_type: 'dashboard_view'".
--
-- Postgres ≥ 12 supports `ALTER TYPE ... ADD VALUE IF NOT EXISTS` inside
-- a transaction provided the new value is not used in the SAME transaction.
-- This migration ONLY adds the value (no usage), so it is transaction-safe.
--
-- Squawk note : `require-enum-value-ordering` ignored — Postgres ENUM
-- ordinality is irrelevant to the dashboard audit usage (`event_type='dashboard_view'`
-- is compared by equality, never by sort). Appending is the canonical pattern.
-- =====================================================

set lock_timeout = '2s';
set statement_timeout = '5s';

ALTER TYPE seo_event_type ADD VALUE IF NOT EXISTS 'dashboard_view';

COMMENT ON TYPE seo_event_type IS
  'SEO event types — extensible via ALTER TYPE. Includes dashboard_view (PR-SBD-1, deduped audit log via Redis SET NX 15min, payload.dashboard=seo-control).';

-- =====================================================
-- Pricing Control Plane V1 — calibrated B2C grid seed (pricing_rules)
-- Date: 2026-05-22
-- Refs: plan pricing-control-plane-v1 ; 20260522_pricing_control_plane_v1.sql (table)
-- =====================================================
--
-- Seeds the degressive B2C grid CALIBRATED to the measured legacy medians
-- (markup on cost, per achat_HT bucket), so the L4 grid reproduces the real
-- curve. Used by APPLY_GRID and by INSERT/recovery rows lacking a file marge —
-- NOT by the default PRESERVE_EXISTING import (which keeps each row's marge).
--
-- Idempotent: each bucket guarded by a sentinel change_reason. Re-run = no-op.
-- min_margin_amount protects cheap parts (legacy min brute was 0,15 €).
-- The owner tunes these toward the target grid later; every change is versioned
-- (rule_version / change_reason) and quantified by the dry-run before any commit.
-- NOT applied to the shared DB here — governed apply step.
-- =====================================================

set lock_timeout = '2s';
set statement_timeout = '30s';

DO $$
DECLARE
  v_seed_reason CONSTANT TEXT := 'calibration-seed-v1 (legacy medians)';
  -- [min_cost_cents, max_cost_cents (NULL=+inf), margin_rate %, min_margin_amount_cents, max_margin_rate %]
  v_rules CONSTANT JSONB := '[
    {"min":0,      "max":1000,   "rate":65, "floor":200, "cap":150},
    {"min":1000,   "max":3000,   "rate":53, "floor":0,   "cap":120},
    {"min":3000,   "max":8000,   "rate":47, "floor":0,   "cap":null},
    {"min":8000,   "max":15000,  "rate":39, "floor":0,   "cap":null},
    {"min":15000,  "max":30000,  "rate":30, "floor":0,   "cap":null},
    {"min":30000,  "max":null,   "rate":25, "floor":0,   "cap":null}
  ]'::jsonb;
  v_r JSONB;
BEGIN
  FOR v_r IN SELECT * FROM jsonb_array_elements(v_rules)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pricing_rules
      WHERE change_reason = v_seed_reason
        AND customer_type = 'B2C'
        AND min_cost_cents = (v_r->>'min')::BIGINT
    ) THEN
      INSERT INTO pricing_rules (
        min_cost_cents, max_cost_cents, margin_rate, min_margin_amount_cents,
        max_margin_rate, customer_type, supplier_pm_id, category_gamme_id,
        priority, active, rule_version, created_by, change_reason
      ) VALUES (
        (v_r->>'min')::BIGINT,
        NULLIF(v_r->>'max', 'null')::BIGINT,
        (v_r->>'rate')::NUMERIC,
        (v_r->>'floor')::BIGINT,
        NULLIF(v_r->>'cap', 'null')::NUMERIC,
        'B2C', NULL, NULL,
        0, TRUE, 1, 'pricing-seed', v_seed_reason
      );
    END IF;
  END LOOP;
END $$;

-- =====================================================
-- Pricing Control Plane V1 — cost-bucket aggregate for simulation (read-only)
-- Date: 2026-05-22
-- Refs: plan pricing-control-plane-v1 ; pricing-simulation.core.ts
-- =====================================================
--
-- One efficient server-side GROUP BY (returns ~6 rows) feeding the read-only
-- grid simulation — never a 442K-row pull. Revenue is SALES-WEIGHTED by
-- ___xtr_order_line (count per pm_id+ref_clean), so zero-rotation stock weighs 0
-- (qty=0 → contributes 0 to revenue), consistent with "traffic without conversion".
--
-- STABLE, read-only (SELECT only). NOT applied to the shared DB here (gated).
-- The TS layer (pricing-simulation.core) applies the candidate grid + L1/L4 SoT
-- to these aggregates — no pricing formula is duplicated in SQL.
-- =====================================================

set lock_timeout = '2s';
set statement_timeout = '30s';

set lock_timeout = '2s';
set statement_timeout = '30s';

CREATE OR REPLACE FUNCTION pricing_cost_bucket_aggregates()
RETURNS TABLE (
  representative_cost_cents   BIGINT,
  piece_count                 BIGINT,
  sum_achat_x_qty_cents       NUMERIC,
  sum_vente_ttc_x_qty_cents   NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  WITH sales AS (
    SELECT orl_pm_id, orl_art_ref_clean, count(*)::numeric AS qty
    FROM ___xtr_order_line
    WHERE orl_pm_id IS NOT NULL AND orl_art_ref_clean IS NOT NULL
    GROUP BY orl_pm_id, orl_art_ref_clean
  ),
  rows AS (
    SELECT
      pp.pri_achat_ht_n  AS achat,
      pp.pri_vente_ttc_n AS vente_ttc,
      COALESCE(s.qty, 0) AS qty,
      CASE
        WHEN pp.pri_achat_ht_n < 10  THEN 100      -- bucket [0,1000)c   → rule min_cost 0
        WHEN pp.pri_achat_ht_n < 30  THEN 1000     -- [1000,3000)c
        WHEN pp.pri_achat_ht_n < 80  THEN 3000     -- [3000,8000)c
        WHEN pp.pri_achat_ht_n < 150 THEN 8000     -- [8000,15000)c
        WHEN pp.pri_achat_ht_n < 300 THEN 15000    -- [15000,30000)c
        ELSE 30000                                 -- [30000,+inf)c
      END AS rep_cost
    FROM pieces_price pp
    JOIN pieces p ON p.piece_id = pp.pri_piece_id_i
    LEFT JOIN sales s
      ON s.orl_pm_id = pp.pri_pm_id
     AND s.orl_art_ref_clean = p.piece_ref_clean
    WHERE pp.pri_type = '0' AND pp.pri_achat_ht_n > 0 AND pp.pri_vente_ttc_n > 0
  )
  SELECT
    rep_cost::bigint,
    count(*)::bigint,
    round(sum(achat * 100 * qty))::numeric,
    round(sum(vente_ttc * 100 * qty))::numeric
  FROM rows
  GROUP BY rep_cost
  ORDER BY rep_cost;
$$;

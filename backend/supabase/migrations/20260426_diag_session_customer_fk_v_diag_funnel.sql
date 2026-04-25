-- =====================================================
-- ADR-027 Phase B — Instrumentation neutre
-- Date: 2026-04-26
-- Refs: ADR-027-r5-consolidation-into-r3-s2-diag (vault, PR ak125/governance-vault#76)
--       Plan voie B: /home/deploy/.claude/plans/verifier-ce-que-mutable-cake.md
-- =====================================================
--
-- Objectif :
--   Lier les sessions diagnostic (__diag_session) aux comptes clients
--   (___xtr_customer.cst_id) pour permettre la mesure du funnel
--   "diagnostic terminé → achat" (audit live 2026-04-25 :
--   101 sessions stateless, 0 jointure orders possible).
--
-- Cette migration est NEUTRE vis-à-vis du choix architectural R5/R3
-- de l'ADR-027 — elle ne change rien à la consolidation R5→R3 S2_DIAG.
--
-- Schéma cible :
--   __diag_session.customer_id TEXT NULL FK → ___xtr_customer(cst_id)
--   v_diag_funnel : view aggrégée jour×semaine sessions×orders
--
-- Type TEXT (pas UUID) car ___xtr_customer.cst_id est TEXT (legacy XTR).
-- NULL accepté pour préserver les sessions anonymes existantes (101 lignes
-- au 2026-04-25 sans customer_id).
-- =====================================================

-- 1. Ajouter colonne customer_id TEXT nullable
ALTER TABLE __diag_session
  ADD COLUMN IF NOT EXISTS customer_id TEXT NULL;

-- 2. FK vers ___xtr_customer(cst_id) avec ON DELETE SET NULL
--    (préserve historique session si compte client supprimé)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = '__diag_session'
      AND constraint_name = 'fk_diag_session_customer'
  ) THEN
    ALTER TABLE __diag_session
      ADD CONSTRAINT fk_diag_session_customer
      FOREIGN KEY (customer_id)
      REFERENCES ___xtr_customer(cst_id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Index sur customer_id pour les queries de funnel
--    (jointure customer × sessions, agrégation par customer)
CREATE INDEX IF NOT EXISTS idx_diag_session_customer_id
  ON __diag_session(customer_id)
  WHERE customer_id IS NOT NULL;

-- 4. View v_diag_funnel : conversion sessions × orders par jour/semaine
--    Schéma ___xtr_order legacy = colonnes TEXT, casts explicites requis.
--    Convention dates :
--      __diag_session.created_at = TIMESTAMPTZ (canonique)
--      ___xtr_order.ord_date = TEXT au format 'YYYY-MM-DD HH:MM:SS' (legacy)
CREATE OR REPLACE VIEW v_diag_funnel AS
WITH sessions_by_day AS (
  SELECT
    DATE(created_at) AS day,
    COUNT(*) AS sessions_total,
    COUNT(*) FILTER (WHERE customer_id IS NOT NULL) AS sessions_logged_in,
    COUNT(DISTINCT customer_id) FILTER (WHERE customer_id IS NOT NULL) AS unique_customers
  FROM __diag_session
  GROUP BY DATE(created_at)
),
orders_by_day AS (
  SELECT
    DATE(ord_date::timestamp) AS day,
    COUNT(*) AS orders_total,
    COUNT(DISTINCT ord_cst_id) AS unique_buyers,
    SUM(NULLIF(ord_total_ttc, '')::numeric) AS revenue_ttc
  FROM ___xtr_order
  WHERE ord_date IS NOT NULL
    AND ord_date <> ''
  GROUP BY DATE(ord_date::timestamp)
),
diag_buyers AS (
  SELECT
    DATE(s.created_at) AS day,
    COUNT(DISTINCT s.customer_id) AS diag_customers_who_bought_same_day
  FROM __diag_session s
  INNER JOIN ___xtr_order o
    ON o.ord_cst_id = s.customer_id
    AND DATE(o.ord_date::timestamp) = DATE(s.created_at)
  WHERE s.customer_id IS NOT NULL
    AND o.ord_date IS NOT NULL
    AND o.ord_date <> ''
  GROUP BY DATE(s.created_at)
)
SELECT
  sb.day,
  sb.sessions_total,
  sb.sessions_logged_in,
  sb.unique_customers AS diag_unique_customers,
  COALESCE(ob.orders_total, 0) AS orders_total,
  COALESCE(ob.unique_buyers, 0) AS orders_unique_buyers,
  COALESCE(ob.revenue_ttc, 0) AS revenue_ttc,
  COALESCE(db.diag_customers_who_bought_same_day, 0) AS diag_to_purchase_same_day,
  CASE
    WHEN sb.unique_customers > 0
    THEN ROUND(
      (COALESCE(db.diag_customers_who_bought_same_day, 0)::numeric / sb.unique_customers) * 100,
      2
    )
    ELSE NULL
  END AS conversion_rate_pct
FROM sessions_by_day sb
LEFT JOIN orders_by_day ob ON ob.day = sb.day
LEFT JOIN diag_buyers db ON db.day = sb.day
ORDER BY sb.day DESC;

COMMENT ON VIEW v_diag_funnel IS
  'ADR-027 Phase B — Funnel diagnostic→achat par jour. '
  'Conversion = customers ayant fait diag ET ordered le même jour / customers ayant fait diag. '
  'NULL conversion_rate si aucune session loggée le jour.';

-- 5. Smoke test data: vérifier que la view est queriable
--    (exécuté à la migration pour fail-fast si schéma legacy a changé)
DO $$
DECLARE
  v_test_count INT;
BEGIN
  SELECT COUNT(*) INTO v_test_count FROM v_diag_funnel LIMIT 1;
  RAISE NOTICE 'v_diag_funnel queriable: % rows visible', v_test_count;
END $$;

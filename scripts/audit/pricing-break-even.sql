-- scripts/audit/pricing-break-even.sql
-- Phase B compta analytique — seuil de rentabilité par bucket (Phase B Day-2..5).
--
-- Statut : SQL skeleton avec estimations industrie en fallback (sensibilité
-- ± 30 %). Suffisant pour identifier les buckets manifestement en perte
-- unitaire. Pour précision opérationnelle, remplacer les CTEs `est_*` par
-- les valeurs réelles après réponse owner sur docs/pricing/cost-data-request.md.
--
-- Correctif 2026-06-02 : le port n'est PAS un coût par-ligne — payé par le CLIENT
-- sous 150€ (pass-through), GRATUIT ≥150€ (franco, absorbé au niveau commande).
-- shipping_per_order=0 dans le seuil par-ligne (l'inclure créait un faux
-- "perte unitaire" sur le bucket 0-10€ — vérifié grille ___xtr_delivery_ape_france).
--
-- Périmètre : 6 buckets canon (0-10 / 10-30 / 30-80 / 80-150 / 150-300 / 300+),
-- 12 derniers mois roulants, pieces_price (442 173 lignes) + ___xtr_order_line.
--
-- Doctrine : docs/pricing/economic-governance-system.md
-- Modèle de coûts : docs/pricing/cost-allocation-model.md
--
-- Usage :
--   psql -d $DATABASE_URL -f scripts/audit/pricing-break-even.sql
-- Output : table de résultats par bucket avec verdict KEEP/MODIFY/STOP.

-- ============================================================================
-- ESTIMATIONS INDUSTRIE FALLBACK
-- Remplacer par valeurs owner après réponse cost-data-request.md.
-- ============================================================================

WITH est_costs AS (
  SELECT
    -- Picking par ligne (€)
    0.60::numeric AS picking_per_line,
    -- Packing par commande (€)
    0.40::numeric AS packing_per_order,
    -- Expédition : NEUTRE par ligne (corrigé 2026-06-02). Port payé par le CLIENT
    -- sous 150€ (pass-through exact : grille ___xtr_delivery_ape_france,
    -- facturé_TTC = coût_HT × 1,2) ; GRATUIT ≥150€ (franco, shipping-calculator
    -- .service.ts:45) = coût absorbé au niveau COMMANDE, pas par-SKU. Donc 0 ici.
    0.00::numeric AS shipping_per_order,
    -- Frais paiement (% du TTC + fixe €)
    0.015::numeric AS payment_rate_pct,
    0.10::numeric AS payment_fixed_per_order,
    -- Support client par ligne (€)
    0.35::numeric AS support_per_line,
    -- Retour par ligne retournée (€)
    4.00::numeric AS return_cost_per_returned_line,
    -- Taux retour par bucket (% — pondéré gamme, fallback uniforme)
    0.05::numeric AS return_rate_default,
    -- Fixe alloué (ratio annuel charges fixes / revenue annuel)
    0.10::numeric AS fixed_allocated_pct_of_revenue,
    -- TVA pour ramener TTC à HT
    0.20::numeric AS vat_rate,
    -- Ratio ligne / commande moyen (lignes par commande, pour
    -- amortir le coût packing+shipping qui est par commande)
    2.5::numeric AS avg_lines_per_order
),

-- ============================================================================
-- BUCKETIZATION (médianes mesurées sur pieces_price)
-- ============================================================================
buckets AS (
  SELECT
    CASE
      WHEN pri_achat_ht < 10   THEN '0-10'
      WHEN pri_achat_ht < 30   THEN '10-30'
      WHEN pri_achat_ht < 80   THEN '30-80'
      WHEN pri_achat_ht < 150  THEN '80-150'
      WHEN pri_achat_ht < 300  THEN '150-300'
      ELSE '300+'
    END AS bucket,
    pri_achat_ht::numeric AS achat_ht,
    pri_marge::numeric AS marge_pct
  FROM pieces_price
  WHERE pri_achat_ht > 0
    AND pri_marge IS NOT NULL
),

-- Statistiques par bucket
bucket_stats AS (
  SELECT
    bucket,
    COUNT(*) AS n_skus,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY achat_ht) AS achat_ht_median,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY marge_pct) AS applied_margin_pct_median,
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY marge_pct) AS applied_margin_pct_p25,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY marge_pct) AS applied_margin_pct_p75
  FROM buckets
  GROUP BY bucket
),

-- ============================================================================
-- CALCUL DU SEUIL DE RENTABILITE PAR BUCKET
-- ============================================================================
break_even AS (
  SELECT
    bs.bucket,
    bs.n_skus,
    bs.achat_ht_median,
    bs.applied_margin_pct_median,

    -- Coût-fixe par ligne (estimation fallback)
    (
      ec.picking_per_line
      + ec.packing_per_order / ec.avg_lines_per_order
      + ec.shipping_per_order / ec.avg_lines_per_order
      + ec.support_per_line
      + ec.return_cost_per_returned_line * ec.return_rate_default
      -- payment_rate_pct sera ajouté en aval (proportionnel au TTC)
      -- fixed_allocated sera ajouté en aval (proportionnel au revenue)
    )::numeric AS fixed_overhead_per_line_base,

    -- Prix de vente HT médian appliqué actuellement (achat + marge%)
    (bs.achat_ht_median * (1 + bs.applied_margin_pct_median / 100))::numeric AS applied_price_ht_median,

    ec.payment_rate_pct,
    ec.payment_fixed_per_order,
    ec.fixed_allocated_pct_of_revenue,
    ec.vat_rate,
    ec.avg_lines_per_order
  FROM bucket_stats bs
  CROSS JOIN est_costs ec
),

-- Frais paiement + fixe alloué (proportionnels au prix vente)
break_even_full AS (
  SELECT
    bucket,
    n_skus,
    achat_ht_median,
    applied_margin_pct_median,
    applied_price_ht_median,

    -- Coût-fixe total par ligne (en €)
    fixed_overhead_per_line_base
    + (applied_price_ht_median * (1 + vat_rate) * payment_rate_pct)
    + (payment_fixed_per_order / avg_lines_per_order)
    + (applied_price_ht_median * fixed_allocated_pct_of_revenue)
    AS fixed_overhead_per_line_total,

    -- Prix break-even (achat + tous les coûts non-COGS)
    achat_ht_median
    + fixed_overhead_per_line_base
    + (applied_price_ht_median * (1 + vat_rate) * payment_rate_pct)
    + (payment_fixed_per_order / avg_lines_per_order)
    + (applied_price_ht_median * fixed_allocated_pct_of_revenue)
    AS break_even_price_ht,

    -- Marge % de seuil de rentabilité
    100 * (
      fixed_overhead_per_line_base
      + (applied_price_ht_median * (1 + vat_rate) * payment_rate_pct)
      + (payment_fixed_per_order / avg_lines_per_order)
      + (applied_price_ht_median * fixed_allocated_pct_of_revenue)
    ) / achat_ht_median AS break_even_margin_pct
  FROM break_even
)

-- ============================================================================
-- RESULTAT FINAL : DELTA + VERDICT
-- ============================================================================
SELECT
  bucket,
  n_skus,
  ROUND(achat_ht_median, 2) AS achat_ht_median_eur,
  ROUND(applied_margin_pct_median, 1) AS applied_margin_pct,
  ROUND(break_even_margin_pct, 1) AS break_even_margin_pct,
  ROUND(applied_margin_pct_median - break_even_margin_pct, 1) AS safety_margin_pts,
  ROUND(applied_price_ht_median, 2) AS applied_price_ht_eur,
  ROUND(break_even_price_ht, 2) AS break_even_price_ht_eur,
  ROUND(fixed_overhead_per_line_total, 2) AS fixed_overhead_per_line_eur,

  -- Verdict per decision_closure_protocol
  CASE
    WHEN applied_margin_pct_median - break_even_margin_pct < 0
      THEN 'FAST_TRACK_V1.5 — perte unitaire, MODIFY floor immediately'
    WHEN applied_margin_pct_median - break_even_margin_pct < 5
      THEN 'WATCH — marge de sécurité étroite (< 5 pts), MODIFY si confirmé par données owner réelles'
    WHEN applied_margin_pct_median - break_even_margin_pct > 30
      THEN 'KEEP — large marge de sécurité (> 30 pts), bucket robuste'
    ELSE 'KEEP — marge de sécurité saine'
  END AS verdict
FROM break_even_full
ORDER BY
  CASE bucket
    WHEN '0-10'    THEN 1
    WHEN '10-30'   THEN 2
    WHEN '30-80'   THEN 3
    WHEN '80-150'  THEN 4
    WHEN '150-300' THEN 5
    ELSE 6
  END;

-- ============================================================================
-- ANNEXE : SENSIBILITE ± 30 %
-- Pour identifier les buckets dont le verdict change selon l'estimation,
-- re-runner avec :
--   - picking_per_line ∈ {0.42, 0.78}
--   - packing_per_order ∈ {0.21, 0.65}
--   - shipping_per_order : N/A — pass-through client <150€, franco ≥150€ hors-ligne
--   - return_rate ∈ {0.035, 0.065}
--   - fixed_allocated_pct ∈ {0.07, 0.13}
-- Un bucket robuste = même verdict sur les 5 runs. Un bucket borderline =
-- verdict qui bascule entre KEEP / WATCH / FAST_TRACK selon l'estimation —
-- exige les vraies données owner.
-- ============================================================================

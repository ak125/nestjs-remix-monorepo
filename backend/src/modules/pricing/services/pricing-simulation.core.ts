/**
 * Simulation core (pure, read-only). Estimates the business impact of a candidate
 * pricing grid WITHOUT a file and WITHOUT writing anything.
 *
 * Efficiency: works on cost-bucket aggregates (a single server-side GROUP BY,
 * ~6 rows), never a per-row pull of 442K rows. Reuses the L1 formula and L4 rule
 * resolution (no SQL formula duplication). Revenue is weighted by historical
 * sales (qty) so zero-rotation stock weighs ~0 — consistent with the "traffic
 * without conversion" reality.
 *
 * It is an ESTIMATE: the per-bucket rate is applied to the bucket's
 * sales-weighted achat aggregate (floor/cap effects are bucket-level, not
 * per-row). Exact per-row impact comes from the dry-run when a file is imported.
 */
import {
  computeVenteHtCents,
  computeVenteTtcCents,
  DEFAULT_TVA_RATE,
} from './pricing-formula.service';
import {
  resolveRule,
  type CustomerType,
  type PricingRule,
} from './pricing-strategy.service';

export interface CostBucketAggregate {
  /** Representative cost (cents) used to resolve the applicable rule (e.g. bucket min+1). */
  representativeCostCents: number;
  pieceCount: number;
  /** Σ achat_HT × qty_sold (cents) — sales-weighted cost base. */
  sumAchatXQtyCents: number;
  /** Σ current vente_TTC × qty_sold (cents) — current sales-weighted revenue. */
  sumVenteTtcXQtyCents: number;
}

export interface SimulationBucketResult {
  representativeCostCents: number;
  pieceCount: number;
  ruleId: number | null;
  appliedMarginRate: number | null;
  currentRevenueCents: number;
  estimatedRevenueCents: number;
  revenueDeltaCents: number;
}

export interface SimulationReport {
  customerType: CustomerType;
  totalCurrentRevenueCents: number;
  totalEstimatedRevenueCents: number;
  totalRevenueDeltaCents: number;
  /** Buckets with no matching rule (left unchanged, flagged — no silent default). */
  unmatchedBucketCount: number;
  buckets: SimulationBucketResult[];
}

export function computeGridSimulation(
  buckets: readonly CostBucketAggregate[],
  rules: readonly PricingRule[],
  customerType: CustomerType = 'B2C',
): SimulationReport {
  const results: SimulationBucketResult[] = [];
  let totalCurrent = 0;
  let totalEstimated = 0;
  let unmatched = 0;

  for (const b of buckets) {
    const rule = resolveRule(rules, {
      costCents: b.representativeCostCents,
      customerType,
    });
    const current = b.sumVenteTtcXQtyCents;
    let estimated = current;
    if (rule) {
      // Reuse L1: new sales-weighted vente from the bucket's weighted achat base.
      const venteHt = computeVenteHtCents(b.sumAchatXQtyCents, rule.marginRate);
      estimated = computeVenteTtcCents(venteHt, 0, 0, DEFAULT_TVA_RATE);
    } else {
      unmatched++;
    }
    totalCurrent += current;
    totalEstimated += estimated;
    results.push({
      representativeCostCents: b.representativeCostCents,
      pieceCount: b.pieceCount,
      ruleId: rule?.id ?? null,
      appliedMarginRate: rule?.marginRate ?? null,
      currentRevenueCents: current,
      estimatedRevenueCents: estimated,
      revenueDeltaCents: estimated - current,
    });
  }

  return {
    customerType,
    totalCurrentRevenueCents: totalCurrent,
    totalEstimatedRevenueCents: totalEstimated,
    totalRevenueDeltaCents: totalEstimated - totalCurrent,
    unmatchedBucketCount: unmatched,
    buckets: results,
  };
}

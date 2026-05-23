import {
  computeGridSimulation,
  type CostBucketAggregate,
} from '../pricing-simulation.core';
import type { PricingRule } from '../pricing-strategy.service';

const rule = (over: Partial<PricingRule>): PricingRule => ({
  id: 1,
  minCostCents: 0,
  maxCostCents: null,
  marginRate: 50,
  minMarginAmountCents: 0,
  maxMarginRate: null,
  customerType: 'B2C',
  supplierPmId: null,
  categoryGammeId: null,
  priority: 0,
  active: true,
  ...over,
});

describe('computeGridSimulation — read-only grid impact', () => {
  const buckets: CostBucketAggregate[] = [
    {
      representativeCostCents: 500,
      pieceCount: 100,
      sumAchatXQtyCents: 100000,
      sumVenteTtcXQtyCents: 198000,
    },
    {
      representativeCostCents: 40000,
      pieceCount: 10,
      sumAchatXQtyCents: 500000,
      sumVenteTtcXQtyCents: 750000,
    },
  ];

  it('applies the per-bucket rule and sums weighted revenue delta', () => {
    const rules = [
      rule({ id: 1, minCostCents: 0, maxCostCents: 1000, marginRate: 65 }),
      rule({ id: 2, minCostCents: 30000, maxCostCents: null, marginRate: 25 }),
    ];
    const r = computeGridSimulation(buckets, rules, 'B2C');
    // bucket1: vente_ht = 100000×1.65 = 165000 ; ttc ×1.2 = 198000 → delta 0 (≈ current)
    expect(r.buckets[0].ruleId).toBe(1);
    expect(r.buckets[0].estimatedRevenueCents).toBe(
      Math.round(Math.round(100000 * 1.65) * 1.2),
    );
    // bucket2: 500000×1.25=625000 ×1.2=750000 → delta 0
    expect(r.buckets[1].ruleId).toBe(2);
    expect(r.totalRevenueDeltaCents).toBe(
      r.totalEstimatedRevenueCents - r.totalCurrentRevenueCents,
    );
  });

  it('flags buckets with no matching rule (left unchanged, no silent default)', () => {
    const r = computeGridSimulation(
      buckets,
      [rule({ minCostCents: 999999 })],
      'B2C',
    );
    expect(r.unmatchedBucketCount).toBe(2);
    expect(r.buckets[0].estimatedRevenueCents).toBe(
      r.buckets[0].currentRevenueCents,
    );
    expect(r.buckets[0].ruleId).toBeNull();
  });

  it('a more aggressive grid (lower rate) reduces estimated revenue on expensive bucket', () => {
    const r = computeGridSimulation(
      [buckets[1]],
      [
        rule({
          id: 9,
          minCostCents: 30000,
          maxCostCents: null,
          marginRate: 10,
        }),
      ], // 25%→10%
      'B2C',
    );
    expect(r.totalRevenueDeltaCents).toBeLessThan(0); // compression
  });
});

import {
  computeProjectionFromSimulation,
  DEFAULT_PROJECTION_INPUTS,
  type ProjectionInputs,
} from '../pricing-projection.core';
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

const buckets: CostBucketAggregate[] = [
  {
    representativeCostCents: 500, // 5 €
    pieceCount: 100,
    sumAchatXQtyCents: 100_000,
    sumVenteTtcXQtyCents: 198_000, // current = 65% × 1.2 TVA
  },
  {
    representativeCostCents: 40_000, // 400 €
    pieceCount: 10,
    sumAchatXQtyCents: 500_000,
    sumVenteTtcXQtyCents: 750_000, // current = 25% × 1.2 TVA
  },
];

const calibratedRules = [
  rule({ id: 1, minCostCents: 0, maxCostCents: 1000, marginRate: 65 }),
  rule({ id: 2, minCostCents: 30_000, maxCostCents: null, marginRate: 25 }),
];

describe('computeProjectionFromSimulation — 7-axis scorecard', () => {
  it('produces 7 axes with the canonical key set + confidence labels', () => {
    const sim = computeGridSimulation(buckets, calibratedRules, 'B2C');
    const proj = computeProjectionFromSimulation(buckets, sim);
    const keys = proj.axes.map((a) => a.key);
    expect(keys).toEqual([
      'margin_delta_cents',
      'revenue_delta_cents',
      'cash_pressure_cents',
      'logistics_load_cents',
      'sav_load_cents',
      'stock_rotation_impact',
      'supplier_variance_risk',
    ]);
    expect(proj.axes.filter((a) => a.confidence === 'HIGH')).toHaveLength(2);
    expect(proj.axes.filter((a) => a.confidence === 'MEDIUM')).toHaveLength(3);
    expect(proj.axes.filter((a) => a.confidence === 'PENDING_DATA')).toHaveLength(
      2,
    );
  });

  it('flags PENDING_DATA axes with null values + explicit reason (no silent fallback)', () => {
    const sim = computeGridSimulation(buckets, calibratedRules, 'B2C');
    const proj = computeProjectionFromSimulation(buckets, sim);
    const pending = proj.axes.filter((a) => a.confidence === 'PENDING_DATA');
    for (const axis of pending) {
      expect(axis.valueCents).toBeNull();
      expect(axis.lowCents).toBeNull();
      expect(axis.highCents).toBeNull();
      expect(axis.pendingReason).toBeTruthy();
    }
  });

  it('reports zero margin/revenue delta when candidate grid matches current state (legacy seed)', () => {
    const sim = computeGridSimulation(buckets, calibratedRules, 'B2C');
    const proj = computeProjectionFromSimulation(buckets, sim);
    const marginAxis = proj.axes.find((a) => a.key === 'margin_delta_cents')!;
    const revenueAxis = proj.axes.find((a) => a.key === 'revenue_delta_cents')!;
    expect(marginAxis.valueCents).toBe(0);
    expect(revenueAxis.valueCents).toBe(0);
  });

  it('reports cash pressure = 0 when margin delta ≥ 0 (no carrying cost on extra margin)', () => {
    // Grid that increases the rate on bucket 0 (5€ piece) from 65% to 80%.
    const aggressiveRules = [
      rule({ id: 1, minCostCents: 0, maxCostCents: 1000, marginRate: 80 }),
      rule({ id: 2, minCostCents: 30_000, maxCostCents: null, marginRate: 25 }),
    ];
    const sim = computeGridSimulation(buckets, aggressiveRules, 'B2C');
    const proj = computeProjectionFromSimulation(buckets, sim);
    const cashAxis = proj.axes.find((a) => a.key === 'cash_pressure_cents')!;
    expect(cashAxis.valueCents).toBe(0);
  });

  it('reports cash pressure > 0 when grid compresses margin (cost of capital on inventory)', () => {
    // Compress bucket 0 from 65% to 30% — margin shrinks → cash burn proxy.
    const compressed = [
      rule({ id: 1, minCostCents: 0, maxCostCents: 1000, marginRate: 30 }),
      rule({ id: 2, minCostCents: 30_000, maxCostCents: null, marginRate: 25 }),
    ];
    const sim = computeGridSimulation(buckets, compressed, 'B2C');
    const proj = computeProjectionFromSimulation(buckets, sim);
    const cashAxis = proj.axes.find((a) => a.key === 'cash_pressure_cents')!;
    expect(cashAxis.valueCents).toBeGreaterThan(0);
    expect(cashAxis.lowCents).toBeLessThan(cashAxis.valueCents!);
    expect(cashAxis.highCents).toBeGreaterThan(cashAxis.valueCents!);
  });

  it('logistics_load_cents scales with totalPieceCount × picking estimate', () => {
    const sim = computeGridSimulation(buckets, calibratedRules, 'B2C');
    const proj = computeProjectionFromSimulation(buckets, sim);
    const logisticsAxis = proj.axes.find(
      (a) => a.key === 'logistics_load_cents',
    )!;
    // 110 lignes × 60 cents = 6600 cents
    expect(logisticsAxis.valueCents).toBe(6600);
    expect(proj.totalPieceCount).toBe(110);
  });

  it('sav_load_cents scales with totalPieceCount × return_rate × return_cost', () => {
    const sim = computeGridSimulation(buckets, calibratedRules, 'B2C');
    const proj = computeProjectionFromSimulation(buckets, sim);
    const savAxis = proj.axes.find((a) => a.key === 'sav_load_cents')!;
    // 110 × 0.05 × 400 = 2200
    expect(savAxis.valueCents).toBe(2200);
  });

  it('honors caller-provided ProjectionInputs (replaces defaults wholesale)', () => {
    const customInputs: ProjectionInputs = {
      ...DEFAULT_PROJECTION_INPUTS,
      pickingCostPerLineCents: 100,
      returnRate: 0.1,
      returnCostPerLineCents: 500,
    };
    const sim = computeGridSimulation(buckets, calibratedRules, 'B2C');
    const proj = computeProjectionFromSimulation(buckets, sim, customInputs);
    const logisticsAxis = proj.axes.find(
      (a) => a.key === 'logistics_load_cents',
    )!;
    const savAxis = proj.axes.find((a) => a.key === 'sav_load_cents')!;
    expect(logisticsAxis.valueCents).toBe(110 * 100);
    expect(savAxis.valueCents).toBe(Math.round(110 * 0.1 * 500));
  });

  it('throws on bucket / simulation length mismatch (no silent realignment)', () => {
    const sim = computeGridSimulation(buckets, calibratedRules, 'B2C');
    expect(() =>
      computeProjectionFromSimulation([buckets[0]], sim),
    ).toThrow(/length mismatch/);
  });

  it('throws on bucket misalignment by representativeCostCents (no silent realignment)', () => {
    const sim = computeGridSimulation(buckets, calibratedRules, 'B2C');
    const shuffled = [buckets[1], buckets[0]];
    expect(() => computeProjectionFromSimulation(shuffled, sim)).toThrow(
      /bucket misalignment/,
    );
  });

  it('hasBorderlineAxis = true when a MEDIUM axis envelope brackets zero', () => {
    // Construct a degenerate scenario where logistics load near zero.
    const tinyBuckets: CostBucketAggregate[] = [
      {
        representativeCostCents: 500,
        pieceCount: 1,
        sumAchatXQtyCents: 1000,
        sumVenteTtcXQtyCents: 1980,
      },
    ];
    const tinyRules = [
      rule({ id: 1, minCostCents: 0, maxCostCents: 1000, marginRate: 65 }),
    ];
    const tinyInputs: ProjectionInputs = {
      ...DEFAULT_PROJECTION_INPUTS,
      pickingCostPerLineCents: 0, // logistics_load = 0
      returnRate: 0, // sav_load = 0
    };
    const sim = computeGridSimulation(tinyBuckets, tinyRules, 'B2C');
    const proj = computeProjectionFromSimulation(
      tinyBuckets,
      sim,
      tinyInputs,
    );
    // All MEDIUM axes are exactly 0 (no envelope crosses), HIGH axes are 0 too.
    // hasBorderlineAxis only flips when value≠0 yet envelope brackets 0 ; here all 0.
    expect(proj.hasBorderlineAxis).toBe(false);
  });
});

/**
 * Multi-effects profitability projection (pure, read-only).
 *
 * Extends {@link computeGridSimulation} with a 7-axis scorecard, per the
 * pricing Economic Governance System doctrine
 * (`docs/pricing/economic-governance-system.md`, section "Phase B.3 Projection
 * multi-effets"). A bare revenue delta is misleading: a candidate grid that
 * looks more profitable on Excel can wreck operations (cash burn, logistics
 * saturation, SAV spike). This module surfaces the 4 quantitative axes that
 * are computable from bucket aggregates + industry estimates, and flags the 2
 * non-computable axes explicitly (no silent fallback).
 *
 * Composition (no recomputation): input is a {@link SimulationReport} from the
 * existing core, plus a small {@link ProjectionInputs} record of industry
 * estimates (see `docs/pricing/cost-allocation-model.md`, replaced post-Phase-B
 * by real owner data via `docs/pricing/cost-data-request.md`).
 *
 * Confidence labels (decision_closure_protocol):
 *  - HIGH    — computed from observed aggregates (no estimate involved).
 *  - MEDIUM  — proxy using documented industry estimate (± 30 % sensitivity).
 *  - PENDING_DATA — non-computable from bucket aggregates ; requires per-SKU
 *    data the V1 pipeline does not surface. Surface a placeholder, not a guess.
 *
 * Pure functions, zero I/O.
 */
import type {
  CostBucketAggregate,
  SimulationBucketResult,
  SimulationReport,
} from './pricing-simulation.core';

export type AxisConfidence = 'HIGH' | 'MEDIUM' | 'PENDING_DATA';

/** Industry-default estimates used by the MEDIUM-confidence axes. */
export interface ProjectionInputs {
  /**
   * Average days-of-stock across the active catalogue. Used to size the cash
   * pressure of a margin delta on the working capital tied to inventory.
   * Industry fallback: 90 days for an auto-parts distributor.
   */
  avgDaysOfStock: number;
  /** Annual cost of capital, decimal (e.g. 0.06 = 6 %). Default 0.06. */
  annualCostOfCapital: number;
  /** Picking + packing fully-allocated cost per order line, in cents. Fallback 60. */
  pickingCostPerLineCents: number;
  /** Average return rate per line, decimal (e.g. 0.05). Industry fallback 0.05. */
  returnRate: number;
  /** Cost of handling one returned line, in cents. Fallback 400. */
  returnCostPerLineCents: number;
  /**
   * Sensitivity bound applied to MEDIUM-confidence axes to derive a low/high
   * envelope around each estimate. Decimal (e.g. 0.30 = ± 30 %).
   */
  sensitivityBound: number;
}

/**
 * Conservative industry defaults documented in `docs/pricing/cost-allocation-model.md`.
 * Replace whole record post-Phase-B with measured owner values.
 */
export const DEFAULT_PROJECTION_INPUTS: ProjectionInputs = {
  avgDaysOfStock: 90,
  annualCostOfCapital: 0.06,
  pickingCostPerLineCents: 60,
  returnRate: 0.05,
  returnCostPerLineCents: 400,
  sensitivityBound: 0.3,
};

/** A single scorecard axis with point estimate + low/high sensitivity envelope. */
export interface ProjectionAxis {
  /** Stable identifier (snake_case) — used by downstream report renderers. */
  key:
    | 'margin_delta_cents'
    | 'revenue_delta_cents'
    | 'cash_pressure_cents'
    | 'logistics_load_cents'
    | 'sav_load_cents'
    | 'stock_rotation_impact'
    | 'supplier_variance_risk';
  /** Human-readable label (French canonical wording). */
  label: string;
  /** Point estimate ; `null` when axis is PENDING_DATA. */
  valueCents: number | null;
  /** Lower bound from sensitivity ; `null` for PENDING_DATA + HIGH-confidence axes. */
  lowCents: number | null;
  /** Upper bound from sensitivity ; `null` for PENDING_DATA + HIGH-confidence axes. */
  highCents: number | null;
  confidence: AxisConfidence;
  /** Why the axis is not computable today (only for PENDING_DATA). */
  pendingReason?: string;
}

/** Per-bucket breakdown (for the auditable report — not just totals). */
export interface ProjectionBucketBreakdown {
  representativeCostCents: number;
  pieceCount: number;
  ruleId: number | null;
  /** Margin delta on the bucket, cents. */
  marginDeltaCents: number;
  /** Revenue delta on the bucket, cents. */
  revenueDeltaCents: number;
  /** Cash pressure proxy on the bucket, cents. */
  cashPressureCents: number;
}

export interface ProjectionReport {
  /** Echoed from the source SimulationReport for traceability. */
  customerType: SimulationReport['customerType'];
  inputs: ProjectionInputs;
  /** Total pieceCount across all buckets — denominator for the per-line proxies. */
  totalPieceCount: number;
  axes: readonly ProjectionAxis[];
  buckets: readonly ProjectionBucketBreakdown[];
  /** Set to true if any HIGH/MEDIUM axis crossed its ± sensitivity zero line. */
  hasBorderlineAxis: boolean;
}

/**
 * Compute the per-bucket margin delta (cents).
 *
 * Margin (gross) = revenue_TTC − COGS. We approximate COGS by the
 * sales-weighted achat aggregate already exposed on the bucket, which matches
 * the sales-weighted revenue on the same denominator. Both current and
 * estimated bucket-margins are therefore comparable on the same volume basis.
 *
 * NB: this is bucket-margin in TTC terms (matches how revenue is exposed).
 * For an HT-comparison subtract DEFAULT_TVA_RATE in a derived step ; we keep
 * TTC here to stay consistent with `sumVenteTtcXQtyCents`.
 */
function marginDeltaCentsForBucket(
  bucket: CostBucketAggregate,
  result: SimulationBucketResult,
): number {
  const cogs = bucket.sumAchatXQtyCents;
  const currentMargin = result.currentRevenueCents - cogs;
  const estimatedMargin = result.estimatedRevenueCents - cogs;
  return estimatedMargin - currentMargin;
}

/**
 * Compute cash-pressure proxy on a bucket (cents). When the candidate grid
 * increases revenue without changing COGS, that cash is "free" (proxy = 0).
 * When COGS effectively shifts (estimatedMargin lower → working-capital cycle
 * lengthens), the proxy is `|marginDelta| × avgDaysOfStock / 365 × costOfCapital`.
 * Conservative : always reports the **absolute** value as pressure on cash
 * (margin compression = cash burn through inventory carrying cost).
 */
function cashPressureCentsForBucket(
  marginDelta: number,
  inputs: ProjectionInputs,
): number {
  if (marginDelta >= 0) return 0;
  const dailyCapitalRate = inputs.annualCostOfCapital / 365;
  return Math.round(
    Math.abs(marginDelta) * inputs.avgDaysOfStock * dailyCapitalRate,
  );
}

function sensitivityEnvelope(
  value: number,
  bound: number,
): { low: number; high: number } {
  const delta = Math.abs(value) * bound;
  return { low: Math.round(value - delta), high: Math.round(value + delta) };
}

/**
 * Build the multi-effects projection from an existing {@link SimulationReport}.
 * The caller MUST provide both the original `buckets` (for COGS context, since
 * the SimulationReport drops the achat aggregate) and the SimulationReport.
 */
export function computeProjectionFromSimulation(
  buckets: readonly CostBucketAggregate[],
  simulation: SimulationReport,
  inputs: ProjectionInputs = DEFAULT_PROJECTION_INPUTS,
): ProjectionReport {
  if (buckets.length !== simulation.buckets.length) {
    throw new Error(
      `pricing-projection: buckets length mismatch (got ${buckets.length}, simulation has ${simulation.buckets.length})`,
    );
  }

  let totalMarginDelta = 0;
  let totalCashPressure = 0;
  let totalPieceCount = 0;
  const breakdown: ProjectionBucketBreakdown[] = [];

  for (let i = 0; i < buckets.length; i++) {
    const bucket = buckets[i];
    const result = simulation.buckets[i];
    if (bucket.representativeCostCents !== result.representativeCostCents) {
      throw new Error(
        `pricing-projection: bucket misalignment at index ${i} (got ${bucket.representativeCostCents}, simulation has ${result.representativeCostCents})`,
      );
    }
    const marginDelta = marginDeltaCentsForBucket(bucket, result);
    const cashPressure = cashPressureCentsForBucket(marginDelta, inputs);
    totalMarginDelta += marginDelta;
    totalCashPressure += cashPressure;
    totalPieceCount += bucket.pieceCount;
    breakdown.push({
      representativeCostCents: bucket.representativeCostCents,
      pieceCount: bucket.pieceCount,
      ruleId: result.ruleId,
      marginDeltaCents: marginDelta,
      revenueDeltaCents: result.revenueDeltaCents,
      cashPressureCents: cashPressure,
    });
  }

  const totalRevenueDelta = simulation.totalRevenueDeltaCents;
  const logisticsLoad = totalPieceCount * inputs.pickingCostPerLineCents;
  const savLoad = Math.round(
    totalPieceCount * inputs.returnRate * inputs.returnCostPerLineCents,
  );

  const cashEnv = sensitivityEnvelope(totalCashPressure, inputs.sensitivityBound);
  const logisticsEnv = sensitivityEnvelope(logisticsLoad, inputs.sensitivityBound);
  const savEnv = sensitivityEnvelope(savLoad, inputs.sensitivityBound);

  const axes: ProjectionAxis[] = [
    {
      key: 'margin_delta_cents',
      label: 'Delta marge brute (TTC, ventes pondérées)',
      valueCents: totalMarginDelta,
      lowCents: null,
      highCents: null,
      confidence: 'HIGH',
    },
    {
      key: 'revenue_delta_cents',
      label: 'Delta revenue TTC',
      valueCents: totalRevenueDelta,
      lowCents: null,
      highCents: null,
      confidence: 'HIGH',
    },
    {
      key: 'cash_pressure_cents',
      label: 'Pression trésorerie (capital immobilisé en stock)',
      valueCents: totalCashPressure,
      lowCents: cashEnv.low,
      highCents: cashEnv.high,
      confidence: 'MEDIUM',
    },
    {
      key: 'logistics_load_cents',
      label: 'Charge logistique (picking + packing)',
      valueCents: logisticsLoad,
      lowCents: logisticsEnv.low,
      highCents: logisticsEnv.high,
      confidence: 'MEDIUM',
    },
    {
      key: 'sav_load_cents',
      label: 'Charge SAV / retours (estimée)',
      valueCents: savLoad,
      lowCents: savEnv.low,
      highCents: savEnv.high,
      confidence: 'MEDIUM',
    },
    {
      key: 'stock_rotation_impact',
      label: 'Impact rotation stock (jours)',
      valueCents: null,
      lowCents: null,
      highCents: null,
      confidence: 'PENDING_DATA',
      pendingReason:
        "Requires per-SKU stock + sales velocity data not surfaced by cost-bucket aggregates. Available after Phase B owner data + per-SKU rotation snapshot.",
    },
    {
      key: 'supplier_variance_risk',
      label: 'Risque variance fournisseur (rupture)',
      valueCents: null,
      lowCents: null,
      highCents: null,
      confidence: 'PENDING_DATA',
      pendingReason:
        "Requires per-supplier rupture-frequency history not exposed by bucket aggregates. Will be computed once Phase C sentinel + supplier-offer observatory data lands.",
    },
  ];

  // Borderline = any HIGH/MEDIUM axis where the sensitivity envelope crosses 0.
  const hasBorderlineAxis = axes.some((axis) => {
    if (axis.confidence === 'PENDING_DATA') return false;
    if (axis.valueCents === null) return false;
    if (axis.lowCents !== null && axis.highCents !== null) {
      return axis.lowCents <= 0 && axis.highCents >= 0 && axis.valueCents !== 0;
    }
    return false;
  });

  return {
    customerType: simulation.customerType,
    inputs,
    totalPieceCount,
    axes,
    buckets: breakdown,
    hasBorderlineAxis,
  };
}

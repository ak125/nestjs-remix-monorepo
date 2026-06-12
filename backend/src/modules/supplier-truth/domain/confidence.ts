/**
 * Supplier Availability Truth — availability confidence score (pure, Layer 3).
 *
 * Produces a 0-100 confidence used by the state machine bands
 * (0-30 unreliable, 30-70 sur commande, 70-100 stock fiable).
 *
 * `parseError` is a hard cap: a degraded/broken parse can never produce a
 * confident "available" — a broken HTML/JSON response must NOT read as in-stock.
 */

export interface ConfidenceInput {
  /** Snapshot age in minutes (use provenance-weighted age upstream). */
  ageMinutes: number;
  /** 0..1 — historical operational stability of the supplier. */
  supplierStability: number;
  /** 0..1 — observed order-vs-claim mismatch frequency. */
  mismatchRate: number;
  /** 0..1 — normalized variance of real delivery delays. */
  delayVariance: number;
  /** Current snapshot's parse degraded. */
  parseError: boolean;
  /** 0..1 — recent fetch timeout rate. */
  timeoutRate: number;
}

const clamp100 = (n: number): number => Math.max(0, Math.min(100, n));
const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

/** Freshness reaches 0 after 24h; linear in between. */
const FRESHNESS_HORIZON_MINUTES = 24 * 60;

export function computeAvailabilityConfidence(i: ConfidenceInput): number {
  // Hard cap: a broken parse is never confident, even for a stable supplier.
  if (i.parseError) return clamp100(20 * clamp01(i.supplierStability));

  const freshness = Math.max(
    0,
    1 - Math.max(0, i.ageMinutes) / FRESHNESS_HORIZON_MINUTES,
  );

  const score =
    40 * freshness +
    25 * clamp01(i.supplierStability) +
    15 * (1 - clamp01(i.mismatchRate)) +
    10 * (1 - clamp01(i.delayVariance)) +
    10 * (1 - clamp01(i.timeoutRate));

  return clamp100(Math.round(score));
}

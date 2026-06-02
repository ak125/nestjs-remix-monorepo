/**
 * Supplier Availability Truth — effective-score source selection (pure, Layer 3).
 *
 * When several suppliers report on the same piece, the projection adopts the
 * source with the highest effective score — NOT simply the most recent one
 * (a fresh-but-broken read must lose to a slightly older reliable one).
 *
 * Robust hybrid model (NOT a pure product):
 *   - `parseQuality` is a HARD GATE — a broken read (0) annihilates the score,
 *     because we cannot trust a value we failed to parse.
 *   - the remaining factors combine as a weighted average, so a single transient
 *     low factor degrades the score without collapsing it to ~0 (which a pure
 *     product `f1*f2*f3*f4` would do).
 */

export interface EffectiveScoreInput {
  /** 0..1 — how fresh the source's snapshot is (provenance-weighted upstream). */
  freshness: number;
  /** 0..1 — operational reliability (observed mismatch/parse/timeout), NOT business score. */
  supplierReliability: number;
  /** 0..1 — quality of the current parse (1 = clean, 0 = broken). Hard gate. */
  parseQuality: number;
  /** 0..1 — historical accuracy of this source's claims. */
  historicalAccuracy: number;
}

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

const WEIGHTS = { freshness: 0.4, reliability: 0.35, historicalAccuracy: 0.25 };

export function effectiveScore(i: EffectiveScoreInput): number {
  const parseQuality = clamp01(i.parseQuality);
  const blend =
    WEIGHTS.freshness * clamp01(i.freshness) +
    WEIGHTS.reliability * clamp01(i.supplierReliability) +
    WEIGHTS.historicalAccuracy * clamp01(i.historicalAccuracy);
  return clamp01(parseQuality * blend);
}

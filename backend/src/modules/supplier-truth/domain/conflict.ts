/**
 * Supplier Availability Truth — graded conflict classifier (pure, Layer 3).
 *
 * Binary "any disagreement = conflict" floods the funnel; instead we grade:
 *   - HARD_CONFLICT     : reliable sources disagree on availability itself.
 *   - SOFT_CONFLICT     : all agree available, but delays diverge materially.
 *   - DEGRADED_CONSENSUS: all agree, but every source is low confidence.
 *   - NONE              : agreement, or not enough reliable signal to conflict.
 *
 * Only sources at/above the reliability floor count toward HARD classification —
 * a lone unreliable outlier must not flip a confident piece into conflict.
 */

import {
  ConflictKind,
  CONFIDENCE_PENDING,
  CONFIDENCE_VERIFIED,
} from './availability-state';

export interface SupplierClaim {
  available: boolean;
  delayDays: number | null;
  confidence: number; // 0-100
}

/** Delay spread (days) above which "available" sources are deemed in soft conflict. */
const SOFT_DELAY_SPREAD_DAYS = 7;

export function classifyConflict(claims: SupplierClaim[]): ConflictKind {
  if (claims.length < 2) return ConflictKind.NONE;

  const reliable = claims.filter((c) => c.confidence >= CONFIDENCE_PENDING);

  // Disagreement on availability among reliable sources = hard conflict.
  if (reliable.length >= 2) {
    const anyAvailable = reliable.some((c) => c.available);
    const anyUnavailable = reliable.some((c) => !c.available);
    if (anyAvailable && anyUnavailable) return ConflictKind.HARD_CONFLICT;
  }

  // No reliable source at all → consensus is degraded.
  if (reliable.length === 0) return ConflictKind.DEGRADED_CONSENSUS;

  // From here, reliable sources agree on availability.
  const allAgreeAvailable = reliable.every((c) => c.available);
  if (allAgreeAvailable) {
    const delays = reliable
      .map((c) => c.delayDays)
      .filter((d): d is number => d != null);
    if (delays.length >= 2) {
      const spread = Math.max(...delays) - Math.min(...delays);
      if (spread > SOFT_DELAY_SPREAD_DAYS) return ConflictKind.SOFT_CONFLICT;
    }
  }

  // Agreement, but if every source is weak, flag degraded consensus.
  const allLowConfidence = claims.every(
    (c) => c.confidence < CONFIDENCE_VERIFIED,
  );
  if (allLowConfidence) return ConflictKind.DEGRADED_CONSENSUS;

  return ConflictKind.NONE;
}

/**
 * ConfidencePolicy — V1A.0
 *
 * Pure function `getConfidenceBucket(score)` : confidence ∈ [0,1] → ConfidenceBucket.
 * Aucun fallback silencieux ; out-of-range → throw RangeError.
 *
 * Buckets canon (cf. ADR vault "Diagnostic Confidence Policy") :
 *   [0.00, 0.30) → weak           — safety rail ON
 *   [0.30, 0.50) → ambiguous      — safety rail ON
 *   [0.50, 0.70) → plausible
 *   [0.70, 0.85) → strong
 *   [0.85, 1.00] → very_strong
 *
 * Safety rail threshold : `safety_rail = true` si `max(confidence) < 0.5`
 * OU autres conditions (vehicle_ctx missing, contradictory signals).
 */
import type { ConfidenceBucket } from '../types/diagnostic-intent';

export const SAFETY_RAIL_THRESHOLD = 0.5;

export function getConfidenceBucket(score: number): ConfidenceBucket {
  if (!Number.isFinite(score) || score < 0 || score > 1) {
    throw new RangeError(
      `Confidence score must be in [0,1], got ${score}`,
    );
  }
  if (score < 0.3) return 'weak';
  if (score < 0.5) return 'ambiguous';
  if (score < 0.7) return 'plausible';
  if (score < 0.85) return 'strong';
  return 'very_strong';
}

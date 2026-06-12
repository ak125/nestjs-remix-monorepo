/**
 * Supplier Availability Truth — normalized state machine (pure, Layer 3).
 *
 * `decideState` computes the *target* canonical state for a piece from the
 * already-aggregated truth inputs. It is intentionally pure and synchronous so
 * it can be exhaustively unit/property tested. Lifecycle hysteresis (anti-flap)
 * is applied separately in the Truth Engine using the previous state + counters.
 *
 * Hard rule: errors always lean to caution — quarantine, cold-start, parse
 * failure, or low confidence can NEVER yield VERIFIED_AVAILABLE.
 */

export enum AvailabilityState {
  VERIFIED_AVAILABLE = 'VERIFIED_AVAILABLE',
  SUPPLIER_PENDING = 'SUPPLIER_PENDING',
  BACKORDER = 'BACKORDER',
  DEGRADED = 'DEGRADED',
  STALE = 'STALE',
  UNKNOWN = 'UNKNOWN',
  HARD_CONFLICT = 'HARD_CONFLICT',
  SOFT_CONFLICT = 'SOFT_CONFLICT',
  DEGRADED_CONSENSUS = 'DEGRADED_CONSENSUS',
}

export enum ConflictKind {
  NONE = 'NONE',
  SOFT_CONFLICT = 'SOFT_CONFLICT',
  HARD_CONFLICT = 'HARD_CONFLICT',
  DEGRADED_CONSENSUS = 'DEGRADED_CONSENSUS',
}

/** Confidence band thresholds (0-100). Shared with the confidence scorer. */
export const CONFIDENCE_VERIFIED = 70;
export const CONFIDENCE_PENDING = 30;

export interface StateDecisionInput {
  /** Whether any (non-error) snapshot exists for the piece. */
  hasSnapshot: boolean;
  /** Best source says the part is available. */
  available: boolean;
  /** Best source's snapshot is older than its dynamic TTL. */
  stale: boolean;
  /** Aggregated confidence 0-100 (already floored on parse error upstream). */
  confidence: number;
  /** Graded inter-supplier conflict. */
  conflict: ConflictKind;
  /** Known orderable delay when not in stock (enables BACKORDER). */
  delayDays: number | null;
  /** Chosen source's connector is quarantined (data frozen / untrusted). */
  quarantined: boolean;
  /** No observation history yet (new supplier/piece) → neutral prior. */
  coldStart: boolean;
}

/**
 * Compute the target state. Priority order encodes the safety guards:
 * missing data > conflict > quarantine/stale/cold-start > confidence/availability.
 */
export function decideState(i: StateDecisionInput): AvailabilityState {
  if (!i.hasSnapshot) return AvailabilityState.UNKNOWN;

  // Graded conflict takes precedence over a single source's optimism.
  if (i.conflict === ConflictKind.HARD_CONFLICT)
    return AvailabilityState.HARD_CONFLICT;
  if (i.conflict === ConflictKind.SOFT_CONFLICT)
    return AvailabilityState.SOFT_CONFLICT;
  if (i.conflict === ConflictKind.DEGRADED_CONSENSUS)
    return AvailabilityState.DEGRADED_CONSENSUS;

  // A frozen/untrusted connector can never promise stock.
  if (i.quarantined) return AvailabilityState.DEGRADED;

  // Expired snapshot.
  if (i.stale) return AvailabilityState.STALE;

  // Zero history → neutral prior, never verified.
  if (i.coldStart) return AvailabilityState.SUPPLIER_PENDING;

  // Too little confidence to assert anything.
  if (i.confidence < CONFIDENCE_PENDING)
    return AvailabilityState.SUPPLIER_PENDING;

  if (!i.available) {
    return i.delayDays != null
      ? AvailabilityState.BACKORDER
      : AvailabilityState.SUPPLIER_PENDING;
  }

  // Available + high confidence + fresh + no conflict.
  if (i.confidence >= CONFIDENCE_VERIFIED)
    return AvailabilityState.VERIFIED_AVAILABLE;

  return AvailabilityState.SUPPLIER_PENDING;
}

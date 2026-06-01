import {
  AvailabilityState,
  ConflictKind,
  decideState,
  type StateDecisionInput,
} from './availability-state';

const base: StateDecisionInput = {
  hasSnapshot: true,
  available: true,
  stale: false,
  confidence: 85,
  conflict: ConflictKind.NONE,
  delayDays: null,
  quarantined: false,
  coldStart: false,
};

describe('decideState', () => {
  it('VERIFIED_AVAILABLE when fresh, confident, available, no conflict', () => {
    expect(decideState(base)).toBe(AvailabilityState.VERIFIED_AVAILABLE);
  });

  it('UNKNOWN when no snapshot (wins over everything)', () => {
    expect(decideState({ ...base, hasSnapshot: false })).toBe(
      AvailabilityState.UNKNOWN,
    );
  });

  it('HARD_CONFLICT wins over availability', () => {
    expect(decideState({ ...base, conflict: ConflictKind.HARD_CONFLICT })).toBe(
      AvailabilityState.HARD_CONFLICT,
    );
  });

  it('SOFT_CONFLICT maps to SOFT_CONFLICT', () => {
    expect(decideState({ ...base, conflict: ConflictKind.SOFT_CONFLICT })).toBe(
      AvailabilityState.SOFT_CONFLICT,
    );
  });

  it('DEGRADED_CONSENSUS maps to DEGRADED_CONSENSUS', () => {
    expect(
      decideState({ ...base, conflict: ConflictKind.DEGRADED_CONSENSUS }),
    ).toBe(AvailabilityState.DEGRADED_CONSENSUS);
  });

  it('STALE when snapshot expired', () => {
    expect(decideState({ ...base, stale: true })).toBe(AvailabilityState.STALE);
  });

  it('BACKORDER when not available but orderable with known delay', () => {
    expect(decideState({ ...base, available: false, delayDays: 7 })).toBe(
      AvailabilityState.BACKORDER,
    );
  });

  it('SUPPLIER_PENDING when not available and no known delay', () => {
    expect(decideState({ ...base, available: false, delayDays: null })).toBe(
      AvailabilityState.SUPPLIER_PENDING,
    );
  });

  it('SUPPLIER_PENDING when confidence in the mid band', () => {
    expect(decideState({ ...base, confidence: 50 })).toBe(
      AvailabilityState.SUPPLIER_PENDING,
    );
  });

  // --- hard guards: errors always lean to caution ---
  it('quarantined is NEVER VERIFIED_AVAILABLE', () => {
    expect(decideState({ ...base, quarantined: true })).not.toBe(
      AvailabilityState.VERIFIED_AVAILABLE,
    );
  });

  it('cold-start (no history) is NEVER VERIFIED_AVAILABLE even when confident', () => {
    expect(decideState({ ...base, coldStart: true, confidence: 95 })).toBe(
      AvailabilityState.SUPPLIER_PENDING,
    );
  });

  it('low confidence is NEVER VERIFIED_AVAILABLE', () => {
    expect(decideState({ ...base, confidence: 10 })).not.toBe(
      AvailabilityState.VERIFIED_AVAILABLE,
    );
  });
});

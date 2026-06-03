import { classifyConflict, type SupplierClaim } from './conflict';
import { ConflictKind } from './availability-state';

const claim = (o: Partial<SupplierClaim>): SupplierClaim => ({
  available: true,
  delayDays: null,
  confidence: 85,
  ...o,
});

describe('classifyConflict', () => {
  it('single source ⇒ NONE', () => {
    expect(classifyConflict([claim({})])).toBe(ConflictKind.NONE);
  });

  it('empty ⇒ NONE', () => {
    expect(classifyConflict([])).toBe(ConflictKind.NONE);
  });

  it('reliable sources disagree on availability ⇒ HARD_CONFLICT', () => {
    expect(
      classifyConflict([
        claim({ available: true }),
        claim({ available: false, delayDays: 5 }),
      ]),
    ).toBe(ConflictKind.HARD_CONFLICT);
  });

  it('both available but delays diverge widely ⇒ SOFT_CONFLICT', () => {
    expect(
      classifyConflict([
        claim({ available: true, delayDays: 1 }),
        claim({ available: true, delayDays: 15 }),
      ]),
    ).toBe(ConflictKind.SOFT_CONFLICT);
  });

  it('agree available, similar delays ⇒ NONE', () => {
    expect(
      classifyConflict([
        claim({ available: true, delayDays: 2 }),
        claim({ available: true, delayDays: 3 }),
      ]),
    ).toBe(ConflictKind.NONE);
  });

  it('agree but all low confidence ⇒ DEGRADED_CONSENSUS', () => {
    expect(
      classifyConflict([
        claim({ available: true, confidence: 20 }),
        claim({ available: true, confidence: 25 }),
      ]),
    ).toBe(ConflictKind.DEGRADED_CONSENSUS);
  });

  it('a lone low-confidence source does not create a HARD conflict with a reliable one', () => {
    // unreliable (below floor) disagreement is ignored for HARD classification
    expect(
      classifyConflict([
        claim({ available: true, confidence: 90 }),
        claim({ available: false, confidence: 10, delayDays: 4 }),
      ]),
    ).not.toBe(ConflictKind.HARD_CONFLICT);
  });
});

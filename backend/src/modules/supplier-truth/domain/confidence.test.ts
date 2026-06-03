import {
  computeAvailabilityConfidence,
  type ConfidenceInput,
} from './confidence';

const base: ConfidenceInput = {
  ageMinutes: 0,
  supplierStability: 1,
  mismatchRate: 0,
  delayVariance: 0,
  parseError: false,
  timeoutRate: 0,
};

describe('computeAvailabilityConfidence', () => {
  it('fresh + stable + no errors ⇒ high (>=70)', () => {
    expect(computeAvailabilityConfidence(base)).toBeGreaterThanOrEqual(70);
  });

  it('parse error hard-caps below 30', () => {
    expect(
      computeAvailabilityConfidence({ ...base, parseError: true }),
    ).toBeLessThan(30);
  });

  it('decays with age', () => {
    expect(
      computeAvailabilityConfidence({ ...base, ageMinutes: 6000 }),
    ).toBeLessThan(computeAvailabilityConfidence(base));
  });

  it('high mismatch rate lowers the score', () => {
    expect(
      computeAvailabilityConfidence({ ...base, mismatchRate: 0.5 }),
    ).toBeLessThan(computeAvailabilityConfidence(base));
  });

  it('output is clamped to [0,100]', () => {
    const worst = computeAvailabilityConfidence({
      ageMinutes: 99999,
      supplierStability: 0,
      mismatchRate: 1,
      delayVariance: 1,
      parseError: false,
      timeoutRate: 1,
    });
    expect(worst).toBeGreaterThanOrEqual(0);
    expect(worst).toBeLessThanOrEqual(100);
    expect(computeAvailabilityConfidence(base)).toBeLessThanOrEqual(100);
  });
});

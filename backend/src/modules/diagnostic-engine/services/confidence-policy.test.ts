import {
  getConfidenceBucket,
  SAFETY_RAIL_THRESHOLD,
} from './confidence-policy';

describe('confidence-policy V1A.0', () => {
  describe('bucket boundaries', () => {
    test('0.0 → weak', () => {
      expect(getConfidenceBucket(0)).toBe('weak');
    });
    test('0.299 → weak', () => {
      expect(getConfidenceBucket(0.299)).toBe('weak');
    });
    test('0.30 → ambiguous (boundary inclusive)', () => {
      expect(getConfidenceBucket(0.3)).toBe('ambiguous');
    });
    test('0.499 → ambiguous', () => {
      expect(getConfidenceBucket(0.499)).toBe('ambiguous');
    });
    test('0.50 → plausible (boundary inclusive)', () => {
      expect(getConfidenceBucket(0.5)).toBe('plausible');
    });
    test('0.699 → plausible', () => {
      expect(getConfidenceBucket(0.699)).toBe('plausible');
    });
    test('0.70 → strong', () => {
      expect(getConfidenceBucket(0.7)).toBe('strong');
    });
    test('0.849 → strong', () => {
      expect(getConfidenceBucket(0.849)).toBe('strong');
    });
    test('0.85 → very_strong', () => {
      expect(getConfidenceBucket(0.85)).toBe('very_strong');
    });
    test('1.0 → very_strong', () => {
      expect(getConfidenceBucket(1.0)).toBe('very_strong');
    });
  });

  describe('out-of-range throws (no silent fallback)', () => {
    test('negative throws', () => {
      expect(() => getConfidenceBucket(-0.01)).toThrow(RangeError);
    });
    test('> 1 throws', () => {
      expect(() => getConfidenceBucket(1.01)).toThrow(RangeError);
    });
    test('NaN throws', () => {
      expect(() => getConfidenceBucket(NaN)).toThrow(RangeError);
    });
    test('Infinity throws', () => {
      expect(() => getConfidenceBucket(Infinity)).toThrow(RangeError);
    });
  });

  describe('safety rail threshold', () => {
    test('SAFETY_RAIL_THRESHOLD is 0.5 (canon)', () => {
      expect(SAFETY_RAIL_THRESHOLD).toBe(0.5);
    });
  });
});

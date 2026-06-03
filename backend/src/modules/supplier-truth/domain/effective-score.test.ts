import { effectiveScore, type EffectiveScoreInput } from './effective-score';

const strong: EffectiveScoreInput = {
  freshness: 1,
  supplierReliability: 1,
  parseQuality: 1,
  historicalAccuracy: 1,
};

describe('effectiveScore', () => {
  it('returns ~1 for a perfect source', () => {
    expect(effectiveScore(strong)).toBeCloseTo(1, 5);
  });

  it('parseQuality is a hard gate: 0 ⇒ 0', () => {
    expect(effectiveScore({ ...strong, parseQuality: 0 })).toBe(0);
  });

  it('a reliable-but-old source beats a fresh-but-broken one', () => {
    const reliableOld = effectiveScore({
      freshness: 0.2,
      supplierReliability: 1,
      parseQuality: 1,
      historicalAccuracy: 1,
    });
    const freshBroken = effectiveScore({
      freshness: 1,
      supplierReliability: 1,
      parseQuality: 0.1, // parsing barely worked
      historicalAccuracy: 1,
    });
    expect(reliableOld).toBeGreaterThan(freshBroken);
  });

  it('a single transient low factor degrades but does NOT annihilate (no pure-product collapse)', () => {
    const oneLowFactor = effectiveScore({
      ...strong,
      historicalAccuracy: 0.1,
    });
    // pure product would give 0.1; the hybrid blend must stay well above that
    expect(oneLowFactor).toBeGreaterThan(0.5);
    expect(oneLowFactor).toBeLessThan(1);
  });

  it('clamps inputs to [0,1] and output stays in [0,1]', () => {
    const s = effectiveScore({
      freshness: 5,
      supplierReliability: -2,
      parseQuality: 1,
      historicalAccuracy: 3,
    });
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(1);
  });
});

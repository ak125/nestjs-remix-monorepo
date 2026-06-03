import { resolveTtlMinutes, DEFAULT_TTL_MINUTES } from './ttl';

describe('resolveTtlMinutes', () => {
  it('falls back to the documented default when no profile/criticality', () => {
    expect(resolveTtlMinutes({})).toBe(DEFAULT_TTL_MINUTES);
  });

  it('uses the per-supplier profile TTL when present', () => {
    expect(resolveTtlMinutes({ supplierDefaultTtlMinutes: 360 })).toBe(360);
  });

  it('high criticality shortens the TTL', () => {
    const high = resolveTtlMinutes({ criticality: 'high' });
    expect(high).toBeLessThan(DEFAULT_TTL_MINUTES);
  });

  it('low criticality lengthens the TTL', () => {
    const low = resolveTtlMinutes({ criticality: 'low' });
    expect(low).toBeGreaterThan(DEFAULT_TTL_MINUTES);
  });

  it('a gamme override beats the default but criticality still applies', () => {
    const base = resolveTtlMinutes({ gammeTtlMinutes: 600 });
    expect(base).toBe(600);
    const crit = resolveTtlMinutes({
      gammeTtlMinutes: 600,
      criticality: 'high',
    });
    expect(crit).toBeLessThan(600);
  });

  it('never returns a non-positive TTL', () => {
    expect(resolveTtlMinutes({ supplierDefaultTtlMinutes: 0 })).toBeGreaterThan(
      0,
    );
  });
});

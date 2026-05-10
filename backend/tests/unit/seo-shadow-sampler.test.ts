/**
 * SeoShadowSampler — sampler déterministe (sha1-based bucket).
 *
 * @see backend/src/modules/seo-shadow-observatory/seo-shadow-sampler.service.ts
 */
import { ConfigService } from '@nestjs/config';

import { SeoShadowSampler } from '../../src/modules/seo-shadow-observatory/seo-shadow-sampler.service';

function makeSampler(rate: string | undefined): SeoShadowSampler {
  const cfg = {
    get: (key: string) =>
      key === 'SEO_CHAIN_SHADOW_SAMPLE_RATE' ? rate : undefined,
  } as unknown as ConfigService;
  return new SeoShadowSampler(cfg);
}

describe('SeoShadowSampler', () => {
  it('rate=0 → never samples', () => {
    const s = makeSampler('0');
    for (let i = 0; i < 1000; i++) {
      expect(s.shouldSample('R7_BRAND_HUB', `brand-${i}`)).toBe(false);
    }
  });

  it('rate=1 → always samples', () => {
    const s = makeSampler('1');
    for (let i = 0; i < 1000; i++) {
      expect(s.shouldSample('R7_BRAND_HUB', `brand-${i}`)).toBe(true);
    }
  });

  it('rate=0.5 → ~50% sur 10k itérations (tolérance ±3%)', () => {
    const s = makeSampler('0.5');
    let sampled = 0;
    for (let i = 0; i < 10000; i++) {
      if (s.shouldSample('R7_BRAND_HUB', `entity-${i}`)) sampled++;
    }
    expect(sampled).toBeGreaterThan(4700);
    expect(sampled).toBeLessThan(5300);
  });

  it('déterminisme cross-call : même paire = même décision', () => {
    const s = makeSampler('0.3');
    for (let i = 0; i < 100; i++) {
      const key = `entity-${i}`;
      const first = s.shouldSample('R7_BRAND_HUB', key);
      for (let j = 0; j < 5; j++) {
        expect(s.shouldSample('R7_BRAND_HUB', key)).toBe(first);
      }
    }
  });

  it('env malformée → fallback 0.01 (cohérent avec default)', () => {
    const s = makeSampler('not-a-number');
    expect(s.sampleRate).toBe(0.01);
  });

  it('env hors bornes → fallback 0.01', () => {
    expect(makeSampler('-0.5').sampleRate).toBe(0.01);
    expect(makeSampler('1.5').sampleRate).toBe(0.01);
  });

  it('env absente → fallback 0.01', () => {
    const s = makeSampler(undefined);
    expect(s.sampleRate).toBe(0.01);
  });
});

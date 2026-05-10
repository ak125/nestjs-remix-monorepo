/**
 * SeoShadowDiffEngine — diff field-level legacy↔chain + R8 canonical skip.
 *
 * @see backend/src/modules/seo-shadow-observatory/seo-shadow-diff-engine.service.ts
 */
import { SeoShadowDiffEngine } from '../../src/modules/seo-shadow-observatory/seo-shadow-diff-engine.service';
import { SeoShadowUrlNormalizer } from '../../src/modules/seo-shadow-observatory/seo-shadow-url-normalizer.service';
import type {
  ChainSeoSnapshot,
  LegacySeoSnapshot,
} from '../../src/modules/seo-shadow-observatory/types';

const REQUEST_URL = 'https://www.automecanik.com/constructeurs/bmw.html';

function legacy(overrides: Partial<LegacySeoSnapshot> = {}): LegacySeoSnapshot {
  return {
    title: 'Pièces BMW',
    description: 'Catalogue BMW',
    h1: 'BMW',
    content: 'Lorem',
    keywords: 'bmw,pieces',
    canonical: REQUEST_URL,
    robots: 'index,follow',
    ...overrides,
  };
}

function chain(overrides: Partial<ChainSeoSnapshot> = {}): ChainSeoSnapshot {
  return {
    title: 'Pièces BMW',
    description: 'Catalogue BMW',
    h1: 'BMW',
    content: 'Lorem',
    keywords: 'bmw,pieces',
    canonical: REQUEST_URL,
    robots: 'index,follow',
    ...overrides,
  };
}

describe('SeoShadowDiffEngine', () => {
  let engine: SeoShadowDiffEngine;
  beforeEach(() => {
    engine = new SeoShadowDiffEngine(new SeoShadowUrlNormalizer());
  });

  it('tous champs égaux → divergenceTypes vide + policyDivergence false', () => {
    const r = engine.compare(legacy(), chain(), REQUEST_URL, 'R7_BRAND_HUB');
    expect(r.divergenceTypes).toEqual([]);
    expect(r.policyDivergence).toBe(false);
    expect(r.summary.divergenceCount).toBe(0);
  });

  it('title divergent → divergenceTypes contient title, mais policyDivergence false', () => {
    const r = engine.compare(
      legacy(),
      chain({ title: 'Autre titre' }),
      REQUEST_URL,
      'R7_BRAND_HUB',
    );
    expect(r.divergenceTypes).toContain('title');
    expect(r.policyDivergence).toBe(false);
  });

  it('canonical divergent (R7) → policyDivergence true', () => {
    const r = engine.compare(
      legacy({ canonical: REQUEST_URL }),
      chain({ canonical: 'https://www.automecanik.com/constructeurs/audi.html' }),
      REQUEST_URL,
      'R7_BRAND_HUB',
    );
    expect(r.divergenceTypes).toContain('canonical');
    expect(r.policyDivergence).toBe(true);
  });

  it('canonical normalisé identique malgré format différent', () => {
    // legacy avec trailing slash + casse + http, chain forme normalisée
    const r = engine.compare(
      legacy({ canonical: 'http://www.automecanik.com/Constructeurs/BMW.html/' }),
      chain({ canonical: 'https://www.automecanik.com/constructeurs/bmw.html' }),
      REQUEST_URL,
      'R7_BRAND_HUB',
    );
    const canonical = r.diffs.find((d) => d.field === 'canonical');
    expect(canonical?.equal).toBe(true);
    expect(r.policyDivergence).toBe(false);
  });

  it('R8_VEHICLE → canonical equal=null + skip_reason', () => {
    const r = engine.compare(
      legacy({ canonical: 'https://www.automecanik.com/A.html' }),
      chain({ canonical: 'https://www.automecanik.com/B.html' }),
      REQUEST_URL,
      'R8_VEHICLE',
    );
    const canonical = r.diffs.find((d) => d.field === 'canonical');
    expect(canonical?.equal).toBeNull();
    expect(canonical?.skip_reason).toBe(
      'r8_frontend_redirect_logic_not_reproduced',
    );
    expect(r.divergenceTypes).not.toContain('canonical');
  });

  it('R8_VEHICLE robots divergent → policyDivergence true (canonical skip ne masque pas robots)', () => {
    const r = engine.compare(
      legacy({ robots: 'index,follow' }),
      chain({ robots: 'noindex,follow' }),
      REQUEST_URL,
      'R8_VEHICLE',
    );
    expect(r.divergenceTypes).toContain('robots');
    expect(r.policyDivergence).toBe(true);
  });

  it('robots un seul côté → equal=null, pas de policyDivergence sur robots seul', () => {
    const r = engine.compare(
      legacy({ robots: null }),
      chain({ robots: 'index,follow' }),
      REQUEST_URL,
      'R7_BRAND_HUB',
    );
    const robots = r.diffs.find((d) => d.field === 'robots');
    expect(robots?.equal).toBeNull();
  });

  it('robots whitespace/case insensitive', () => {
    const r = engine.compare(
      legacy({ robots: 'INDEX, FOLLOW' }),
      chain({ robots: 'index,follow' }),
      REQUEST_URL,
      'R7_BRAND_HUB',
    );
    const robots = r.diffs.find((d) => d.field === 'robots');
    expect(robots?.equal).toBe(true);
  });

  it('hashes 12 hex chars présents quand champ présent', () => {
    const r = engine.compare(legacy(), chain(), REQUEST_URL, 'R7_BRAND_HUB');
    const title = r.diffs.find((d) => d.field === 'title');
    expect(title?.legacyHash).toMatch(/^[0-9a-f]{12}$/);
    expect(title?.chainHash).toMatch(/^[0-9a-f]{12}$/);
  });

  it('summary contient surface + count + types', () => {
    const r = engine.compare(
      legacy(),
      chain({ title: 'X', description: 'Y' }),
      REQUEST_URL,
      'R7_BRAND_HUB',
    );
    expect(r.summary.surface).toBe('R7_BRAND_HUB');
    expect(r.summary.divergenceCount).toBe(2);
    expect(r.summary.divergenceTypes.sort()).toEqual(['description', 'title']);
  });
});

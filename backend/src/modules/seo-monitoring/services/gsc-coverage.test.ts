/**
 * Tests purs gsc-coverage — invariant de couverture GLOBALE (Σpages vs property_total).
 * Cœur déterministe, fixtures only (no I/O), comme seo-action.rules.
 */
import {
  computeGlobalCoverage,
  DEFAULT_GSC_COVERAGE_MIN_RATIO,
} from './gsc-coverage';

const D = '2026-06-10';

describe('computeGlobalCoverage', () => {
  it('insufficient_data quand pas de property_total (jamais « 0 opportunité »)', () => {
    const r = computeGlobalCoverage(D, null, [
      { clicks: 5, impressions: 100 },
    ]);
    expect(r.status).toBe('insufficient_data');
    expect(r.pagesVsPropertyImpr).toBeNull();
  });

  it('insufficient_data quand property_total.impressions = 0', () => {
    const r = computeGlobalCoverage(
      D,
      { clicks: 0, impressions: 0 },
      [{ clicks: 1, impressions: 10 }],
    );
    expect(r.status).toBe('insufficient_data');
  });

  it('coverage_gap quand le grain pages est vide alors que le total existe', () => {
    const r = computeGlobalCoverage(D, { clicks: 50, impressions: 5000 }, []);
    expect(r.status).toBe('coverage_gap');
    expect(r.pagesVsPropertyImpr).toBe(0);
  });

  it('coverage_gap quand le ratio est sous le plancher', () => {
    // Σpages impr = 1000 ; total = 5000 → ratio 0.2 < défaut 0.3
    const r = computeGlobalCoverage(D, { clicks: 50, impressions: 5000 }, [
      { clicks: 5, impressions: 600 },
      { clicks: 3, impressions: 400 },
    ]);
    expect(r.status).toBe('coverage_gap');
    expect(r.pagesVsPropertyImpr).toBeCloseTo(0.2, 5);
    expect(r.minRatio).toBe(DEFAULT_GSC_COVERAGE_MIN_RATIO);
  });

  it('ok quand le ratio est au-dessus du plancher (Σpages<total reste NORMAL)', () => {
    // Σpages impr = 4000 ; total = 5000 → ratio 0.8 ≥ 0.3
    const r = computeGlobalCoverage(D, { clicks: 80, impressions: 5000 }, [
      { clicks: 40, impressions: 2500 },
      { clicks: 30, impressions: 1500 },
    ]);
    expect(r.status).toBe('ok');
    expect(r.pagesVsPropertyImpr).toBeCloseTo(0.8, 5);
  });

  it('respecte un plancher gouverné custom (param injecté, pas magic constant)', () => {
    // ratio 0.2 ; plancher custom 0.1 → ok
    const r = computeGlobalCoverage(
      D,
      { clicks: 50, impressions: 5000 },
      [{ clicks: 8, impressions: 1000 }],
      0.1,
    );
    expect(r.status).toBe('ok');
    expect(r.minRatio).toBe(0.1);
  });

  it('clicks ratio null-safe quand total.clicks = 0 mais impressions > 0', () => {
    const r = computeGlobalCoverage(D, { clicks: 0, impressions: 5000 }, [
      { clicks: 0, impressions: 2000 },
    ]);
    expect(r.pagesVsPropertyClicks).toBeNull();
    expect(r.pagesVsPropertyImpr).toBeCloseTo(0.4, 5);
    expect(r.status).toBe('ok');
  });
});

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
    const r = computeGlobalCoverage(D, null, [{ clicks: 5, impressions: 100 }]);
    expect(r.status).toBe('insufficient_data');
    expect(r.pagesVsPropertyImpr).toBeNull();
  });

  it('insufficient_data quand property_total.impressions = 0', () => {
    const r = computeGlobalCoverage(D, { clicks: 0, impressions: 0 }, [
      { clicks: 1, impressions: 10 },
    ]);
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

describe('computeGlobalCoverage — plancher clics + grain (2026-09-11)', () => {
  it('coverage_gap quand les impressions passent le plancher mais pas les clics (grain segmenté réel du 09-01)', () => {
    // Mesure live : property_total 79 clics / 5 506 impr ; page+country+device 8 / 2 282.
    const r = computeGlobalCoverage(
      '2026-09-01',
      { clicks: 79, impressions: 5506 },
      [{ clicks: 8, impressions: 2282 }],
    );
    expect(r.pagesVsPropertyImpr).toBeCloseTo(0.4145, 3);
    expect(r.pagesVsPropertyClicks).toBeCloseTo(0.1013, 3);
    expect(r.status).toBe('coverage_gap');
    expect(r.grain).toBe('segmented_pages');
  });

  it('ok sur le grain page fidèle au plancher 0.9, ratio impressions > 1 accepté', () => {
    // Mesure live : dimension page seule = 79 clics / 5 730 impr pour 79 / 5 506.
    const r = computeGlobalCoverage(
      '2026-09-01',
      { clicks: 79, impressions: 5506 },
      [{ clicks: 79, impressions: 5730 }],
      0.9,
      'page_totals',
    );
    expect(r.pagesVsPropertyClicks).toBe(1);
    expect(r.pagesVsPropertyImpr).toBeGreaterThan(1);
    expect(r.status).toBe('ok');
    expect(r.grain).toBe('page_totals');
  });

  it('coverage_gap sur le grain fidèle si les clics tombent sous 0.9', () => {
    const r = computeGlobalCoverage(
      '2026-09-01',
      { clicks: 100, impressions: 5000 },
      [{ clicks: 85, impressions: 4990 }],
      0.9,
      'page_totals',
    );
    expect(r.status).toBe('coverage_gap');
  });
});

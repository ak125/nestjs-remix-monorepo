/**
 * Tests purs gsc-index-sampler — allocation stratifiée + mapping coverageState.
 * Cœurs déterministes, fixtures only.
 */
import {
  allocateStratifiedSample,
  mapCoverageToIndexStatus,
} from './gsc-index-sampler';

describe('allocateStratifiedSample', () => {
  const pools = {
    r1_hub: ['h1', 'h2'],
    r2_pages: ['p1', 'p2', 'p3', 'p4'],
    r8_vehicle: ['v1'],
    r3_content: ['c1', 'c2'],
  };

  it('respecte le budget total', () => {
    const out = allocateStratifiedSample(pools, 5);
    expect(out).toHaveLength(5);
  });

  it('round-robin priorisé : sert r1 en premier à chaque tour', () => {
    const out = allocateStratifiedSample(pools, 4).map((s) => s.url);
    // tour 1 : h1(r1), p1(r2), v1(r8), c1(r3)
    expect(out).toEqual(['h1', 'p1', 'v1', 'c1']);
  });

  it('déduplique une URL présente dans plusieurs pools', () => {
    const out = allocateStratifiedSample(
      { r1_hub: ['x'], r2_pages: ['x', 'y'] },
      10,
    );
    const urls = out.map((s) => s.url);
    expect(urls.filter((u) => u === 'x')).toHaveLength(1);
    expect(urls).toContain('y');
  });

  it('budget > total disponible → renvoie tout, sans boucler', () => {
    const out = allocateStratifiedSample({ r1_hub: ['a', 'b'] }, 100);
    expect(out.map((s) => s.url)).toEqual(['a', 'b']);
  });

  it('budget 0 → vide', () => {
    expect(allocateStratifiedSample(pools, 0)).toEqual([]);
  });

  it('étiquette correctement la strate', () => {
    const out = allocateStratifiedSample({ r8_vehicle: ['v1'] }, 1);
    expect(out[0]).toEqual({ url: 'v1', strate: 'r8_vehicle' });
  });
});

describe('mapCoverageToIndexStatus', () => {
  it('verdict PASS → INDEXED', () => {
    expect(
      mapCoverageToIndexStatus({
        verdict: 'PASS',
        coverageState: 'Submitted and indexed',
      }),
    ).toEqual({ status: 'INDEXED', isIndexed: true });
  });

  it('crawled - currently not indexed → NOT_INDEXED', () => {
    const r = mapCoverageToIndexStatus({
      verdict: 'NEUTRAL',
      coverageState: 'Crawled - currently not indexed',
    });
    expect(r).toEqual({ status: 'NOT_INDEXED', isIndexed: false });
  });

  it("excluded by 'noindex' tag → NOT_INDEXED", () => {
    expect(
      mapCoverageToIndexStatus({
        verdict: 'NEUTRAL',
        coverageState: "Excluded by 'noindex' tag",
      }).status,
    ).toBe('NOT_INDEXED');
  });

  it('URL is unknown to Google → UNKNOWN', () => {
    expect(
      mapCoverageToIndexStatus({
        verdict: 'NEUTRAL',
        coverageState: 'URL is unknown to Google',
      }).status,
    ).toBe('UNKNOWN');
  });

  it('redirect / soft 404 / robots / duplicate', () => {
    expect(
      mapCoverageToIndexStatus({ coverageState: 'Page with redirect' }).status,
    ).toBe('REDIRECT');
    expect(mapCoverageToIndexStatus({ coverageState: 'Soft 404' }).status).toBe(
      'SOFT_404',
    );
    expect(
      mapCoverageToIndexStatus({ coverageState: 'Blocked by robots.txt' })
        .status,
    ).toBe('BLOCKED_BY_ROBOTS');
    expect(
      mapCoverageToIndexStatus({
        coverageState: 'Duplicate without user-selected canonical',
      }).status,
    ).toBe('DUPLICATE_WITHOUT_CANONICAL');
  });

  it('coverageState absent → UNKNOWN (jamais un faux INDEXED)', () => {
    expect(mapCoverageToIndexStatus({}).status).toBe('UNKNOWN');
    expect(mapCoverageToIndexStatus({}).isIndexed).toBe(false);
  });
});

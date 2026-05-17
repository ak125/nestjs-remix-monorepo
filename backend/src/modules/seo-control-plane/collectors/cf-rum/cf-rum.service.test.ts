import type { ConfigService } from '@nestjs/config';
import type { SeoCriticality } from '@repo/registry';
import { CriticalityLoaderService } from '../../services/criticality-loader.service';
import { CfRumCollectorService, normalizePathGroup } from './cf-rum.service';

const VALID_CONFIG: SeoCriticality = {
  schemaVersion: '1.0.0',
  slo_window_minutes: 60,
  tiers: {
    tier0: {
      slo: 0.997,
      sampling_weight: 0.6,
      alerting: {
        breach_threshold_minutes: 5,
        channel: 'pagerduty',
        auto_issue: true,
      },
      routes: ['pieces/*'],
    },
    tier1: {
      slo: 0.99,
      sampling_weight: 0.3,
      alerting: {
        breach_threshold_minutes: 15,
        channel: 'slack',
        auto_issue: false,
      },
      routes: ['blog/*'],
    },
    tier2: {
      slo: 0.98,
      sampling_weight: 0.1,
      alerting: {
        breach_threshold_minutes: 60,
        channel: 'log',
        auto_issue: false,
      },
      routes: ['support/*'],
    },
  },
  excluded: { routes: ['admin/*', 'api/*'] },
  metadata: {
    adr_reference: 'ADR-064',
    introduced_in_pr: 'TBD',
    last_review: '2026-05-17',
    next_review_due: '2026-08-17',
  },
};

function makeConfigService(
  overrides: Record<string, string | number> = {},
): ConfigService {
  return {
    get: (key: string, def?: unknown): unknown => overrides[key] ?? def,
  } as unknown as ConfigService;
}

function buildSvc(
  crit: CriticalityLoaderService,
  cfg: ConfigService,
  spyUpsert: jest.Mock,
): CfRumCollectorService {
  const svc = Object.create(
    CfRumCollectorService.prototype,
  ) as CfRumCollectorService;
  Object.assign(svc, {
    logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
    criticality: crit,
    cfg,
    supabase: {
      from: (_table: string) => ({ upsert: spyUpsert }),
    },
  });
  return svc;
}

interface MockPageload {
  date: string;
  path: string;
  count: number;
  visits?: number;
}
interface MockPerformance {
  date: string;
  path: string;
  count: number;
  lcpP75?: number;
  lcpP50?: number;
  lcpP95?: number;
  clsP75?: number;
  inpP75?: number;
  fcpP75?: number;
  ttfbP75?: number;
}

function mockFetch(
  pageload: MockPageload[],
  performance: MockPerformance[],
): jest.Mock {
  return jest
    .fn()
    .mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as { query: string };
      const isPageload = body.query.includes('rumPageloadEventsAdaptiveGroups');
      return {
        ok: true,
        status: 200,
        text: async () => '',
        json: async () => ({
          data: {
            viewer: {
              accounts: [
                isPageload
                  ? {
                      rumPageloadEventsAdaptiveGroups: pageload.map((p) => ({
                        dimensions: { date: p.date, requestPath: p.path },
                        count: p.count,
                        sum: { visits: p.visits ?? p.count },
                      })),
                    }
                  : {
                      rumPerformanceEventsAdaptiveGroups: performance.map(
                        (p) => ({
                          dimensions: { date: p.date, requestPath: p.path },
                          count: p.count,
                          quantiles: {
                            performanceLargestContentfulPaintPathP50:
                              p.lcpP50 ?? null,
                            performanceLargestContentfulPaintPathP75:
                              p.lcpP75 ?? null,
                            performanceLargestContentfulPaintPathP95:
                              p.lcpP95 ?? null,
                            performanceCumulativeLayoutShiftP50: null,
                            performanceCumulativeLayoutShiftP75:
                              p.clsP75 ?? null,
                            performanceCumulativeLayoutShiftP95: null,
                            performanceInteractionToNextPaintP50: null,
                            performanceInteractionToNextPaintP75:
                              p.inpP75 ?? null,
                            performanceInteractionToNextPaintP95: null,
                            performanceFirstContentfulPaintP75:
                              p.fcpP75 ?? null,
                            performanceTimeToFirstByteP75: p.ttfbP75 ?? null,
                          },
                        }),
                      ),
                    },
              ],
            },
          },
        }),
      };
    });
}

describe('normalizePathGroup', () => {
  it('maps root path correctly', () => {
    expect(normalizePathGroup('/')).toBe('/');
    expect(normalizePathGroup('')).toBe('/');
    expect(normalizePathGroup(null)).toBe('/');
    expect(normalizePathGroup(undefined)).toBe('/');
  });

  it('extracts the first segment as a glob group', () => {
    expect(normalizePathGroup('/pieces/foo-1.html')).toBe('/pieces/*');
    expect(normalizePathGroup('/blog/post-x')).toBe('/blog/*');
    expect(normalizePathGroup('/admin/dashboard')).toBe('/admin/*');
    expect(normalizePathGroup('/support/contact')).toBe('/support/*');
  });

  it('handles deep paths by keeping only the first segment', () => {
    expect(normalizePathGroup('/pieces/freins/disque-bmw-e90')).toBe(
      '/pieces/*',
    );
    expect(normalizePathGroup('/pieces/123/abc/def')).toBe('/pieces/*');
  });

  it('strips query strings and fragments', () => {
    expect(normalizePathGroup('/pieces/foo?utm=x')).toBe('/pieces/*');
    expect(normalizePathGroup('/blog/post#section')).toBe('/blog/*');
  });

  it('falls back to /other for non-alphanumeric first segments', () => {
    expect(normalizePathGroup('/%20space/foo')).toBe('/other');
    expect(normalizePathGroup('/<script>/x')).toBe('/other');
  });

  it('handles valid char classes (letters, digits, hyphens, underscores, dots)', () => {
    expect(normalizePathGroup('/api-v2/foo')).toBe('/api-v2/*');
    expect(normalizePathGroup('/v1.0/foo')).toBe('/v1.0/*');
    expect(normalizePathGroup('/my_section/foo')).toBe('/my_section/*');
  });
});

describe('CfRumCollectorService', () => {
  let crit: CriticalityLoaderService;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    crit = new CriticalityLoaderService();
    crit.setConfigForTest(VALID_CONFIG);
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('skips when CLOUDFLARE token is missing (graceful)', async () => {
    const upsertSpy = jest.fn().mockResolvedValue({ error: null });
    const svc = buildSvc(
      crit,
      makeConfigService({ CLOUDFLARE_ACCOUNT_ID: 'acc-123' }),
      upsertSpy,
    );
    const result = await svc.run({ triggeredBy: 'test' });
    expect(result.skipped).toBe('no_token');
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it('skips when CLOUDFLARE_ACCOUNT_ID is missing (graceful)', async () => {
    const upsertSpy = jest.fn().mockResolvedValue({ error: null });
    const svc = buildSvc(
      crit,
      makeConfigService({ CLOUDFLARE_API_TOKEN: 'tok-123' }),
      upsertSpy,
    );
    const result = await svc.run({ triggeredBy: 'test' });
    expect(result.skipped).toBe('no_account_id');
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it('prefers CLOUDFLARE_ANALYTICS_TOKEN over CLOUDFLARE_API_TOKEN when both set', async () => {
    let capturedAuth: string | undefined;
    globalThis.fetch = jest
      .fn()
      .mockImplementation(async (_url, init: RequestInit) => {
        capturedAuth = (init.headers as Record<string, string>).Authorization;
        return {
          ok: true,
          status: 200,
          text: async () => '',
          json: async () => ({
            data: {
              viewer: { accounts: [{ rumPageloadEventsAdaptiveGroups: [] }] },
            },
          }),
        };
      }) as unknown as typeof globalThis.fetch;

    const upsertSpy = jest.fn().mockResolvedValue({ error: null });
    const svc = buildSvc(
      crit,
      makeConfigService({
        CLOUDFLARE_API_TOKEN: 'old-token',
        CLOUDFLARE_ANALYTICS_TOKEN: 'new-analytics-token',
        CLOUDFLARE_ACCOUNT_ID: 'acc-123',
      }),
      upsertSpy,
    );
    await svc.run({ triggeredBy: 'test' });
    expect(capturedAuth).toBe('Bearer new-analytics-token');
  });

  it('aggregates pageload + performance by tier × path_group, upserts to __seo_snapshot_cf_rum', async () => {
    globalThis.fetch = mockFetch(
      [
        {
          date: '2026-05-16',
          path: '/pieces/foo-1.html',
          count: 100,
          visits: 80,
        },
        {
          date: '2026-05-16',
          path: '/pieces/bar-2.html',
          count: 50,
          visits: 40,
        },
        { date: '2026-05-16', path: '/blog/post-x', count: 30, visits: 25 },
        { date: '2026-05-16', path: '/admin/dashboard', count: 10, visits: 5 },
      ],
      [
        {
          date: '2026-05-16',
          path: '/pieces/foo-1.html',
          count: 100,
          lcpP75: 2100,
          clsP75: 0.087,
          inpP75: 180,
        },
        {
          date: '2026-05-16',
          path: '/blog/post-x',
          count: 30,
          lcpP75: 1800,
          clsP75: 0.05,
          inpP75: 150,
        },
      ],
    ) as unknown as typeof globalThis.fetch;

    const upsertSpy = jest.fn().mockResolvedValue({ error: null });
    const svc = buildSvc(
      crit,
      makeConfigService({
        CLOUDFLARE_API_TOKEN: 'tok',
        CLOUDFLARE_ACCOUNT_ID: 'acc-123',
      }),
      upsertSpy,
    );

    const result = await svc.run({
      triggeredBy: 'test',
      bucketDateOverride: '2026-05-16',
    });

    expect(result.skipped).toBeUndefined();
    expect(result.bucket_date).toBe('2026-05-16');
    expect(result.pageload_events).toBe(4);
    expect(result.performance_events).toBe(2);
    expect(upsertSpy).toHaveBeenCalledTimes(1);

    const rows = upsertSpy.mock.calls[0][0] as Array<{
      tier: string;
      path_group: string;
      visit_count: number;
      pageview_count: number;
      lcp_p75_ms: number | null;
      cls_p75_milli: number | null;
    }>;

    // Grand total : (tier='total', path_group='total') = tous pageloads sommés.
    const grandTotal = rows.find(
      (r) => r.tier === 'total' && r.path_group === 'total',
    );
    expect(grandTotal).toBeDefined();
    expect(grandTotal?.pageview_count).toBe(190); // 100+50+30+10
    expect(grandTotal?.visit_count).toBe(150); // 80+40+25+5

    // (tier='total', path_group='/pieces/*') = total pieces.
    const totalPieces = rows.find(
      (r) => r.tier === 'total' && r.path_group === '/pieces/*',
    );
    expect(totalPieces?.pageview_count).toBe(150); // 100+50

    // (tier='tier0', path_group='total') = total tier0 (= pieces).
    const tier0Total = rows.find(
      (r) => r.tier === 'tier0' && r.path_group === 'total',
    );
    expect(tier0Total?.pageview_count).toBe(150);

    // (tier='tier0', path_group='/pieces/*') = drill-down complet.
    const tier0Pieces = rows.find(
      (r) => r.tier === 'tier0' && r.path_group === '/pieces/*',
    );
    expect(tier0Pieces?.pageview_count).toBe(150);
    expect(tier0Pieces?.lcp_p75_ms).toBe(2100);
    expect(tier0Pieces?.cls_p75_milli).toBe(87); // 0.087 * 1000

    // admin/* est excluded → JAMAIS de row tier2 (admin n'est pas tier2 dans VALID_CONFIG).
    // Mais admin contribue toujours aux rollups (total/total) et (total, /admin/*).
    const totalAdmin = rows.find(
      (r) => r.tier === 'total' && r.path_group === '/admin/*',
    );
    expect(totalAdmin?.pageview_count).toBe(10);

    // tier1 = blog
    const tier1Total = rows.find(
      (r) => r.tier === 'tier1' && r.path_group === 'total',
    );
    expect(tier1Total?.pageview_count).toBe(30);
    expect(tier1Total?.lcp_p75_ms).toBe(1800);
  });

  it('persists volumes with null percentiles when performance query fails (non-fatal)', async () => {
    let call = 0;
    globalThis.fetch = jest
      .fn()
      .mockImplementation(async (_url, init: RequestInit) => {
        call++;
        const body = JSON.parse(init.body as string) as { query: string };
        const isPageload = body.query.includes(
          'rumPageloadEventsAdaptiveGroups',
        );
        if (isPageload) {
          return {
            ok: true,
            status: 200,
            text: async () => '',
            json: async () => ({
              data: {
                viewer: {
                  accounts: [
                    {
                      rumPageloadEventsAdaptiveGroups: [
                        {
                          dimensions: {
                            date: '2026-05-16',
                            requestPath: '/pieces/x',
                          },
                          count: 42,
                          sum: { visits: 30 },
                        },
                      ],
                    },
                  ],
                },
              },
            }),
          };
        }
        // Performance query fails.
        return {
          ok: false,
          status: 500,
          text: async () => 'Schema mismatch',
          json: async () => ({}),
        };
      }) as unknown as typeof globalThis.fetch;

    const upsertSpy = jest.fn().mockResolvedValue({ error: null });
    const svc = buildSvc(
      crit,
      makeConfigService({
        CLOUDFLARE_API_TOKEN: 'tok',
        CLOUDFLARE_ACCOUNT_ID: 'acc',
      }),
      upsertSpy,
    );

    const result = await svc.run({
      triggeredBy: 'test',
      bucketDateOverride: '2026-05-16',
    });

    // Volumes persisted, but perf events = 0 and percentiles null.
    expect(result.skipped).toBeUndefined();
    expect(result.pageload_events).toBe(1);
    expect(result.performance_events).toBe(0);
    expect(result.errorMessage).toMatch(/performance:/);
    expect(upsertSpy).toHaveBeenCalledTimes(1);
    expect(call).toBe(2); // both queries attempted

    const rows = upsertSpy.mock.calls[0][0] as Array<{
      tier: string;
      path_group: string;
      pageview_count: number;
      lcp_p75_ms: number | null;
    }>;
    const tier0Pieces = rows.find(
      (r) => r.tier === 'tier0' && r.path_group === '/pieces/*',
    );
    expect(tier0Pieces?.pageview_count).toBe(42);
    expect(tier0Pieces?.lcp_p75_ms).toBeNull();
  });

  it('returns cf_api_error when pageload query (critical signal) fails', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
      json: async () => ({}),
    }) as unknown as typeof globalThis.fetch;

    const upsertSpy = jest.fn().mockResolvedValue({ error: null });
    const svc = buildSvc(
      crit,
      makeConfigService({
        CLOUDFLARE_API_TOKEN: 'tok',
        CLOUDFLARE_ACCOUNT_ID: 'acc',
      }),
      upsertSpy,
    );

    const result = await svc.run({ triggeredBy: 'test' });
    expect(result.skipped).toBe('cf_api_error');
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it('uses J-1 UTC as the default bucket date', async () => {
    // Stable mock: no data, just observe the date arg sent to CF.
    let capturedFrom: string | undefined;
    globalThis.fetch = jest
      .fn()
      .mockImplementation(async (_url, init: RequestInit) => {
        const body = JSON.parse(init.body as string) as {
          variables: { from: string };
        };
        capturedFrom = body.variables.from;
        return {
          ok: true,
          status: 200,
          text: async () => '',
          json: async () => ({
            data: {
              viewer: {
                accounts: [{ rumPageloadEventsAdaptiveGroups: [] }],
              },
            },
          }),
        };
      }) as unknown as typeof globalThis.fetch;

    const upsertSpy = jest.fn().mockResolvedValue({ error: null });
    const svc = buildSvc(
      crit,
      makeConfigService({
        CLOUDFLARE_API_TOKEN: 'tok',
        CLOUDFLARE_ACCOUNT_ID: 'acc',
      }),
      upsertSpy,
    );

    const result = await svc.run({ triggeredBy: 'test' });
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const expected = yesterday.toISOString().slice(0, 10);
    expect(result.bucket_date).toBe(expected);
    expect(capturedFrom).toBe(expected);
  });
});

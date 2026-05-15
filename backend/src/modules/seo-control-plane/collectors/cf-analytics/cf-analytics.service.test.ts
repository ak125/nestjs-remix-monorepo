import type { ConfigService } from '@nestjs/config';
import type { SeoCriticality } from '@repo/registry';
import { CriticalityLoaderService } from '../../services/criticality-loader.service';
import { CfAnalyticsCollectorService } from './cf-analytics.service';

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
    last_review: '2026-05-14',
    next_review_due: '2026-08-14',
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
): CfAnalyticsCollectorService {
  const svc = Object.create(
    CfAnalyticsCollectorService.prototype,
  ) as CfAnalyticsCollectorService;
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

function mockFetchGraphQL(
  groups: Array<{
    datetime: string;
    status: number;
    cache: string;
    path: string;
    count: number;
    bytes?: number;
    p50?: number;
    p95?: number;
  }>,
): jest.Mock {
  return jest.fn().mockImplementation(async () => ({
    ok: true,
    status: 200,
    text: async () => '',
    json: async () => ({
      data: {
        viewer: {
          zones: [
            {
              httpRequestsAdaptiveGroups: groups.map((g) => ({
                dimensions: {
                  datetimeFiveMinutes: g.datetime,
                  edgeResponseStatus: g.status,
                  cacheStatus: g.cache,
                  clientRequestPath: g.path,
                },
                count: g.count,
                sum: { edgeResponseBytes: g.bytes ?? 0 },
                avg: { originResponseDurationMs: 0 },
                quantiles: {
                  originResponseDurationMsP50: g.p50 ?? 0,
                  originResponseDurationMsP95: g.p95 ?? 0,
                },
              })),
            },
          ],
        },
      },
    }),
  }));
}

describe('CfAnalyticsCollectorService', () => {
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

  it('skips when CLOUDFLARE_API_TOKEN or CLOUDFLARE_ZONE_ID missing (graceful)', async () => {
    const upsertSpy = jest.fn().mockResolvedValue({ error: null });
    const svc = buildSvc(crit, makeConfigService({}), upsertSpy);
    const result = await svc.run({ triggeredBy: 'test' });
    expect(result.skipped).toBe('no_token');
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it('aggregates by bucket × tier and upserts to __seo_snapshot_cf_analytics', async () => {
    globalThis.fetch = mockFetchGraphQL([
      {
        datetime: '2026-05-14T18:00:00Z',
        status: 200,
        cache: 'hit',
        path: '/pieces/foo-1.html',
        count: 100,
        bytes: 100_000,
        p50: 50,
        p95: 150,
      },
      {
        datetime: '2026-05-14T18:00:00Z',
        status: 503,
        cache: 'miss',
        path: '/pieces/bar-2.html',
        count: 5,
      },
      {
        datetime: '2026-05-14T18:00:00Z',
        status: 200,
        cache: 'hit',
        path: '/blog/post-x',
        count: 50,
      },
      {
        datetime: '2026-05-14T18:00:00Z',
        status: 200,
        cache: 'miss',
        path: '/admin/dashboard',
        count: 10,
      },
    ]) as unknown as typeof globalThis.fetch;

    const upsertSpy = jest.fn().mockResolvedValue({ error: null });
    const svc = buildSvc(
      crit,
      makeConfigService({ CLOUDFLARE_API_TOKEN: 't', CLOUDFLARE_ZONE_ID: 'z' }),
      upsertSpy,
    );

    const result = await svc.run({ triggeredBy: 'test' });

    expect(result.skipped).toBeUndefined();
    expect(result.buckets_received).toBe(1);
    expect(upsertSpy).toHaveBeenCalledTimes(1);
    const rows = upsertSpy.mock.calls[0][0] as Array<{
      tier: string;
      total_requests: number;
      http_5xx: number;
    }>;
    // total bucket = all groups summed
    const totalRow = rows.find((r) => r.tier === 'total');
    expect(totalRow?.total_requests).toBe(165); // 100 + 5 + 50 + 10
    expect(totalRow?.http_5xx).toBe(5);
    // tier0 excludes /blog and /admin paths
    const tier0Row = rows.find((r) => r.tier === 'tier0');
    expect(tier0Row?.total_requests).toBe(105); // 100 (pieces 200) + 5 (pieces 503)
    expect(tier0Row?.http_5xx).toBe(5);
    // tier1 = /blog
    const tier1Row = rows.find((r) => r.tier === 'tier1');
    expect(tier1Row?.total_requests).toBe(50);
    // admin/* is excluded (no tier2 row from this dataset)
    const tier2Row = rows.find((r) => r.tier === 'tier2');
    expect(tier2Row).toBeUndefined();
  });

  it('returns cf_api_error when GraphQL endpoint fails', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
      json: async () => ({}),
    }) as unknown as typeof globalThis.fetch;

    const upsertSpy = jest.fn().mockResolvedValue({ error: null });
    const svc = buildSvc(
      crit,
      makeConfigService({ CLOUDFLARE_API_TOKEN: 't', CLOUDFLARE_ZONE_ID: 'z' }),
      upsertSpy,
    );

    const result = await svc.run({ triggeredBy: 'test' });
    expect(result.skipped).toBe('cf_api_error');
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it('computes rate_5xx from total bucket totals across the window', async () => {
    globalThis.fetch = mockFetchGraphQL([
      {
        datetime: '2026-05-14T18:00:00Z',
        status: 200,
        cache: 'hit',
        path: '/pieces/a.html',
        count: 950,
      },
      {
        datetime: '2026-05-14T18:00:00Z',
        status: 503,
        cache: 'miss',
        path: '/pieces/b.html',
        count: 50,
      },
    ]) as unknown as typeof globalThis.fetch;

    const upsertSpy = jest.fn().mockResolvedValue({ error: null });
    const svc = buildSvc(
      crit,
      makeConfigService({ CLOUDFLARE_API_TOKEN: 't', CLOUDFLARE_ZONE_ID: 'z' }),
      upsertSpy,
    );

    const result = await svc.run({ triggeredBy: 'test' });
    expect(result.totals_period.total_requests).toBe(1000);
    expect(result.totals_period.http_5xx).toBe(50);
    expect(result.totals_period.rate_5xx).toBeCloseTo(0.05, 5);
  });
});

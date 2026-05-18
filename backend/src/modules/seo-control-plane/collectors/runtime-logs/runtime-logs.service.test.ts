import type { ConfigService } from '@nestjs/config';
import type { SeoCriticality } from '@repo/registry';
import { CriticalityLoaderService } from '../../services/criticality-loader.service';
import { RuntimeLogsCollectorService } from './runtime-logs.service';

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
  excluded: { routes: ['admin/*', 'api/*', 'sitemap*.xml', 'robots.txt'] },
  metadata: {
    adr_reference: 'ADR-064',
    introduced_in_pr: 'TBD',
    last_review: '2026-05-14',
    next_review_due: '2026-08-14',
  },
};

interface ErrorLogRow {
  err_id: string;
  err_status: number;
  err_url: string | null;
  err_subject: string | null;
  err_created_at: string;
}

function makeConfigService(
  overrides: Record<string, string | number> = {},
): ConfigService {
  return {
    get: (key: string, def?: unknown): unknown => overrides[key] ?? def,
  } as unknown as ConfigService;
}

/**
 * Build a RuntimeLogsCollectorService with the Supabase base init bypassed.
 * SupabaseBaseService validates env vars and creates a real client — we
 * skip the inheritance chain and patch fake `supabase` + `criticality`.
 */
function buildSvc(
  crit: CriticalityLoaderService,
  cfg: ConfigService,
  rows: ErrorLogRow[],
  upsertSpy: jest.Mock,
): RuntimeLogsCollectorService {
  const svc = Object.create(
    RuntimeLogsCollectorService.prototype,
  ) as RuntimeLogsCollectorService;

  // Chainable query mock for fetchErrorLogs paginated query
  const selectChain: Record<string, unknown> = {};
  for (const m of ['select', 'gte', 'lt', 'like', 'order']) {
    selectChain[m] = jest.fn(() => selectChain);
  }
  selectChain.range = jest.fn(async () => ({ data: rows, error: null }));

  const from = jest.fn((_table: string) => ({
    select: () => selectChain,
    upsert: upsertSpy,
  }));

  Object.assign(svc, {
    logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
    criticality: crit,
    cfg,
    supabase: { from },
  });
  return svc;
}

function buildSvcNoSupabase(
  crit: CriticalityLoaderService,
  cfg: ConfigService,
): RuntimeLogsCollectorService {
  const svc = Object.create(
    RuntimeLogsCollectorService.prototype,
  ) as RuntimeLogsCollectorService;

  const selectChain: Record<string, unknown> = {};
  for (const m of ['select', 'gte', 'lt', 'like', 'order']) {
    selectChain[m] = jest.fn(() => selectChain);
  }
  selectChain.range = jest.fn(async () => ({
    data: null,
    error: { message: 'connection refused' },
  }));

  const from = jest.fn(() => ({
    select: () => selectChain,
    upsert: jest.fn(),
  }));

  Object.assign(svc, {
    logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
    criticality: crit,
    cfg,
    supabase: { from },
  });
  return svc;
}

describe('RuntimeLogsCollectorService', () => {
  let crit: CriticalityLoaderService;

  beforeEach(() => {
    crit = new CriticalityLoaderService();
    crit.setConfigForTest(VALID_CONFIG);
  });

  it('aggregates rows into 5-min buckets × tier (total + tier0)', async () => {
    const upsert = jest
      .fn()
      .mockImplementation(async () => ({ data: null, error: null }));
    const rows: ErrorLogRow[] = [
      {
        err_id: '1',
        err_status: 503,
        err_url: 'https://www.automecanik.com/pieces/foo.html',
        err_subject: 'LOADER_503_BACKEND_RPC_ERROR',
        err_created_at: '2026-05-14T10:02:13Z',
      },
      {
        err_id: '2',
        err_status: 500,
        err_url: 'https://www.automecanik.com/pieces/bar.html',
        err_subject: 'LOADER_503_TIMEOUT',
        err_created_at: '2026-05-14T10:04:59Z',
      },
      {
        err_id: '3',
        err_status: 404,
        err_url: 'https://www.automecanik.com/pieces/baz.html',
        err_subject: 'LOADER_404_NOT_FOUND',
        err_created_at: '2026-05-14T10:07:00Z',
      },
    ];
    const svc = buildSvc(crit, makeConfigService(), rows, upsert);

    const result = await svc.run({ triggeredBy: 'test', windowMinutes: 60 });

    expect(result.skipped).toBeUndefined();
    expect(result.rows_scanned).toBe(3);
    // 2 buckets (10:00 and 10:05) × 2 tiers (total + tier0) = 4 snapshots
    expect(result.buckets_emitted).toBe(4);
    expect(result.totals_period.total_events).toBe(3);
    expect(result.totals_period.http_5xx_count).toBe(2);

    // Inspect upsert payload — assert tier=total bucket 10:00 has 2 events, 2 5xx
    expect(upsert).toHaveBeenCalledTimes(1);
    const payload = upsert.mock.calls[0][0] as Array<{
      bucket_start: string;
      tier: string;
      total_events: number;
      http_5xx_count: number;
      http_4xx_count: number;
    }>;
    const bucket10Total = payload.find(
      (s) =>
        s.bucket_start === '2026-05-14T10:00:00.000Z' && s.tier === 'total',
    );
    expect(bucket10Total).toBeDefined();
    expect(bucket10Total!.total_events).toBe(2);
    expect(bucket10Total!.http_5xx_count).toBe(2);
    expect(bucket10Total!.http_4xx_count).toBe(0);
  });

  it('returns 0 buckets on empty window (no rows)', async () => {
    const upsert = jest
      .fn()
      .mockImplementation(async () => ({ data: null, error: null }));
    const svc = buildSvc(crit, makeConfigService(), [], upsert);

    const result = await svc.run({ triggeredBy: 'test' });

    expect(result.rows_scanned).toBe(0);
    expect(result.buckets_emitted).toBe(0);
    expect(result.rows_upserted).toBe(0);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('floors timestamps to 5-min boundaries (idempotent UPSERT key)', async () => {
    const upsert = jest
      .fn()
      .mockImplementation(async () => ({ data: null, error: null }));
    const rows: ErrorLogRow[] = [
      // Both should fall into the 10:00 bucket
      {
        err_id: '1',
        err_status: 503,
        err_url: null,
        err_subject: 'LOADER_503_FETCH_ERROR',
        err_created_at: '2026-05-14T10:00:00.000Z',
      },
      {
        err_id: '2',
        err_status: 503,
        err_url: null,
        err_subject: 'LOADER_503_FETCH_ERROR',
        err_created_at: '2026-05-14T10:04:59.999Z',
      },
    ];
    const svc = buildSvc(crit, makeConfigService(), rows, upsert);

    const result = await svc.run({ triggeredBy: 'test' });

    expect(result.rows_scanned).toBe(2);
    expect(result.buckets_emitted).toBe(1); // only 'total' tier (url null → no tier)
    const payload = upsert.mock.calls[0][0] as Array<{ bucket_start: string }>;
    expect(payload[0].bucket_start).toBe('2026-05-14T10:00:00.000Z');
  });

  it('returns skipped=no_supabase when fetch errors out', async () => {
    const svc = buildSvcNoSupabase(crit, makeConfigService());
    const result = await svc.run({ triggeredBy: 'test' });
    expect(result.skipped).toBe('no_supabase');
    expect(result.errorMessage).toContain('connection refused');
    expect(result.rows_upserted).toBe(0);
  });
});

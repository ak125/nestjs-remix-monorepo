/**
 * Unit tests for CruxFieldFetcherService (ADR-063 PR-3).
 *
 * Covers : sticky 404 backoff, graceful degrade, dryRun, sampleTopUrls aggregation,
 * fetchAndPersist origin + URL flows.
 */
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CruxFieldFetcherService } from './crux-field-fetcher.service';
import { CruxApiClient } from './crux-api-client.service';
import { SeoMonitoringRunsService } from './seo-monitoring-runs.service';

const buildHistoryResponse = () => ({
  record: {
    key: { origin: 'https://www.automecanik.com', formFactor: 'PHONE' as const },
    metrics: {
      largest_contentful_paint: { percentilesTimeseries: { p75s: [2300] } },
      interaction_to_next_paint: { percentilesTimeseries: { p75s: [180] } },
      cumulative_layout_shift: { percentilesTimeseries: { p75s: [0.08] } },
      experimental_time_to_first_byte: { percentilesTimeseries: { p75s: [600] } },
      first_contentful_paint: { percentilesTimeseries: { p75s: [1500] } },
    },
    collectionPeriods: [
      { firstDate: { year: 2026, month: 4, day: 1 }, lastDate: { year: 2026, month: 4, day: 28 } },
    ],
  },
});

interface MockState {
  topUrlsData: Array<{ page: string; clicks: number }>;
  upsertError: { message: string } | null;
  upsertedCount: number;
}

function buildSupabaseMock(state: MockState) {
  return {
    from: jest.fn((table: string) => {
      if (table === '__seo_gsc_daily') {
        return {
          select: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({ data: state.topUrlsData, error: null }),
        };
      }
      if (table === '__seo_crux_field_history') {
        return {
          upsert: jest.fn(async (payload: unknown[]) => {
            state.upsertedCount += payload.length;
            return { error: state.upsertError };
          }),
        };
      }
      return {};
    }),
  };
}

async function buildService(opts: {
  available: boolean;
  topUrls?: Array<{ page: string; clicks: number }>;
  upsertError?: { message: string } | null;
}): Promise<{ service: CruxFieldFetcherService; state: MockState; cruxClient: jest.Mocked<CruxApiClient> }> {
  const state: MockState = {
    topUrlsData: opts.topUrls ?? [],
    upsertError: opts.upsertError ?? null,
    upsertedCount: 0,
  };

  const cruxClientMock = {
    isAvailable: jest.fn().mockReturnValue(opts.available),
    fetchOriginHistory: jest.fn(async () => ({
      response: buildHistoryResponse(),
      status: 200,
      attempts: 1,
      latencyMs: 100,
    })),
    fetchUrlHistory: jest.fn(async () => ({
      response: buildHistoryResponse(),
      status: 200,
      attempts: 1,
      latencyMs: 100,
    })),
  } as unknown as jest.Mocked<CruxApiClient>;

  const runsServiceMock = {
    logStarted: jest.fn().mockResolvedValue('test-run-id'),
    logCompleted: jest.fn().mockResolvedValue(undefined),
    logFailed: jest.fn().mockResolvedValue(undefined),
  };

  const moduleRef = await Test.createTestingModule({
    providers: [
      CruxFieldFetcherService,
      { provide: CruxApiClient, useValue: cruxClientMock },
      { provide: SeoMonitoringRunsService, useValue: runsServiceMock },
      { provide: ConfigService, useValue: { get: (k: string) => (k === 'SUPABASE_URL' ? 'https://mock.supabase.co' : undefined) } },
    ],
  }).compile();

  const service = moduleRef.get(CruxFieldFetcherService);
  Object.defineProperty(service, 'supabase', { value: buildSupabaseMock(state), writable: false });

  return { service, state, cruxClient: cruxClientMock };
}

describe('CruxFieldFetcherService', () => {
  describe('shouldFetchToday — sticky 404 backoff', () => {
    let service: CruxFieldFetcherService;

    beforeEach(async () => {
      const built = await buildService({ available: true });
      service = built.service;
    });

    it('null sticky → fetch today', () => {
      expect(service.shouldFetchToday(null)).toBe(true);
    });

    it('0-2 days 404 → fetch daily', () => {
      expect(service.shouldFetchToday({ consecutive404Days: 0, lastChecked: '2026-05-14' }, new Date('2026-05-14'))).toBe(true);
      expect(service.shouldFetchToday({ consecutive404Days: 2, lastChecked: '2026-05-14' }, new Date('2026-05-14'))).toBe(true);
    });

    it('3-20 days 404 → weekly (day-of-month % 7 == 0)', () => {
      const sticky = { consecutive404Days: 5, lastChecked: '2026-05-14' };
      expect(service.shouldFetchToday(sticky, new Date('2026-05-07'))).toBe(true);
      expect(service.shouldFetchToday(sticky, new Date('2026-05-08'))).toBe(false);
    });

    it('21+ days 404 → monthly (day-of-month == 1)', () => {
      const sticky = { consecutive404Days: 30, lastChecked: '2026-05-14' };
      expect(service.shouldFetchToday(sticky, new Date('2026-05-01'))).toBe(true);
      expect(service.shouldFetchToday(sticky, new Date('2026-05-07'))).toBe(false);
    });
  });

  describe('fetchAndPersist', () => {
    it('crux_client_unavailable warning when client unavailable', async () => {
      const { service } = await buildService({ available: false });
      const out = await service.fetchAndPersist();
      expect(out.warnings).toContain('crux_client_unavailable');
      expect(out.rowsInserted).toBe(0);
    });

    it('fetches origin × 2 form factors and persists rows', async () => {
      const { service, state, cruxClient } = await buildService({ available: true });
      const out = await service.fetchAndPersist({ originOnly: true });
      expect(cruxClient.fetchOriginHistory).toHaveBeenCalledTimes(2);
      expect(out.originSuccess).toBe(2);
      expect(out.rowsInserted).toBe(2);
      expect(state.upsertedCount).toBe(2);
    });

    it('dryRun skips upsert', async () => {
      const { service, state, cruxClient } = await buildService({ available: true });
      const out = await service.fetchAndPersist({ originOnly: true, dryRun: true });
      expect(cruxClient.fetchOriginHistory).toHaveBeenCalledTimes(2);
      expect(out.rowsInserted).toBe(0);
      expect(state.upsertedCount).toBe(0);
    });

    it('handles 404 origin gracefully', async () => {
      const { service, cruxClient } = await buildService({ available: true });
      cruxClient.fetchOriginHistory.mockResolvedValue({
        response: null,
        status: 404,
        attempts: 1,
        latencyMs: 50,
      });
      const out = await service.fetchAndPersist({ originOnly: true });
      expect(out.originSkipped).toBe(2);
      expect(out.warnings.some((w) => w.startsWith('origin_404'))).toBe(true);
    });

    it('fetches top URLs when not originOnly', async () => {
      const { service, cruxClient } = await buildService({
        available: true,
        topUrls: [
          { page: 'https://www.automecanik.com/pieces/freinage', clicks: 100 },
          { page: 'https://www.automecanik.com/pieces/embrayage', clicks: 80 },
        ],
      });
      const out = await service.fetchAndPersist();
      expect(cruxClient.fetchUrlHistory).toHaveBeenCalledTimes(2);
      expect(out.urlSuccess).toBe(2);
    });
  });

  describe('sampleTopUrls', () => {
    it('aggregates clicks per page and returns top N', async () => {
      const { service } = await buildService({
        available: true,
        topUrls: [
          { page: 'https://x/a', clicks: 50 },
          { page: 'https://x/a', clicks: 30 }, // duplicates → summed
          { page: 'https://x/b', clicks: 100 },
          { page: 'https://x/c', clicks: 10 },
        ],
      });
      const result = await service.sampleTopUrls(2);
      expect(result).toEqual(['https://x/b', 'https://x/a']);
    });

    it('returns empty array when GSC table is empty', async () => {
      const { service } = await buildService({ available: true, topUrls: [] });
      const result = await service.sampleTopUrls();
      expect(result).toEqual([]);
    });
  });
});

/**
 * Unit tests for Ga4DailyFetcherService — hostName anti-pollution guard.
 *
 * Garantit que les requêtes GA4 filtrent sur le hostname de PROD
 * (SITE_HOSTNAME) pour exclure le trafic localhost (CI headless E2E/Lighthouse).
 * Cf. mémoire ga4_prod_tag_not_env_gated_ci_localhost_pollution + PR #1115.
 */
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SITE_HOSTNAME } from '@config/site.constants';
import { Ga4DailyFetcherService } from './ga4-daily-fetcher.service';
import { GoogleCredentialsService } from './google-credentials.service';
import { SeoMonitoringRunsService } from './seo-monitoring-runs.service';

// Base Supabase en mémoire (présence par date + upsert idempotent date,page,channel).
type Row = Record<string, any>;
const mockGa4Db: {
  rows: Map<string, Row>;
  upserts: Row[][];
  presenceReads: string[];
} = { rows: new Map(), upserts: [], presenceReads: [] };

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: () => ({
      select: () => {
        let date: string | undefined;
        const q: any = {
          eq: (_c: string, v: string) => {
            date = v;
            return q;
          },
          limit: () => q,
          then: (resolve: (v: any) => void) => {
            mockGa4Db.presenceReads.push(date!);
            const found = [...mockGa4Db.rows.values()].some(
              (r) => r.date === date,
            );
            return resolve({ data: found ? [{ date }] : [], error: null });
          },
        };
        return q;
      },
      upsert: async (batch: Row[]) => {
        mockGa4Db.upserts.push(batch);
        for (const r of batch)
          mockGa4Db.rows.set(`${r.date}|${r.page}|${r.channel}`, r);
        return { error: null };
      },
    }),
  })),
}));

function buildService(
  runReport: jest.Mock = jest.fn().mockResolvedValue([{ rows: [] }]),
  env: Record<string, string> = {},
) {
  const credentialsMock = {
    isMonitoringEnabled: jest.fn().mockReturnValue(true),
    getGA4Client: jest.fn().mockReturnValue({ runReport }),
    getGA4PropertyName: jest.fn().mockReturnValue('properties/311870207'),
  } as unknown as GoogleCredentialsService;

  const runsServiceMock = {
    logStarted: jest.fn().mockResolvedValue('test-run-id'),
    logCompleted: jest.fn().mockResolvedValue(undefined),
    logFailed: jest.fn().mockResolvedValue(undefined),
  };

  return Test.createTestingModule({
    providers: [
      Ga4DailyFetcherService,
      { provide: GoogleCredentialsService, useValue: credentialsMock },
      { provide: SeoMonitoringRunsService, useValue: runsServiceMock },
      {
        provide: ConfigService,
        useValue: {
          get: (k: string) =>
            k === 'SUPABASE_URL' ? 'https://mock.supabase.co' : env[k],
        },
      },
    ],
  })
    .compile()
    .then((moduleRef) => {
      const service = moduleRef.get(Ga4DailyFetcherService);
      return { service, runReport, runs: runsServiceMock };
    });
}

describe('Ga4DailyFetcherService — hostName anti-pollution guard', () => {
  it('SITE_HOSTNAME dérive bien le host nu de PROD', () => {
    expect(SITE_HOSTNAME).toBe('www.automecanik.com');
  });

  it('sans segment pagePath → filtre hostName EXACT seul', async () => {
    const { service, runReport } = await buildService();

    await service.fetchAndPersist({ date: '2026-06-22', dryRun: true });

    expect(runReport).toHaveBeenCalledTimes(1);
    const req = runReport.mock.calls[0][0];
    expect(req.dimensionFilter).toEqual({
      filter: {
        fieldName: 'hostName',
        stringFilter: { matchType: 'EXACT', value: SITE_HOSTNAME },
      },
    });
  });

  it('avec segment pagePath → andGroup [hostName, pagePath]', async () => {
    const { service, runReport } = await buildService();

    await service.fetchAndPersist({
      date: '2026-06-22',
      pagePathPatterns: ['/pieces'],
      dryRun: true,
    });

    expect(runReport).toHaveBeenCalledTimes(1);
    const req = runReport.mock.calls[0][0];
    expect(req.dimensionFilter.andGroup.expressions).toHaveLength(2);
    expect(req.dimensionFilter.andGroup.expressions[0]).toEqual({
      filter: {
        fieldName: 'hostName',
        stringFilter: { matchType: 'EXACT', value: SITE_HOSTNAME },
      },
    });
    expect(req.dimensionFilter.andGroup.expressions[1]).toEqual({
      filter: {
        fieldName: 'pagePath',
        stringFilter: { matchType: 'CONTAINS', value: '/pieces' },
      },
    });
  });
});

// ─── Rattrapage des trous + pagination + dry-run (2026-09-11) ───────────────

const WINDOW_ENV = {
  SEO_GA4_ROLLING_DAYS: '1',
  SEO_GA4_BACKFILL_LOOKBACK_DAYS: '6',
  SEO_GA4_BACKFILL_MAX_DAYS_PER_RUN: '2',
  SEO_GA4_BACKFILL_FLOOR_DATE: '2026-04-01',
};

function ga4Row(page: string) {
  return {
    dimensionValues: [{ value: page }, { value: 'Organic Search' }],
    metricValues: [
      { value: '3' },
      { value: '1' },
      { value: '0.5' },
      { value: '42' },
    ],
  };
}

function seedPresent(dates: string[]) {
  for (const d of dates) {
    mockGa4Db.rows.set(`${d}|/x|organic search`, {
      date: d,
      page: '/x',
      channel: 'organic search',
    });
  }
}

describe('Ga4DailyFetcherService — rattrapage des trous', () => {
  beforeEach(() => {
    mockGa4Db.rows = new Map();
    mockGa4Db.upserts = [];
    mockGa4Db.presenceReads = [];
  });

  it('dry-run : aucun journal ni upsert (fetchAndPersist)', async () => {
    const runReport = jest
      .fn()
      .mockResolvedValue([{ rows: [ga4Row('/pieces/a')], rowCount: 1 }]);
    const { service, runs } = await buildService(runReport);
    const r = await service.fetchAndPersist({
      date: '2026-09-08',
      dryRun: true,
    });
    expect(r.rowsFetched).toBe(1);
    expect(r.rowsInserted).toBe(0);
    expect(runs.logStarted).not.toHaveBeenCalled();
    expect(runs.logCompleted).not.toHaveBeenCalled();
    expect(mockGa4Db.upserts).toHaveLength(0);
  });

  it('fenêtre : ancre + jours ABSENTS plafonnés, plus anciens d’abord ; présence lue hors refresh seulement', async () => {
    // Fenêtre 09-03..09-08, refresh = 09-08 ; présents 09-04, 09-06 → absents 09-03, 09-05, 09-07.
    seedPresent(['2026-09-04', '2026-09-06']);
    const runReport = jest.fn().mockImplementation((req: any) =>
      Promise.resolve([
        {
          rows: [ga4Row(`/pieces/${req.dateRanges[0].startDate}`)],
          rowCount: 1,
        },
      ]),
    );
    const { service, runs } = await buildService(runReport, WINDOW_ENV);
    const r = await service.fetchAndPersistWindow({
      anchorDate: '2026-09-08',
      triggeredBy: 'scheduler',
    });

    expect(mockGa4Db.presenceReads.sort()).toEqual([
      '2026-09-03',
      '2026-09-04',
      '2026-09-05',
      '2026-09-06',
      '2026-09-07',
    ]);
    expect(r.dates.refresh).toEqual(['2026-09-08']);
    expect(r.dates.backfill).toEqual(['2026-09-03', '2026-09-05']);
    expect(r.dates.deferred).toEqual(['2026-09-07']);
    expect(
      runReport.mock.calls.map((c) => c[0].dateRanges[0].startDate),
    ).toEqual(['2026-09-08', '2026-09-03', '2026-09-05']);
    expect(r.dates.ingested).toEqual([
      '2026-09-08',
      '2026-09-03',
      '2026-09-05',
    ]);
    expect(
      mockGa4Db.upserts
        .flat()
        .every((row) => typeof row.fetched_at === 'string'),
    ).toBe(true);
    expect(runs.logCompleted).toHaveBeenCalledTimes(1);
    expect(runs.logCompleted.mock.calls[0][1].extra.dates.deferred_count).toBe(
      1,
    );
  });

  it('réponse vide : rien écrit, avertissement explicite avec la raison GA4', async () => {
    const runReport = jest
      .fn()
      .mockResolvedValue([{ rows: [], metadata: { emptyReason: 'NO_DATA' } }]);
    const { service } = await buildService(runReport, {
      ...WINDOW_ENV,
      SEO_GA4_BACKFILL_MAX_DAYS_PER_RUN: '0',
    });
    const r = await service.fetchAndPersistWindow({ anchorDate: '2026-09-08' });
    expect(r.dates.empty).toEqual(['2026-09-08']);
    expect(r.warnings).toContain('ga4_empty:2026-09-08:NO_DATA');
    expect(mockGa4Db.upserts).toHaveLength(0);
  });

  it('pagination : rowCount > lignes reçues → 2e appel avec offset', async () => {
    const runReport = jest
      .fn()
      .mockResolvedValueOnce([
        { rows: [ga4Row('/a'), ga4Row('/b')], rowCount: 3 },
      ])
      .mockResolvedValueOnce([{ rows: [ga4Row('/c')], rowCount: 3 }]);
    const { service } = await buildService(runReport);
    const r = await service.fetchAndPersist({
      date: '2026-09-08',
      rowLimit: 2,
    });
    expect(runReport).toHaveBeenCalledTimes(2);
    expect(runReport.mock.calls[0][0].offset).toBeUndefined();
    expect(runReport.mock.calls[1][0].offset).toBe(2);
    expect(r.rowsInserted).toBe(3);
  });

  it('erreur gRPC quota (8) : run arrêté ; erreur réseau : jour en échec, run poursuivi', async () => {
    const quota = jest
      .fn()
      .mockRejectedValue(
        Object.assign(new Error('RESOURCE_EXHAUSTED'), { code: 8 }),
      );
    const a = await buildService(quota, WINDOW_ENV);
    await expect(
      a.service.fetchAndPersistWindow({ anchorDate: '2026-09-08' }),
    ).rejects.toThrow('RESOURCE_EXHAUSTED');
    expect(quota).toHaveBeenCalledTimes(1);
    expect(a.runs.logFailed.mock.calls[0][1].errorClass).toBe('quota_exceeded');

    const flaky = jest
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error('socket hang up'), { code: 14 }),
      )
      .mockResolvedValue([{ rows: [ga4Row('/ok')], rowCount: 1 }]);
    const b = await buildService(flaky, WINDOW_ENV);
    const r = await b.service.fetchAndPersistWindow({
      anchorDate: '2026-09-08',
    });
    expect(r.dates.failed).toEqual([
      expect.objectContaining({ date: '2026-09-08', errorClass: 'network' }),
    ]);
    expect(r.dates.ingested.length).toBeGreaterThan(0);
    expect(b.runs.logFailed).toHaveBeenCalledTimes(1);
  });
});

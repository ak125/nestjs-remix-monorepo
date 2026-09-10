/**
 * GscDailyFetcherService — contrat d'un jour + rattrapage des trous (2026-09-11).
 *
 * Fakes : API Search Console (données par jour) + base Supabase en mémoire
 * clé = colonnes `onConflict` (même sémantique d'idempotence que la PK SQL).
 * Couvre : trou historique, vrai zéro, jour non finalisé, finalité inconnue,
 * import partiel, erreur API systémique, schéma absent, pagination,
 * ré-exécution sans doublon, dry-run / plan seul sans aucune écriture.
 */
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GscDailyFetcherService } from './gsc-daily-fetcher.service';
import { GoogleCredentialsService } from './google-credentials.service';
import { SeoMonitoringRunsService } from './seo-monitoring-runs.service';

// ─── Fake Supabase ─────────────────────────────────────────────────────────
type Row = Record<string, any>;
interface FakeDb {
  tables: Map<string, Map<string, Row>>;
  upserts: Array<{ table: string; rows: Row[] }>;
  failUpsert:
    | ((
        table: string,
        rows: Row[],
      ) => { code?: string; message: string } | null)
    | null;
  selectError: { code: string; message: string } | null;
}
const mockDb: FakeDb = {
  tables: new Map(),
  upserts: [],
  failUpsert: null,
  selectError: null,
};

function mockFrom(table: string) {
  return {
    select() {
      const filters: Array<(r: Row) => boolean> = [];
      let limit = Infinity;
      const q: any = {
        gte(col: string, v: any) {
          filters.push((r) => r[col] != null && r[col] >= v);
          return q;
        },
        lte(col: string, v: any) {
          filters.push((r) => r[col] != null && r[col] <= v);
          return q;
        },
        eq(col: string, v: any) {
          filters.push((r) => r[col] === v);
          return q;
        },
        limit(n: number) {
          limit = n;
          return q;
        },
        then(resolve: (v: any) => void) {
          if (mockDb.selectError) {
            return resolve({ data: null, error: mockDb.selectError });
          }
          const rows = [...(mockDb.tables.get(table)?.values() ?? [])]
            .filter((r) => filters.every((f) => f(r)))
            .slice(0, limit)
            .map((r) => ({ date: r.date }));
          return resolve({ data: rows, error: null });
        },
      };
      return q;
    },
    async upsert(rows: Row[], opts: { onConflict: string }) {
      const failure = mockDb.failUpsert?.(table, rows) ?? null;
      if (failure) return { error: failure };
      mockDb.upserts.push({ table, rows });
      const store = mockDb.tables.get(table) ?? new Map<string, Row>();
      for (const r of rows) {
        const key = opts.onConflict
          .split(',')
          .map((c) => String(r[c]))
          .join('|');
        store.set(key, { ...(store.get(key) ?? {}), ...r });
      }
      mockDb.tables.set(table, store);
      return { error: null };
    },
  };
}

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({ from: (t: string) => mockFrom(t) })),
}));

// ─── Fake Search Console ───────────────────────────────────────────────────
interface GoogleDay {
  clicks: number;
  impressions: number;
  pages: Array<{ page: string; clicks: number; impressions: number }>;
}
interface FakeGoogle {
  days: Record<string, GoogleDay>;
  firstIncompleteDate: string | null;
  /** Jours signalés avec données par la sonde mais vides en requête finale. */
  finalEmpty: Set<string>;
  failQuery: ((body: any) => any) | null;
  calls: any[];
}
const mockGoogle: FakeGoogle = {
  days: {},
  firstIncompleteDate: null,
  finalEmpty: new Set(),
  failQuery: null,
  calls: [],
};

function mockQuery({ requestBody: body }: { requestBody: any }) {
  mockGoogle.calls.push(body);
  const err = mockGoogle.failQuery?.(body);
  if (err) return Promise.reject(err);
  const dims: string[] = body.dimensions ?? [];
  const page = (rows: any[]) =>
    rows.slice(body.startRow ?? 0, (body.startRow ?? 0) + body.rowLimit);

  if (body.dataState === 'all') {
    const rows = Object.entries(mockGoogle.days)
      .filter(([d]) => d >= body.startDate && d <= body.endDate)
      .map(([d, v]) => ({
        keys: [d],
        clicks: v.clicks,
        impressions: v.impressions,
      }));
    return Promise.resolve({
      data: {
        rows,
        ...(mockGoogle.firstIncompleteDate
          ? {
              metadata: { firstIncompleteDate: mockGoogle.firstIncompleteDate },
            }
          : {}),
      },
    });
  }
  const day = mockGoogle.days[body.startDate];
  if (!day || mockGoogle.finalEmpty.has(body.startDate)) {
    return Promise.resolve({ data: {} });
  }
  const ctr = (c: number, i: number) => (i > 0 ? c / i : 0);
  let rows: any[] = [];
  const key = dims.join(',');
  if (key === '') {
    rows = [
      {
        clicks: day.clicks,
        impressions: day.impressions,
        ctr: ctr(day.clicks, day.impressions),
        position: 12,
      },
    ];
  } else if (key === 'country,device') {
    rows = [
      {
        keys: ['fra', 'MOBILE'],
        clicks: day.clicks,
        impressions: day.impressions,
        ctr: ctr(day.clicks, day.impressions),
        position: 12,
      },
    ];
  } else if (key === 'page,country,device') {
    rows = day.pages.slice(0, 1).map((p) => ({
      keys: [p.page, 'fra', 'MOBILE'],
      clicks: 0,
      impressions: 10,
      ctr: 0,
      position: 20,
    }));
  } else if (key === 'page') {
    rows = day.pages.map((p) => ({
      keys: [p.page],
      clicks: p.clicks,
      impressions: p.impressions,
      ctr: ctr(p.clicks, p.impressions),
      position: 9,
    }));
  } else if (key === 'page,query,device') {
    rows = day.pages.slice(0, 1).map((p) => ({
      keys: [p.page, 'capteur abs', 'MOBILE'],
      clicks: 0,
      impressions: 5,
      ctr: 0,
      position: 30,
    }));
  }
  return Promise.resolve({ data: { rows: page(rows) } });
}

jest.mock('googleapis', () => ({
  google: {
    searchconsole: jest.fn(() => ({
      searchanalytics: { query: (args: any) => mockQuery(args) },
    })),
  },
}));

// ─── Harness ───────────────────────────────────────────────────────────────
const NOW = new Date('2026-09-11T02:00:00.000Z'); // probe endDate = 2026-09-10
const ENV: Record<string, string> = {
  SUPABASE_URL: 'https://mock.supabase.co',
  SEO_GSC_ROLLING_DAYS: '2',
  SEO_GSC_BACKFILL_LOOKBACK_DAYS: '10',
  SEO_GSC_BACKFILL_MAX_DAYS_PER_RUN: '3',
  SEO_GSC_BACKFILL_FLOOR_DATE: '2026-08-25',
};
// Fenêtre ancre 09-08 : 08-30 .. 09-08 ; refresh = 09-07, 09-08.
const ANCHOR = '2026-09-08';

function googleDay(clicks: number, impressions: number, nPages = 3): GoogleDay {
  const pages = Array.from({ length: nPages }, (_, i) => ({
    page: `https://www.automecanik.com/pieces/p-${i}.html`,
    clicks: i === 0 ? clicks : 0,
    impressions: Math.round(impressions / nPages),
  }));
  return { clicks, impressions, pages };
}

function commitMarker(date: string, version: number | null = 1) {
  const store =
    mockDb.tables.get('__seo_gsc_daily_property_total') ?? new Map();
  store.set(date, {
    date,
    clicks: 1,
    impressions: 100,
    commit_version: version,
  });
  mockDb.tables.set('__seo_gsc_daily_property_total', store);
}

async function build() {
  const runs = {
    logStarted: jest.fn().mockResolvedValue('run-1'),
    logCompleted: jest.fn().mockResolvedValue(undefined),
    logFailed: jest.fn().mockResolvedValue(undefined),
  };
  const credentials = {
    isMonitoringEnabled: jest.fn().mockReturnValue(true),
    getGSCAuth: jest.fn().mockReturnValue({}),
    getGSCSiteUrl: jest.fn().mockReturnValue('sc-domain:automecanik.com'),
  };
  const moduleRef = await Test.createTestingModule({
    providers: [
      GscDailyFetcherService,
      { provide: GoogleCredentialsService, useValue: credentials },
      { provide: SeoMonitoringRunsService, useValue: runs },
      { provide: ConfigService, useValue: { get: (k: string) => ENV[k] } },
    ],
  }).compile();
  return { svc: moduleRef.get(GscDailyFetcherService), runs, credentials };
}

/** Commite tous les candidats au rattrapage (08-30..09-06) sauf `except`. */
function commitAllCandidatesExcept(except: string) {
  for (const d of [
    '2026-08-30',
    '2026-08-31',
    '2026-09-01',
    '2026-09-02',
    '2026-09-03',
    '2026-09-04',
    '2026-09-05',
    '2026-09-06',
  ]) {
    if (d !== except) commitMarker(d);
  }
}

const grainCalls = (date: string) =>
  mockGoogle.calls.filter((b) => b.dataState !== 'all' && b.startDate === date);
const rowsOf = (table: string) => [
  ...(mockDb.tables.get(table)?.values() ?? []),
];

beforeEach(() => {
  jest.useFakeTimers({
    now: NOW,
    doNotFake: [
      'nextTick',
      'setImmediate',
      'setTimeout',
      'setInterval',
      'clearTimeout',
      'clearInterval',
      'queueMicrotask',
    ],
  });
  mockDb.tables = new Map();
  mockDb.upserts = [];
  mockDb.failUpsert = null;
  mockDb.selectError = null;
  mockGoogle.days = {};
  mockGoogle.firstIncompleteDate = '2026-09-09';
  mockGoogle.finalEmpty = new Set();
  mockGoogle.failQuery = null;
  mockGoogle.calls = [];
  for (const d of [
    '2026-08-30',
    '2026-08-31',
    '2026-09-01',
    '2026-09-02',
    '2026-09-03',
    '2026-09-05',
    '2026-09-06',
    '2026-09-07',
    '2026-09-08',
  ]) {
    mockGoogle.days[d] = googleDay(80, 5500);
  }
});
afterEach(() => jest.useRealTimers());

describe('GscDailyFetcherService.fetchAndPersistMultiGrain', () => {
  it('trou historique : grains lus uniquement pour refresh + jours non commités, marqueur écrit EN DERNIER', async () => {
    for (const d of [
      '2026-08-30',
      '2026-08-31',
      '2026-09-02',
      '2026-09-03',
      '2026-09-05',
      '2026-09-06',
    ]) {
      commitMarker(d);
    }
    commitMarker('2026-09-01', null); // ligne legacy : pas une preuve de commit
    const { svc, runs } = await build();

    const r = await svc.fetchAndPersistMultiGrain({
      date: ANCHOR,
      triggeredBy: 'scheduler',
    });

    expect(r.dates!.refresh).toEqual(['2026-09-07', '2026-09-08']);
    // 09-04 : aucun trafic (vrai zéro) ; 09-01 : legacy non commitée.
    expect(r.dates!.backfill).toEqual(['2026-09-01', '2026-09-04']);
    expect(r.dates!.ingested).toEqual([
      '2026-09-07',
      '2026-09-08',
      '2026-09-01',
    ]);
    expect(r.dates!.realZero).toEqual(['2026-09-04']);
    expect(grainCalls('2026-09-02')).toHaveLength(0);
    expect(grainCalls('2026-09-04')).toHaveLength(0);

    for (const d of r.dates!.ingested) {
      const tablesForDate = mockDb.upserts
        .filter((u) => u.rows.some((row) => row.date === d))
        .map((u) => u.table);
      expect(tablesForDate).toEqual([
        '__seo_gsc_daily_totals',
        '__seo_gsc_daily_pages',
        '__seo_gsc_daily_page_totals',
        '__seo_gsc_daily',
        '__seo_gsc_daily_property_total',
      ]);
      const marker = rowsOf('__seo_gsc_daily_property_total').find(
        (x) => x.date === d,
      );
      expect(marker).toMatchObject({
        clicks: 80,
        impressions: 5500,
        commit_version: 1,
      });
    }
    expect(runs.logStarted).toHaveBeenCalledTimes(1);
    expect(runs.logCompleted).toHaveBeenCalledTimes(1);
    expect(runs.logCompleted.mock.calls[0][1].extra.dates.real_zero).toEqual([
      '2026-09-04',
    ]);
    expect(runs.logCompleted.mock.calls[0][1].extra.runtime).toHaveProperty(
      'hostname',
    );
  });

  it('vrai zéro : jour finalisé sans impression → 0/0 explicite commité, aucun appel de grain', async () => {
    commitAllCandidatesExcept('2026-09-04');
    const { svc } = await build();
    const r = await svc.fetchAndPersistMultiGrain({ date: ANCHOR });
    expect(r.dates!.realZero).toContain('2026-09-04');
    const zero = rowsOf('__seo_gsc_daily_property_total').find(
      (x) => x.date === '2026-09-04',
    );
    expect(zero).toMatchObject({
      clicks: 0,
      impressions: 0,
      commit_version: 1,
    });
    expect(grainCalls('2026-09-04')).toHaveLength(0);
    expect(
      rowsOf('__seo_gsc_daily_page_totals').some(
        (x) => x.date === '2026-09-04',
      ),
    ).toBe(false);
  });

  it('jour non finalisé : aucune écriture, jamais un zéro', async () => {
    mockGoogle.firstIncompleteDate = '2026-09-08';
    const { svc } = await build();
    const r = await svc.fetchAndPersistMultiGrain({ date: ANCHOR });
    expect(r.dates!.notFinal).toEqual(['2026-09-08']);
    expect(r.warnings).toContain('not_final:2026-09-08');
    expect(grainCalls('2026-09-08')).toHaveLength(0);
    expect(
      mockDb.upserts.some((u) =>
        u.rows.some((row) => row.date === '2026-09-08'),
      ),
    ).toBe(false);
  });

  it('métadonnée absente : jour annoncé mais requête finale vide → rien écrit ; jour sans donnée → pas de zéro', async () => {
    mockGoogle.firstIncompleteDate = null;
    mockGoogle.finalEmpty = new Set(['2026-09-07']);
    commitAllCandidatesExcept('2026-09-04');
    const { svc } = await build();
    const r = await svc.fetchAndPersistMultiGrain({ date: ANCHOR });
    expect(r.dates!.finalityUnknown).toEqual(
      expect.arrayContaining(['2026-09-07', '2026-09-04']),
    );
    expect(r.warnings).toContain('final_rows_missing:2026-09-07');
    expect(r.dates!.realZero).toEqual([]);
    expect(
      mockDb.upserts.some((u) =>
        u.rows.some((row) => ['2026-09-07', '2026-09-04'].includes(row.date)),
      ),
    ).toBe(false);
    expect(r.dates!.ingested).toContain('2026-09-08');
  });

  it('import partiel : échec page_totals → jour non commité, journal failed, repris et commité au run suivant', async () => {
    for (const d of [
      '2026-08-30',
      '2026-08-31',
      '2026-09-02',
      '2026-09-03',
      '2026-09-05',
      '2026-09-06',
    ]) {
      commitMarker(d);
    }
    mockDb.failUpsert = (table, rows) =>
      table === '__seo_gsc_daily_page_totals' &&
      rows.some((x) => x.date === '2026-09-01')
        ? { message: 'fetch failed: ECONNRESET' }
        : null;
    const first = await build();
    const r1 = await first.svc.fetchAndPersistMultiGrain({ date: ANCHOR });

    expect(r1.dates!.failed).toEqual([
      expect.objectContaining({ date: '2026-09-01', errorClass: 'network' }),
    ]);
    expect(
      rowsOf('__seo_gsc_daily_property_total').find(
        (x) => x.date === '2026-09-01',
      ),
    ).toBeUndefined();
    expect(r1.dates!.ingested).toEqual(['2026-09-07', '2026-09-08']);
    expect(first.runs.logFailed).toHaveBeenCalledTimes(1);
    expect(first.runs.logCompleted).not.toHaveBeenCalled();
    expect(first.runs.logFailed.mock.calls[0][1].extra.dates.failed).toEqual([
      { date: '2026-09-01', error_class: 'network' },
    ]);

    mockDb.failUpsert = null;
    mockGoogle.calls = [];
    const second = await build();
    const r2 = await second.svc.fetchAndPersistMultiGrain({ date: ANCHOR });
    expect(r2.dates!.backfill).toEqual(['2026-09-01']);
    expect(r2.dates!.ingested).toContain('2026-09-01');
    expect(
      rowsOf('__seo_gsc_daily_property_total').find(
        (x) => x.date === '2026-09-01',
      ),
    ).toMatchObject({ commit_version: 1 });
  });

  it('erreur API systémique (429) : run arrêté, aucune requête suivante, rejet + journal quota', async () => {
    mockGoogle.failQuery = (body) =>
      body.dataState !== 'all'
        ? Object.assign(new Error('Rate Limit Exceeded'), { status: 429 })
        : null;
    const { svc, runs } = await build();
    await expect(
      svc.fetchAndPersistMultiGrain({ date: ANCHOR }),
    ).rejects.toThrow('Rate Limit Exceeded');
    const grainQueries = mockGoogle.calls.filter((b) => b.dataState !== 'all');
    expect(grainQueries).toHaveLength(1);
    expect(mockDb.upserts).toHaveLength(0);
    expect(runs.logFailed).toHaveBeenCalledTimes(1);
    expect(runs.logFailed.mock.calls[0][1].errorClass).toBe('quota_exceeded');
  });

  it('schéma absent (migration non appliquée) : schema_drift, 0 appel API, 0 écriture de données', async () => {
    mockDb.selectError = {
      code: '42703',
      message: 'column commit_version does not exist',
    };
    const { svc, runs } = await build();
    await expect(
      svc.fetchAndPersistMultiGrain({ date: ANCHOR }),
    ).rejects.toThrow('commit_version');
    expect(mockGoogle.calls).toHaveLength(0);
    expect(mockDb.upserts).toHaveLength(0);
    expect(runs.logFailed.mock.calls[0][1].errorClass).toBe('schema_drift');
  });

  it('pagination : rowLimit 2 et 5 pages → startRow 0/2/4, toutes les lignes écrites', async () => {
    mockGoogle.days = { '2026-09-08': googleDay(80, 5500, 5) };
    commitMarker('2026-09-07');
    const { svc } = await build();
    await svc.fetchAndPersistMultiGrain({
      date: ANCHOR,
      rowLimit: 2,
      lookbackDays: 2,
    });
    const pageTotalCalls = mockGoogle.calls.filter(
      (b) =>
        b.startDate === '2026-09-08' &&
        (b.dimensions ?? []).join(',') === 'page',
    );
    expect(pageTotalCalls.map((b) => b.startRow)).toEqual([0, 2, 4]);
    expect(pageTotalCalls[0].aggregationType).toBe('byPage');
    expect(
      rowsOf('__seo_gsc_daily_page_totals').filter(
        (x) => x.date === '2026-09-08',
      ),
    ).toHaveLength(5);
  });

  it('ré-exécution : mêmes clés, aucun doublon, fetched_at rafraîchi', async () => {
    const { svc } = await build();
    // 1er run sans plafond effectif : toute la fenêtre est commitée.
    await svc.fetchAndPersistMultiGrain({ date: ANCHOR, maxBackfillDays: 10 });
    const counts = () =>
      [
        '__seo_gsc_daily_property_total',
        '__seo_gsc_daily_totals',
        '__seo_gsc_daily_pages',
        '__seo_gsc_daily_page_totals',
        '__seo_gsc_daily',
      ].map((t) => rowsOf(t).length);
    const before = counts();
    const fetchedBefore = rowsOf('__seo_gsc_daily_page_totals')[0].fetched_at;

    jest.setSystemTime(new Date('2026-09-11T03:00:00.000Z'));
    const again = await build();
    const r2 = await again.svc.fetchAndPersistMultiGrain({
      date: ANCHOR,
      maxBackfillDays: 10,
    });
    expect(r2.dates!.backfill).toEqual([]); // tout est commité : seul le refresh repasse
    expect(counts()).toEqual(before);
    const refreshed = rowsOf('__seo_gsc_daily_page_totals').find(
      (x) => x.date === '2026-09-08',
    )!;
    expect(refreshed.fetched_at > fetchedBefore).toBe(true);
  });

  it('dry-run : lit GSC mais AUCUNE écriture (ni données ni journal)', async () => {
    const { svc, runs } = await build();
    const r = await svc.fetchAndPersistMultiGrain({
      date: ANCHOR,
      dryRun: true,
    });
    expect(r.dryRun).toBe(true);
    expect(r.runId).toBe('dry-run');
    expect(r.dates!.ingested.length).toBeGreaterThan(0);
    expect(mockDb.upserts).toHaveLength(0);
    expect(mockDb.tables.size).toBe(0);
    expect(runs.logStarted).not.toHaveBeenCalled();
    expect(runs.logCompleted).not.toHaveBeenCalled();
    expect(runs.logFailed).not.toHaveBeenCalled();
  });

  it('plan seul : 1 sonde de finalité, 0 requête de grain, 0 écriture', async () => {
    const { svc, runs } = await build();
    const r = await svc.fetchAndPersistMultiGrain({
      date: ANCHOR,
      planOnly: true,
      maxBackfillDays: 10,
    });
    expect(mockGoogle.calls).toHaveLength(1);
    expect(mockGoogle.calls[0]).toMatchObject({
      dataState: 'all',
      dimensions: ['date'],
      endDate: '2026-09-10',
    });
    expect(r.dates!.decisions['2026-09-04']).toBe('real_zero');
    expect(mockDb.upserts).toHaveLength(0);
    expect(runs.logStarted).not.toHaveBeenCalled();
  });

  it('monitoring désactivé : aucun appel, aucun journal', async () => {
    const { svc, runs, credentials } = await build();
    credentials.isMonitoringEnabled.mockReturnValue(false);
    const r = await svc.fetchAndPersistMultiGrain({ date: ANCHOR });
    expect(r.warnings).toEqual(['monitoring_disabled']);
    expect(mockGoogle.calls).toHaveLength(0);
    expect(runs.logStarted).not.toHaveBeenCalled();
  });

  it('plancher CLI sous le plancher gouverné refusé', async () => {
    const { svc } = await build();
    await expect(
      svc.fetchAndPersistMultiGrain({
        date: ANCHOR,
        floorDate: '2026-08-01',
        dryRun: true,
      }),
    ).rejects.toThrow('plancher');
  });
});

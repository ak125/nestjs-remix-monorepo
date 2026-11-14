/**
 * Sitemap v10 scoring — fail-closed contract.
 *
 * A score refresh writes nothing unless every input source was read in full
 * and is populated. An unknown input is never a penalty: an empty link graph
 * would score every page as an orphan, and pages without any title or
 * description would all be scored as duplicated thin content — both end in a
 * mass `exclude`.
 *
 * Guarantees pinned here:
 *   1. an unreadable source is a failure, never an empty source;
 *   2. an empty or unpopulated source stops the refresh before any write;
 *   3. reads are paginated, so a refresh never scores a truncated page set;
 *   4. an unknown `status_target` does not block a page, a known non-200 does;
 *   5. the first refused write stops the refresh, and partial scores never
 *      reach the temperature refresh;
 *   6. the HTTP routes answer 503 instead of a 2xx carrying `success: false`
 *      or empty statistics;
 *   7. the monthly report never proposes a `noindex` from a score alone.
 *
 * supabase-js resolves `{ error }` (it does not throw): the fake returns results.
 */
import { ServiceUnavailableException } from '@nestjs/common';
import { Queue } from 'bull';

import { SitemapV10Controller } from '../../src/modules/seo/controllers/sitemap-v10.controller';
import { SeoPilotageService } from '../../src/modules/seo/services/seo-pilotage.service';
import { SitemapV10HubsService } from '../../src/modules/seo/services/sitemap-v10-hubs.service';
import {
  SitemapV10ScoringService,
  type EntityInputs,
  type ScoringResult,
} from '../../src/modules/seo/services/sitemap-v10-scoring.service';
import { SitemapV10Service } from '../../src/modules/seo/services/sitemap-v10.service';
import type { ZombiePage } from '../../src/modules/seo/types/seo-pilotage.types';

const mockConfigService = {
  get: jest.fn().mockImplementation((key: string) => {
    const map: Record<string, string> = {
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key-placeholder',
    };
    return map[key] ?? 'mock-value';
  }),
  getOrThrow: jest.fn().mockReturnValue('mock-value'),
};

// ─── Fake database ──────────────────────────────────────────────────────────

type Row = Record<string, unknown>;
type DbError = { message: string };

interface TableSpec {
  rows?: Row[];
  /** Error returned by every read of the table. */
  error?: string;
  /** Error returned from this page index on (0 = first page). */
  errorFromPage?: number;
}

interface DbSpec {
  tables: Record<string, TableSpec>;
  /** Index of the first upsert call that is refused (0 = first batch). */
  upsertFailsAt?: number;
  rpc?: { data?: unknown; error?: DbError };
}

function fakeDb(spec: DbSpec) {
  const reads: Record<string, number> = {};
  const upserts: Row[][] = [];
  const rpcCalls: string[] = [];

  const from = jest.fn((table: string) => {
    const state = spec.tables[table] ?? {};
    const rows = state.rows ?? [];
    const result = (
      slice: Row[],
      pageIndex: number,
    ): { data: Row[] | null; error: DbError | null } => {
      reads[table] = (reads[table] ?? 0) + 1;
      const failing =
        state.error !== undefined &&
        (state.errorFromPage === undefined || pageIndex >= state.errorFromPage);
      return failing
        ? { data: null, error: { message: state.error as string } }
        : { data: slice, error: null };
    };
    const builder = {
      select: () => builder,
      eq: () => builder,
      gte: () => builder,
      not: () => builder,
      in: () => builder,
      limit: () => builder,
      order: () => builder,
      range: (start: number, end: number) =>
        Promise.resolve(
          result(rows.slice(start, end + 1), Math.floor(start / 1000)),
        ),
      // A read awaited without `range` (single request).
      then: (
        onFulfilled: (value: {
          data: Row[] | null;
          error: DbError | null;
        }) => unknown,
      ) => Promise.resolve(result(rows, 0)).then(onFulfilled),
      upsert: (batch: Row[]) => {
        const index = upserts.length;
        upserts.push(batch);
        return Promise.resolve({
          error:
            spec.upsertFailsAt !== undefined && index >= spec.upsertFailsAt
              ? { message: 'write refused' }
              : null,
        });
      },
    };
    return builder;
  });

  const rpc = jest.fn((name: string) => {
    rpcCalls.push(name);
    return Promise.resolve({
      data: spec.rpc?.data ?? 0,
      error: spec.rpc?.error ?? null,
    });
  });

  return { from, rpc, reads, upserts, rpcCalls };
}

type FakeDb = ReturnType<typeof fakeDb>;

const ALLOW = { decision: 'ALLOW' as const, reason: 'TEST' };

function makeScoring(
  db: FakeDb,
  gate: { evaluate: jest.Mock; log: jest.Mock } = {
    evaluate: jest.fn(() => ALLOW),
    log: jest.fn(),
  },
): SitemapV10ScoringService {
  const service = new (SitemapV10ScoringService as unknown as new (
    c: unknown,
    g: unknown,
  ) => SitemapV10ScoringService)(mockConfigService, gate);
  Object.defineProperty(service, 'supabase', {
    get: () => db,
    configurable: true,
  });
  return service;
}

// ─── Fixtures ───────────────────────────────────────────────────────────────

const page = (id: number, overrides: Row = {}): Row => ({
  id,
  url: `/pieces/p-${id}.html`,
  entity_id: null,
  page_type: 'product',
  meta_robots: 'index, follow',
  canonical_url: null,
  status_target: 200,
  last_published_at: null,
  title: `Titre ${id}`,
  meta_description: `Description ${id}`,
  ...overrides,
});

/** Two active inbound links per page: no page is an orphan. */
const linksFor = (pages: Row[]): Row[] =>
  pages.flatMap((p) => [
    { to_url: p.url, link_type: 'hub' },
    { to_url: p.url, link_type: 'related' },
  ]);

const PAGES = [page(1), page(2), page(3)];

const healthy = (overrides: Partial<DbSpec> = {}): DbSpec => ({
  tables: {
    __seo_internal_link: { rows: linksFor(PAGES) },
    __seo_quality_log: { rows: [] },
    __seo_page: { rows: PAGES },
  },
  rpc: { data: PAGES.length },
  ...overrides,
});

const withTables = (tables: Record<string, TableSpec>): DbSpec => {
  const base = healthy();
  return { ...base, tables: { ...base.tables, ...tables } };
};

function expectNothingWritten(db: FakeDb): void {
  expect(db.upserts).toHaveLength(0);
  expect(db.rpcCalls).toHaveLength(0);
}

// ─── Refresh ────────────────────────────────────────────────────────────────

describe('SitemapV10ScoringService.refreshAllScores — fail closed', () => {
  it('scores and writes when every input is read and populated', async () => {
    const db = fakeDb(healthy());
    const result = await makeScoring(db).refreshAllScores();

    expect(result).toMatchObject({
      success: true,
      status: 'ok',
      processed: 3,
      updated: 3,
      errors: 0,
    });
    expect(result.reason).toBeUndefined();
    expect(db.upserts).toHaveLength(1);
    expect(db.upserts[0]).toHaveLength(3);
    for (const row of db.upserts[0]) {
      expect(row.is_blocked).toBe(false);
      expect(row.bucket).not.toBe('exclude');
    }
    expect(db.rpcCalls).toEqual(['refresh_temperature_scores']);
  });

  it('stops before any write when the inbound link graph is empty', async () => {
    const db = fakeDb(withTables({ __seo_internal_link: { rows: [] } }));
    const result = await makeScoring(db).refreshAllScores();

    expect(result).toMatchObject({
      success: false,
      status: 'inputs_unavailable',
      reason: 'inbound link graph is empty',
      processed: 0,
      updated: 0,
    });
    // Nothing else is loaded once the graph is known to be missing.
    expect(db.reads.__seo_page).toBeUndefined();
    expectNothingWritten(db);
  });

  it.each(['__seo_internal_link', '__seo_quality_log', '__seo_page'])(
    'fails without writing when %s cannot be read',
    async (table) => {
      const rows = healthy().tables[table].rows;
      const db = fakeDb(
        withTables({ [table]: { rows, error: 'read refused' } }),
      );
      const result = await makeScoring(db).refreshAllScores();

      expect(result).toMatchObject({
        success: false,
        status: 'failed',
        reason: 'input read failed',
        updated: 0,
      });
      expect(result.errors).toBeGreaterThan(0);
      expectNothingWritten(db);
    },
  );

  it('does not put the database error text in the reason', async () => {
    const db = fakeDb(
      withTables({ __seo_quality_log: { error: 'column x does not exist' } }),
    );
    const result = await makeScoring(db).refreshAllScores();

    expect(result.reason).toBe('input read failed');
  });

  it('stops before any write when there is no indexable page', async () => {
    const db = fakeDb(withTables({ __seo_page: { rows: [] } }));
    const result = await makeScoring(db).refreshAllScores();

    expect(result).toMatchObject({
      status: 'inputs_unavailable',
      reason: 'no indexable page to score',
    });
    expectNothingWritten(db);
  });

  it.each([
    ['title', 'no page carries a title'],
    ['meta_description', 'no page carries a meta description'],
  ])(
    'stops before any write when no page carries a %s',
    async (field, reason) => {
      const rows = PAGES.map((p) => ({ ...p, [field]: null }));
      const db = fakeDb(
        withTables({
          __seo_internal_link: { rows: linksFor(rows) },
          __seo_page: { rows },
        }),
      );
      const result = await makeScoring(db).refreshAllScores();

      expect(result).toMatchObject({
        success: false,
        status: 'inputs_unavailable',
        reason,
      });
      expectNothingWritten(db);
    },
  );

  it('still scores a page that lacks a title when the source is populated', async () => {
    const rows = [page(1), page(2, { title: null })];
    const db = fakeDb(
      withTables({
        __seo_internal_link: { rows: linksFor(rows) },
        __seo_page: { rows },
      }),
    );
    const result = await makeScoring(db).refreshAllScores();

    expect(result.status).toBe('ok');
    expect(db.upserts[0]).toHaveLength(2);
  });

  it('reads every page, beyond the per-request row cap', async () => {
    const rows = Array.from({ length: 2500 }, (_, i) => page(i + 1));
    const db = fakeDb(
      withTables({
        __seo_internal_link: { rows: linksFor(rows) },
        __seo_page: { rows },
      }),
    );
    const result = await makeScoring(db).refreshAllScores();

    expect(result).toMatchObject({
      status: 'ok',
      processed: 2500,
      updated: 2500,
    });
    expect(db.reads.__seo_page).toBe(3);
    expect(db.reads.__seo_internal_link).toBe(6);
    expect(db.upserts.map((batch) => batch.length)).toEqual([1000, 1000, 500]);
  });

  it('fails without writing when a later page of a read is refused', async () => {
    const rows = Array.from({ length: 2500 }, (_, i) => page(i + 1));
    const db = fakeDb(
      withTables({
        __seo_internal_link: { rows: linksFor(rows) },
        __seo_page: { rows, error: 'read refused', errorFromPage: 1 },
      }),
    );
    const result = await makeScoring(db).refreshAllScores();

    expect(result).toMatchObject({
      status: 'failed',
      reason: 'input read failed',
    });
    expectNothingWritten(db);
  });

  it('does not block a page whose status_target is unknown, blocks a known non-200', async () => {
    const rows = [
      page(1, { status_target: null }),
      page(2, { status_target: 404 }),
    ];
    const db = fakeDb(
      withTables({
        __seo_internal_link: { rows: linksFor(rows) },
        __seo_page: { rows },
      }),
    );
    await makeScoring(db).refreshAllScores();
    const [unknown, notFound] = db.upserts[0];

    expect(unknown).toMatchObject({ is_blocked: false, confusion_risk: 0 });
    expect(unknown.bucket).not.toBe('exclude');
    expect(notFound).toMatchObject({
      is_blocked: true,
      confusion_risk: 100,
      bucket: 'exclude',
    });
  });

  it('derives the cluster size from the pages it scores', async () => {
    const rows = [
      page(1, { entity_id: 7 }),
      page(2, { entity_id: 7 }),
      page(3, { entity_id: 7 }),
    ];
    const db = fakeDb(
      withTables({
        __seo_internal_link: { rows: linksFor(rows) },
        __seo_page: { rows },
      }),
    );
    const result = await makeScoring(db).refreshAllScores();

    expect(result.status).toBe('ok');
    // One paginated read of the pages, no second read for the clusters.
    expect(db.reads.__seo_page).toBe(1);
  });

  it('stops at the first refused write and never refreshes temperatures', async () => {
    const rows = Array.from({ length: 2500 }, (_, i) => page(i + 1));
    const db = fakeDb({
      ...withTables({
        __seo_internal_link: { rows: linksFor(rows) },
        __seo_page: { rows },
      }),
      upsertFailsAt: 1,
    });
    const result = await makeScoring(db).refreshAllScores();

    expect(result).toMatchObject({
      success: false,
      status: 'failed',
      reason: 'score write failed',
      updated: 1000,
      errors: 1500,
    });
    // The third batch is never attempted.
    expect(db.upserts).toHaveLength(2);
    expect(db.rpcCalls).toHaveLength(0);
  });

  it('fails when the score table refuses the very first write', async () => {
    const db = fakeDb({ ...healthy(), upsertFailsAt: 0 });
    const result = await makeScoring(db).refreshAllScores();

    expect(result).toMatchObject({
      status: 'failed',
      reason: 'score write failed',
      updated: 0,
      errors: 3,
    });
    expect(db.rpcCalls).toHaveLength(0);
  });

  it('fails when the temperature refresh returns an error', async () => {
    const db = fakeDb(healthy({ rpc: { error: { message: 'no function' } } }));
    const result = await makeScoring(db).refreshAllScores();

    expect(result).toMatchObject({
      success: false,
      status: 'failed',
      reason: 'temperature refresh failed',
      updated: 3,
    });
  });

  it('fails when the RPC gate refuses the temperature refresh', async () => {
    const db = fakeDb(healthy());
    const gate = {
      evaluate: jest.fn(() => ({ decision: 'BLOCK', reason: 'TEST_BLOCK' })),
      log: jest.fn(),
    };
    const result = await makeScoring(db, gate).refreshAllScores();

    expect(result).toMatchObject({
      status: 'failed',
      reason: 'temperature refresh failed',
    });
    expect(db.rpcCalls).toHaveLength(0);
  });

  it('runs once for calls received while a refresh is in progress', async () => {
    const db = fakeDb(healthy());
    const service = makeScoring(db);

    const [first, second, third] = await Promise.all([
      service.refreshAllScores(),
      service.refreshAllScores(),
      service.refreshAllScores(),
    ]);

    expect(second).toBe(first);
    expect(third).toBe(first);
    expect(first.status).toBe('ok');
    expect(db.reads.__seo_page).toBe(1);
    expect(db.upserts).toHaveLength(1);
    expect(db.rpcCalls).toHaveLength(1);
  });

  it('runs again once the previous refresh has ended, failed or not', async () => {
    const db = fakeDb(healthy());
    const service = makeScoring(db);

    await service.refreshAllScores();
    await service.refreshAllScores();
    expect(db.upserts).toHaveLength(2);

    const failing = fakeDb(
      withTables({ __seo_internal_link: { error: 'connection reset' } }),
    );
    const other = makeScoring(failing);
    expect((await other.refreshAllScores()).status).toBe('failed');
    expect((await other.refreshAllScores()).status).toBe('failed');
    expect(failing.reads.__seo_internal_link).toBe(2);
  });
});

// ─── Pure scoring rule ──────────────────────────────────────────────────────

describe('SitemapV10ScoringService.scoreEntity — status_target', () => {
  const inputs: EntityInputs = {
    businessValue: 70,
    demand: 50,
    graphStrength: 20,
    clusterDepth: 1,
    contentStrength: 40,
    duplicationRisk: 5,
    orphanRisk: 0,
    thinContentRisk: 0,
    confusionRisk: 0,
  };
  const service = makeScoring(fakeDb(healthy()));

  it.each([undefined, null, 200])('does not block on %s', (statusTarget) => {
    expect(service.scoreEntity({ ...inputs, statusTarget }).isBlocked).toBe(
      false,
    );
  });

  it.each([0, 301, 404, 410, 500])('blocks on %s', (statusTarget) => {
    const score = service.scoreEntity({ ...inputs, statusTarget });
    expect(score.isBlocked).toBe(true);
    expect(score.bucket).toBe('exclude');
  });
});

// ─── Distribution ───────────────────────────────────────────────────────────

describe('SitemapV10ScoringService.getScoreDistribution', () => {
  it('throws when the view cannot be read', async () => {
    const db = fakeDb({
      tables: { v_seo_temperature_stats: { error: 'relation is missing' } },
    });
    await expect(makeScoring(db).getScoreDistribution()).rejects.toThrow(
      'Failed to load score distribution',
    );
  });

  it('returns zeros for a readable, empty view', async () => {
    const db = fakeDb({ tables: { v_seo_temperature_stats: { rows: [] } } });
    await expect(makeScoring(db).getScoreDistribution()).resolves.toEqual({
      byBucket: {},
      avgScore: 0,
      totalScored: 0,
    });
  });

  it('aggregates the rows of the view', async () => {
    const db = fakeDb({
      tables: {
        v_seo_temperature_stats: {
          rows: [
            { temperature: 'hot', url_count: 10, avg_score: 80 },
            { temperature: 'cold', url_count: 30, avg_score: 40 },
          ],
        },
      },
    });
    await expect(makeScoring(db).getScoreDistribution()).resolves.toEqual({
      byBucket: { hot: 10, cold: 30 },
      avgScore: 50,
      totalScored: 40,
    });
  });
});

// ─── HTTP routes ────────────────────────────────────────────────────────────

function makeController(scoring: Partial<SitemapV10ScoringService>): {
  controller: SitemapV10Controller;
  sitemapService: { getTemperatureStats: jest.Mock };
} {
  const sitemapService = { getTemperatureStats: jest.fn(async () => []) };
  const controller = new SitemapV10Controller(
    sitemapService as unknown as SitemapV10Service,
    scoring as SitemapV10ScoringService,
    {} as SitemapV10HubsService,
    {} as Queue,
  );
  return { controller, sitemapService };
}

const scoringResult = (overrides: Partial<ScoringResult>): ScoringResult => ({
  success: true,
  status: 'ok',
  processed: 3,
  updated: 3,
  errors: 0,
  durationMs: 12,
  ...overrides,
});

describe('SitemapV10Controller — no 2xx for an unavailable scoring', () => {
  it('refresh-scores returns the counters when the refresh completed', async () => {
    const { controller } = makeController({
      refreshAllScores: jest.fn(async () => scoringResult({})),
    });
    await expect(controller.refreshScores()).resolves.toEqual({
      success: true,
      message: 'Scores refreshed successfully',
      data: { processed: 3, updated: 3, errors: 0, durationMs: 12 },
    });
  });

  it.each([
    ['inputs_unavailable', 'inbound link graph is empty'],
    ['failed', 'score write failed'],
  ] as const)(
    'refresh-scores answers 503 when the refresh is %s',
    async (status, reason) => {
      const { controller } = makeController({
        refreshAllScores: jest.fn(async () =>
          scoringResult({ success: false, status, reason, updated: 0 }),
        ),
      });

      const error = await controller.refreshScores().catch((e) => e);
      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect(error.getStatus()).toBe(503);
      expect(error.getResponse()).toMatchObject({
        success: false,
        status,
        message: `Score refresh did not complete: ${reason}`,
      });
    },
  );

  it('stats answers 503 when the distribution cannot be read', async () => {
    const { controller } = makeController({
      getScoreDistribution: jest.fn(async () => {
        throw new Error('relation is missing');
      }),
    });

    const error = await controller.getStats().catch((e) => e);
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    // The cause stays in the logs, not in the public answer.
    expect(JSON.stringify(error.getResponse())).not.toContain('relation');
  });

  it('stats returns the distribution when it is readable', async () => {
    const distribution = { byBucket: { hot: 1 }, avgScore: 80, totalScored: 1 };
    const { controller } = makeController({
      getScoreDistribution: jest.fn(async () => distribution),
    });

    await expect(controller.getStats()).resolves.toEqual({
      success: true,
      data: { temperature: [], scoring: distribution },
    });
  });
});

// ─── Monthly report ─────────────────────────────────────────────────────────

describe('SeoPilotageService — no noindex from a score alone', () => {
  type Internals = {
    detectZombiePages(): Promise<ZombiePage[]>;
    generateMonthlyActions(
      zombies: ZombiePage[],
      cannibalization: unknown[],
    ): Array<{ id: string; type: string; targetUrls: string[] }>;
  };

  function makePilotage(db: FakeDb): Internals {
    const service = Object.create(SeoPilotageService.prototype);
    Object.defineProperty(service, 'supabase', { get: () => db });
    Object.defineProperty(service, 'logger', {
      value: { error: jest.fn(), log: jest.fn(), warn: jest.fn() },
    });
    return service as Internals;
  }

  const zombie = (overrides: Partial<ZombiePage>): ZombiePage => ({
    url: '/pieces/p-1.html',
    pageRole: null,
    impressions90d: 0,
    clicks90d: 0,
    avgPosition90d: 100,
    reasons: ['low_impressions'],
    zombieScore: 90,
    recommendation: 'improve',
    ...overrides,
  });

  it('never recommends noindex for a page known only by its temperature', async () => {
    const db = fakeDb({
      tables: {
        __seo_page: {
          rows: [
            { url: '/a', page_role: null, temperature: 'exclude' },
            { url: '/b', page_role: null, temperature: 'cold' },
          ],
        },
      },
    });
    const zombies = await makePilotage(db).detectZombiePages();

    expect(zombies.map((z) => z.recommendation)).toEqual([
      'improve',
      'improve',
    ]);
  });

  it('proposes no noindex action from a high score alone', () => {
    const actions = makePilotage(fakeDb({ tables: {} })).generateMonthlyActions(
      [zombie({ zombieScore: 90 }), zombie({ zombieScore: 100 })],
      [],
    );

    expect(actions.filter((a) => a.type === 'noindex')).toEqual([]);
  });

  it('keeps the noindex action for a page that carries that recommendation', () => {
    const actions = makePilotage(fakeDb({ tables: {} })).generateMonthlyActions(
      [zombie({ url: '/x', zombieScore: 90, recommendation: 'noindex' })],
      [],
    );

    expect(actions.filter((a) => a.type === 'noindex')).toEqual([
      expect.objectContaining({ id: 'zombies-critical', targetUrls: ['/x'] }),
    ]);
  });
});

/**
 * Tests — R8 vehicle enricher: write outcome observability.
 *
 * Covers the three silent failure paths of `enrichSingle`:
 *   1. WriteGate `written=false` used to be treated as a success (page id
 *      returned, version inserted for content that was never written).
 *   2. `fetchNeighbors` used to turn a DB error (e.g. 42703 on the missing
 *      `variant_signature` column) into `[]`, inflating the diversity score.
 *   3. DB failures used to be labelled `CONTENT_BROKEN`.
 * Every non-written outcome also carries `reason`, the field the execution
 * report (`__pipeline_chain_queue.pcq_error`) reads.
 *
 * The service is built with Object.create (bypasses the SupabaseBaseService
 * ctor, which needs env), as in r8-parent-enrichment.test.ts. Composition and
 * scoring are stubbed: only the DB read/write orchestration is under test.
 */

import { DatabaseException } from '@common/exceptions';
import { ContentWriteExecutor } from '../../../config/content-write-executor.service';
import type { ResourceGroup } from '../../../config/execution-registry.types';
import { RoleId } from '../../../config/role-ids';
import { SupabaseRpcError } from '../../../security/rpc-gate/rpc-gate.errors';
import { R8VehicleEnricherService } from './r8-vehicle-enricher.service';

type DbError = { code?: string; message: string };
type DbResult = { data: unknown; error: DbError | null };

interface PagesTable {
  /** Awaited result of the neighbors query (select…eq…neq…order…limit). */
  neighbors: DbResult;
  /** Result of the existing-page lookup (…maybeSingle()). */
  lookup: DbResult;
  /** Result of the legacy upsert (…upsert().select().single()). */
  upsert: DbResult;
}

const PAGE_ID = '0b6f5d1e-0000-4000-8000-000000000001';
const TYPE_ID = 19053;
const NEIGHBOR_TYPE_ID = 11056;

const VEHICLE = {
  brand_name: 'RENAULT',
  brand_alias: 'renault',
  model_name: 'CLIO III',
  model_alias: 'clio-iii',
  type_name: '1.5 dCi',
  fuel: 'Diesel',
  body: 'Berline',
  power_ps: '106',
  year_from: '2005',
  year_to: '2014',
};

const NEIGHBOR = {
  id: '0b6f5d1e-0000-4000-8000-000000000002',
  page_key: `r8_vehicle_${NEIGHBOR_TYPE_ID}`,
  content_main: 'x',
  faq_signature: 'f',
  category_signature: 'c',
  diversity_score: 60,
  variant_signature: null,
};

const BLOCKS = ['S_A', 'S_B', 'S_C', 'S_D', 'S_E'].map((id) => ({
  id,
  type: 'text',
  title: id,
  renderedText: `texte ${id}`,
  specificityWeight: 0.7,
  boilerplateRisk: 0.1,
}));

const METRICS = {
  specificContentRatio: 0.7,
  boilerplateRatio: 0.2,
  diversityScore: 58.4,
  semanticSimilarityScore: 70,
  categoryOrderDiversityScore: 50,
  faqReuseRiskScore: 10,
  catalogDeltaScore: 40,
  commercialIntentScore: 30,
};

const FINGERPRINTS = {
  contentFingerprint: 'cf',
  normalizedTextFingerprint: 'nf',
  faqSignature: 'fs',
  categorySignature: 'cs',
};

function makeClient(pages: PagesTable) {
  const writes: Array<{ table: string; op: string }> = [];
  const from = jest.fn((table: string) => {
    const builder: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'neq', 'order', 'limit']) {
      builder[m] = jest.fn(() => builder);
    }
    for (const m of ['upsert', 'insert', 'update']) {
      builder[m] = jest.fn(() => {
        writes.push({ table, op: m });
        return builder;
      });
    }
    builder.maybeSingle = jest.fn(() => Promise.resolve(pages.lookup));
    builder.single = jest.fn(() => Promise.resolve(pages.upsert));
    // The neighbors query is awaited directly after .limit().
    builder.then = (
      resolve: (v: DbResult) => unknown,
      reject: (e: unknown) => unknown,
    ) => Promise.resolve(pages.neighbors).then(resolve, reject);
    return builder;
  });
  return { client: { from }, writes };
}

interface Harness {
  svc: R8VehicleEnricherService;
  logger: { log: jest.Mock; warn: jest.Mock; error: jest.Mock };
  writeToTarget: jest.Mock;
  writes: Array<{ table: string; op: string }>;
  inserts: Record<
    | 'insertVersion'
    | 'insertFingerprints'
    | 'insertSimilarityScores'
    | 'insertRegenerationQueue'
    | 'insertQaReview',
    jest.Mock
  >;
  composeBlocks: jest.Mock;
}

function makeHarness(
  opts: {
    pages?: Partial<PagesTable>;
    writeResult?: Record<string, unknown>;
    rpc?: DbResult | { data: unknown; error: unknown };
    writeGuardEnabled?: boolean;
  } = {},
): Harness {
  const pages: PagesTable = {
    neighbors: { data: [NEIGHBOR], error: null },
    lookup: { data: { id: PAGE_ID }, error: null },
    upsert: { data: { id: PAGE_ID }, error: null },
    ...opts.pages,
  };
  const { client, writes } = makeClient(pages);
  const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const writeToTarget = jest.fn().mockResolvedValue({
    written: true,
    fieldsWritten: ['content_main'],
    fieldsSkipped: [],
    fieldsStripped: [],
    mergeDetails: [],
    ...opts.writeResult,
  });
  const inserts = {
    insertVersion: jest.fn().mockResolvedValue(undefined),
    insertFingerprints: jest.fn().mockResolvedValue(undefined),
    insertSimilarityScores: jest.fn().mockResolvedValue(undefined),
    insertRegenerationQueue: jest.fn().mockResolvedValue(undefined),
    insertQaReview: jest.fn().mockResolvedValue(undefined),
  };
  const composeBlocks = jest.fn().mockReturnValue(BLOCKS);

  const svc = Object.create(
    R8VehicleEnricherService.prototype,
  ) as R8VehicleEnricherService;
  Object.assign(svc as unknown as Record<string, unknown>, {
    logger,
    supabase: client,
    RAG_GAMMES_DIR: '/nonexistent/r8-write-gate-test/gammes',
    callRpc: jest
      .fn()
      .mockResolvedValue(
        opts.rpc ?? { data: { vehicle: VEHICLE }, error: null },
      ),
    seoRoleTemplate: { pick: jest.fn().mockResolvedValue(null) },
    featureFlags: {
      writeGuardEnabled: opts.writeGuardEnabled ?? true,
      r8OwnedEditorialEnabled: false,
    },
    writeGate: { writeToTarget },
    loadGammeRag: jest.fn().mockReturnValue({ faq: [], symptoms: [] }),
    composeBlocks,
    computeMetrics: jest.fn().mockReturnValue({ ...METRICS }),
    computeFingerprints: jest.fn().mockReturnValue(FINGERPRINTS),
    applyMetaCollisionPenalty: jest.fn().mockReturnValue([]),
    gate: jest.fn().mockReturnValue({
      decision: 'REVIEW_REQUIRED',
      reasons: ['LOW_SEMANTIC_DIVERSITY'],
      warnings: [],
    }),
    ...inserts,
  });
  return { svc, logger, writeToTarget, writes, inserts, composeBlocks };
}

/**
 * Real ContentWriteExecutor with a stubbed Supabase client (Object.create
 * bypasses its ctor, which builds a live client). Write guard off: no lock,
 * no CAS — straight to step H (UPDATE, then INSERT fallback).
 */
function makeRealExecutor(db: {
  update: { error: { message: string } | null; count: number | null };
  insert?: { error: { message: string } | null };
}): ContentWriteExecutor {
  const executor = Object.create(
    ContentWriteExecutor.prototype,
  ) as ContentWriteExecutor;
  const eq = jest.fn().mockResolvedValue(db.update);
  const supabase = {
    from: jest.fn(() => ({
      update: jest.fn(() => ({ eq })),
      insert: jest.fn().mockResolvedValue(db.insert ?? { error: null }),
    })),
  };
  Object.assign(executor as unknown as Record<string, unknown>, {
    logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
    supabase,
    lockService: {},
    casService: {},
    ledgerService: {},
    featureFlags: { writeGuardEnabled: false, writeGuardMode: 'observe' },
  });
  return executor;
}

const messages = (m: jest.Mock): string[] =>
  m.mock.calls.map((c) => String(c[0]));

describe('R8VehicleEnricherService — WriteGate outcome', () => {
  it('A. written=false (gate refusal) → write_gate_blocked, no version nor side inserts, structured warn', async () => {
    const h = makeHarness({
      writeResult: {
        written: false,
        reason: 'stale_base',
        fieldsWritten: [],
        fieldsSkipped: ['content_main'],
        fieldsStripped: ['h1'],
      },
    });

    const res = await h.svc.enrichSingle(TYPE_ID);

    expect(h.writeToTarget).toHaveBeenCalledTimes(1);
    expect(res.status).toBe('write_gate_blocked');
    expect(res.writeGate).toEqual({
      reason: 'stale_base',
      fieldsSkipped: ['content_main'],
      fieldsStripped: ['h1'],
    });
    expect(res.warnings).toContain('WRITE_GATE_BLOCKED: stale_base');
    expect(res.reason).toBe('WRITE_GATE_BLOCKED: stale_base');
    // Computed decision is reported as-is (a refusal is not an error).
    expect(res.seoDecision).toBe('REVIEW_REQUIRED');
    expect(res.reasons).not.toContain('DB_ERROR');
    expect(res.reasons).not.toContain('CONTENT_BROKEN');
    for (const insert of Object.values(h.inserts)) {
      expect(insert).not.toHaveBeenCalled();
    }
    const warn = messages(h.logger.warn).find((m) =>
      m.includes('[R8_WRITE_GATE_REFUSED]'),
    );
    expect(warn).toBeDefined();
    expect(warn).toContain(`page_key=r8_vehicle_${TYPE_ID}`);
    expect(warn).toContain('reason=stale_base');
    expect(warn).toContain('fields_skipped=content_main');
    expect(h.logger.error).not.toHaveBeenCalled();
    // The WriteGate path never falls back to the direct upsert.
    expect(h.writes).toEqual([]);
  });

  it('B. written=true → draft, version and side inserts recorded (control)', async () => {
    const h = makeHarness();

    const res = await h.svc.enrichSingle(TYPE_ID);

    expect(res.status).toBe('draft');
    expect(res.writeGate).toBeUndefined();
    expect(res.reason).toBeUndefined();
    expect(h.inserts.insertVersion).toHaveBeenCalledTimes(1);
    expect(h.inserts.insertVersion.mock.calls[0][0]).toBe(PAGE_ID);
    expect(h.inserts.insertFingerprints).toHaveBeenCalledTimes(1);
    expect(h.inserts.insertSimilarityScores).toHaveBeenCalledTimes(1);
    expect(h.inserts.insertQaReview).toHaveBeenCalledTimes(1);
  });

  it('C. written=false with a db_error reason → failed / DB_ERROR, no version', async () => {
    const h = makeHarness({
      writeResult: {
        written: false,
        reason: 'db_error: column "variant_signature" does not exist',
        fieldsWritten: [],
      },
    });

    const res = await h.svc.enrichSingle(TYPE_ID);

    expect(res.status).toBe('failed');
    expect(res.reasons).toEqual(['DB_ERROR']);
    expect(res.reason).toBe(
      'DB_ERROR: op=write_gate code=unknown db_error: column "variant_signature" does not exist',
    );
    expect(h.inserts.insertVersion).not.toHaveBeenCalled();
    expect(
      messages(h.logger.error).some(
        (m) => m.includes('[R8_DB_ERROR]') && m.includes('op=write_gate'),
      ),
    ).toBe(true);
  });

  // Pins the `db_error` prefix contract on its producer: the reason below is
  // produced by the real ContentWriteExecutor (step H), relayed unchanged as
  // ContentWriteGateService.writeToTarget does. If the executor ever renames
  // its prefix, this test fails instead of the enricher silently reporting a
  // DB failure as a gate refusal.
  it.each([
    [
      'UPDATE error',
      { update: { error: { message: 'canceling statement' }, count: null } },
      'db_error: canceling statement',
    ],
    [
      'fallback INSERT error',
      {
        update: { error: null, count: 0 },
        insert: { error: { message: 'duplicate key' } },
      },
      'db_error_insert: duplicate key',
    ],
  ])(
    'C2. real executor %s → failed / DB_ERROR (not write_gate_blocked)',
    async (_label, db, expectedReason) => {
      const executor = makeRealExecutor(db);
      const execResult = await executor.execute(
        RoleId.R8_VEHICLE,
        'r8_vehicle_main' as ResourceGroup,
        PAGE_ID,
        { content_main: 'x' },
        [],
        'corr-c2',
      );
      expect(execResult).toMatchObject({
        written: false,
        reason: expectedReason,
      });

      const h = makeHarness({
        writeResult: {
          written: execResult.written,
          reason: execResult.reason,
          fieldsWritten: execResult.fieldsWritten,
        },
      });
      const res = await h.svc.enrichSingle(TYPE_ID);

      expect(res.status).toBe('failed');
      expect(res.reasons).toEqual(['DB_ERROR']);
      expect(res.reason).toBe(
        `DB_ERROR: op=write_gate code=unknown ${expectedReason}`,
      );
      expect(res.writeGate).toBeUndefined();
      expect(h.inserts.insertVersion).not.toHaveBeenCalled();
    },
  );

  it('H. page lookup error → DB_ERROR, never falls back to the direct upsert (gate bypass)', async () => {
    const h = makeHarness({
      pages: {
        lookup: {
          data: null,
          error: { code: '57014', message: 'canceling statement' },
        },
      },
    });

    const res = await h.svc.enrichSingle(TYPE_ID);

    expect(res.status).toBe('failed');
    expect(res.reasons).toEqual(['DB_ERROR']);
    expect(res.reason).toBe(
      'DB_ERROR: op=page_lookup code=57014 canceling statement',
    );
    expect(h.writeToTarget).not.toHaveBeenCalled();
    expect(h.writes).toEqual([]);
    expect(h.inserts.insertVersion).not.toHaveBeenCalled();
  });

  it('F. legacy upsert error → DB_ERROR (not CONTENT_BROKEN), error code logged', async () => {
    const h = makeHarness({
      writeGuardEnabled: false,
      pages: {
        upsert: {
          data: null,
          error: { code: '42703', message: 'column does not exist' },
        },
      },
    });

    const res = await h.svc.enrichSingle(TYPE_ID);

    expect(h.writes).toEqual([{ table: '__seo_r8_pages', op: 'upsert' }]);
    expect(res.status).toBe('failed');
    expect(res.reasons).toEqual(['DB_ERROR']);
    expect(res.reason).toBe(
      'DB_ERROR: op=upsert code=42703 column does not exist',
    );
    expect(h.inserts.insertVersion).not.toHaveBeenCalled();
    expect(
      messages(h.logger.error).some(
        (m) => m.includes('op=upsert') && m.includes('code=42703'),
      ),
    ).toBe(true);
  });
});

describe('R8VehicleEnricherService — fetchNeighbors', () => {
  it('D. DB error (42703) → explicit failure DB_ERROR, nothing composed nor written', async () => {
    const h = makeHarness({
      pages: {
        neighbors: {
          data: null,
          error: {
            code: '42703',
            message: 'column __seo_r8_pages.variant_signature does not exist',
          },
        },
      },
    });

    const res = await h.svc.enrichSingle(TYPE_ID);

    expect(res.status).toBe('failed');
    expect(res.reasons).toEqual(['DB_ERROR']);
    expect(res.reason).toMatch(/^DB_ERROR: /);
    expect(h.composeBlocks).not.toHaveBeenCalled();
    expect(h.writeToTarget).not.toHaveBeenCalled();
    expect(h.writes).toEqual([]);
    const err = messages(h.logger.error).find((m) =>
      m.includes('op=fetch_neighbors'),
    );
    expect(err).toBeDefined();
    expect(err).toContain('code=42703');
  });

  it('D2. DB error is thrown as a DatabaseException (not an empty neighbor list)', async () => {
    const h = makeHarness({
      pages: {
        neighbors: { data: null, error: { code: '42703', message: 'boom' } },
      },
    });
    const fetchNeighbors = (
      h.svc as unknown as {
        fetchNeighbors: (k: string, p: string) => Promise<unknown[]>;
      }
    ).fetchNeighbors.bind(h.svc);

    await expect(fetchNeighbors('k', 'r8_vehicle_1')).rejects.toBeInstanceOf(
      DatabaseException,
    );
  });

  it.each([
    ['empty list', []],
    ['null data', null],
  ])('E. no error and %s → []', async (_label, data) => {
    const h = makeHarness({ pages: { neighbors: { data, error: null } } });
    const fetchNeighbors = (
      h.svc as unknown as {
        fetchNeighbors: (k: string, p: string) => Promise<unknown[]>;
      }
    ).fetchNeighbors.bind(h.svc);

    await expect(fetchNeighbors('k', 'r8_vehicle_1')).resolves.toEqual([]);
    expect(h.logger.error).not.toHaveBeenCalled();
  });
});

describe('R8VehicleEnricherService — fetchVehicleData', () => {
  it('G. RPC DB failure (SupabaseRpcError) → DB_ERROR, not CONTENT_BROKEN', async () => {
    const h = makeHarness({
      rpc: {
        data: null,
        error: new SupabaseRpcError({
          code: '57014',
          message: 'canceling statement due to statement timeout',
        }),
      },
    });

    const res = await h.svc.enrichSingle(TYPE_ID);

    expect(res.status).toBe('failed');
    expect(res.reasons).toEqual(['DB_ERROR']);
    expect(res.reason).toMatch(/^DB_ERROR: /);
    expect(
      messages(h.logger.error).some(
        (m) => m.includes('op=fetch_vehicle_data') && m.includes('code=57014'),
      ),
    ).toBe(true);
  });

  it('G2. vehicle not found (no error) → CONTENT_BROKEN unchanged', async () => {
    const h = makeHarness({ rpc: { data: { vehicle: null }, error: null } });

    const res = await h.svc.enrichSingle(TYPE_ID);

    expect(res.status).toBe('failed');
    expect(res.reasons).toEqual(['CONTENT_BROKEN']);
    expect(res.warnings).toEqual(['vehicle not found']);
    expect(res.reason).toBe('CONTENT_BROKEN: vehicle not found');
  });
});

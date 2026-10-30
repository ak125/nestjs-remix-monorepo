/**
 * Tests — R8 vehicle enricher: balise anti-duplicate gate (ADR-095).
 *
 * The INDEX decision activates the served overlay title/description
 * (`getR8Content`). `SEO_CHAIN_DUPLICATE_GATE_MODE` governs the gate:
 *   - off (default)  → no sibling read, no event, write unchanged;
 *   - shadow         → verdict observed in `__seo_event_log`, write unchanged;
 *   - on             → exact title/H1 collision between indexable pages =
 *                      change refused, nothing written (previous version kept).
 * Out of scope (report-only): non-indexable sibling or candidate, TecDoc
 * release-gate range, description-only collision.
 *
 * Same Object.create harness as r8-vehicle-enricher.write-gate.test.ts, with a
 * client that routes each query by table and filters.
 */

import { R8VehicleEnricherService } from './r8-vehicle-enricher.service';

type DbError = { code?: string; message: string };
type DbResult = { data: unknown; error: DbError | null };
type Call = [string, unknown[]];

interface Query {
  table: string;
  calls: Call[];
}

interface Db {
  neighbors: DbResult;
  lookup: DbResult;
  /** Sibling query filtered on the candidate's exact meta_title. */
  byTitle: DbResult;
  /** Sibling query filtered on the candidate's brand/model. */
  byModel: DbResult;
  cache: DbResult;
  eventInsert: DbResult;
}

const PAGE_ID = '0b6f5d1e-0000-4000-8000-000000000001';
const TYPE_ID = 19053;
const SIBLING_ID = 11056;
const TECDOC_TYPE_ID = 83389;

const TITLE = 'Pièces RENAULT CLIO III 1.5 dCi 106 ch | AutoMecanik';
const DESCRIPTION = 'Pièces compatibles RENAULT CLIO III 1.5 dCi 106 ch.';

/** RPC vehicle: raw French keys (served H1) — normalized by fetchVehicleData. */
const VEHICLE = {
  marque_name: 'RENAULT',
  marque_alias: 'renault',
  modele_name: 'CLIO III',
  modele_alias: 'clio-iii',
  type_name: '1.5 dCi',
  type_fuel: 'Diesel',
  type_power_ps: '106',
  type_year_from: '2005',
  type_year_to: '2014',
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
  specificContentRatio: 0.8,
  boilerplateRatio: 0.2,
  diversityScore: 72,
  blockSpecificityScore: 80,
  semanticSimilarityScore: 75,
  categoryOrderDiversityScore: 70,
  faqReuseRiskScore: 0,
  catalogDeltaScore: 50,
  commercialIntentScore: 70,
};

/** Served overlay of a sibling motorisation (distinct title and H1 by default). */
const sibling = (typeId: number, over: Record<string, unknown> = {}) => ({
  type_id: String(typeId),
  brand: 'RENAULT',
  model: 'CLIO III',
  type_name: '1.5 dCi',
  power_ps: '86',
  year_from: '2005',
  year_to: '2014',
  meta_title: `Titre ${typeId}`,
  meta_description: `Description ${typeId}`,
  ...over,
});

const ok = (data: unknown): DbResult => ({ data, error: null });
const indexable = (...ids: number[]) =>
  ok(ids.map((type_id) => ({ type_id, is_indexable: true })));

const has = (q: Query, method: string, ...args: unknown[]) =>
  q.calls.some(([m, a]) => m === method && args.every((x, i) => a[i] === x));

function route(db: Db, q: Query, terminal: string): DbResult {
  if (q.table === '__vehicle_page_cache') return db.cache;
  if (q.table === '__seo_event_log') return db.eventInsert;
  if (terminal === 'maybeSingle') return db.lookup;
  if (has(q, 'filter', 'rendered_json->blocks')) {
    return has(q, 'eq', 'meta_title') ? db.byTitle : db.byModel;
  }
  return db.neighbors;
}

function makeClient(db: Db) {
  const reads: Query[] = [];
  const writes: Array<{ table: string; op: string; row: unknown }> = [];
  const from = jest.fn((table: string) => {
    const q: Query = { table, calls: [] };
    reads.push(q);
    const builder: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'neq', 'order', 'limit', 'filter', 'in']) {
      builder[m] = jest.fn((...args: unknown[]) => {
        q.calls.push([m, args]);
        return builder;
      });
    }
    for (const m of ['upsert', 'insert', 'update']) {
      builder[m] = jest.fn((row: unknown) => {
        writes.push({ table, op: m, row });
        return builder;
      });
    }
    builder.maybeSingle = jest.fn(() =>
      Promise.resolve(route(db, q, 'maybeSingle')),
    );
    builder.single = jest.fn(() => Promise.resolve(route(db, q, 'single')));
    builder.then = (
      resolve: (v: DbResult) => unknown,
      reject: (e: unknown) => unknown,
    ) => Promise.resolve(route(db, q, 'then')).then(resolve, reject);
    return builder;
  });
  return { client: { from }, reads, writes };
}

interface Harness {
  svc: R8VehicleEnricherService;
  logger: { log: jest.Mock; warn: jest.Mock; error: jest.Mock };
  writeToTarget: jest.Mock;
  reads: Query[];
  writes: Array<{ table: string; op: string; row: unknown }>;
  inserts: Record<string, jest.Mock>;
}

function makeHarness(
  opts: {
    mode?: 'off' | 'shadow' | 'on';
    db?: Partial<Db>;
    candidateIndexable?: boolean;
    decision?: 'INDEX' | 'REVIEW_REQUIRED';
  } = {},
): Harness {
  const db: Db = {
    neighbors: ok([]),
    lookup: ok({ id: PAGE_ID }),
    byTitle: ok([]),
    byModel: ok([]),
    cache: ok([]),
    eventInsert: ok(null),
    ...opts.db,
  };
  const { client, reads, writes } = makeClient(db);
  const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const writeToTarget = jest.fn().mockResolvedValue({
    written: true,
    fieldsWritten: ['content_main'],
    fieldsSkipped: [],
    fieldsStripped: [],
    mergeDetails: [],
  });
  const inserts = {
    insertVersion: jest.fn().mockResolvedValue(undefined),
    insertFingerprints: jest.fn().mockResolvedValue(undefined),
    insertSimilarityScores: jest.fn().mockResolvedValue(undefined),
    insertRegenerationQueue: jest.fn().mockResolvedValue(undefined),
    insertQaReview: jest.fn().mockResolvedValue(undefined),
  };

  const svc = Object.create(
    R8VehicleEnricherService.prototype,
  ) as R8VehicleEnricherService;
  Object.assign(svc as unknown as Record<string, unknown>, {
    logger,
    supabase: client,
    RAG_GAMMES_DIR: '/nonexistent/r8-balise-gate-test/gammes',
    callRpc: jest.fn().mockResolvedValue(
      ok({
        vehicle: { ...VEHICLE },
        seo_validation: { is_indexable: opts.candidateIndexable ?? true },
      }),
    ),
    seoRoleTemplate: {
      pick: jest.fn(({ slot }: { slot: 'meta_title' | 'meta_description' }) =>
        Promise.resolve({
          id: `tpl-${slot}`,
          rendered: slot === 'meta_title' ? TITLE : DESCRIPTION,
        }),
      ),
    },
    featureFlags: { writeGuardEnabled: true, r8OwnedEditorialEnabled: false },
    seoFlags: opts.mode ? { mode: jest.fn(() => opts.mode) } : undefined,
    writeGate: { writeToTarget },
    loadGammeRag: jest.fn().mockReturnValue({ faq: [], symptoms: [] }),
    composeBlocks: jest.fn().mockReturnValue(BLOCKS),
    computeMetrics: jest.fn().mockReturnValue({ ...METRICS }),
    computeFingerprints: jest.fn().mockReturnValue({
      contentFingerprint: 'cf',
      normalizedTextFingerprint: 'nf',
      faqSignature: 'fs',
      categorySignature: 'cs',
    }),
    applyMetaCollisionPenalty: jest.fn().mockReturnValue([]),
    gate: jest.fn().mockReturnValue({
      decision: opts.decision ?? 'INDEX',
      reasons: [],
      warnings: [],
    }),
    ...inserts,
  });
  return { svc, logger, writeToTarget, reads, writes, inserts };
}

const messages = (m: jest.Mock): string[] =>
  m.mock.calls.map((c) => String(c[0]));
const siblingReads = (h: Harness) =>
  h.reads.filter(
    (q) =>
      q.table === '__vehicle_page_cache' ||
      has(q, 'filter', 'rendered_json->blocks'),
  );
const events = (h: Harness) =>
  h.writes.filter((w) => w.table === '__seo_event_log');
const contentWrites = (h: Harness) =>
  h.writes.filter((w) => w.table !== '__seo_event_log');
const eventRow = (h: Harness, i = 0) =>
  events(h)[i].row as { severity: string; payload: Record<string, unknown> };

function expectNothingWritten(h: Harness): void {
  expect(h.writeToTarget).not.toHaveBeenCalled();
  expect(contentWrites(h)).toEqual([]);
  for (const insert of Object.values(h.inserts)) {
    expect(insert).not.toHaveBeenCalled();
  }
}

const TITLE_COLLISION: Partial<Db> = {
  byTitle: ok([sibling(SIBLING_ID, { meta_title: TITLE })]),
  cache: indexable(SIBLING_ID),
};

describe('R8VehicleEnricherService — balise gate modes', () => {
  it.each([
    ['flag registry absent', undefined],
    ['mode off', 'off' as const],
  ])('A. %s → no sibling read, no event, write unchanged', async (_l, mode) => {
    const h = makeHarness({ mode, db: TITLE_COLLISION });

    const res = await h.svc.enrichSingle(TYPE_ID);

    expect(res.status).toBe('draft');
    expect(res.seoDecision).toBe('INDEX');
    expect(siblingReads(h)).toEqual([]);
    expect(events(h)).toEqual([]);
    expect(h.writeToTarget).toHaveBeenCalledTimes(1);
    expect(h.inserts.insertVersion).toHaveBeenCalledTimes(1);
  });

  it('B. shadow + exact title collision → observed, write unchanged', async () => {
    const h = makeHarness({ mode: 'shadow', db: TITLE_COLLISION });

    const res = await h.svc.enrichSingle(TYPE_ID);

    expect(res.status).toBe('draft');
    expect(res.reason).toBeUndefined();
    expect(h.writeToTarget).toHaveBeenCalledTimes(1);
    expect(h.inserts.insertVersion).toHaveBeenCalledTimes(1);
    expect(events(h)).toHaveLength(1);
    const ev = eventRow(h);
    expect(ev.severity).toBe('medium');
    expect(ev.payload).toMatchObject({
      observation_kind: 'BALISE',
      surface: 'R8',
      entity_id: `r8_vehicle_${TYPE_ID}`,
      mode: 'shadow',
      decision: 'COLLISION_EXACTE',
      blocking: true,
      applied: 'observed',
      reason_code: 'BALISE_EXACT_TITLE_COLLISION',
      field: 'title',
      colliding_entity_key: `r8_vehicle_${SIBLING_ID}`,
      siblings_evaluated: 1,
    });
    expect(
      messages(h.logger.warn).some(
        (m) =>
          m.includes('[R8_BALISE_GATE] mode=shadow') &&
          m.includes('applied=observed'),
      ),
    ).toBe(true);
  });

  it('C. on + exact title collision → refused, nothing written (previous version kept)', async () => {
    const h = makeHarness({ mode: 'on', db: TITLE_COLLISION });

    const res = await h.svc.enrichSingle(TYPE_ID);

    expect(res.status).toBe('write_gate_blocked');
    expect(res.seoDecision).toBe('INDEX');
    expect(res.reason).toBe(
      `BALISE_GATE_BLOCKED: BALISE_EXACT_TITLE_COLLISION vs r8_vehicle_${SIBLING_ID}`,
    );
    expect(res.warnings).toContain(res.reason);
    expect(res.writeGate).toBeUndefined();
    expectNothingWritten(h);
    expect(events(h)).toHaveLength(1);
    expect(eventRow(h).severity).toBe('high');
    expect(eventRow(h).payload).toMatchObject({
      mode: 'on',
      blocking: true,
      applied: 'refused',
    });
    // The gate never mutates URL / canonical / robots: no page row touched.
    expect(h.writes.some((w) => w.table === '__seo_r8_pages')).toBe(false);
  });

  it('D. on + exact H1 collision (served H1 builder) → refused', async () => {
    const h = makeHarness({
      mode: 'on',
      db: {
        byModel: ok([sibling(SIBLING_ID, { power_ps: '106' })]),
        cache: indexable(SIBLING_ID),
      },
    });

    const res = await h.svc.enrichSingle(TYPE_ID);

    expect(res.status).toBe('write_gate_blocked');
    expect(res.reason).toBe(
      `BALISE_GATE_BLOCKED: BALISE_EXACT_H1_COLLISION vs r8_vehicle_${SIBLING_ID}`,
    );
    expectNothingWritten(h);
    // Sibling queries are bounded and restricted to served overlays.
    const pageQueries = siblingReads(h).filter(
      (q) => q.table === '__seo_r8_pages',
    );
    expect(pageQueries).toHaveLength(2);
    for (const q of pageQueries) {
      expect(has(q, 'eq', 'seo_decision', 'INDEX')).toBe(true);
      expect(has(q, 'neq', 'type_id', String(TYPE_ID))).toBe(true);
      expect(has(q, 'limit', 200)).toBe(true);
    }
    const cacheQuery = siblingReads(h).find(
      (q) => q.table === '__vehicle_page_cache',
    );
    expect(cacheQuery?.calls).toContainEqual(['in', ['type_id', [SIBLING_ID]]]);
  });

  it('E. non-INDEX decision → gate not evaluated even in on mode', async () => {
    const h = makeHarness({
      mode: 'on',
      decision: 'REVIEW_REQUIRED',
      db: TITLE_COLLISION,
    });

    const res = await h.svc.enrichSingle(TYPE_ID);

    expect(res.status).toBe('draft');
    expect(res.seoDecision).toBe('REVIEW_REQUIRED');
    expect(siblingReads(h)).toEqual([]);
    expect(events(h)).toEqual([]);
    expect(h.writeToTarget).toHaveBeenCalledTimes(1);
  });
});

describe('R8VehicleEnricherService — balise gate scope (report-only)', () => {
  it.each([
    [
      'sibling not indexable',
      TYPE_ID,
      true,
      {
        byTitle: ok([sibling(SIBLING_ID, { meta_title: TITLE })]),
        cache: ok([{ type_id: SIBLING_ID, is_indexable: false }]),
      },
    ],
    [
      'sibling absent from the vehicle page cache',
      TYPE_ID,
      true,
      {
        byTitle: ok([sibling(SIBLING_ID, { meta_title: TITLE })]),
        cache: ok([]),
      },
    ],
    [
      'sibling in the TecDoc release-gate range',
      TYPE_ID,
      true,
      {
        byTitle: ok([sibling(TECDOC_TYPE_ID, { meta_title: TITLE })]),
        cache: indexable(TECDOC_TYPE_ID),
      },
    ],
    ['candidate not indexable', TYPE_ID, false, TITLE_COLLISION],
    [
      'candidate in the TecDoc release-gate range',
      TECDOC_TYPE_ID,
      true,
      TITLE_COLLISION,
    ],
    [
      'description-only exact collision',
      TYPE_ID,
      true,
      {
        byModel: ok([sibling(SIBLING_ID, { meta_description: DESCRIPTION })]),
        cache: indexable(SIBLING_ID),
      },
    ],
  ])(
    'F. on + %s → not refused, collision reported (non-blocking)',
    async (_l, typeId, candidateIndexable, db) => {
      const h = makeHarness({ mode: 'on', candidateIndexable, db });

      const res = await h.svc.enrichSingle(typeId);

      expect(res.status).toBe('draft');
      expect(res.reason).toBeUndefined();
      expect(h.writeToTarget).toHaveBeenCalledTimes(1);
      expect(events(h)).toHaveLength(1);
      expect(eventRow(h).severity).toBe('info');
      expect(eventRow(h).payload).toMatchObject({
        mode: 'on',
        blocking: false,
        applied: 'observed',
        decision: 'COLLISION_PROCHE',
      });
    },
  );
});

describe('R8VehicleEnricherService — balise gate failures', () => {
  const SIBLING_ERROR = {
    byTitle: {
      data: null,
      error: { code: '57014', message: 'canceling statement' },
    },
  };

  it('G. shadow + sibling read error → logged, write unchanged, no event', async () => {
    const h = makeHarness({ mode: 'shadow', db: SIBLING_ERROR });

    const res = await h.svc.enrichSingle(TYPE_ID);

    expect(res.status).toBe('draft');
    expect(h.writeToTarget).toHaveBeenCalledTimes(1);
    expect(events(h)).toEqual([]);
    expect(
      messages(h.logger.error).some(
        (m) =>
          m.includes('[R8_BALISE_GATE] mode=shadow') &&
          m.includes('siblings_unavailable'),
      ),
    ).toBe(true);
  });

  it.each([
    ['sibling read', SIBLING_ERROR, 'op=fetch_balise_siblings'],
    [
      'indexability read',
      {
        byTitle: ok([sibling(SIBLING_ID, { meta_title: TITLE })]),
        cache: { data: null, error: { code: '57014', message: 'timeout' } },
      },
      'op=fetch_balise_indexability',
    ],
  ])(
    'H. on + %s error → failed / DB_ERROR, nothing written (never "no sibling")',
    async (_l, db, op) => {
      const h = makeHarness({ mode: 'on', db });

      const res = await h.svc.enrichSingle(TYPE_ID);

      expect(res.status).toBe('failed');
      expect(res.reasons).toEqual(['DB_ERROR']);
      expect(res.reason).toMatch(/^DB_ERROR: /);
      expectNothingWritten(h);
      expect(events(h)).toEqual([]);
      expect(
        messages(h.logger.error).some(
          (m) =>
            m.includes('[R8_DB_ERROR]') &&
            m.includes(op) &&
            m.includes('code=57014'),
        ),
      ).toBe(true);
    },
  );

  it('I. event log insert error → logged, refusal unchanged', async () => {
    const h = makeHarness({
      mode: 'on',
      db: {
        ...TITLE_COLLISION,
        eventInsert: {
          data: null,
          error: { code: '42501', message: 'denied' },
        },
      },
    });

    const res = await h.svc.enrichSingle(TYPE_ID);

    expect(res.status).toBe('write_gate_blocked');
    expectNothingWritten(h);
    expect(
      messages(h.logger.error).some((m) =>
        m.includes('event_log_insert_failed'),
      ),
    ).toBe(true);
  });

  it('J. truncated sibling read is reported (partial coverage)', async () => {
    const h = makeHarness({
      mode: 'shadow',
      db: {
        byModel: ok(Array.from({ length: 200 }, (_, i) => sibling(20000 + i))),
      },
    });

    await h.svc.enrichSingle(TYPE_ID);

    expect(
      messages(h.logger.warn).some(
        (m) => m.includes('siblings_truncated') && m.includes('query=model'),
      ),
    ).toBe(true);
  });
});

describe('R8VehicleEnricherService — balise gate replay', () => {
  it('K. on: replaying the refused change gives the same verdict and still writes nothing', async () => {
    const h = makeHarness({ mode: 'on', db: TITLE_COLLISION });

    const first = await h.svc.enrichSingle(TYPE_ID);
    const second = await h.svc.enrichSingle(TYPE_ID);

    expect(second).toEqual(first);
    expect(first.status).toBe('write_gate_blocked');
    expectNothingWritten(h);
    expect(events(h)).toHaveLength(2);
    const { observed_at: _a, ...p1 } = eventRow(h, 0).payload;
    const { observed_at: _b, ...p2 } = eventRow(h, 1).payload;
    expect(p2).toEqual(p1);
  });
});

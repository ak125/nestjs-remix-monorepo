// backend/src/modules/admin/services/r1-keyword-plan-batch.service.test.ts

// SupabaseBaseService vérifie les env vars dans son constructor — stub minimal
// (canon, cf. rm-alternatives.service.test.ts).
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY || 'test-service-key';
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

import { R1KeywordPlanBatchService } from './r1-keyword-plan-batch.service';
import { R1KeywordPlanGatesService } from './r1-keyword-plan-gates.service';
import { CACHE_STRATEGIES } from '../../../config/cache-ttl.config';

/**
 * Contrat de `getTopVehicles(pgId)` (A4, plan massdoc 2026-09-02).
 *
 * Avant : `this.client.rpc('get_alternative_vehicles_for_gamme' as never,
 * {...} as never)` — le double cast défait le typage ET le parseur d'allowlist
 * (`scripts/ci/check-rpc-allowlist-coverage.sh` ne voit que `callRpc(...)`),
 * et le fichier est dans la liste de contournement du RPC-gate (ci.yml), d'où
 * l'invisibilité. Un appel séquentiel par gamme, jusqu'à 200 par requête
 * `POST /api/admin/keyword-planner/batch-r1`, sans aucun cache — alors que le
 * résultat ne dépend que de `pgId` (compatibilité TecDoc, stable entre imports).
 *
 * Après : `callRpc()` gouverné (nom littéral, `source: 'admin'`), résultat mis
 * en cache sous `CACHE_STRATEGIES.KEYWORD_PLAN.R1_TOP_VEHICLES` (clé = pgId
 * seul), erreur RPC observable (warn) et JAMAIS mise en cache.
 */

type TopVehicle = { marque_name: string; modele_name: string; cnt: number };

const STRATEGY = CACHE_STRATEGIES.KEYWORD_PLAN.R1_TOP_VEHICLES;

// Constructeur typé lâchement : le test décrit le contrat cible (4e dépendance
// CacheService) sans dépendre de la signature courante.
const ServiceCtor = R1KeywordPlanBatchService as unknown as new (
  ...args: unknown[]
) => R1KeywordPlanBatchService;

function buildService() {
  const configService = { get: (k: string) => process.env[k] };
  const yamlParser = {};
  const gatesService = {};
  const cache = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  };
  const service = new ServiceCtor(
    configService,
    yamlParser,
    gatesService,
    cache,
  );
  const callRpc = jest.fn();
  (service as unknown as { callRpc: jest.Mock }).callRpc = callRpc;
  const getTopVehicles = (pgId: number): Promise<TopVehicle[]> =>
    (
      service as unknown as {
        getTopVehicles: (id: number) => Promise<TopVehicle[]>;
      }
    ).getTopVehicles(pgId);
  return { service, cache, callRpc, getTopVehicles };
}

const rpcRows = [
  {
    type_id: '11836',
    type_name: '530 d',
    type_alias: '530-d',
    modele_name: 'Série 5 (E60)',
    modele_alias: 'serie-5-e60',
    modele_id: 33053,
    marque_name: 'BMW',
    marque_alias: 'bmw',
    marque_id: 33,
  },
  {
    type_id: '57414',
    type_name: '1.9 TDI',
    type_alias: '1-9-tdi',
    modele_name: 'Golf V',
    modele_alias: 'golf-v',
    modele_id: 1201,
    marque_name: 'Volkswagen',
    marque_alias: 'volkswagen',
    marque_id: 120,
  },
];

describe('R1KeywordPlanBatchService.getTopVehicles — RPC gouvernée + cache (A4)', () => {
  it('cache miss → un seul callRpc gouverné (nom littéral, params nommés, source admin), mappé en TopVehicle', async () => {
    const { callRpc, getTopVehicles } = buildService();
    callRpc.mockResolvedValue({ data: rpcRows, error: null });

    const result = await getTopVehicles(402);

    expect(callRpc).toHaveBeenCalledTimes(1);
    expect(callRpc).toHaveBeenCalledWith(
      'get_alternative_vehicles_for_gamme',
      { p_gamme_id: 402, p_exclude_type_id: 0, p_limit: 6 },
      { source: 'admin' },
    );
    expect(result).toEqual([
      { marque_name: 'BMW', modele_name: 'Série 5 (E60)', cnt: 1 },
      { marque_name: 'Volkswagen', modele_name: 'Golf V', cnt: 1 },
    ]);
  });

  it('cache miss → écrit le résultat mappé sous la clé pgId seul, avec le TTL déclaré dans CACHE_STRATEGIES', async () => {
    const { cache, callRpc, getTopVehicles } = buildService();
    callRpc.mockResolvedValue({ data: rpcRows, error: null });

    const result = await getTopVehicles(402);

    expect(cache.get).toHaveBeenCalledWith('r1kp:top-vehicles:402');
    expect(cache.set).toHaveBeenCalledTimes(1);
    expect(cache.set).toHaveBeenCalledWith(
      'r1kp:top-vehicles:402',
      result,
      STRATEGY.ttl,
    );
    // La donnée dérive de la compatibilité TecDoc : stable entre imports.
    expect(STRATEGY.ttl).toBe(86400);
  });

  it('cache hit → aucun appel RPC, résultat rejoué depuis le cache', async () => {
    const { cache, callRpc, getTopVehicles } = buildService();
    const cached: TopVehicle[] = [
      { marque_name: 'Peugeot', modele_name: '308', cnt: 1 },
    ];
    cache.get.mockResolvedValue(cached);

    const result = await getTopVehicles(7);

    expect(callRpc).not.toHaveBeenCalled();
    expect(cache.set).not.toHaveBeenCalled();
    expect(result).toEqual(cached);
  });

  it('erreur RPC → [] observable (warn), et RIEN n’est mis en cache (anti-poisoning)', async () => {
    const { service, cache, callRpc, getTopVehicles } = buildService();
    callRpc.mockResolvedValue({
      data: null,
      error: { message: 'permission denied', name: 'SupabaseRpcError' },
    });
    const warnSpy = jest
      .spyOn(
        (service as unknown as { logger: { warn: (m: string) => void } })
          .logger,
        'warn',
      )
      .mockImplementation(() => {});

    const result = await getTopVehicles(402);

    expect(result).toEqual([]);
    expect(cache.set).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/permission denied/);
  });

  it('résultat vide (RPC ok, 0 ligne) → [] mis en cache : c’est un état réel, pas une erreur', async () => {
    const { cache, callRpc, getTopVehicles } = buildService();
    callRpc.mockResolvedValue({ data: [], error: null });

    const result = await getTopVehicles(9999);

    expect(result).toEqual([]);
    expect(cache.set).toHaveBeenCalledWith(
      'r1kp:top-vehicles:9999',
      [],
      STRATEGY.ttl,
    );
  });
});

/**
 * Contrat « une panne n'est jamais un résultat » du batch R1.
 *
 * Avant : `gamme_aggregates` était lue sur une colonne inexistante (`sgc_id`) et
 * `top_brands` comme un dictionnaire alors que la colonne contient un tableau ;
 * les erreurs de lecture étaient ignorées, si bien qu'une panne passait pour
 * « 0 gamme éligible », pour « aucun plan R1 existant » (régénération) ou pour
 * « version 1 » (écrasement).
 */
type DbResult = { data: unknown; error: { message: string } | null };

function chain(result: DbResult) {
  const builder: Record<string, unknown> = {};
  const self = () => builder;
  for (const method of ['select', 'eq', 'gte', 'order', 'limit', 'in']) {
    builder[method] = jest.fn(self);
  }
  builder.upsert = jest.fn(self);
  builder.single = jest.fn(() => Promise.resolve(result));
  builder.maybeSingle = jest.fn(() => Promise.resolve(result));
  builder.then = (
    onFulfilled: (value: DbResult) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(onFulfilled, onRejected);
  return builder as Record<string, jest.Mock> & { then: unknown };
}

const R3_ROW = {
  skp_pg_id: 7,
  skp_pg_alias: 'gamme-sans-fichier-rag-test',
  skp_quality_score: 90,
  skp_section_terms: null,
};

const DB_OK: Record<string, DbResult> = {
  __seo_r3_keyword_plan: { data: [R3_ROW], error: null },
  __seo_r1_keyword_plan: { data: [], error: null },
  pieces_gamme: { data: { pg_name: 'Filtre à huile' }, error: null },
  gamme_aggregates: {
    data: {
      top_brands: [
        { top: '1', name: 'BOSCH', count: 1237, stars: '6' },
        { top: '1', name: 'DENSO', count: 12, stars: '6' },
      ],
    },
    error: null,
  },
};

const R1_VERIFY: DbResult = { data: { rkp_id: 501 }, error: null };

function buildBatch(overrides: Partial<Record<string, DbResult>> = {}) {
  const tables = { ...DB_OK, ...overrides };
  const builders: Record<string, ReturnType<typeof chain>> = {};
  let r1Reads = 0;
  const from = jest.fn((table: string) => {
    const isVersionRead =
      table === '__seo_r1_keyword_plan' &&
      ++r1Reads === 2 &&
      tables.versionRead;
    const builder = chain(
      (isVersionRead ? tables.versionRead : tables[table]) as DbResult,
    );
    if (table === '__seo_r1_keyword_plan') {
      builder.single = jest.fn(() =>
        Promise.resolve(tables.verify ?? R1_VERIFY),
      );
    }
    builders[table] = builder;
    return builder;
  });
  const gatesService = {
    runR1Gates: jest.fn().mockResolvedValue({
      gateReport: {},
      qualityScore: 80,
      r3RiskScore: 0,
      duplicationScore: 0,
      coverageScore: 80,
    }),
    upsertR1KeywordPlan: jest.fn().mockResolvedValue(undefined),
  };
  const yamlParser = {};
  const cache = {
    get: jest.fn().mockResolvedValue([]),
    set: jest.fn().mockResolvedValue(undefined),
  };
  const service = new ServiceCtor(
    { get: (k: string) => process.env[k] },
    yamlParser,
    gatesService,
    cache,
  );
  Object.defineProperty(service, 'client', { value: { from } });
  const logger = (service as unknown as { logger: Record<string, jest.Mock> })
    .logger;
  const warn = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
  jest.spyOn(logger, 'log').mockImplementation(() => undefined);
  jest.spyOn(logger, 'error').mockImplementation(() => undefined);
  return { service, gatesService, builders, warn };
}

const FAILURE = { data: null, error: { message: 'upstream unavailable' } };

describe('R1KeywordPlanBatchService.batchGenerate — une panne reste une panne', () => {
  it('lit gamme_aggregates sur ga_pg_id et prend les noms du tableau top_brands', async () => {
    const { service, gatesService, builders } = buildBatch();

    const { summary } = await service.batchGenerate({});

    expect(builders.gamme_aggregates.eq).toHaveBeenCalledWith('ga_pg_id', 7);
    expect(summary).toEqual({ total: 1, created: 1, skipped: 0, failed: 0 });
    const written = gatesService.upsertR1KeywordPlan.mock.calls[0][1] as {
      rkp_query_clusters: { equipementiers: string[] };
    };
    expect(written.rkp_query_clusters.equipementiers).toEqual([
      'gamme sans fichier rag test BOSCH',
      'gamme sans fichier rag test DENSO',
    ]);
  });

  it('aucune ligne d’agrégat → état réel, le plan est créé sans marque', async () => {
    const { service, gatesService } = buildBatch({
      gamme_aggregates: { data: null, error: null },
    });

    const { summary } = await service.batchGenerate({});

    expect(summary.created).toBe(1);
    const written = gatesService.upsertR1KeywordPlan.mock.calls[0][1] as {
      rkp_query_clusters: { equipementiers: string[] };
    };
    expect(written.rkp_query_clusters.equipementiers).toEqual([]);
  });

  it('plans R3 illisibles → erreur, jamais { total: 0 }', async () => {
    const { service } = buildBatch({ __seo_r3_keyword_plan: FAILURE });

    await expect(service.batchGenerate({})).rejects.toThrow(/plans R3/);
  });

  it('plans R1 illisibles → erreur, aucune gamme régénérée', async () => {
    const { service, gatesService } = buildBatch({
      __seo_r1_keyword_plan: FAILURE,
    });

    await expect(service.batchGenerate({})).rejects.toThrow(/plans R1/);
    expect(gatesService.upsertR1KeywordPlan).not.toHaveBeenCalled();
  });

  it.each([
    ['pieces_gamme', /pieces_gamme/],
    ['gamme_aggregates', /gamme_aggregates/],
  ])(
    '%s illisible → gamme en échec, rien n’est écrit',
    async (table, reason) => {
      const { service, gatesService } = buildBatch({ [table]: FAILURE });

      const { results, summary } = await service.batchGenerate({});

      expect(summary.failed).toBe(1);
      expect(results[0].reason).toMatch(reason);
      expect(gatesService.upsertR1KeywordPlan).not.toHaveBeenCalled();
    },
  );

  it('version illisible → gamme en échec, la version 1 n’est pas écrasée', async () => {
    const { service, gatesService } = buildBatch({ versionRead: FAILURE });

    const { results, summary } = await service.batchGenerate({});

    expect(summary.failed).toBe(1);
    expect(results[0].reason).toMatch(/version/);
    expect(gatesService.upsertR1KeywordPlan).not.toHaveBeenCalled();
  });

  it('écriture refusée → gamme comptée en échec', async () => {
    const { service, gatesService } = buildBatch();
    gatesService.upsertR1KeywordPlan.mockRejectedValue(new Error('rejected'));

    const { summary } = await service.batchGenerate({});

    expect(summary).toEqual({ total: 1, created: 0, skipped: 0, failed: 1 });
  });

  it('relecture impossible après écriture → pas de « created »', async () => {
    const { service } = buildBatch({ verify: FAILURE });

    const { results, summary } = await service.batchGenerate({});

    expect(summary.failed).toBe(1);
    expect(results[0].reason).toMatch(/relecture/);
  });

  it('fichier RAG absent → signalé par un warn', async () => {
    const { service, warn } = buildBatch();

    await service.batchGenerate({ dryRun: true });

    expect(warn.mock.calls.flat().join(' ')).toMatch(/RAG/);
  });
});

describe('R1KeywordPlanGatesService.upsertR1KeywordPlan', () => {
  it('propage l’échec d’écriture au lieu de le journaliser seulement', async () => {
    const GatesCtor = R1KeywordPlanGatesService as unknown as new (
      ...args: unknown[]
    ) => R1KeywordPlanGatesService;
    const gates = new GatesCtor({ get: (k: string) => process.env[k] });
    Object.defineProperty(gates, 'client', {
      value: { from: () => ({ upsert: () => Promise.resolve(FAILURE) }) },
    });
    jest
      .spyOn(
        (gates as unknown as { logger: { error: () => void } }).logger,
        'error',
      )
      .mockImplementation(() => undefined);

    await expect(gates.upsertR1KeywordPlan('7', {})).rejects.toThrow(/plan R1/);
  });
});

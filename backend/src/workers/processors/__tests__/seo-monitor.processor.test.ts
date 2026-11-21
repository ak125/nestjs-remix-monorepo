// backend/src/workers/processors/__tests__/seo-monitor.processor.test.ts

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY || 'test-service-key';
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

import { SeoMonitorProcessor } from '../seo-monitor.processor';
import { getTypeModelIndex } from '../../../modules/seo/helpers/auto-type-valid-ids.helper';

jest.mock('../../../modules/seo/helpers/auto-type-valid-ids.helper', () => ({
  ...jest.requireActual(
    '../../../modules/seo/helpers/auto-type-valid-ids.helper',
  ),
  getTypeModelIndex: jest.fn(),
}));

/**
 * Contrat de la sonde `checkUrl` (A1, plan massdoc 2026-09-02).
 *
 * Avant : `.select('rtp_piece_id', { count: 'exact', head: true })` filtré sur
 * `rtp_type_id` + `rtp_ga_id`. Mesuré en PROD (pg_stat_statements) : 110 663
 * appels, 1 167 ms de moyenne, 2 705 blocs lus par appel ≈ 2,3 To de churn du
 * buffer pool — comptage complet sur 368 M lignes, et `rtp_ga_id` n'est pas
 * indexé.
 *
 * Et la colonne était la mauvaise : `rtp_ga_id` est la gamme ARTICLE (sous-
 * gamme TecDoc : « Accessoires de plaquette », « Tête de cardan »…), pas la
 * gamme de la page. Toutes les RPC de la page R2 filtrent `rtp_pg_id`, et sur
 * les 8 couples critiques le comptage via `rtp_ga_id` sous-compte de 1 à 12 %
 * (ex. 893 contre 1 010 pour disques 82 × 29991) — preuve SQL dans la PR.
 *
 * Après : sonde BORNÉE — au plus `WARNING_THRESHOLD` (5) lignes lues via
 * l'index composite `(rtp_type_id, rtp_pg_id)`, sans comptage. La frontière
 * de décision est intacte : 0 → error, 1..4 → warning avec le compte exact,
 * ≥ 5 → ok (piecesCount rapporté = 5, borne de la sonde).
 */

type QueryResult = {
  data?: unknown[] | null;
  error?: { message: string } | null;
  count?: number | null;
};

function supabaseMock(result: QueryResult) {
  const builder: Record<string, jest.Mock> & { then?: unknown } = {};
  for (const m of ['select', 'eq', 'limit']) {
    builder[m] = jest.fn(() => builder);
  }
  // Les query builders Supabase sont des thenables : `await builder` résout.
  builder.then = (
    resolve: (v: QueryResult) => unknown,
    reject: (e: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject);
  const from = jest.fn(() => builder);
  return { client: { from }, from, builder };
}

function buildProcessor(result: QueryResult) {
  const configService = { get: (k: string) => process.env[k] } as never;
  const rpcGate = {} as never;
  const jobHealth = { recordSuccess: jest.fn().mockResolvedValue(undefined) };
  const processor = new SeoMonitorProcessor(
    configService,
    rpcGate,
    jobHealth as never,
  );
  const mock = supabaseMock(result);
  (processor as unknown as { supabase: unknown }).supabase = mock.client;
  type CheckResult = {
    status: 'ok' | 'warning' | 'error';
    piecesCount: number;
    message?: string;
  };
  const checkUrl = (url: string, typeId: number, gammeId: number) =>
    (
      processor as unknown as {
        checkUrl: (u: string, t: number, g: number) => Promise<CheckResult>;
      }
    ).checkUrl(url, typeId, gammeId);
  return { processor, mock, checkUrl };
}

const rows = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ rtp_piece_id: i + 1 }));

describe('SeoMonitorProcessor.checkUrl — sonde de présence bornée (A1)', () => {
  it('filtre rtp_type_id + rtp_pg_id (jamais rtp_ga_id), sans count exact, borné à 5 lignes', async () => {
    const { mock, checkUrl } = buildProcessor({ data: rows(5), error: null });

    await checkUrl('/pieces/filtre-a-huile-7/x/y/z-8217.html', 8217, 7);

    expect(mock.from).toHaveBeenCalledWith('pieces_relation_type');
    // Sélection plate : ni `{ count: 'exact' }` ni `head: true`.
    expect(mock.builder.select).toHaveBeenCalledWith('rtp_piece_id');
    expect(mock.builder.eq).toHaveBeenCalledWith('rtp_type_id', 8217);
    expect(mock.builder.eq).toHaveBeenCalledWith('rtp_pg_id', 7);
    expect(mock.builder.eq).not.toHaveBeenCalledWith(
      'rtp_ga_id',
      expect.anything(),
    );
    expect(mock.builder.limit).toHaveBeenCalledWith(5);
  });

  it('0 ligne → status error (risque désindexation), piecesCount 0', async () => {
    const { checkUrl } = buildProcessor({ data: [], error: null });

    const result = await checkUrl('/pieces/x', 8217, 7);

    expect(result.status).toBe('error');
    expect(result.piecesCount).toBe(0);
    expect(result.message).toMatch(/0 pièce/);
  });

  it('1..4 lignes → status warning avec le compte exact', async () => {
    const { checkUrl } = buildProcessor({ data: rows(3), error: null });

    const result = await checkUrl('/pieces/x', 8217, 7);

    expect(result.status).toBe('warning');
    expect(result.piecesCount).toBe(3);
  });

  it('5 lignes (borne de la sonde) → status ok, piecesCount = 5 (≥ 5)', async () => {
    const { checkUrl } = buildProcessor({ data: rows(5), error: null });

    const result = await checkUrl('/pieces/x', 8217, 7);

    expect(result.status).toBe('ok');
    expect(result.piecesCount).toBe(5);
  });

  it('erreur DB → status error, piecesCount -1, message explicite', async () => {
    const { checkUrl } = buildProcessor({
      data: null,
      error: { message: 'connection reset' },
    });

    const result = await checkUrl('/pieces/x', 8217, 7);

    expect(result.status).toBe('error');
    expect(result.piecesCount).toBe(-1);
    expect(result.message).toMatch(/Erreur DB: connection reset/);
  });
});

/**
 * Échantillon aléatoire (incident #2144). Avant : appel à la RPC
 * `get_random_vehicle_gamme_combinations`, absente de la base ; l'erreur était
 * convertie en liste vide et le job se terminait en succès sans tester une
 * seule page. Après : tirage dans `__sitemap_p_link` (table du sitemap pièces),
 * filtrage des types périmés, et échec du job si l'échantillon est vide ou
 * illisible.
 */
type TableResult = {
  data?: unknown[] | null;
  error?: { message: string } | null;
};

function linkRow(mapId: number, typeId: number, modeleId = 100) {
  return {
    map_id: mapId,
    map_pg_alias: 'filtre-a-huile',
    map_pg_id: 7,
    map_marque_alias: 'peugeot',
    map_marque_id: 128,
    map_modele_alias: 'partner-i',
    map_modele_id: modeleId,
    map_type_alias: '1-4',
    map_type_id: typeId,
  };
}

/** Client Supabase factice : une file de réponses par table. */
function tableMock(queues: Record<string, TableResult[]>) {
  const calls: Array<{ table: string; ops: Array<[string, unknown[]]> }> = [];
  const from = jest.fn((table: string) => {
    const call = { table, ops: [] as Array<[string, unknown[]]> };
    calls.push(call);
    const builder: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'gte', 'order', 'limit', 'range', 'in']) {
      builder[m] = (...args: unknown[]) => {
        call.ops.push([m, args]);
        return builder;
      };
    }
    builder.then = (
      resolve: (v: TableResult) => unknown,
      reject: (e: unknown) => unknown,
    ) => {
      const queue = queues[table] ?? [];
      const next = queue.length > 1 ? queue.shift()! : queue[0];
      return Promise.resolve(next ?? { data: [], error: null }).then(
        resolve,
        reject,
      );
    };
    return builder;
  });
  return { client: { from }, from, calls };
}

function buildSampleProcessor(queues: Record<string, TableResult[]>) {
  const configService = { get: (k: string) => process.env[k] } as never;
  const jobHealth = {
    recordSuccess: jest.fn().mockResolvedValue(undefined),
    recordFailure: jest.fn().mockResolvedValue(undefined),
  };
  const processor = new SeoMonitorProcessor(
    configService,
    {} as never,
    jobHealth as never,
  );
  const mock = tableMock(queues);
  (processor as unknown as { supabase: unknown }).supabase = mock.client;
  const callRpc = jest.fn();
  (processor as unknown as { callRpc: unknown }).callRpc = callRpc;
  const job = {
    id: 'test-1',
    data: { taskType: 'check-random-sample', triggeredBy: 'api' },
    progress: jest.fn().mockResolvedValue(undefined),
  };
  const run = () =>
    processor.handleMonitoring(job as never) as Promise<{
      totalChecked: number;
      okCount: number;
    }>;
  return { processor, mock, jobHealth, callRpc, run, job };
}

describe('SeoMonitorProcessor — échantillon aléatoire (#2144)', () => {
  const mockedIndex = getTypeModelIndex as jest.MockedFunction<
    typeof getTypeModelIndex
  >;

  beforeEach(() => {
    mockedIndex.mockReset();
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('tire dans __sitemap_p_link, écarte les types périmés et teste les pages restantes', async () => {
    // type 10 vivant (modèle 100), type 20 orphelin, type 30 rattaché ailleurs
    mockedIndex.mockResolvedValue(
      new Map<number, number | null>([
        [10, 100],
        [30, 999],
      ]),
    );
    const { mock, jobHealth, callRpc, run } = buildSampleProcessor({
      __sitemap_p_link: [
        { data: [{ map_id: 1000 }], error: null },
        { data: [linkRow(11, 10)], error: null },
        { data: [linkRow(12, 20)], error: null },
        { data: [linkRow(13, 30)], error: null },
        { data: [linkRow(11, 10)], error: null }, // doublon, puis répété
      ],
      pieces_relation_type: [{ data: rows(5), error: null }],
    });

    const result = await run();

    expect(callRpc).not.toHaveBeenCalled();
    const sampleCalls = mock.calls.filter(
      (c) => c.table === '__sitemap_p_link',
    );
    // 1 lecture de la borne + 20 tirages
    expect(sampleCalls).toHaveLength(21);
    expect(sampleCalls[0].ops).toContainEqual([
      'order',
      ['map_id', { ascending: false }],
    ]);
    // Math.random = 0.5, max = 1000 → point de départ 501
    expect(sampleCalls[1].ops).toContainEqual(['gte', ['map_id', 501]]);
    expect(sampleCalls[1].ops).toContainEqual(['limit', [1]]);

    const probes = mock.calls.filter((c) => c.table === 'pieces_relation_type');
    expect(probes).toHaveLength(1);
    expect(probes[0].ops).toContainEqual(['eq', ['rtp_type_id', 10]]);
    expect(probes[0].ops).toContainEqual(['eq', ['rtp_pg_id', 7]]);
    expect(result.totalChecked).toBe(1);
    expect(result.okCount).toBe(1);
    expect(jobHealth.recordSuccess).toHaveBeenCalledTimes(1);
  });

  it('lecture de la borne en erreur → le job échoue, aucun succès enregistré', async () => {
    const { jobHealth, run } = buildSampleProcessor({
      __sitemap_p_link: [{ data: null, error: { message: 'timeout' } }],
    });

    await expect(run()).rejects.toThrow(/__sitemap_p_link.*timeout/);
    expect(jobHealth.recordSuccess).not.toHaveBeenCalled();
  });

  it('table vide → le job échoue', async () => {
    const { jobHealth, run } = buildSampleProcessor({
      __sitemap_p_link: [{ data: [], error: null }],
    });

    await expect(run()).rejects.toThrow(/est vide/);
    expect(jobHealth.recordSuccess).not.toHaveBeenCalled();
  });

  it('tirage en erreur → le job échoue', async () => {
    const { jobHealth, run } = buildSampleProcessor({
      __sitemap_p_link: [
        { data: [{ map_id: 1000 }], error: null },
        { data: null, error: { message: 'connection reset' } },
      ],
    });

    await expect(run()).rejects.toThrow(/tirage.*connection reset/);
    expect(jobHealth.recordSuccess).not.toHaveBeenCalled();
  });

  it('aucune page servie après filtrage → le job échoue (jamais 0 page en succès)', async () => {
    mockedIndex.mockResolvedValue(new Map<number, number | null>());
    const { jobHealth, run, mock } = buildSampleProcessor({
      __sitemap_p_link: [
        { data: [{ map_id: 1000 }], error: null },
        { data: [linkRow(12, 20)], error: null },
      ],
    });

    await expect(run()).rejects.toThrow(/Échantillon aléatoire vide/);
    expect(jobHealth.recordSuccess).not.toHaveBeenCalled();
    expect(
      mock.calls.filter((c) => c.table === 'pieces_relation_type'),
    ).toHaveLength(0);
  });

  it('auto_type illisible → le job échoue', async () => {
    mockedIndex.mockRejectedValue(new Error('auto_type read failed'));
    const { jobHealth, run } = buildSampleProcessor({
      __sitemap_p_link: [
        { data: [{ map_id: 1000 }], error: null },
        { data: [linkRow(11, 10)], error: null },
      ],
    });

    await expect(run()).rejects.toThrow(/auto_type read failed/);
    expect(jobHealth.recordSuccess).not.toHaveBeenCalled();
  });

  it("un job échoué alimente l'alerte existante (recordFailure)", () => {
    const { processor, jobHealth } = buildSampleProcessor({});

    processor.handleFailedJob(
      { id: 'test-1', attemptsMade: 2 } as never,
      new Error('Échantillon aléatoire vide'),
    );

    expect(jobHealth.recordFailure).toHaveBeenCalledWith(
      'seo-monitor',
      'Échantillon aléatoire vide',
    );
  });
});

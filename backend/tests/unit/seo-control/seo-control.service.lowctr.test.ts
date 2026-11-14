/**
 * SeoControlService — bloc « CTR faible » lu au grain page fidèle (2026-11-12).
 *
 * Le cockpit lisait `rpc_seo_low_ctr_v1`, calculée sur le grain requêtes de GSC :
 * pages sous-comptées, surface non résolue. Il lit désormais `rpc_seo_low_ctr_v4`
 * (grain `page_totals`) et publie la couverture de cette lecture dans
 * `lowCtrCoverage`. Aucun repli vers une version antérieure : une réponse qui
 * n'est pas une enveloppe v4 fait échouer le snapshot.
 */
import { ConfigService } from '@nestjs/config';

import { SeoControlDecisionsService } from '../../../src/modules/admin/services/seo-control-decisions.service';
import { SeoControlService } from '../../../src/modules/admin/services/seo-control.service';

const NOW = new Date('2026-09-11T10:00:00Z');
const CACHE_KEY = 'seo-control:lowctr:v4:7d';
/** Clé sous laquelle la v1 mettait en cache un tableau de lignes. */
const V1_CACHE_KEY = 'seo-control:lowctr:7d';

const traffic = {
  impact_score_version: 'v1',
  clicks: 700,
  impressions: 40000,
  ctr: 1.75,
  avg_position: 14.3,
  pages_count: 500,
  delta_vs_previous: {
    clicks_pct: 2,
    impressions_pct: 1,
    direction: 'flat',
    change_severity: 'info',
  },
};

const row = {
  page: 'https://www.automecanik.com/pieces/filtre-a-huile-7.html',
  surface_key: 'R1',
  impressions: 3750,
  clicks: 3,
  ctr: 0.0008,
  avg_position: 4.31,
  position_band: 'top5',
  business_impact_score: 61.2,
  impact_score_version: 'v1',
  severity: 'critical',
};

const coverage = {
  grain: 'page_totals',
  coverage_status: 'ok',
  retrieval_status: 'complete',
  data_from: '2026-09-04',
  data_to: '2026-09-08',
  days_expected: 5,
  days_confirmed: 5,
  total_qualifying: 1,
};

/** Enveloppe telle que la rend `rpc_seo_low_ctr_v4` (champs non publiés compris). */
const envelope = (over: Record<string, unknown> = {}) => ({
  rows: [row],
  ...coverage,
  last_data_date: '2026-09-08',
  impact_score_version: 'v1',
  days_present: 5,
  missing_dates: [],
  unconfirmed_dates: [],
  retrieval_gap_dates: [],
  gsc_aggregation: {
    page_vs_property_clicks_ratio: 0.97,
    page_vs_property_impressions_ratio: 0.99,
    blocking: false,
  },
  ...over,
});

/** Les 14 jours des deux fenêtres 7 j, tous commités. */
const committed = Array.from({ length: 14 }, (_, i) => ({
  date: new Date(Date.UTC(2026, 7, 28 + i)).toISOString().slice(0, 10),
  commit_version: 1,
}));

type RpcResult = { data: unknown; error: unknown };

function makeService(lowCtr: RpcResult, cached: Record<string, unknown> = {}) {
  const config = {
    get: (key: string) =>
      ({
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key-placeholder',
      })[key],
    getOrThrow: () => 'mock-value',
  } as unknown as ConfigService;
  const cache = {
    get: jest.fn((key: string) => Promise.resolve(cached[key] ?? null)),
    set: jest.fn().mockResolvedValue(undefined),
    setNx: jest.fn().mockResolvedValue(false), // audit déjà journalisé
  };
  const builder: Record<string, unknown> = {};
  for (const op of ['select', 'gte', 'lte', 'limit']) {
    builder[op] = () => builder;
  }
  builder.then = (resolve: (v: unknown) => unknown) =>
    resolve({ data: committed, error: null });
  // Aucune commande payée dans la fenêtre : attribution des commandes hors sujet ici.
  const noPaidOrders: Record<string, unknown> = {};
  for (const op of ['select', 'eq', 'gte', 'lt', 'order', 'limit']) {
    noPaidOrders[op] = () => noPaidOrders;
  }
  noPaidOrders.then = (resolve: (v: unknown) => unknown) =>
    resolve({ data: [], error: null });
  const rpcData: Record<string, RpcResult> = {
    rpc_seo_traffic_v1: { data: traffic, error: null },
    rpc_seo_top_losers_v1: { data: [], error: null },
    rpc_seo_low_ctr_v4: lowCtr,
    rpc_seo_alerts_v1: { data: [], error: null },
    rpc_seo_conversion_v1: { data: null, error: null },
  };
  const supabase = {
    from: jest.fn((table: string) => {
      if (table === '___xtr_order') return noPaidOrders;
      if (table !== '__seo_gsc_daily_property_total') {
        throw new Error(`unexpected table ${table}`);
      }
      return builder;
    }),
    rpc: jest.fn((name: string, _params?: unknown) =>
      Promise.resolve(rpcData[name] ?? { data: null, error: null }),
    ),
  };
  const service = new SeoControlService(
    config,
    cache as never,
    new SeoControlDecisionsService(),
  );
  Object.defineProperty(service, 'supabase', {
    get: () => supabase,
    configurable: true,
  });
  const logger = (service as unknown as { logger: Record<string, unknown> })
    .logger;
  const warn = jest.spyOn(logger as never, 'warn').mockImplementation();
  jest.spyOn(logger as never, 'error').mockImplementation();
  const lowCtrCalls = () =>
    supabase.rpc.mock.calls.filter(([name]) => name.includes('low_ctr'));
  return { service, cache, supabase, warn, lowCtrCalls };
}

const ok = (data: unknown): RpcResult => ({ data, error: null });

describe('SeoControlService — bloc CTR faible au grain page', () => {
  beforeEach(() => {
    jest.useFakeTimers({
      now: NOW,
      doNotFake: [
        'nextTick',
        'setImmediate',
        'setTimeout',
        'clearTimeout',
        'setInterval',
        'clearInterval',
        'queueMicrotask',
      ],
    });
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('lit rpc_seo_low_ctr_v4 et elle seule, sans plancher de jours attendus', async () => {
    const { service, lowCtrCalls } = makeService(ok(envelope()));
    await service.getSnapshot('7d', 'admin-1');

    expect(lowCtrCalls()).toEqual([
      [
        'rpc_seo_low_ctr_v4',
        {
          p_window_days: 7,
          p_now: NOW.toISOString(),
          p_min_impressions: 100,
          p_max_ctr: 0.01,
          p_limit: 50,
        },
      ],
    ]);
  });

  it('publie les lignes de la RPC, leur décision, la couverture et la version v4', async () => {
    const { service, warn } = makeService(ok(envelope()));
    const snap = await service.getSnapshot('7d', 'admin-1');

    expect(snap.lowCtrOpportunities).toHaveLength(1);
    expect(snap.lowCtrOpportunities[0]).toMatchObject({
      ...row,
      decisions: { decision_rule_ids: ['LOWCTR_TOP5_META_MISMATCH_V1'] },
    });
    expect(snap.lowCtrCoverage).toEqual(coverage);
    expect(snap.generated_from.rpc_versions.low_ctr).toBe('v4');
    expect(warn).not.toHaveBeenCalled();
  });

  it('met en cache les lignes avec leur couverture', async () => {
    const { service, cache } = makeService(ok(envelope()));
    await service.getSnapshot('7d', 'admin-1');

    expect(cache.set).toHaveBeenCalledWith(
      CACHE_KEY,
      { rows: [row], coverage },
      60 * 60,
    );
  });

  it.each(['incomplete_days', 'coverage_gap'] as const)(
    'couverture %s → lignes publiées, statut publié et journalisé',
    async (coverage_status) => {
      const { service, warn } = makeService(
        ok(envelope({ coverage_status, days_expected: 7, days_confirmed: 5 })),
      );
      const snap = await service.getSnapshot('7d', 'admin-1');

      expect(snap.lowCtrOpportunities).toHaveLength(1);
      expect(snap.lowCtrCoverage).toMatchObject({
        coverage_status,
        days_expected: 7,
        days_confirmed: 5,
      });
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining(coverage_status),
      );
    },
  );

  it('aucune donnée commitée → liste vide dite insufficient_data, pas « aucune opportunité »', async () => {
    const { service, warn } = makeService(
      ok(
        envelope({
          rows: [],
          coverage_status: 'insufficient_data',
          retrieval_status: 'unknown',
          data_from: null,
          data_to: null,
          days_expected: 0,
          days_confirmed: 0,
          total_qualifying: 0,
        }),
      ),
    );
    const snap = await service.getSnapshot('7d', 'admin-1');

    expect(snap.lowCtrOpportunities).toEqual([]);
    expect(snap.lowCtrCoverage).toMatchObject({
      coverage_status: 'insufficient_data',
      retrieval_status: 'unknown',
      data_from: null,
      data_to: null,
    });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('insufficient_data'),
    );
  });

  it('liste tronquée → total_qualifying dit combien de pages passent les seuils', async () => {
    const rows = Array.from({ length: 50 }, (_, i) => ({
      ...row,
      page: `https://www.automecanik.com/pieces/gamme-${i}.html`,
    }));
    const { service } = makeService(
      ok(envelope({ rows, total_qualifying: 124 })),
    );
    const snap = await service.getSnapshot('7d', 'admin-1');

    expect(snap.lowCtrOpportunities).toHaveLength(50);
    expect(snap.lowCtrCoverage.total_qualifying).toBe(124);
  });

  it.each([
    ['tableau sans enveloppe (forme v1)', [row]],
    ['réponse nulle', null],
    ['enveloppe sans rows', (({ rows: _rows, ...rest }) => rest)(envelope())],
    ['grain requêtes', envelope({ grain: 'queries' })],
    ['grain absent', envelope({ grain: undefined })],
    ['statut de couverture inconnu', envelope({ coverage_status: 'partial' })],
    ['statut de couverture absent', envelope({ coverage_status: undefined })],
    ['compte de jours absent', envelope({ days_confirmed: undefined })],
  ])(
    'réponse hors contrat (%s) → le snapshot échoue, aucun repli, rien en cache',
    async (_label, data) => {
      const { service, cache, lowCtrCalls } = makeService(ok(data));

      await expect(service.getSnapshot('7d', 'admin-1')).rejects.toThrow(
        'rpc_seo_low_ctr_v4 returned an invalid envelope',
      );
      expect(lowCtrCalls().map(([name]) => name)).toEqual([
        'rpc_seo_low_ctr_v4',
      ]);
      expect(cache.set).not.toHaveBeenCalledWith(
        CACHE_KEY,
        expect.anything(),
        expect.anything(),
      );
    },
  );

  it.each([
    ['réseau', { message: 'fetch failed' }],
    ['permission refusée', { code: '42501', message: 'permission denied' }],
    ['fonction absente', { code: 'PGRST202', message: 'not found' }],
  ])(
    'erreur de la RPC (%s) → le snapshot échoue, pas de liste vide',
    async (_label, error) => {
      const { service, lowCtrCalls } = makeService({ data: null, error });

      await expect(service.getSnapshot('7d', 'admin-1')).rejects.toBeDefined();
      expect(lowCtrCalls().map(([name]) => name)).toEqual([
        'rpc_seo_low_ctr_v4',
      ]);
    },
  );

  it('ligne hors contrat dans une enveloppe valide → le snapshot échoue', async () => {
    const { service } = makeService(
      ok(envelope({ rows: [{ ...row, position_band: 'top1' }] })),
    );

    await expect(service.getSnapshot('7d', 'admin-1')).rejects.toBeDefined();
  });

  it('bloc en cache au format courant → servi sans appel à la RPC', async () => {
    const cachedCoverage = { ...coverage, data_to: '2026-09-07' };
    const { service, lowCtrCalls, cache } = makeService(ok(envelope()), {
      [CACHE_KEY]: { rows: [row], coverage: cachedCoverage },
    });
    const snap = await service.getSnapshot('7d', 'admin-1');

    expect(lowCtrCalls()).toEqual([]);
    expect(snap.lowCtrCoverage).toEqual(cachedCoverage);
    expect(snap.lowCtrOpportunities).toHaveLength(1);
    expect(cache.set).not.toHaveBeenCalledWith(
      CACHE_KEY,
      expect.anything(),
      expect.anything(),
    );
  });

  it.each([
    ['tableau sans enveloppe', [{ ...row, clicks: 0 }]],
    ['tableau vide', []],
    ['bloc sans couverture', { rows: [row] }],
    [
      'couverture hors contrat',
      { rows: [row], coverage: { ...coverage, grain: 'queries' } },
    ],
  ])(
    'entrée de cache invalide (%s) → relue à la source et remplacée',
    async (_label, stale) => {
      const { service, lowCtrCalls, cache } = makeService(ok(envelope()), {
        [CACHE_KEY]: stale,
      });
      const snap = await service.getSnapshot('7d', 'admin-1');

      expect(lowCtrCalls()).toHaveLength(1);
      expect(snap.lowCtrOpportunities[0].clicks).toBe(3);
      expect(snap.lowCtrCoverage).toEqual(coverage);
      expect(cache.set).toHaveBeenCalledWith(
        CACHE_KEY,
        { rows: [row], coverage },
        60 * 60,
      );
    },
  );

  it("tableau v1 resté en cache sous l'ancienne clé → ni relu, ni écrasé", async () => {
    const { service, lowCtrCalls, cache } = makeService(ok(envelope()), {
      [V1_CACHE_KEY]: [{ ...row, clicks: 0 }],
    });
    const snap = await service.getSnapshot('7d', 'admin-1');
    await service.refreshBlock('lowctr', '7d');

    expect(snap.lowCtrOpportunities[0].clicks).toBe(3);
    expect(lowCtrCalls()).toHaveLength(2);
    expect(cache.get).not.toHaveBeenCalledWith(V1_CACHE_KEY);
    expect(cache.set).not.toHaveBeenCalledWith(
      V1_CACHE_KEY,
      expect.anything(),
      expect.anything(),
    );
  });

  it('refreshBlock(lowctr) lit la v4 et met en cache lignes + couverture', async () => {
    const { service, cache, lowCtrCalls } = makeService(ok(envelope()));
    await service.refreshBlock('lowctr', '28d');

    expect(lowCtrCalls()).toEqual([
      [
        'rpc_seo_low_ctr_v4',
        {
          p_window_days: 28,
          p_now: NOW.toISOString(),
          p_min_impressions: 100,
          p_max_ctr: 0.01,
          p_limit: 50,
        },
      ],
    ]);
    expect(cache.set).toHaveBeenCalledWith(
      'seo-control:lowctr:v4:28d',
      { rows: [row], coverage },
      60 * 60,
    );
  });

  it('refreshBlock(lowctr) sur réponse hors contrat → échoue sans écraser le cache', async () => {
    const { service, cache } = makeService(ok([row]));

    await expect(service.refreshBlock('lowctr', '7d')).rejects.toThrow(
      'rpc_seo_low_ctr_v4 returned an invalid envelope',
    );
    expect(cache.set).not.toHaveBeenCalled();
  });
});

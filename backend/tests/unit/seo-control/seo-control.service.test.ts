/**
 * SeoControlService — comparaison de fenêtres GSC incomplètes (2026-09-11).
 *
 * rpc_seo_traffic_v1 / rpc_seo_top_losers_v1 comparent [J-N, J-1] à [J-2N, J-N-1]
 * sans contrôler les jours présents. Un trou d'ingestion — ou le simple retard
 * GSC en queue de fenêtre courante — y devient une « baisse ». Le snapshot doit
 * alors dire « non comparable » (raison + jours manquants), mettre le delta à
 * `unknown` et ne publier aucun perdant ; une fenêtre complète reste inchangée.
 */
import { ConfigService } from '@nestjs/config';

import { SeoControlDecisionsService } from '../../../src/modules/admin/services/seo-control-decisions.service';
import { SeoControlService } from '../../../src/modules/admin/services/seo-control.service';

const NOW = new Date('2026-09-11T10:00:00Z'); // J = 2026-09-11 (UTC)

const traffic = {
  impact_score_version: 'v1',
  clicks: 700,
  impressions: 40000,
  ctr: 1.75,
  avg_position: 14.3,
  pages_count: 500,
  delta_vs_previous: {
    clicks_pct: -28.6,
    impressions_pct: -27.1,
    direction: 'down',
    change_severity: 'high',
  },
};

const loser = {
  page: '/pieces/freinage/peugeot/308/1.6-hdi.html',
  surface_key: 'R8',
  clicks_current: 5,
  clicks_previous: 50,
  delta_clicks: -45,
  delta_pct: -90,
  impressions_current: 800,
  position_current: 12.4,
  position_delta: 3.2,
  business_impact_score: 42.5,
  impact_score_version: 'v1',
  severity: 'high',
  top_queries_sample: [],
};

/** Jours ISO de `from` à `to` inclus. */
function range(from: string, to: string): string[] {
  const out: string[] = [];
  for (
    let t = Date.parse(`${from}T00:00:00Z`);
    t <= Date.parse(`${to}T00:00:00Z`);
    t += 86_400_000
  ) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

/**
 * `committedDates` : lignes property_total portant le marqueur de commit ;
 * `uncommittedDates` : lignes présentes SANS marqueur (héritées ou réécriture interrompue).
 */
function makeService(
  committedDates: string[],
  presenceError: unknown = null,
  uncommittedDates: string[] = [],
) {
  const config = {
    get: (key: string) =>
      ({
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key-placeholder',
      })[key],
    getOrThrow: () => 'mock-value',
  } as unknown as ConfigService;
  const cache = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    setNx: jest.fn().mockResolvedValue(false), // audit déjà journalisé → aucune écriture
  };
  const presenceOps: Array<[string, unknown[]]> = [];
  const builder: Record<string, unknown> = {};
  for (const op of ['select', 'gte', 'lte', 'limit']) {
    builder[op] = (...args: unknown[]) => {
      presenceOps.push([op, args]);
      return builder;
    };
  }
  builder.then = (resolve: (v: unknown) => unknown) =>
    resolve(
      presenceError
        ? { data: null, error: presenceError }
        : {
            data: [
              ...committedDates.map((date) => ({ date, commit_version: 1 })),
              ...uncommittedDates.map((date) => ({
                date,
                commit_version: null,
              })),
            ],
            error: null,
          },
    );
  const rpcData: Record<string, unknown> = {
    rpc_seo_traffic_v1: traffic,
    rpc_seo_top_losers_v1: [loser],
    rpc_seo_low_ctr_v1: [],
    rpc_seo_alerts_v1: [],
    rpc_seo_conversion_v1: null,
  };
  const supabase = {
    from: jest.fn((table: string) => {
      if (table !== '__seo_gsc_daily_property_total') {
        throw new Error(`unexpected table ${table}`);
      }
      return builder;
    }),
    rpc: jest.fn((name: string) =>
      Promise.resolve({ data: rpcData[name] ?? null, error: null }),
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
  return { service, presenceOps, cache };
}

describe('SeoControlService — comparabilité des fenêtres GSC', () => {
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
  });

  it('fenêtres 7 j complètes → comparable, delta et perdants de la RPC conservés', async () => {
    const { service, presenceOps } = makeService(
      range('2026-08-28', '2026-09-10'),
    );
    const snap = await service.getSnapshot('7d', 'admin-1');

    expect(snap.gscComparability).toEqual({
      comparable: true,
      reason: null,
      source: '__seo_gsc_daily_property_total',
      current: {
        from: '2026-09-04',
        to: '2026-09-10',
        days_expected: 7,
        days_present: 7,
        days_confirmed: 7,
        missing_dates: [],
        unconfirmed_dates: [],
      },
      previous: {
        from: '2026-08-28',
        to: '2026-09-03',
        days_expected: 7,
        days_present: 7,
        days_confirmed: 7,
        missing_dates: [],
        unconfirmed_dates: [],
      },
    });
    expect(snap.trafficWindow.delta_vs_previous.direction).toBe('down');
    expect(snap.trafficWindow.delta_vs_previous.clicks_pct).toBe(-28.6);
    expect(snap.topLosers).toHaveLength(1);
    // lecture bornée aux 2 fenêtres
    expect(presenceOps).toEqual([
      ['select', ['date, commit_version']],
      ['gte', ['date', '2026-08-28']],
      ['lte', ['date', '2026-09-10']],
      ['limit', [1000]],
    ]);
  });

  it('retard GSC (J-1, J-2 absents) → non comparable : delta unknown, aucun perdant, jours manquants dits', async () => {
    const { service } = makeService(range('2026-08-28', '2026-09-08'));
    const snap = await service.getSnapshot('7d', 'admin-1');

    expect(snap.gscComparability.comparable).toBe(false);
    expect(snap.gscComparability.reason).toBe('current_incomplete');
    expect(snap.gscComparability.current.days_present).toBe(5);
    expect(snap.gscComparability.current.missing_dates).toEqual([
      '2026-09-09',
      '2026-09-10',
    ]);
    expect(snap.trafficWindow.delta_vs_previous).toEqual({
      clicks_pct: null,
      impressions_pct: null,
      direction: 'unknown',
      change_severity: 'info',
    });
    // totaux de la fenêtre courante conservés (étiquetés par la couverture)
    expect(snap.trafficWindow.clicks).toBe(700);
    expect(snap.topLosers).toEqual([]);
  });

  it('trou dans la fenêtre précédente seulement → non comparable (previous_incomplete)', async () => {
    const present = range('2026-08-28', '2026-09-10').filter(
      (d) => d !== '2026-08-30',
    );
    const { service } = makeService(present);
    const snap = await service.getSnapshot('7d', null);
    expect(snap.gscComparability.comparable).toBe(false);
    expect(snap.gscComparability.reason).toBe('previous_incomplete');
    expect(snap.gscComparability.previous.missing_dates).toEqual([
      '2026-08-30',
    ]);
    expect(snap.topLosers).toEqual([]);
  });

  it('28 j : bornes [J-28, J-1] / [J-56, J-29] ; relevé 2026-09-10 (15/28 jours) → non comparable', async () => {
    // jours présents constatés en base le 2026-09-10 sur 08-10 → 09-06 (15/28)
    const observed = [
      '2026-08-10',
      '2026-08-11',
      '2026-08-12',
      '2026-08-13',
      '2026-08-26',
      '2026-08-27',
      '2026-08-28',
      '2026-08-29',
      '2026-08-30',
      '2026-08-31',
      '2026-09-01',
      '2026-09-03',
      '2026-09-04',
      '2026-09-05',
      '2026-09-06',
    ];
    const { service } = makeService(observed);
    const snap = await service.getSnapshot('28d', 'admin-1');
    expect(snap.gscComparability.current.from).toBe('2026-08-14');
    expect(snap.gscComparability.current.to).toBe('2026-09-10');
    expect(snap.gscComparability.previous.from).toBe('2026-07-17');
    expect(snap.gscComparability.previous.to).toBe('2026-08-13');
    expect(snap.gscComparability.comparable).toBe(false);
    expect(snap.trafficWindow.delta_vs_previous.direction).toBe('unknown');
  });

  it('lignes présentes mais non commitées dans la fenêtre courante → non comparable, jours non confirmés distingués des manquants', async () => {
    const all = range('2026-08-28', '2026-09-10');
    const legacy = ['2026-09-06', '2026-09-07'];
    const { service } = makeService(
      all.filter((d) => !legacy.includes(d)),
      null,
      legacy,
    );
    const snap = await service.getSnapshot('7d', 'admin-1');

    expect(snap.gscComparability.comparable).toBe(false);
    expect(snap.gscComparability.reason).toBe('current_incomplete');
    expect(snap.gscComparability.current).toEqual({
      from: '2026-09-04',
      to: '2026-09-10',
      days_expected: 7,
      days_present: 7,
      days_confirmed: 5,
      missing_dates: [],
      unconfirmed_dates: ['2026-09-06', '2026-09-07'],
    });
    expect(snap.trafficWindow.delta_vs_previous.direction).toBe('unknown');
    expect(snap.topLosers).toEqual([]);
  });

  it('après migration, avant reprise : lignes toutes héritées (marqueur NULL) → aucune fenêtre certifiée', async () => {
    const { service } = makeService(
      [],
      null,
      range('2026-08-28', '2026-09-10'),
    );
    const snap = await service.getSnapshot('7d', null);
    expect(snap.gscComparability.comparable).toBe(false);
    expect(snap.gscComparability.current.days_present).toBe(7);
    expect(snap.gscComparability.current.days_confirmed).toBe(0);
    expect(snap.gscComparability.previous.days_confirmed).toBe(0);
    expect(snap.gscComparability.previous.unconfirmed_dates).toHaveLength(7);
    expect(snap.topLosers).toEqual([]);
  });

  it('schéma sans marqueur de commit (migration absente) → exception, jamais « comparable »', async () => {
    const { service } = makeService([], {
      code: '42703',
      message:
        'column __seo_gsc_daily_property_total.commit_version does not exist',
    });
    await expect(service.getSnapshot('7d', 'admin-1')).rejects.toMatchObject({
      code: '42703',
    });
  });

  it('lecture de présence en erreur → exception (jamais « comparable » par défaut)', async () => {
    const { service } = makeService([], { message: 'permission denied' });
    await expect(service.getSnapshot('7d', 'admin-1')).rejects.toEqual({
      message: 'permission denied',
    });
  });
});

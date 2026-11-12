/**
 * SeoMonitoringController — auth + honnêteté de GET timeseries/gsc (2026-09-11).
 *
 * Défauts corrigés : (1) aucun guard sur le contrôleur (GET credentials/health 200
 * sans session en PROD) ; (2) totaux/courbe = somme de ≤ `top` lignes arbitraires
 * du grain requêtes. Les totaux viennent désormais du total propriété, un jour
 * absent est listé manquant (jamais un zéro) et l'échantillon requêtes est
 * déclaré non exhaustif.
 *
 * GET timeseries/ga4 (2026-11-12) : totaux et série quotidienne calculés sur
 * toutes les lignes de la fenêtre (lecture paginée ordonnée), et non plus sur
 * une seule réponse plafonnée à 1000 lignes.
 */
import { BadRequestException, Logger } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';

import { AuthenticatedGuard } from '../../../src/auth/authenticated.guard';
import { IsAdminGuard } from '../../../src/auth/is-admin.guard';
import { SeoMonitoringController } from '../../../src/modules/seo-monitoring/controllers/seo-monitoring.controller';

jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }));

type Row = Record<string, unknown>;
/** Lignes d'une table, ou fonction qui rend la tranche demandée par `range`. */
type TableSource = Row[] | ((from: number, to: number) => Row[]);
/** `afterCalls` : nombre de lectures de la table servies avant que l'erreur tombe. */
type TableError = { code: string; message: string; afterCalls?: number };

/**
 * Builder PostgREST minimal : enregistre les filtres, résout les lignes (ou
 * l'erreur) de la table. `range` découpe les lignes comme PostgREST.
 */
function fakeSupabase(
  tables: Record<string, TableSource>,
  errors: Record<string, TableError> = {},
) {
  const calls: Array<{ table: string; ops: Array<[string, unknown[]]> }> = [];
  const from = jest.fn((table: string) => {
    const call = { table, ops: [] as Array<[string, unknown[]]> };
    const previousCalls = calls.filter((c) => c.table === table).length;
    calls.push(call);
    const builder: Record<string, unknown> = {};
    for (const op of [
      'select',
      'gte',
      'lte',
      'order',
      'ilike',
      'limit',
      'range',
    ]) {
      builder[op] = (...args: unknown[]) => {
        call.ops.push([op, args]);
        return builder;
      };
    }
    builder.then = (resolve: (v: unknown) => unknown) => {
      const failure = errors[table];
      if (failure && previousCalls >= (failure.afterCalls ?? 0)) {
        return resolve({ data: null, error: failure });
      }
      const range = call.ops.find(([op]) => op === 'range')?.[1] as
        | [number, number]
        | undefined;
      const source = tables[table] ?? [];
      const data =
        typeof source === 'function'
          ? source(range?.[0] ?? 0, range?.[1] ?? Number.MAX_SAFE_INTEGER)
          : range
            ? source.slice(range[0], range[1] + 1)
            : source;
      return resolve({ data, error: null });
    };
    return builder;
  });
  return { client: { from }, calls };
}

function makeController(
  tables: Record<string, TableSource>,
  errors: Record<string, TableError> = {},
) {
  const fake = fakeSupabase(tables, errors);
  (createClient as jest.Mock).mockReturnValue(fake.client);
  const config = {
    get: (key: string) =>
      key === 'SUPABASE_URL' ? 'https://supabase.test' : undefined,
  } as unknown as ConfigService;
  const controller = new (SeoMonitoringController as unknown as new (
    ...args: unknown[]
  ) => SeoMonitoringController)(
    {},
    { ingestionConfig: { floorDate: '2026-06-01' } },
    {},
    {},
    {},
    {},
    {},
    config,
  );
  return { controller, calls: fake.calls };
}

describe('SeoMonitoringController — auth', () => {
  it('protège TOUTES les routes : AuthenticatedGuard puis IsAdminGuard au niveau classe', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      SeoMonitoringController,
    );
    expect(guards).toEqual([AuthenticatedGuard, IsAdminGuard]);
  });
});

describe('SeoMonitoringController — GET timeseries/gsc', () => {
  const originalEnv = process.env;
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, SUPABASE_SERVICE_ROLE_KEY: 'svc-key' };
  });
  afterAll(() => {
    process.env = originalEnv;
  });

  const propertyTotals: Row[] = [
    {
      date: '2026-08-10',
      clicks: 40,
      impressions: 3000,
      ctr: 0.0133,
      position: 20,
      commit_version: 1,
    },
    {
      date: '2026-08-11',
      clicks: 50,
      impressions: 3500,
      ctr: 0.0143,
      position: 18,
      commit_version: 1,
    },
    // 08-12 et 08-13 ABSENTS (trou d'ingestion)
    {
      date: '2026-08-14',
      clicks: 60,
      impressions: 4000,
      ctr: 0.015,
      position: 16,
      commit_version: 1,
    },
  ];
  // échantillon requêtes : volontairement sans rapport avec les totaux propriété
  const queryRows: Row[] = [
    {
      date: '2026-08-10',
      page: '/a',
      query: 'q',
      device: 'MOBILE',
      clicks: 1,
      impressions: 10,
      ctr: 0.1,
      position: 3,
    },
  ];

  it('totaux = somme du total propriété (pas de l’échantillon requêtes), position pondérée par les impressions', async () => {
    const { controller } = makeController({
      __seo_gsc_daily_property_total: propertyTotals,
      __seo_gsc_daily: queryRows,
    });
    const res = (await controller.timeseriesGsc(
      '2026-08-10',
      '2026-08-16',
      undefined,
      'date',
      '200',
    )) as Record<string, any>;

    expect(res.totals.clicks).toBe(150);
    expect(res.totals.impressions).toBe(10500);
    expect(res.totals.ctr).toBeCloseTo(150 / 10500, 10);
    expect(res.totals.avg_position).toBeCloseTo(
      (20 * 3000 + 18 * 3500 + 16 * 4000) / 10500,
      10,
    );
    expect(res.daily.map((d: Row) => d.date)).toEqual([
      '2026-08-10',
      '2026-08-11',
      '2026-08-14',
    ]);
    expect(res.rows).toHaveLength(1);
    expect(res.rows_scope).toEqual({
      grain: 'query',
      exhaustive: false,
      limit: 200,
      returned: 1,
      truncated: false,
    });
  });

  it('jours manquants listés (jamais comptés à zéro) ; la queue de fraîcheur après le dernier jour présent n’est pas « manquante »', async () => {
    const { controller } = makeController({
      __seo_gsc_daily_property_total: propertyTotals,
      __seo_gsc_daily: queryRows,
    });
    const res = (await controller.timeseriesGsc(
      '2026-08-10',
      '2026-08-16',
      undefined,
      'date',
      undefined,
    )) as Record<string, any>;

    expect(res.coverage).toEqual({
      grain: 'property_total',
      last_data_date: '2026-08-14',
      expected_from: '2026-08-10',
      expected_to: '2026-08-14', // 08-15/08-16 = retard GSC, porté par last_data_date
      days_expected: 5,
      days_present: 3,
      days_confirmed: 3,
      missing_dates: ['2026-08-12', '2026-08-13'],
      unconfirmed_dates: [],
      complete: false,
    });
    // aucun zéro fabriqué dans la série
    expect(res.daily.some((d: Row) => d.date === '2026-08-12')).toBe(false);
  });

  it('aucun jour avant le plancher d’ingestion n’est attendu ; fenêtre sans donnée → rien d’affirmé', async () => {
    const early = makeController({
      __seo_gsc_daily_property_total: [
        {
          date: '2026-06-01',
          clicks: 1,
          impressions: 10,
          ctr: 0.1,
          position: 5,
          commit_version: 1,
        },
        {
          date: '2026-06-02',
          clicks: 1,
          impressions: 10,
          ctr: 0.1,
          position: 5,
          commit_version: 1,
        },
      ],
      __seo_gsc_daily: [],
    });
    const res = (await early.controller.timeseriesGsc(
      '2026-05-20',
      '2026-06-02',
    )) as Record<string, any>;
    expect(res.coverage.expected_from).toBe('2026-06-01');
    expect(res.coverage.days_expected).toBe(2);
    expect(res.coverage.complete).toBe(true);

    const empty = makeController({
      __seo_gsc_daily_property_total: [],
      __seo_gsc_daily: [],
    });
    const none = (await empty.controller.timeseriesGsc(
      '2026-08-10',
      '2026-08-16',
    )) as Record<string, any>;
    expect(none.totals.clicks).toBe(0);
    expect(none.coverage.days_expected).toBe(0);
    expect(none.coverage.complete).toBe(false);
    expect(none.coverage.last_data_date).toBeNull();
  });

  it('lecture bornée et ordonnée du total propriété ; `top` invalide → défaut 500 (pas de limit NaN)', async () => {
    const { controller, calls } = makeController({
      __seo_gsc_daily_property_total: propertyTotals,
      __seo_gsc_daily: queryRows,
    });
    const res = (await controller.timeseriesGsc(
      '2026-08-10',
      '2026-08-16',
      undefined,
      'date',
      'abc',
    )) as Record<string, any>;
    const totalsCall = calls.find(
      (c) => c.table === '__seo_gsc_daily_property_total',
    )!;
    expect(totalsCall.ops).toEqual(
      expect.arrayContaining([
        [
          'select',
          ['date, clicks, impressions, ctr, position, commit_version'],
        ],
        ['gte', ['date', '2026-08-10']],
        ['lte', ['date', '2026-08-16']],
        ['order', ['date', { ascending: true }]],
        ['limit', [1000]],
      ]),
    );
    const queryCall = calls.find((c) => c.table === '__seo_gsc_daily')!;
    expect(queryCall.ops).toContainEqual(['limit', [500]]);
    expect(res.rows_scope.limit).toBe(500);
  });

  it('distingue jour confirmé, zéro confirmé, ligne non commitée (héritée ou réécriture interrompue) et jour absent', async () => {
    const { controller } = makeController({
      __seo_gsc_daily_property_total: [
        // commité
        {
          date: '2026-08-10',
          clicks: 40,
          impressions: 3000,
          ctr: 0.0133,
          position: 20,
          commit_version: 1,
        },
        // zéro CONFIRMÉ : jour finalisé sans impression, marqueur posé
        {
          date: '2026-08-11',
          clicks: 0,
          impressions: 0,
          ctr: 0,
          position: 0,
          commit_version: 1,
        },
        // ligne héritée : l'ancien code écrivait property_total EN PREMIER, à 0 si GSC ne renvoyait rien
        {
          date: '2026-08-12',
          clicks: 0,
          impressions: 0,
          ctr: 0,
          position: 0,
          commit_version: null,
        },
        // 08-13 ABSENT
        // réécriture interrompue : marqueur retiré, ancienne valeur encore là
        {
          date: '2026-08-14',
          clicks: 60,
          impressions: 4000,
          ctr: 0.015,
          position: 16,
          commit_version: null,
        },
      ],
      __seo_gsc_daily: [],
    });
    const res = (await controller.timeseriesGsc(
      '2026-08-10',
      '2026-08-16',
    )) as Record<string, any>;

    expect(res.coverage).toEqual({
      grain: 'property_total',
      last_data_date: '2026-08-14',
      expected_from: '2026-08-10',
      expected_to: '2026-08-14',
      days_expected: 5,
      days_present: 4,
      days_confirmed: 2,
      missing_dates: ['2026-08-13'],
      unconfirmed_dates: ['2026-08-12', '2026-08-14'],
      complete: false,
    });
    expect(
      res.daily.map((d: Row) => [d.date, d.impressions, d.confirmed]),
    ).toEqual([
      ['2026-08-10', 3000, true],
      ['2026-08-11', 0, true],
      ['2026-08-12', 0, false],
      ['2026-08-14', 4000, false],
    ]);
  });

  it('une ligne non commitée ne rend jamais la fenêtre complète, même seule manquante de marqueur', async () => {
    const committed = (date: string) => ({
      date,
      clicks: 10,
      impressions: 1000,
      ctr: 0.01,
      position: 10,
      commit_version: 1,
    });
    const { controller } = makeController({
      __seo_gsc_daily_property_total: [
        committed('2026-08-10'),
        committed('2026-08-11'),
        { ...committed('2026-08-12'), commit_version: null },
      ],
      __seo_gsc_daily: [],
    });
    const res = (await controller.timeseriesGsc(
      '2026-08-10',
      '2026-08-12',
    )) as Record<string, any>;
    expect(res.coverage.days_present).toBe(3);
    expect(res.coverage.missing_dates).toEqual([]);
    expect(res.coverage.unconfirmed_dates).toEqual(['2026-08-12']);
    expect(res.coverage.complete).toBe(false);
  });

  it('schéma sans marqueur de commit (migration absente) → erreur explicite, aucune couverture affirmée', async () => {
    const { controller } = makeController(
      { __seo_gsc_daily: [] },
      {
        __seo_gsc_daily_property_total: {
          code: '42703',
          message:
            'column __seo_gsc_daily_property_total.commit_version does not exist',
        },
      },
    );
    const res = (await controller.timeseriesGsc(
      '2026-08-10',
      '2026-08-16',
    )) as Record<string, any>;
    expect(res).toEqual({
      error:
        'column __seo_gsc_daily_property_total.commit_version does not exist',
      rows: [],
    });
    expect(res.coverage).toBeUndefined();
  });

  it('dates invalides ou inversées → 400 explicite, aucune lecture', async () => {
    const { controller, calls } = makeController({});
    await expect(
      controller.timeseriesGsc('2026-02-30', '2026-03-01'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      controller.timeseriesGsc('2026-09-10', '2026-09-01'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(calls).toHaveLength(0);
  });
});

describe('SeoMonitoringController — GET timeseries/ga4', () => {
  const originalEnv = process.env;
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, SUPABASE_SERVICE_ROLE_KEY: 'svc-key' };
  });
  afterAll(() => {
    process.env = originalEnv;
  });

  const ga4Row = (
    date: string,
    page: string,
    channel: string,
    sessions: unknown,
    conversions: unknown,
  ): Row => ({
    date,
    page,
    channel,
    sessions,
    conversions,
    bounce_rate: null,
    avg_session_duration: null,
  });

  /** `count` lignes réparties sur `days` jours consécutifs, 2 sessions et 1 événement clé par ligne. */
  const manyRows = (count: number, days: number): Row[] =>
    Array.from({ length: count }, (_, i) => {
      const day = Math.floor((i * days) / count) + 1;
      return ga4Row(
        `2026-10-${String(day).padStart(2, '0')}`,
        `https://www.automecanik.com/p-${i}`,
        'organic search',
        2,
        1,
      );
    });

  const ga4Calls = (calls: ReturnType<typeof makeController>['calls']) =>
    calls.filter((c) => c.table === '__seo_ga4_daily');
  const ranges = (calls: ReturnType<typeof makeController>['calls']) =>
    ga4Calls(calls).map((c) => c.ops.find(([op]) => op === 'range')?.[1]);

  it('série quotidienne et totaux = somme de toutes les lignes, tous canaux, lues dans l’ordre de la clé primaire', async () => {
    const { controller, calls } = makeController({
      __seo_ga4_daily: [
        ga4Row('2026-10-01', 'https://www.automecanik.com/a', 'direct', 5, 0),
        ga4Row(
          '2026-10-01',
          'https://www.automecanik.com/a',
          'organic search',
          10,
          2,
        ),
        ga4Row(
          '2026-10-02',
          'https://www.automecanik.com/b',
          'organic search',
          7,
          1,
        ),
      ],
    });
    const res = (await controller.timeseriesGa4(
      '2026-10-01',
      '2026-10-07',
    )) as Record<string, any>;

    expect(res.daily).toEqual([
      { date: '2026-10-01', sessions: 15, conversions: 2 },
      { date: '2026-10-02', sessions: 7, conversions: 1 },
    ]);
    expect(res.totals).toEqual({ sessions: 22, conversions: 3 });
    expect(res.totals_scope).toEqual({
      grain: 'date',
      channels: 'all',
      exhaustive: true,
      rows_read: 3,
      days_present: 2,
      last_data_date: '2026-10-02',
    });
    expect(res.rows).toHaveLength(3);
    expect(res.rows_scope).toEqual({
      grain: 'date_page_channel',
      exhaustive: false,
      limit: 1000,
      returned: 3,
      truncated: false,
    });
    expect(res.from).toBe('2026-10-01');
    expect(res.to).toBe('2026-10-07');

    expect(ga4Calls(calls)).toHaveLength(1);
    expect(ga4Calls(calls)[0].ops).toEqual([
      [
        'select',
        [
          'date, page, channel, sessions, conversions, bounce_rate, avg_session_duration',
        ],
      ],
      ['gte', ['date', '2026-10-01']],
      ['lte', ['date', '2026-10-07']],
      ['order', ['date', { ascending: true }]],
      ['order', ['page', { ascending: true }]],
      ['order', ['channel', { ascending: true }]],
      ['range', [0, 999]],
    ]);
  });

  it('fenêtre de plus de 1000 lignes : toutes les pages sont lues, les totaux ne s’arrêtent pas à la première', async () => {
    const { controller, calls } = makeController({
      __seo_ga4_daily: manyRows(2500, 5),
    });
    const res = (await controller.timeseriesGa4(
      '2026-10-01',
      '2026-10-05',
    )) as Record<string, any>;

    expect(ranges(calls)).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
    expect(res.totals).toEqual({ sessions: 5000, conversions: 2500 });
    expect(res.daily).toHaveLength(5);
    expect(res.daily.every((d: Row) => d.sessions === 1000)).toBe(true);
    expect(res.totals_scope.exhaustive).toBe(true);
    expect(res.totals_scope.rows_read).toBe(2500);
    // l'échantillon reste la première page, et le dit
    expect(res.rows).toHaveLength(1000);
    expect(res.rows_scope.truncated).toBe(true);
  });

  it('nombre de lignes multiple exact de la taille de page : une lecture vide clôt la série, déclarée exhaustive', async () => {
    const { controller, calls } = makeController({
      __seo_ga4_daily: manyRows(2000, 2),
    });
    const res = (await controller.timeseriesGa4(
      '2026-10-01',
      '2026-10-02',
    )) as Record<string, any>;

    expect(ranges(calls)).toHaveLength(3);
    expect(res.totals).toEqual({ sessions: 4000, conversions: 2000 });
    expect(res.totals_scope.exhaustive).toBe(true);
  });

  it('aucune ligne dans la fenêtre → série vide, rien d’inventé', async () => {
    const { controller, calls } = makeController({ __seo_ga4_daily: [] });
    const res = (await controller.timeseriesGa4(
      '2026-10-01',
      '2026-10-07',
    )) as Record<string, any>;

    expect(ga4Calls(calls)).toHaveLength(1);
    expect(res.error).toBeUndefined();
    expect(res.daily).toEqual([]);
    expect(res.totals).toEqual({ sessions: 0, conversions: 0 });
    expect(res.totals_scope).toEqual({
      grain: 'date',
      channels: 'all',
      exhaustive: true,
      rows_read: 0,
      days_present: 0,
      last_data_date: null,
    });
  });

  it('jour absent de la table : absent de la série, jamais un zéro', async () => {
    const { controller } = makeController({
      __seo_ga4_daily: [
        ga4Row('2026-10-01', 'https://www.automecanik.com/a', 'direct', 4, 0),
        ga4Row('2026-10-03', 'https://www.automecanik.com/a', 'direct', 6, 1),
      ],
    });
    const res = (await controller.timeseriesGa4(
      '2026-10-01',
      '2026-10-03',
    )) as Record<string, any>;

    expect(res.daily.map((d: Row) => d.date)).toEqual([
      '2026-10-01',
      '2026-10-03',
    ]);
    expect(res.totals_scope.days_present).toBe(2);
  });

  it('valeurs absentes ou textuelles : comptées pour ce qu’elles valent, sans NaN', async () => {
    const { controller } = makeController({
      __seo_ga4_daily: [
        ga4Row(
          '2026-10-01',
          'https://www.automecanik.com/a',
          'direct',
          null,
          null,
        ),
        ga4Row(
          '2026-10-01',
          'https://www.automecanik.com/b',
          'direct',
          '12',
          '3',
        ),
        ga4Row(
          '2026-10-01',
          'https://www.automecanik.com/c',
          'direct',
          undefined,
          'n/a',
        ),
      ],
    });
    const res = (await controller.timeseriesGa4(
      '2026-10-01',
      '2026-10-01',
    )) as Record<string, any>;

    expect(res.daily).toEqual([
      { date: '2026-10-01', sessions: 12, conversions: 3 },
    ]);
    expect(res.totals).toEqual({ sessions: 12, conversions: 3 });
  });

  it.each([
    ['dès la première page', 0],
    ['à la troisième page', 2],
  ])(
    'erreur de lecture %s → erreur explicite, aucun total partiel',
    async (_label, afterCalls) => {
      const { controller } = makeController(
        { __seo_ga4_daily: manyRows(5000, 5) },
        {
          __seo_ga4_daily: {
            code: '57014',
            message: 'canceling statement due to statement timeout',
            afterCalls,
          },
        },
      );
      const res = (await controller.timeseriesGa4(
        '2026-10-01',
        '2026-10-05',
      )) as Record<string, any>;

      expect(res).toEqual({
        error: 'canceling statement due to statement timeout',
        rows: [],
      });
      expect(res.totals).toBeUndefined();
      expect(res.daily).toBeUndefined();
    },
  );

  it('borne de lecture atteinte : le dernier jour, lu en partie, sort de la série et la réponse le déclare', async () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    // 150 000 lignes par jour : la borne (200 000 lignes) tombe au milieu du 2e jour.
    const endless = (from: number, to: number): Row[] =>
      Array.from({ length: to - from + 1 }, (_, i) =>
        ga4Row(
          `2026-10-${String(Math.floor((from + i) / 150_000) + 1).padStart(2, '0')}`,
          `https://www.automecanik.com/p-${from + i}`,
          'direct',
          1,
          0,
        ),
      );
    const { controller, calls } = makeController({ __seo_ga4_daily: endless });
    const res = (await controller.timeseriesGa4(
      '2026-10-01',
      '2026-10-31',
    )) as Record<string, any>;

    expect(ga4Calls(calls)).toHaveLength(200);
    expect(res.daily).toEqual([
      { date: '2026-10-01', sessions: 150_000, conversions: 0 },
    ]);
    expect(res.totals).toEqual({ sessions: 150_000, conversions: 0 });
    expect(res.totals_scope).toEqual({
      grain: 'date',
      channels: 'all',
      exhaustive: false,
      rows_read: 200_000,
      days_present: 1,
      last_data_date: '2026-10-01',
    });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('borne de lecture atteinte'),
    );
    warn.mockRestore();
  });

  it('filtre `page` appliqué à chaque page lue', async () => {
    const { controller, calls } = makeController({
      __seo_ga4_daily: manyRows(1200, 2),
    });
    await controller.timeseriesGa4('2026-10-01', '2026-10-02', '/pieces/');

    expect(ga4Calls(calls)).toHaveLength(2);
    for (const call of ga4Calls(calls)) {
      expect(call.ops).toContainEqual(['ilike', ['page', '%/pieces/%']]);
    }
  });

  it('sans from/to : fenêtre de 90 jours, bornes ISO valides', async () => {
    const { controller, calls } = makeController({ __seo_ga4_daily: [] });
    const res = (await controller.timeseriesGa4()) as Record<string, any>;

    expect(res.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(res.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(
      Math.round((Date.parse(res.to) - Date.parse(res.from)) / 86_400_000),
    ).toBe(90);
    expect(ga4Calls(calls)[0].ops).toContainEqual(['gte', ['date', res.from]]);
  });

  it.each([
    ['jour inexistant', '2026-02-30', '2026-03-01'],
    ['bornes inversées', '2026-10-10', '2026-10-01'],
    ['texte libre', 'hier', '2026-10-01'],
    ['filtre injecté', '2026-10-01', '2026-10-07,page.ilike.*'],
  ])('%s → 400 explicite, aucune lecture', async (_label, from, to) => {
    const { controller, calls } = makeController({ __seo_ga4_daily: [] });
    await expect(controller.timeseriesGa4(from, to)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(calls).toHaveLength(0);
  });
});

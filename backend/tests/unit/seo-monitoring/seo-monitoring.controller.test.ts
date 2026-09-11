/**
 * SeoMonitoringController — auth + honnêteté de GET timeseries/gsc (2026-09-11).
 *
 * Défauts corrigés : (1) aucun guard sur le contrôleur (GET credentials/health 200
 * sans session en PROD) ; (2) totaux/courbe = somme de ≤ `top` lignes arbitraires
 * du grain requêtes. Les totaux viennent désormais du total propriété, un jour
 * absent est listé manquant (jamais un zéro) et l'échantillon requêtes est
 * déclaré non exhaustif.
 */
import { BadRequestException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';

import { AuthenticatedGuard } from '../../../src/auth/authenticated.guard';
import { IsAdminGuard } from '../../../src/auth/is-admin.guard';
import { SeoMonitoringController } from '../../../src/modules/seo-monitoring/controllers/seo-monitoring.controller';

jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }));

type Row = Record<string, unknown>;

/** Builder PostgREST minimal : enregistre les filtres, résout les lignes (ou l'erreur) de la table. */
function fakeSupabase(
  tables: Record<string, Row[]>,
  errors: Record<string, { code: string; message: string }> = {},
) {
  const calls: Array<{ table: string; ops: Array<[string, unknown[]]> }> = [];
  const from = jest.fn((table: string) => {
    const call = { table, ops: [] as Array<[string, unknown[]]> };
    calls.push(call);
    const builder: Record<string, unknown> = {};
    for (const op of ['select', 'gte', 'lte', 'order', 'ilike', 'limit']) {
      builder[op] = (...args: unknown[]) => {
        call.ops.push([op, args]);
        return builder;
      };
    }
    builder.then = (resolve: (v: unknown) => unknown) =>
      resolve(
        errors[table]
          ? { data: null, error: errors[table] }
          : { data: tables[table] ?? [], error: null },
      );
    return builder;
  });
  return { client: { from }, calls };
}

function makeController(
  tables: Record<string, Row[]>,
  errors: Record<string, { code: string; message: string }> = {},
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

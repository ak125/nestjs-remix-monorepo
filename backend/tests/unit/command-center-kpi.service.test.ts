/**
 * CommandCenterKpiService — `payments_kept` (KPI primaire du département Ventes)
 * et lectures des KPI Data / Pages & SEO / Diagnostic (règles pures testées dans
 * command-center-department-kpi.rules.test.ts).
 *
 * Deux garanties :
 *   1. la classification reproduit les cas réels relevés en base le 2026-10-04
 *      (statut '6' = annulation admin hors canon, statut '3' sans drapeau, date de
 *      paiement seule) — compter le seul statut canon '2' affichait comme gardées
 *      des ventes annulées ;
 *   2. une source illisible (erreur, lecture tronquée) donne UNKNOWN, jamais un zéro.
 * supabase-js résout `{ error }` (il ne lève pas) : le mock renvoie des résultats.
 */
import { TABLES } from '@repo/database-types';
import {
  evaluateTrackingIntegrity,
  trackingWindow,
  unknownVerdict,
} from '../../src/modules/analytics/tracking-integrity/tracking-integrity.service';
import {
  CommandCenterKpiService,
  classifyOrderPayment,
  countPaymentsKept,
  toPaymentsKeptKpi,
  type OrderPaymentRow,
} from '../../src/modules/admin/services/command-center-kpi.service';
import type { LiveKpiMeasure } from '../../src/modules/admin/services/command-center-action-rules/live-kpi';

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

const UNPAID: OrderPaymentRow = {
  ord_ords_id: '1',
  ord_is_pay: '0',
  ord_date_pay: null,
  payment_confirmed: false,
  ord_cancel_date: null,
};

function row(overrides: Partial<OrderPaymentRow>): OrderPaymentRow {
  return { ...UNPAID, ...overrides };
}

type ReadResult = {
  data: unknown[] | null;
  count: number | null;
  error: { code?: string; message: string } | null;
};

const EMPTY: ReadResult = { data: [], count: 0, error: null };
const METHODS = ['select', 'eq', 'gte', 'lt', 'in', 'limit'] as const;
type Method = (typeof METHODS)[number];

/** Ce qu'une lecture de __seo_event_log a demandé. */
interface EventQuery {
  eventType: unknown;
  gte?: unknown;
  lt?: unknown;
  sessions?: string[];
  limit?: number;
}

/**
 * Supabase simulé, une chaîne thenable par `from()`. ___xtr_order : chaque
 * lecture consomme le résultat suivant de `orders` (fenêtre courante puis
 * précédente), le dernier est rejoué. __seo_event_log : `events(query)` répond,
 * vide par défaut. Les méthodes sont des espions partagés par toutes les chaînes.
 */
function fakeDb({
  orders = [EMPTY],
  events = () => EMPTY,
}: {
  orders?: ReadResult[];
  events?: (q: EventQuery) => ReadResult;
}) {
  const spies = Object.fromEntries(
    METHODS.map((m) => [m, jest.fn()]),
  ) as Record<Method, jest.Mock>;
  let orderReads = 0;
  const from = jest.fn((table: string) => {
    const q: EventQuery = { eventType: undefined };
    const chain: Record<string, unknown> = {
      then: (resolve: (r: ReadResult) => unknown) =>
        resolve(
          table === TABLES.xtr_order
            ? orders[Math.min(orderReads++, orders.length - 1)]
            : events(q),
        ),
    };
    for (const m of METHODS) {
      chain[m] = (...args: unknown[]) => {
        spies[m](...args);
        if (m === 'eq' && args[0] === 'event_type') q.eventType = args[1];
        if (m === 'gte') q.gte = args[1];
        if (m === 'lt') q.lt = args[1];
        if (m === 'in') q.sessions = args[1] as string[];
        if (m === 'limit') q.limit = args[0] as number;
        return chain;
      };
    }
    return chain;
  });
  return { from, ...spies };
}

/** Raccourci : seules les lectures ___xtr_order comptent. */
function fakeSupabase(...orders: ReadResult[]) {
  return fakeDb({ orders });
}

type FakeDb = ReturnType<typeof fakeDb>;

function makeService(
  supabase: FakeDb,
  trackingIntegrity: { evaluate: jest.Mock } = {
    evaluate: jest.fn(async (at: Date) =>
      unknownVerdict(trackingWindow(at), 'aucune donnée'),
    ),
  },
) {
  const service = new (CommandCenterKpiService as unknown as new (
    c: unknown,
    t: unknown,
  ) => CommandCenterKpiService)(mockConfigService, trackingIntegrity);
  Object.defineProperty(service, 'supabase', {
    get: () => supabase,
    configurable: true,
  });
  return service;
}

describe('classifyOrderPayment', () => {
  it('commande non payée → unpaid', () => {
    expect(classifyOrderPayment(UNPAID)).toBe('unpaid');
  });

  it('drapeau ord_is_pay seul → kept', () => {
    expect(classifyOrderPayment(row({ ord_is_pay: '1' }))).toBe('kept');
  });

  it('date de paiement seule (drapeau resté à 0) → kept', () => {
    expect(
      classifyOrderPayment(row({ ord_date_pay: '2026-09-20T10:00:00Z' })),
    ).toBe('kept');
  });

  it('date de paiement vide → ne compte pas comme payée', () => {
    expect(classifyOrderPayment(row({ ord_date_pay: '  ' }))).toBe('unpaid');
  });

  it('payment_confirmed seul → kept', () => {
    expect(classifyOrderPayment(row({ payment_confirmed: true }))).toBe('kept');
  });

  it.each(['3', '4', '5'])(
    'statut %s posé par le paiement, sans drapeau → kept',
    (status) => {
      expect(classifyOrderPayment(row({ ord_ords_id: status }))).toBe('kept');
    },
  );

  it("statut '6' (annulation admin, hors canon) après paiement → cancelled_after_payment", () => {
    expect(
      classifyOrderPayment(
        row({
          ord_ords_id: '6',
          ord_is_pay: '1',
          ord_date_pay: '2026-09-20T10:00:00Z',
        }),
      ),
    ).toBe('cancelled_after_payment');
  });

  it("statut canon '2' après paiement → cancelled_after_payment", () => {
    expect(
      classifyOrderPayment(row({ ord_ords_id: '2', ord_is_pay: '1' })),
    ).toBe('cancelled_after_payment');
  });

  it("date d'annulation sur une commande payée → cancelled_after_payment", () => {
    expect(
      classifyOrderPayment(
        row({
          ord_ords_id: '5',
          ord_cancel_date: '2026-09-21T09:00:00Z',
        }),
      ),
    ).toBe('cancelled_after_payment');
  });

  it('commande annulée jamais payée → unpaid (pas une fuite)', () => {
    expect(classifyOrderPayment(row({ ord_ords_id: '2' }))).toBe('unpaid');
  });
});

describe('countPaymentsKept + toPaymentsKeptKpi', () => {
  // Forme relevée en base le 2026-10-04 : tous les paiements de la fenêtre ont
  // été annulés ensuite par l'admin (statut '6').
  const ALL_CANCELLED: OrderPaymentRow[] = [
    UNPAID,
    UNPAID,
    row({ ord_ords_id: '6', ord_is_pay: '1' }),
    row({ ord_ords_id: '6', ord_date_pay: '2026-09-15T08:00:00Z' }),
  ];

  it("paiements tous annulés par l'admin : 0 gardée → CRITICAL", () => {
    const counts = countPaymentsKept(ALL_CANCELLED);
    expect(counts).toEqual({
      orders: 4,
      paid: 2,
      kept: 0,
      cancelledAfterPayment: 2,
    });
    expect(toPaymentsKeptKpi(counts)).toEqual({
      id: 'payments_kept',
      label: 'Ventes — paiements gardés / payés (30 j)',
      value: 0,
      unit: '/2',
      status: 'CRITICAL',
      source: 'db',
      certified: true,
    });
  });

  it('au moins une vente gardée mais une annulation après paiement → WARNING', () => {
    const kpi = toPaymentsKeptKpi(
      countPaymentsKept([
        row({ ord_ords_id: '5', ord_is_pay: '1' }),
        row({ ord_ords_id: '6', ord_is_pay: '1' }),
      ]),
    );
    expect(kpi.value).toBe(1);
    expect(kpi.unit).toBe('/2');
    expect(kpi.status).toBe('WARNING');
  });

  it('ventes gardées sans aucune annulation → OK', () => {
    const kpi = toPaymentsKeptKpi(
      countPaymentsKept([row({ ord_ords_id: '5', ord_is_pay: '1' }), UNPAID]),
    );
    expect(kpi.value).toBe(1);
    expect(kpi.status).toBe('OK');
  });

  it('source illisible → UNKNOWN, valeur null, non certifié', () => {
    expect(toPaymentsKeptKpi(null)).toEqual({
      id: 'payments_kept',
      label: 'Ventes — paiements gardés / payés (30 j)',
      value: null,
      status: 'UNKNOWN',
      source: 'db',
      certified: false,
    });
  });
});

describe('CommandCenterKpiService.computeLiveKpis', () => {
  const NOW = new Date('2026-10-04T12:00:00.000Z');

  it('lit ___xtr_order en lecture seule sur 30 jours glissants et compte', async () => {
    const supabase = fakeSupabase({
      data: [row({ ord_ords_id: '5', ord_is_pay: '1' }), UNPAID],
      count: 2,
      error: null,
    });
    const [{ kpi }] = await makeService(supabase).computeLiveKpis('full', NOW);

    expect(supabase.from).toHaveBeenCalledWith(TABLES.xtr_order);
    expect(supabase.select).toHaveBeenCalledWith(
      'ord_ords_id, ord_is_pay, ord_date_pay, payment_confirmed, ord_cancel_date',
      { count: 'exact' },
    );
    expect(supabase.gte).toHaveBeenCalledWith(
      'ord_date',
      '2026-09-04T12:00:00.000Z',
    );
    expect(kpi).toMatchObject({ value: 1, unit: '/1', status: 'OK' });
  });

  it('erreur de lecture (ex. 42501 en PREPROD, rôle anon) → UNKNOWN, pas zéro', async () => {
    const service = makeService(
      fakeSupabase({
        data: null,
        count: null,
        error: { code: '42501', message: 'permission denied' },
      }),
    );
    const warn = jest.spyOn(
      (service as unknown as { logger: { warn: () => void } }).logger,
      'warn',
    );
    const [{ kpi }] = await service.computeLiveKpis('full', NOW);
    expect(kpi.status).toBe('UNKNOWN');
    expect(kpi.value).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('42501'));
  });

  it('lecture tronquée (count ≠ lignes reçues) → UNKNOWN', async () => {
    const service = makeService(
      fakeSupabase({ data: [UNPAID], count: 1500, error: null }),
    );
    const [{ kpi }] = await service.computeLiveKpis('full', NOW);
    expect(kpi.status).toBe('UNKNOWN');
    expect(kpi.value).toBeNull();
  });

  it('relit la fenêtre précédente de même durée pour l’évolution', async () => {
    const supabase = fakeSupabase(
      // fenêtre courante : 1 gardée sur 1 payée
      {
        data: [row({ ord_ords_id: '5', ord_is_pay: '1' })],
        count: 1,
        error: null,
      },
      // fenêtre précédente : 2 gardées
      {
        data: [
          row({ ord_ords_id: '5', ord_is_pay: '1' }),
          row({ ord_ords_id: '3', ord_date_pay: '2026-08-20T10:00:00Z' }),
        ],
        count: 2,
        error: null,
      },
    );
    const [measure] = await makeService(supabase).computeLiveKpis('full', NOW);

    expect(supabase.gte).toHaveBeenCalledWith(
      'ord_date',
      '2026-08-05T12:00:00.000Z',
    );
    expect(
      supabase.lt.mock.calls.filter(([column]) => column === 'ord_date'),
    ).toEqual([['ord_date', '2026-09-04T12:00:00.000Z']]);
    expect(measure).toMatchObject({
      window_days: 30,
      previous_value: 2,
      better: 'higher',
    });
    expect(measure.kpi.value).toBe(1);
  });

  it('fenêtre précédente illisible → previous_value null, pas zéro', async () => {
    const [measure] = await makeService(
      fakeSupabase(
        {
          data: [row({ ord_ords_id: '5', ord_is_pay: '1' })],
          count: 1,
          error: null,
        },
        { data: null, count: null, error: { message: 'timeout' } },
      ),
    ).computeLiveKpis('full', NOW);
    expect(measure.kpi.value).toBe(1);
    expect(measure.previous_value).toBeNull();
  });

  it('fenêtre courante illisible → aucune comparaison', async () => {
    const [measure] = await makeService(
      fakeSupabase(
        { data: null, count: null, error: { message: 'timeout' } },
        {
          data: [row({ ord_ords_id: '5', ord_is_pay: '1' })],
          count: 1,
          error: null,
        },
      ),
    ).computeLiveKpis('full', NOW);
    expect(measure.kpi.value).toBeNull();
    expect(measure.previous_value).toBeNull();
  });

  it.each(['light', 'disabled'] as const)(
    'mode %s → aucune lecture, aucun indicateur',
    async (mode) => {
      const supabase = fakeSupabase({ data: [], count: 0, error: null });
      expect(await makeService(supabase).computeLiveKpis(mode, NOW)).toEqual(
        [],
      );
      expect(supabase.from).not.toHaveBeenCalled();
    },
  );
});

describe('CommandCenterKpiService — Data, Pages & SEO, Diagnostic', () => {
  const NOW = new Date('2026-10-04T12:00:00.000Z');
  const SINCE = '2026-09-04T12:00:00.000Z';
  const PREVIOUS_SINCE = '2026-08-05T12:00:00.000Z';

  /** Verdict réel produit par la règle de TrackingIntegrity. */
  function verdictAt(at: Date, keyed: number, events: number) {
    return evaluateTrackingIntegrity({
      window: trackingWindow(at),
      events: Array.from({ length: events }, (_, i) => ({
        id: `e${i}`,
        order_id: `o${i}`,
      })),
      confirmedOrders: [{ ord_id: 'o0' }],
      knownOrderIds: new Set(Array.from({ length: keyed }, (_, i) => `o${i}`)),
    });
  }

  function ok(data: unknown[]): ReadResult {
    return { data, count: data.length, error: null };
  }

  function byId(measures: LiveKpiMeasure[], id: string) {
    const found = measures.find((m) => m.kpi.id === id);
    if (!found) throw new Error(`KPI ${id} absent`);
    return found;
  }

  it('renvoie les quatre KPI primaires dans un ordre stable', async () => {
    const measures = await makeService(fakeDb({})).computeLiveKpis('full', NOW);
    expect(measures.map((m) => m.kpi.id)).toEqual([
      'payments_kept',
      'metric_reliability',
      'pages_generating_atc',
      'diagnostic_to_product',
    ]);
  });

  describe('metric_reliability', () => {
    it('reprend le verdict Data et le compare à la fenêtre contiguë précédente', async () => {
      const evaluate = jest.fn(
        async (at: Date) =>
          at.getTime() === NOW.getTime()
            ? verdictAt(at, 1, 2) // 1 événement sur 2 rattaché : NOT_CERTIFIED
            : verdictAt(at, 1, 1), // CERTIFIED
      );
      const measures = await makeService(fakeDb({}), {
        evaluate,
      }).computeLiveKpis('full', NOW);

      expect(evaluate.mock.calls.map(([at]) => at.toISOString())).toEqual([
        NOW.toISOString(),
        SINCE,
      ]);
      const m = byId(measures, 'metric_reliability');
      expect(m.kpi).toMatchObject({
        value: 1,
        unit: '/2',
        status: 'WARNING',
        certified: true,
      });
      expect(m).toMatchObject({ window_days: 30, previous_value: 2 });
    });

    it('verdict hors contrat → UNKNOWN, avertissement, pas de valeur', async () => {
      const service = makeService(fakeDb({}), {
        evaluate: jest.fn(async (at: Date) => ({
          ...verdictAt(at, 1, 1),
          status: 'NOT_CERTIFIED', // aucun contrôle FAIL : viole le contrat
        })),
      });
      const warn = jest.spyOn(
        (service as unknown as { logger: { warn: () => void } }).logger,
        'warn',
      );
      const m = byId(
        await service.computeLiveKpis('full', NOW),
        'metric_reliability',
      );
      expect(m.kpi).toMatchObject({ value: null, status: 'UNKNOWN' });
      expect(m.previous_value).toBeNull();
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('verdict hors contrat'),
      );
    });

    it('évaluation en échec → UNKNOWN, jamais un zéro', async () => {
      const m = byId(
        await makeService(fakeDb({}), {
          evaluate: jest.fn().mockRejectedValue(new Error('boom')),
        }).computeLiveKpis('full', NOW),
        'metric_reliability',
      );
      expect(m.kpi).toMatchObject({ value: null, status: 'UNKNOWN' });
    });

    it('fenêtres non contiguës → aucune comparaison', async () => {
      const evaluate = jest.fn(async (at: Date) =>
        verdictAt(
          at.getTime() === NOW.getTime() ? at : new Date(at.getTime() - 1),
          1,
          1,
        ),
      );
      const m = byId(
        await makeService(fakeDb({}), { evaluate }).computeLiveKpis(
          'full',
          NOW,
        ),
        'metric_reliability',
      );
      expect(m.kpi.value).toBe(2);
      expect(m.previous_value).toBeNull();
    });
  });

  describe('pages_generating_atc', () => {
    it('compte les pages SEO distinctes, fenêtre courante puis précédente', async () => {
      const supabase = fakeDb({
        events: (q) =>
          q.eventType !== 'r2_add_to_cart'
            ? EMPTY
            : q.gte === SINCE
              ? ok([
                  { source_url: '/pieces/plaquette-de-frein-402.html' },
                  { source_url: '/pieces/plaquette-de-frein-402.html?r=x' },
                  { source_url: '/search?q=filtre' },
                ])
              : ok([]),
      });
      const measures = await makeService(supabase).computeLiveKpis('full', NOW);

      expect(supabase.from).toHaveBeenCalledWith('__seo_event_log');
      expect(supabase.select).toHaveBeenCalledWith(
        'source_url:payload->>source_url',
        { count: 'exact' },
      );
      expect(supabase.gte).toHaveBeenCalledWith('created_at', PREVIOUS_SINCE);
      expect(supabase.lt).toHaveBeenCalledWith('created_at', SINCE);
      const m = byId(measures, 'pages_generating_atc');
      expect(m.kpi).toMatchObject({ value: 1, status: 'OK' });
      expect(m.previous_value).toBe(0);
    });

    it('lecture tronquée → UNKNOWN, avertissement nommant la source', async () => {
      const service = makeService(
        fakeDb({
          events: (q) =>
            q.eventType === 'r2_add_to_cart'
              ? {
                  data: [{ source_url: '/pieces/x-1.html' }],
                  count: 1200,
                  error: null,
                }
              : EMPTY,
        }),
      );
      const warn = jest.spyOn(
        (service as unknown as { logger: { warn: () => void } }).logger,
        'warn',
      );
      const m = byId(
        await service.computeLiveKpis('full', NOW),
        'pages_generating_atc',
      );
      expect(m.kpi).toMatchObject({ value: null, status: 'UNKNOWN' });
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('__seo_event_log (r2_add_to_cart) incomplète'),
      );
    });
  });

  describe('diagnostic_to_product', () => {
    it('relie diag_hub_view → r2_view par session, en lots de 100 sessions', async () => {
      const visits = Array.from({ length: 150 }, (_, i) => ({
        session_id: `s${i}`,
        created_at: '2026-09-10T10:00:00.000Z',
      }));
      const supabase = fakeDb({
        events: (q) => {
          if (q.gte !== SINCE) return EMPTY;
          if (q.eventType === 'diag_hub_view') return ok(visits);
          if (q.eventType !== 'r2_view') return EMPTY;
          return ok(
            (q.sessions ?? [])
              .filter((s) => s === 's1' || s === 's120' || s === 's7')
              .map((s) => ({
                session_id: s,
                // s7 voit le produit AVANT le diagnostic : ne compte pas
                created_at:
                  s === 's7'
                    ? '2026-09-10T09:00:00.000Z'
                    : '2026-09-10T10:05:00.000Z',
              })),
          );
        },
      });
      const measures = await makeService(supabase).computeLiveKpis('full', NOW);

      const lots = supabase.in.mock.calls.map(
        ([column, ids]) => [column, (ids as string[]).length] as const,
      );
      expect(lots).toEqual([
        ['payload->>session_id', 100],
        ['payload->>session_id', 50],
      ]);
      const m = byId(measures, 'diagnostic_to_product');
      expect(m.kpi).toMatchObject({ value: 2, unit: '/150', status: 'OK' });
      expect(m.previous_value).toBe(0);
    });

    it('un lot illisible → UNKNOWN pour toute la fenêtre', async () => {
      const m = byId(
        await makeService(
          fakeDb({
            events: (q) =>
              q.eventType === 'diag_hub_view'
                ? ok([{ session_id: 's1', created_at: SINCE }])
                : q.eventType === 'r2_view'
                  ? { data: null, count: null, error: { message: 'timeout' } }
                  : EMPTY,
          }),
        ).computeLiveKpis('full', NOW),
        'diagnostic_to_product',
      );
      expect(m.kpi).toMatchObject({ value: null, status: 'UNKNOWN' });
    });

    it('budget de lignes cumulé sur les lots, pas par lot', async () => {
      const visits = Array.from({ length: 150 }, (_, i) => ({
        session_id: `s${i}`,
        created_at: '2026-09-10T10:00:00.000Z',
      }));
      const limits: number[] = [];
      const service = makeService(
        fakeDb({
          events: (q) => {
            if (q.gte !== SINCE) return EMPTY;
            if (q.eventType === 'diag_hub_view') return ok(visits);
            if (q.eventType !== 'r2_view') return EMPTY;
            limits.push(q.limit as number);
            // 7 vues par session : 700 au 1er lot, 350 au 2e pour 300 restantes
            const rows = (q.sessions ?? []).flatMap((s) =>
              Array.from({ length: 7 }, () => ({
                session_id: s,
                created_at: '2026-09-10T10:05:00.000Z',
              })),
            );
            return {
              data: rows.slice(0, q.limit),
              count: rows.length,
              error: null,
            };
          },
        }),
      );
      const warn = jest.spyOn(
        (service as unknown as { logger: { warn: () => void } }).logger,
        'warn',
      );
      const m = byId(
        await service.computeLiveKpis('full', NOW),
        'diagnostic_to_product',
      );
      expect(limits).toEqual([1000, 300]);
      expect(m.kpi).toMatchObject({ value: null, status: 'UNKNOWN' });
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining(
          '__seo_event_log (r2_view) incomplète (300 lignes reçues sur 350)',
        ),
      );
    });

    it('identifiant hors format : écarté avec avertissement, jamais dans le filtre', async () => {
      const supabase = fakeDb({
        events: (q) =>
          q.gte === SINCE && q.eventType === 'diag_hub_view'
            ? ok([
                { session_id: 's1', created_at: '2026-09-10T10:00:00.000Z' },
                { session_id: 'x","y', created_at: '2026-09-10T10:00:00.000Z' },
              ])
            : EMPTY,
      });
      const service = makeService(supabase);
      const warn = jest.spyOn(
        (service as unknown as { logger: { warn: () => void } }).logger,
        'warn',
      );
      const m = byId(
        await service.computeLiveKpis('full', NOW),
        'diagnostic_to_product',
      );
      expect(supabase.in.mock.calls).toEqual([
        ['payload->>session_id', ['s1']],
      ]);
      expect(m.kpi).toMatchObject({ value: 0, unit: '/1' });
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('1 session(s) écartée(s)'),
      );
    });

    it('aucune visite du diagnostic → aucune lecture r2_view, 0 → CRITICAL', async () => {
      const supabase = fakeDb({});
      const m = byId(
        await makeService(supabase).computeLiveKpis('full', NOW),
        'diagnostic_to_product',
      );
      expect(supabase.in).not.toHaveBeenCalled();
      expect(m.kpi).toMatchObject({ value: 0, unit: '/0', status: 'CRITICAL' });
    });
  });
});

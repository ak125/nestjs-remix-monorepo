/**
 * CommandCenterKpiService — `payments_kept` (KPI primaire du département Ventes).
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
  CommandCenterKpiService,
  classifyOrderPayment,
  countPaymentsKept,
  toPaymentsKeptKpi,
  type OrderPaymentRow,
} from '../../src/modules/admin/services/command-center-kpi.service';

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
  data: OrderPaymentRow[] | null;
  count: number | null;
  error: { code?: string; message: string } | null;
};

/**
 * Chaîne supabase thenable : `await from().select().gte()[.lt()].limit()`.
 * Chaque lecture consomme le résultat suivant (fenêtre courante puis précédente) ;
 * le dernier est rejoué s'il en manque.
 */
function fakeSupabase(...results: ReadResult[]) {
  const chain: Record<string, jest.Mock | unknown> = {};
  for (const m of ['from', 'select', 'gte', 'lt', 'limit']) {
    chain[m] = jest.fn().mockReturnValue(chain);
  }
  let read = 0;
  chain.then = (resolve: (v: ReadResult) => unknown) =>
    resolve(results[Math.min(read++, results.length - 1)]);
  return chain as Record<'from' | 'select' | 'gte' | 'lt' | 'limit', jest.Mock>;
}

function makeService(supabase: ReturnType<typeof fakeSupabase>) {
  const service = new (CommandCenterKpiService as unknown as new (
    c: unknown,
  ) => CommandCenterKpiService)(mockConfigService);
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
    expect(supabase.lt).toHaveBeenCalledTimes(1);
    expect(supabase.lt).toHaveBeenCalledWith(
      'ord_date',
      '2026-09-04T12:00:00.000Z',
    );
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

/**
 * Tuiles /commercial/orders — complément n° 1 au mandat BN.
 *
 * Toute la base (lecture paginée au-delà de 1 000 lignes), par période,
 * impayées < 30 jours, abandonnées ≥ 30 jours, annulation = `ord_cancel_date`
 * (jamais le statut), montants au-delà du seuil exclus et relevés.
 */
import {
  ABANDONED_AFTER_DAYS,
  DEFAULT_IMPLAUSIBLE_TTC_EUR,
  type OrderStatsRow,
  computeOrderTiles,
  fetchAllOrderStatsRows,
  periodStart,
  resolveImplausibleThreshold,
} from '../../src/database/services/order-stats-tiles';
import { OrdersController } from '../../src/controllers/orders.controller';
import { OrdersService } from '../../src/database/services/orders.service';

const NOW = new Date('2026-11-17T12:00:00.000Z');

function row(
  ord_id: string,
  ord_date: string | null,
  ord_total_ttc: string | null,
  opts: { paid?: boolean; cancelled?: boolean } = {},
): OrderStatsRow {
  return {
    ord_id,
    ord_date,
    ord_total_ttc,
    ord_is_pay: opts.paid ? '1' : '0',
    ord_cancel_date: opts.cancelled ? '2026-11-16 10:00:00+00' : null,
  };
}

const ROWS: OrderStatsRow[] = [
  row('A', '2026-11-10T10:00:00.000Z', '100.00', { paid: true }),
  row('B', '2026-01-15T10:00:00.000Z', '200.00', { paid: true }),
  row('C', '2025-06-01T10:00:00.000Z', '300.00', { paid: true }),
  row('D', '2026-11-01T10:00:00.000Z', '50.00'),
  // 30 jours + 1 minute avant NOW → abandonnée
  row('E', '2026-10-18T11:59:00.000Z', '60.00'),
  // 30 jours − 1 minute avant NOW → encore impayée
  row('F', '2026-10-18T12:01:00.000Z', '70.00'),
  row('G', '2026-11-05T10:00:00.000Z', '80.00', { cancelled: true }),
  row('H', '2026-11-12T10:00:00.000Z', '90.00', {
    paid: true,
    cancelled: true,
  }),
  row('15114950', '2025-07-20T14:01:54.950Z', '99999999999999.99'),
  row('J', null, '10.00'),
  row('K', '2026-11-02T10:00:00.000Z', 'abc'),
];

describe('computeOrderTiles — toute la base', () => {
  const tiles = computeOrderTiles(ROWS, {
    now: NOW,
    period: 'all',
    implausibleThresholdTtc: DEFAULT_IMPLAUSIBLE_TTC_EUR,
  });

  it('compte le CA payé sur toutes les lignes, pas sur une page', () => {
    expect(tiles.rowsRead).toBe(ROWS.length);
    expect(tiles.paid).toEqual({
      orders: 4,
      revenue: 690,
      averageBasket: 172.5,
    });
    expect(tiles.monthRevenue).toBe(190);
  });

  it('impayées = non payées, non annulées, de moins de 30 jours', () => {
    expect(ABANDONED_AFTER_DAYS).toBe(30);
    expect(tiles.unpaid).toEqual({ orders: 2, amount: 120 });
  });

  it('abandonnées = non payées, non annulées, de 30 jours ou plus', () => {
    expect(tiles.abandoned).toEqual({ orders: 1, amount: 60, afterDays: 30 });
  });

  it("l'annulation vient de ord_cancel_date ; une payée annulée reste dans le CA et est relevée", () => {
    expect(tiles.cancelled).toEqual({
      orders: 2,
      paidOrders: 1,
      paidAmount: 90,
    });
  });

  it('ne lit pas le statut : un statut « annulée » sans ord_cancel_date ne change rien', () => {
    const withStatus = [
      { ...row('S', '2026-11-15T10:00:00.000Z', '40.00'), ord_ords_id: '2' },
    ] as unknown as OrderStatsRow[];
    const t = computeOrderTiles(withStatus, {
      now: NOW,
      period: 'all',
      implausibleThresholdTtc: DEFAULT_IMPLAUSIBLE_TTC_EUR,
    });
    expect(t.unpaid).toEqual({ orders: 1, amount: 40 });
    expect(t.cancelled.orders).toBe(0);
  });

  it('exclut et relève le montant aberrant et les lignes illisibles', () => {
    expect(tiles.excluded.thresholdTtc).toBe(10000);
    expect(tiles.excluded.orders).toEqual([
      {
        ordId: '15114950',
        ordDate: '2025-07-20T14:01:54.950Z',
        totalTtc: '99999999999999.99',
        isPaid: false,
        reason: 'amount_above_threshold',
      },
      {
        ordId: 'J',
        ordDate: null,
        totalTtc: '10.00',
        isPaid: false,
        reason: 'date_unreadable',
      },
      {
        ordId: 'K',
        ordDate: '2026-11-02T10:00:00.000Z',
        totalTtc: 'abc',
        isPaid: false,
        reason: 'amount_unreadable',
      },
    ]);
    // Sans exclusion, l'abandonné compterait 99 999 999 999 999,99 €.
    expect(tiles.abandoned.amount).toBeLessThan(1000);
  });

  it('un montant égal au seuil est conservé, au-delà il est exclu', () => {
    const t = computeOrderTiles(
      [
        row('X', '2026-11-10T10:00:00.000Z', '500.00', { paid: true }),
        row('Y', '2026-11-10T10:00:00.000Z', '500.01', { paid: true }),
      ],
      { now: NOW, period: 'all', implausibleThresholdTtc: 500 },
    );
    expect(t.paid.revenue).toBe(500);
    expect(t.excluded.orders.map((o) => o.ordId)).toEqual(['Y']);
  });
});

describe('computeOrderTiles — par période (Europe/Paris)', () => {
  it('mois : début au 1er à minuit, heure de Paris', () => {
    const t = computeOrderTiles(ROWS, {
      now: NOW,
      period: 'month',
      implausibleThresholdTtc: DEFAULT_IMPLAUSIBLE_TTC_EUR,
    });
    expect(t.periodStart).toBe('2026-10-31T23:00:00.000Z');
    expect(t.paid).toEqual({ orders: 2, revenue: 190, averageBasket: 95 });
    expect(t.unpaid).toEqual({ orders: 1, amount: 50 });
    expect(t.abandoned.orders).toBe(0);
    // 15114950 (2025) est hors période ; J et K restent relevés.
    expect(t.excluded.orders.map((o) => o.ordId)).toEqual(['J', 'K']);
  });

  it('année : du 1er janvier, heure de Paris', () => {
    const t = computeOrderTiles(ROWS, {
      now: NOW,
      period: 'year',
      implausibleThresholdTtc: DEFAULT_IMPLAUSIBLE_TTC_EUR,
    });
    expect(t.periodStart).toBe('2025-12-31T23:00:00.000Z');
    expect(t.paid.orders).toBe(3);
    expect(t.paid.revenue).toBe(390);
  });

  it('limite du mois : 00:30 à Paris le 1er compte, 23:30 la veille non', () => {
    const t = computeOrderTiles(
      [
        row('in', '2026-10-31T23:30:00.000Z', '10.00', { paid: true }),
        row('out', '2026-10-31T22:30:00.000Z', '20.00', { paid: true }),
      ],
      { now: NOW, period: 'month', implausibleThresholdTtc: 10000 },
    );
    expect(t.paid).toEqual({ orders: 1, revenue: 10, averageBasket: 10 });
  });

  it("heure d'été : le mois de juillet commence à 22:00 UTC la veille", () => {
    expect(
      periodStart('month', new Date('2026-07-15T12:00:00.000Z'))?.toISOString(),
    ).toBe('2026-06-30T22:00:00.000Z');
    expect(periodStart('all', NOW)).toBeNull();
  });
});

describe('resolveImplausibleThreshold', () => {
  it('absent → défaut documenté', () => {
    expect(resolveImplausibleThreshold(undefined)).toBe(10000);
    expect(resolveImplausibleThreshold('')).toBe(10000);
  });
  it('valeur lisible → appliquée', () => {
    expect(resolveImplausibleThreshold('5000')).toBe(5000);
  });
  it('valeur illisible ou ≤ 0 → erreur, pas de repli silencieux', () => {
    expect(() => resolveImplausibleThreshold('abc')).toThrow(
      'ORDERS_STATS_IMPLAUSIBLE_TTC_EUR',
    );
    expect(() => resolveImplausibleThreshold('0')).toThrow();
  });
});

describe('fetchAllOrderStatsRows — au-delà du plafond de 1 000 lignes', () => {
  const makeRows = (n: number) =>
    Array.from({ length: n }, (_, i) =>
      row(String(i), '2026-11-10T10:00:00.000Z', '1.00', { paid: true }),
    );

  it('lit toutes les pages', async () => {
    const all = makeRows(2005);
    const calls: Array<[number, number]> = [];
    const rows = await fetchAllOrderStatsRows(async (from, to) => {
      calls.push([from, to]);
      return { data: all.slice(from, to + 1), error: null };
    });
    expect(rows).toHaveLength(2005);
    expect(calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it('multiple exact de 1 000 : une page vide termine', async () => {
    const all = makeRows(1000);
    const rows = await fetchAllOrderStatsRows(async (from, to) => ({
      data: all.slice(from, to + 1),
      error: null,
    }));
    expect(rows).toHaveLength(1000);
  });

  it('une erreur sur une page fait échouer le tout (pas de total partiel)', async () => {
    const all = makeRows(1500);
    await expect(
      fetchAllOrderStatsRows(async (from, to) =>
        from === 0
          ? { data: all.slice(from, to + 1), error: null }
          : { data: null, error: new Error('timeout') },
      ),
    ).rejects.toThrow('timeout');
  });
});

describe('OrdersService.getOrdersStats — lecture paginée réelle du service', () => {
  function fakeSupabase(rows: OrderStatsRow[]) {
    const ranges: Array<[number, number]> = [];
    const eqs: Array<[string, unknown]> = [];
    const from = () => {
      let range: [number, number] = [0, 999];
      const builder: any = {
        select: () => builder,
        order: () => builder,
        range: (f: number, t: number) => {
          range = [f, t];
          ranges.push(range);
          return builder;
        },
        eq: (c: string, v: unknown) => {
          eqs.push([c, v]);
          return builder;
        },
        then: (res: any, rej: any) =>
          Promise.resolve({
            data: rows.slice(range[0], range[1] + 1),
            error: null,
          }).then(res, rej),
      };
      return builder;
    };
    return { client: { from }, ranges, eqs };
  }

  function makeService(rows: OrderStatsRow[], threshold?: string) {
    const fake = fakeSupabase(rows);
    const svc = Object.create(OrdersService.prototype);
    Object.assign(svc, {
      supabase: fake.client,
      configService: { get: () => threshold },
      logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
    });
    return { svc: svc as OrdersService, fake };
  }

  it('1 707 lignes (volume du 17/11) : tout est compté, rien n’est tronqué à 1 000', async () => {
    const rows = [
      ...Array.from({ length: 1706 }, (_, i) =>
        row(String(i), '2026-11-10T10:00:00.000Z', '2.00', {
          paid: i % 2 === 0,
        }),
      ),
      row('15114950', '2025-07-20T14:01:54.950Z', '99999999999999.99'),
    ];
    const { svc, fake } = makeService(rows);
    const stats = await svc.getOrdersStats(undefined, { now: NOW });
    expect(fake.ranges).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
    expect(stats.totalOrders).toBe(1707);
    expect(stats.paidOrders).toBe(853);
    expect(stats.totalRevenue).toBe(1706);
    expect(stats.tiles.paid.orders).toBe(853);
    expect(stats.tiles.unpaid).toEqual({ orders: 853, amount: 1706 });
    expect(stats.tiles.abandoned.amount).toBe(0);
    expect(stats.tiles.excluded.orders.map((o) => o.ordId)).toEqual([
      '15114950',
    ]);
  });

  it('seuil de configuration appliqué ; période transmise', async () => {
    const { svc } = makeService(ROWS, '150');
    const stats = await svc.getOrdersStats(undefined, {
      now: NOW,
      period: 'month',
    });
    expect(stats.tiles.period).toBe('month');
    expect(stats.tiles.excluded.thresholdTtc).toBe(150);
    // B (200) et C (300) dépassent 150 → exclus du total historique aussi
    expect(stats.totalRevenue).toBe(190);
  });

  it('filtre client conservé (userId)', async () => {
    const { svc, fake } = makeService(ROWS);
    await svc.getOrdersStats('42', { now: NOW });
    expect(fake.eqs).toEqual([['ord_cst_id', '42']]);
  });
});

describe('GET /api/legacy-orders/stats — paramètre period', () => {
  it('refuse une période inconnue en 400 sans lire la base', async () => {
    const getOrdersStats = jest.fn();
    const controller = new OrdersController({ getOrdersStats } as any);
    await expect(
      controller.getOrdersStats(undefined, 'week'),
    ).rejects.toMatchObject({ status: 400 });
    expect(getOrdersStats).not.toHaveBeenCalled();
  });

  it('transmet la période admise', async () => {
    const getOrdersStats = jest.fn().mockResolvedValue({ tiles: {} });
    const controller = new OrdersController({ getOrdersStats } as any);
    await controller.getOrdersStats(undefined, 'month');
    expect(getOrdersStats).toHaveBeenCalledWith(undefined, {
      period: 'month',
    });
  });
});

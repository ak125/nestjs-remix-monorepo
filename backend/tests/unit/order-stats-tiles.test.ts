/**
 * Tuiles /commercial/orders — complément n° 1 au mandat BN.
 *
 * Toute la base (lecture paginée au-delà de 1 000 lignes), par période,
 * impayées < 30 jours, abandonnées ≥ 30 jours, annulation = `ord_cancel_date`
 * ou statut 2 (trace de l'ancien site, réponse de Marwane du 18/11 00:27 ;
 * aucun autre statut n'est lu), montants au-delà du seuil exclus et relevés.
 * File « Payées non traitées depuis plus de 24 h » (complément du 18/11) :
 * données inventées.
 */
import {
  ABANDONED_AFTER_DAYS,
  DEFAULT_IMPLAUSIBLE_TTC_EUR,
  type OrderStatsRow,
  type OrderLineQueueRow,
  PAID_UNPROCESSED_AFTER_HOURS,
  computeOrderTiles,
  computePaidUnprocessed,
  fetchAllOrderStatsRows,
  periodStart,
  resolveImplausibleThreshold,
  selectPaidUnprocessedCandidates,
} from '../../src/database/services/order-stats-tiles';
import { fournisseurPose } from '../../src/modules/orders/services/order-line-supplier.service';
import { TABLES } from '@repo/database-types';
import { OrdersController } from '../../src/controllers/orders.controller';
import { OrdersService } from '../../src/database/services/orders.service';

const NOW = new Date('2026-11-17T12:00:00.000Z');

function row(
  ord_id: string,
  ord_date: string | null,
  ord_total_ttc: string | null,
  opts: {
    paid?: boolean;
    cancelled?: boolean;
    status?: string;
    paidAt?: string | null;
  } = {},
): OrderStatsRow {
  return {
    ord_id,
    ord_date,
    ord_total_ttc,
    ord_is_pay: opts.paid ? '1' : '0',
    ord_cancel_date: opts.cancelled ? '2026-11-16 10:00:00+00' : null,
    ord_ords_id: opts.status ?? null,
    ord_date_pay: opts.paidAt ?? null,
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
    // A + B + C ; H (payée puis annulée) n'est pas une vente.
    expect(tiles.paid).toEqual({
      orders: 3,
      revenue: 600,
      averageBasket: 200,
    });
    expect(tiles.monthRevenue).toBe(100);
  });

  it('impayées = non payées, non annulées, de moins de 30 jours', () => {
    expect(ABANDONED_AFTER_DAYS).toBe(30);
    expect(tiles.unpaid).toEqual({ orders: 2, amount: 120 });
  });

  it('abandonnées = non payées, non annulées, de 30 jours ou plus', () => {
    expect(tiles.abandoned).toEqual({ orders: 1, amount: 60, afterDays: 30 });
  });

  it("l'annulation vient de ord_cancel_date ; une payée puis annulée sort du CA et est chiffrée à part", () => {
    expect(tiles.cancelled).toEqual({
      orders: 2,
      paidOrders: 1,
      paidAmount: 90,
    });
    // Ni dans le CA, ni dans le panier, ni dans les impayées ou abandonnées.
    expect(tiles.paid.revenue).toBe(600);
    expect(tiles.unpaid.amount + tiles.abandoned.amount).toBe(180);
  });

  it('payée puis annulée ce mois : hors CA du mois, montant dans « Annulées »', () => {
    const t = computeOrderTiles(
      [
        row('V', '2026-11-03T10:00:00.000Z', '40.00', { paid: true }),
        row('W', '2026-11-04T10:00:00.000Z', '60.00', {
          paid: true,
          cancelled: true,
        }),
      ],
      { now: NOW, period: 'month', implausibleThresholdTtc: 1500 },
    );
    expect(t.paid).toEqual({ orders: 1, revenue: 40, averageBasket: 40 });
    expect(t.monthRevenue).toBe(40);
    expect(t.cancelled).toEqual({ orders: 1, paidOrders: 1, paidAmount: 60 });
  });

  it('statut 2 sans ord_cancel_date = annulée (ancien site) : une payée sort du CA', () => {
    const legacy: OrderStatsRow[] = [
      {
        ...row('L', '2021-03-10T10:00:00.000Z', '80.00', { paid: true }),
        ord_ords_id: '2',
      },
      { ...row('U', '2026-11-15T10:00:00.000Z', '40.00'), ord_ords_id: '2' },
      {
        ...row('P', '2021-03-11T10:00:00.000Z', '25.00', { paid: true }),
        ord_ords_id: '1',
      },
    ];
    const t = computeOrderTiles(legacy, {
      now: NOW,
      period: 'all',
      implausibleThresholdTtc: DEFAULT_IMPLAUSIBLE_TTC_EUR,
    });
    expect(t.paid).toEqual({ orders: 1, revenue: 25, averageBasket: 25 });
    expect(t.unpaid).toEqual({ orders: 0, amount: 0 });
    expect(t.cancelled).toEqual({ orders: 2, paidOrders: 1, paidAmount: 80 });
  });

  it('ne lit aucun autre statut : 3, 4, 5, 6 ou vide ne rendent pas une commande annulée', () => {
    const others: OrderStatsRow[] = ['3', '4', '5', '6', '', ' '].map(
      (st, i) => ({
        ...row(`O${i}`, '2026-11-15T10:00:00.000Z', '10.00', { paid: true }),
        ord_ords_id: st,
      }),
    );
    const t = computeOrderTiles(others, {
      now: NOW,
      period: 'all',
      implausibleThresholdTtc: DEFAULT_IMPLAUSIBLE_TTC_EUR,
    });
    expect(t.paid.orders).toBe(6);
    expect(t.cancelled.orders).toBe(0);
  });

  it('exclut et relève le montant aberrant et les lignes illisibles', () => {
    expect(tiles.excluded.thresholdTtc).toBe(1500);
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

  it('seuil par défaut (1 500 €) : la payée de 1 212,13 € est comptée ; une payée au-delà sort du CA mais reste signalée', () => {
    const t = computeOrderTiles(
      [
        row('P1', '2026-11-10T10:00:00.000Z', '1212.13', { paid: true }),
        row('P2', '2026-11-10T10:00:00.000Z', '1500.00', { paid: true }),
        row('P3', '2026-11-10T10:00:00.000Z', '1500.01', { paid: true }),
        row('U1', '2026-11-10T10:00:00.000Z', '1600.00'),
      ],
      {
        now: NOW,
        period: 'all',
        implausibleThresholdTtc: resolveImplausibleThreshold(undefined),
      },
    );
    expect(t.paid).toEqual({
      orders: 2,
      revenue: 2712.13,
      averageBasket: 1356.07,
    });
    expect(t.unpaid).toEqual({ orders: 0, amount: 0 });
    expect(t.excluded.thresholdTtc).toBe(1500);
    expect(t.excluded.orders).toEqual([
      {
        ordId: 'P3',
        ordDate: '2026-11-10T10:00:00.000Z',
        totalTtc: '1500.01',
        isPaid: true,
        reason: 'amount_above_threshold',
      },
      {
        ordId: 'U1',
        ordDate: '2026-11-10T10:00:00.000Z',
        totalTtc: '1600.00',
        isPaid: false,
        reason: 'amount_above_threshold',
      },
    ]);
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
    expect(t.paid).toEqual({ orders: 1, revenue: 100, averageBasket: 100 });
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
    expect(t.paid.orders).toBe(2);
    expect(t.paid.revenue).toBe(300);
  });

  it('limite du mois : 00:30 à Paris le 1er compte, 23:30 la veille non', () => {
    const t = computeOrderTiles(
      [
        row('in', '2026-10-31T23:30:00.000Z', '10.00', { paid: true }),
        row('out', '2026-10-31T22:30:00.000Z', '20.00', { paid: true }),
      ],
      { now: NOW, period: 'month', implausibleThresholdTtc: 1500 },
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
    expect(DEFAULT_IMPLAUSIBLE_TTC_EUR).toBe(1500);
    expect(resolveImplausibleThreshold(undefined)).toBe(1500);
    expect(resolveImplausibleThreshold('')).toBe(1500);
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
  function fakeSupabase(
    rows: OrderStatsRow[],
    lines: OrderLineQueueRow[] = [],
  ) {
    const ranges: Array<[number, number]> = [];
    const eqs: Array<[string, unknown]> = [];
    const lineReads: Array<{ ids: string[]; range: [number, number] }> = [];
    const from = (table: string) => {
      let range: [number, number] = [0, 999];
      let ids: string[] | null = null;
      const isLines = table === TABLES.xtr_order_line;
      const builder: any = {
        select: () => builder,
        order: () => builder,
        range: (f: number, t: number) => {
          range = [f, t];
          if (isLines) lineReads.push({ ids: ids ?? [], range });
          else ranges.push(range);
          return builder;
        },
        eq: (c: string, v: unknown) => {
          eqs.push([c, v]);
          return builder;
        },
        in: (c: string, v: string[]) => {
          expect(c).toBe('orl_ord_id');
          ids = v;
          return builder;
        },
        then: (res: any, rej: any) => {
          const source = isLines
            ? lines.filter((l) => (ids ?? []).includes(l.orl_ord_id))
            : rows;
          return Promise.resolve({
            data: source.slice(range[0], range[1] + 1),
            error: null,
          }).then(res, rej);
        },
      };
      return builder;
    };
    return { client: { from }, ranges, eqs, lineReads };
  }

  function makeService(
    rows: OrderStatsRow[],
    threshold?: string,
    lines: OrderLineQueueRow[] = [],
  ) {
    const fake = fakeSupabase(rows, lines);
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
    // B (200) et C (300) dépassent 150 → exclus du total historique aussi ;
    // H (payée puis annulée) n'est pas une vente.
    expect(stats.totalRevenue).toBe(100);
  });

  it('filtre client conservé (userId)', async () => {
    const { svc, fake } = makeService(ROWS);
    await svc.getOrdersStats('42', { now: NOW });
    expect(fake.eqs).toEqual([['ord_cst_id', '42']]);
  });

  it('file « payées non traitées » : lignes des seules candidates, par lots de 200', async () => {
    const rows = [
      ...Array.from({ length: 450 }, (_, i) =>
        row(
          `P${String(i).padStart(3, '0')}`,
          '2026-11-10T10:00:00.000Z',
          '2.00',
          {
            paid: true,
          },
        ),
      ),
      // Payée il y a 2 h : pas encore dans la file, ses lignes ne sont pas lues.
      row('RECENTE', '2026-11-17T10:00:00.000Z', '5.00', { paid: true }),
      row('NONPAYEE', '2026-11-10T10:00:00.000Z', '5.00'),
    ];
    const lines: OrderLineQueueRow[] = [
      {
        orl_id: 'P000-L1',
        orl_ord_id: 'P000',
        orl_orls_id: '6',
        orl_spl_id: '12',
      },
      {
        orl_id: 'P001-L1',
        orl_ord_id: 'P001',
        orl_orls_id: '5',
        orl_spl_id: '12',
      },
    ];
    const { svc, fake } = makeService(rows, undefined, lines);
    const stats = await svc.getOrdersStats(undefined, { now: NOW });
    expect(fake.lineReads.map((r) => r.ids.length)).toEqual([200, 200, 50]);
    expect(fake.lineReads.flatMap((r) => r.ids)).not.toContain('RECENTE');
    expect(fake.lineReads.flatMap((r) => r.ids)).not.toContain('NONPAYEE');
    const q = stats.tiles.paidUnprocessed;
    expect(q.captureStateRead).toBe(false);
    // P000 traitée (fournisseur posé + commandée) ; les 449 autres restent.
    expect(q.orders).toBe(449);
    expect(q.list.find((o) => o.ordId === 'P001')?.reason).toBe(
      'supplier_order_missing',
    );
    expect(q.list.find((o) => o.ordId === 'P002')?.reason).toBe(
      'no_active_line',
    );
  });

  it('une erreur de lecture des lignes fait échouer le calcul entier', async () => {
    const { svc } = makeService([
      row('P', '2026-11-10T10:00:00.000Z', '2.00', { paid: true }),
    ]);
    const client = (svc as any).supabase;
    const from = client.from;
    client.from = (table: string) => {
      const b = from(table);
      if (table !== TABLES.xtr_order_line) return b;
      b.then = (res: any, rej: any) =>
        Promise.resolve({ data: null, error: new Error('lignes') }).then(
          res,
          rej,
        );
      return b;
    };
    await expect(svc.getOrdersStats(undefined, { now: NOW })).rejects.toThrow(
      'lignes',
    );
  });
});

describe('File « Payées non traitées depuis plus de 24 h »', () => {
  const line = (
    ordId: string,
    n: number,
    status: string | null,
    spl: string | null,
  ): OrderLineQueueRow => ({
    orl_id: `${ordId}-L${n}`,
    orl_ord_id: ordId,
    orl_orls_id: status,
    orl_spl_id: spl,
  });
  const compute = (
    rows: OrderStatsRow[],
    lines: OrderLineQueueRow[],
    opts: Partial<Parameters<typeof selectPaidUnprocessedCandidates>[1]> = {},
  ) =>
    computePaidUnprocessed(
      selectPaidUnprocessedCandidates(rows, {
        now: NOW,
        period: 'all',
        ...opts,
      }),
      lines,
      {
        now: NOW,
        captureStateRead: Boolean(opts.captureStates),
        supplierSet: fournisseurPose,
      },
    );

  it('seuil de 24 h compté depuis le paiement, à la minute près', () => {
    const q = compute(
      [
        row('AVANT', '2026-11-16T11:00:00.000Z', '10.00', {
          paid: true,
          paidAt: '2026-11-16T11:59:00.000Z',
        }),
        row('APRES', '2026-11-16T11:00:00.000Z', '10.00', {
          paid: true,
          paidAt: '2026-11-16T12:01:00.000Z',
        }),
      ],
      [],
    );
    expect(PAID_UNPROCESSED_AFTER_HOURS).toBe(24);
    expect(q.list.map((o) => o.ordId)).toEqual(['AVANT']);
    expect(q.list[0]).toMatchObject({
      paidAt: '2026-11-16T11:59:00.000Z',
      paidAtSource: 'ord_date_pay',
      ageDays: 1,
    });
  });

  it('exclut non payées, annulées (date ou statut 2) et paiement annulé ou remboursé', () => {
    const rows = [
      row('NP', '2026-11-01T10:00:00.000Z', '10.00'),
      row('AD', '2026-11-01T10:00:00.000Z', '10.00', {
        paid: true,
        cancelled: true,
      }),
      row('S2', '2026-11-01T10:00:00.000Z', '10.00', {
        paid: true,
        status: '2',
      }),
      row('ANN', '2026-11-01T10:00:00.000Z', '10.00', { paid: true }),
      row('REM', '2026-11-01T10:00:00.000Z', '10.00', { paid: true }),
      row('AUT', '2026-11-01T10:00:00.000Z', '10.00', { paid: true }),
      row('CAP', '2026-11-01T10:00:00.000Z', '10.00', { paid: true }),
    ];
    const captureStates = new Map([
      ['ANN', 'cancelled'],
      ['REM', 'refunded'],
      ['AUT', 'authorized'],
      ['CAP', 'captured'],
    ] as const);
    const q = compute(rows, [], { captureStates });
    expect(q.list.map((o) => o.ordId)).toEqual(['AUT', 'CAP']);
    expect(q.captureStateRead).toBe(true);
  });

  it('traitée seulement si chaque ligne active a un fournisseur posé ET est commandée (statut 6)', () => {
    const rows = [
      'OK',
      'SANSFRS',
      'ZERO',
      'NONCMD',
      'VIDE',
      'TOUTEANN',
      'MIXTE',
    ].map((id) => row(id, '2026-11-01T10:00:00.000Z', '10.00', { paid: true }));
    const lines = [
      line('OK', 1, '6', '12'),
      line('OK', 2, '2', null), // ligne annulée : ignorée
      line('SANSFRS', 1, '6', '12'),
      line('SANSFRS', 2, '1', null),
      line('ZERO', 1, '6', '0'), // '0' = aucun fournisseur (ancien site)
      line('NONCMD', 1, '5', '12'),
      line('TOUTEANN', 1, '2', '12'),
      line('MIXTE', 1, '6', ' 7 '),
      line('MIXTE', 2, '4', '7'),
    ];
    const q = compute(rows, lines);
    const reasons = Object.fromEntries(q.list.map((o) => [o.ordId, o.reason]));
    expect(reasons).toEqual({
      SANSFRS: 'supplier_missing',
      ZERO: 'supplier_missing',
      NONCMD: 'supplier_order_missing',
      VIDE: 'no_active_line',
      TOUTEANN: 'no_active_line',
      MIXTE: 'supplier_order_missing',
    });
    expect(q.list.find((o) => o.ordId === 'SANSFRS')).toMatchObject({
      linesActive: 2,
      linesWithSupplier: 1,
      linesOrderedFromSupplier: 1,
    });
  });

  it('triée de la plus ancienne à la plus récente, âge en jours entiers', () => {
    const q = compute(
      [
        row('R', '2026-11-15T09:00:00.000Z', '10.00', {
          paid: true,
          paidAt: '2026-11-15T09:05:00.000Z',
        }),
        // Cas réel inventé à l'identique : payée le 7, rien sur la ligne.
        row('ORD-X-186', '2026-11-07T14:42:18.587Z', '42.20', {
          paid: true,
          paidAt: '2026-11-07T14:47:02.847Z',
        }),
        row('M', '2026-11-10T09:00:00.000Z', '10.00', { paid: true }),
      ],
      [line('ORD-X-186', 1, null, null)],
    );
    expect(q.list.map((o) => [o.ordId, o.ageDays])).toEqual([
      ['ORD-X-186', 9],
      ['M', 7],
      ['R', 2],
    ]);
    expect(q.orders).toBe(3);
    expect(q.list[0].reason).toBe('supplier_missing');
  });

  it('date de paiement illisible ou antérieure à la commande : âge compté depuis la commande', () => {
    const q = compute(
      [
        row('AN2000', '2026-11-10T10:00:00.000Z', '10.00', {
          paid: true,
          paidAt: '2000-01-01T00:00:00.000Z',
        }),
        row('ILL', '2026-11-11T10:00:00.000Z', '10.00', {
          paid: true,
          paidAt: 'n/a',
        }),
      ],
      [],
    );
    expect(q.list.map((o) => [o.ordId, o.paidAtSource, o.paidAt])).toEqual([
      ['AN2000', 'ord_date', '2026-11-10T10:00:00.000Z'],
      ['ILL', 'ord_date', '2026-11-11T10:00:00.000Z'],
    ]);
  });

  it('suit la période des tuiles (date de commande, Europe/Paris)', () => {
    const rows = [
      row('2025', '2025-12-31T22:59:00.000Z', '10.00', { paid: true }),
      row('2026', '2026-01-02T10:00:00.000Z', '10.00', { paid: true }),
      row('NOV', '2026-11-03T10:00:00.000Z', '10.00', { paid: true }),
    ];
    expect(
      compute(rows, [], { period: 'year' }).list.map((o) => o.ordId),
    ).toEqual(['2026', 'NOV']);
    expect(
      compute(rows, [], { period: 'month' }).list.map((o) => o.ordId),
    ).toEqual(['NOV']);
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

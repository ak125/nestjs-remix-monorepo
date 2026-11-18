/**
 * Mandat BM — OrderBillingService : ajustements, état d'encaissement saisi,
 * facture à l'expédition une fois l'encaissement confirmé.
 *
 * Verrouille :
 * - drapeau ORDER_BILLING_ENABLED absent ⇒ aucune lecture ni écriture, 403 ;
 *   l'écouteur d'expédition ne fait rien ;
 * - moins cher : réduction enregistrée avec motif, montant à encaisser rendu ;
 *   refusée après encaissement, après facture, ou si elle vide la commande ;
 * - plus cher : commande enfant + ajustement + mail (motif et lien) ;
 *   pas de mail si l'ajustement n'est pas enregistré ;
 * - facture : jamais sans expédition, sans encaissement confirmé au montant
 *   attendu, avec un supplément non payé ou non encaissé ; sinon numéro par
 *   la RPC atomique et mail avec le PDF joint ;
 * - PDF client : 404 si la facture n'est pas celle du client.
 */
import 'reflect-metadata';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { TABLES } from '@repo/database-types';
import { OrderBillingService } from '../../src/modules/orders/services/order-billing.service';

const ORDER_ID = 'ORD-1';
const CHILD_ID = 'ORD-2';

type Row = Record<string, unknown>;
type Op = { method: string; args: unknown[] };

interface World {
  orders: Row[];
  lines: Row[];
  adjustments: Row[];
  captures: Row[];
  invoices: Row[];
  invoiceLines: Row[];
  customers: Row[];
  failInsert?: string;
}

function world(overrides: Partial<World> = {}): World {
  return {
    orders: [
      {
        ord_id: ORDER_ID,
        ord_cst_id: '81500',
        ord_cba_id: '10',
        ord_cda_id: '11',
        ord_is_pay: '1',
        ord_date_pay: '2026-11-10T09:05:00Z',
        ord_date: '2026-11-10T09:00:00Z',
        ord_date_ship: '2026-11-17T17:00:00Z',
        ord_ords_id: '4',
        ord_parent: null,
        ord_amount_ttc: '100.00',
        ord_deposit_ttc: '0.00',
        ord_shipping_fee_ttc: '9.90',
        ord_total_ttc: '109.90',
        ord_billing_snapshot: {
          firstName: 'Léa',
          lastName: 'Dupont',
          address: '1 rue X',
          zipCode: '75001',
          city: 'Paris',
          country: 'France',
        },
      },
    ],
    lines: [
      {
        orl_id: 'ORD-1-L001',
        orl_ord_id: ORDER_ID,
        orl_pg_name: 'Plaquettes',
        orl_art_quantity: '1',
        orl_art_price_sell_unit_ttc: '100.00',
        orl_art_price_sell_ttc: '100.00',
      },
    ],
    adjustments: [],
    captures: [],
    invoices: [],
    invoiceLines: [],
    customers: [
      {
        cst_id: '81500',
        cst_mail: 'c@example.test',
        cst_fname: 'Léa',
        cst_name: 'Dupont',
      },
    ],
    ...overrides,
  };
}

/** Faux Supabase sur un petit monde en mémoire ; filtre les `eq`. */
function fakeDb(w: World) {
  const writes: Array<{ table: string; method: string; row: Row }> = [];
  const tables: Record<string, Row[]> = {
    [TABLES.xtr_order]: w.orders,
    [TABLES.xtr_order_line]: w.lines,
    __order_payment_adjustment: w.adjustments,
    __order_capture_state: w.captures,
    [TABLES.xtr_invoice]: w.invoices,
    [TABLES.xtr_invoice_line]: w.invoiceLines,
    [TABLES.xtr_customer]: w.customers,
  };
  const from = jest.fn((table: string) => {
    const ops: Op[] = [];
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'in', 'order', 'is']) {
      chain[m] = (...args: unknown[]) => {
        ops.push({ method: m, args });
        return chain;
      };
    }
    const write = (method: string) => (row: Row) => {
      if (w.failInsert === table) {
        return Promise.resolve({ data: null, error: { message: 'refusé' } });
      }
      writes.push({ table, method, row });
      return Promise.resolve({ data: null, error: null });
    };
    chain.insert = write('insert');
    chain.upsert = write('upsert');
    const rows = () =>
      (tables[table] ?? []).filter((r) =>
        ops.every((o) =>
          o.method === 'eq'
            ? String(r[o.args[0] as string]) === String(o.args[1])
            : o.method === 'in'
              ? (o.args[1] as unknown[])
                  .map(String)
                  .includes(String(r[o.args[0] as string]))
              : true,
        ),
      );
    chain.maybeSingle = () =>
      Promise.resolve({ data: rows()[0] ?? null, error: null });
    chain.then = (f: (v: unknown) => unknown, r?: (e: unknown) => unknown) =>
      Promise.resolve({ data: rows(), error: null }).then(f, r);
    return chain;
  });
  return { client: { from }, writes, from };
}

function makeService(w: World, enabled = true) {
  const config = {
    get: (k: string) =>
      k === 'ORDER_BILLING_ENABLED' && enabled ? 'true' : undefined,
  };
  const ordersService = {
    createReasonedSupplementOrder: jest.fn().mockResolvedValue({
      orderId: CHILD_ID,
      totalTtc: 12.5,
      paymentUrl: 'https://dev.example.test/api/paybox/redirect?orderId=ORD-2',
    }),
  };
  const mail = {
    sendSupplementPaymentRequest: jest.fn().mockResolvedValue('test-transport'),
    sendInvoice: jest.fn().mockResolvedValue('test-transport'),
  };
  const service = new OrderBillingService(
    config as never,
    ordersService as never,
    mail as never,
  );
  const db = fakeDb(w);
  Object.defineProperty(service, 'supabase', {
    value: db.client,
    configurable: true,
  });
  const callRpc = jest.fn(async () => {
    w.invoices.push({
      inv_id: 'F2026-000001',
      inv_ord_id: ORDER_ID,
      inv_cst_id: '81500',
      inv_date: '2026-11-17 18:00:00',
      inv_total_ttc: '109.90',
    });
    return { data: 'F2026-000001', error: null };
  });
  Object.defineProperty(service, 'callRpc', {
    value: callRpc,
    configurable: true,
  });
  return { service, db, callRpc, mail, ordersService };
}

const captured = (cents: number, ord = ORDER_ID) => ({
  ocs_ord_id: ord,
  ocs_state: 'captured',
  ocs_captured_amount_cents: cents,
  ocs_source: 'manual',
});

describe('OrderBillingService (mandat BM)', () => {
  beforeAll(() => {
    process.env.SUPABASE_URL ||= 'http://localhost:54321';
    process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key';
  });

  describe('drapeau ORDER_BILLING_ENABLED désactivé', () => {
    it.each([
      ['getBilling', (s: OrderBillingService) => s.getBilling(ORDER_ID)],
      [
        'recordReduction',
        (s: OrderBillingService) =>
          s.recordReduction(ORDER_ID, { amountTtcCents: 100, reason: 'abc' }),
      ],
      [
        'requestSupplement',
        (s: OrderBillingService) =>
          s.requestSupplement(ORDER_ID, { amountTtcCents: 100, reason: 'abc' }),
      ],
      [
        'recordCaptureState',
        (s: OrderBillingService) =>
          s.recordCaptureState(ORDER_ID, { state: 'authorized' }),
      ],
      [
        'tryIssueInvoice',
        (s: OrderBillingService) => s.tryIssueInvoice(ORDER_ID),
      ],
      ['renderPdf', (s: OrderBillingService) => s.renderPdf(ORDER_ID)],
    ])('%s : 403 sans toucher la base', async (_n, call) => {
      const { service, db } = makeService(world(), false);
      await expect(call(service)).rejects.toBeInstanceOf(ForbiddenException);
      expect(db.from).not.toHaveBeenCalled();
    });

    it("l'expédition n'émet rien", async () => {
      const { service, db, callRpc } = makeService(world(), false);
      await service.onOrderShipped({ orderId: ORDER_ID } as never);
      expect(db.from).not.toHaveBeenCalled();
      expect(callRpc).not.toHaveBeenCalled();
    });
  });

  describe('réduction (moins cher)', () => {
    const notShipped = () =>
      world({
        orders: [
          { ...world().orders[0], ord_date_ship: null, ord_ords_id: '3' },
        ],
      });

    it('enregistre motif et montant, rend le montant à encaisser', async () => {
      const { service, db } = makeService(notShipped());
      const res = await service.recordReduction(
        ORDER_ID,
        { amountTtcCents: 1500, reason: 'Pièce moins chère' },
        '7',
      );
      expect(res).toEqual({
        orderId: ORDER_ID,
        reductionTtc: '15.00',
        amountToCaptureTtc: '94.90',
      });
      expect(db.writes).toEqual([
        {
          table: '__order_payment_adjustment',
          method: 'insert',
          row: {
            opa_ord_id: ORDER_ID,
            opa_kind: 'reduction',
            opa_amount_ttc_cents: 1500,
            opa_reason: 'Pièce moins chère',
            opa_supplement_ord_id: null,
            opa_created_by: '7',
          },
        },
      ]);
    });

    it.each([
      ['déjà encaissée', { captures: [captured(10990)] }],
      [
        'facture émise',
        { invoices: [{ inv_id: 'F2026-000001', inv_ord_id: ORDER_ID }] },
      ],
    ])('refusée si %s', async (_l, extra) => {
      const { service, db } = makeService({ ...notShipped(), ...extra });
      await expect(
        service.recordReduction(ORDER_ID, {
          amountTtcCents: 100,
          reason: 'abc',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(db.writes).toHaveLength(0);
    });

    it('refusée si elle vide la commande (annuler plutôt)', async () => {
      const { service, db } = makeService(notShipped());
      await expect(
        service.recordReduction(ORDER_ID, {
          amountTtcCents: 10990,
          reason: 'abc',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(db.writes).toHaveLength(0);
    });

    it('refusée sur une commande non payée', async () => {
      const w = notShipped();
      w.orders[0].ord_is_pay = '0';
      const { service } = makeService(w);
      await expect(
        service.recordReduction(ORDER_ID, {
          amountTtcCents: 100,
          reason: 'abc',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('supplément (plus cher)', () => {
    it('commande enfant, ajustement lié, mail avec motif et lien', async () => {
      const { service, db, mail, ordersService } = makeService(world());
      const res = await service.requestSupplement(
        ORDER_ID,
        { amountTtcCents: 1250, reason: 'Référence plus chère' },
        '7',
      );
      expect(ordersService.createReasonedSupplementOrder).toHaveBeenCalledWith(
        ORDER_ID,
        { amountTtcCents: 1250, reason: 'Référence plus chère' },
        { userId: '7' },
      );
      expect(db.writes[0].row).toMatchObject({
        opa_kind: 'supplement',
        opa_amount_ttc_cents: 1250,
        opa_supplement_ord_id: CHILD_ID,
        opa_reason: 'Référence plus chère',
      });
      expect(mail.sendSupplementPaymentRequest).toHaveBeenCalledWith(
        { cst_mail: 'c@example.test', cst_fname: 'Léa', cst_name: 'Dupont' },
        expect.objectContaining({
          parentOrderId: ORDER_ID,
          supplementOrderId: CHILD_ID,
          amountTtc: '12.50',
          reason: 'Référence plus chère',
          paymentUrl: expect.stringContaining('/api/paybox/redirect?'),
        }),
      );
      expect(res.mail).toBe('test-transport');
    });

    it("pas de mail si l'ajustement n'est pas enregistré", async () => {
      const { service, mail } = makeService({
        ...world(),
        failInsert: '__order_payment_adjustment',
      });
      await expect(
        service.requestSupplement(ORDER_ID, {
          amountTtcCents: 1250,
          reason: 'abc',
        }),
      ).rejects.toThrow(/aucun mail envoyé/);
      expect(mail.sendSupplementPaymentRequest).not.toHaveBeenCalled();
    });
  });

  describe('encaissement saisi et facture', () => {
    it('saisie « captured » au bon montant sur commande expédiée ⇒ facture et mail avec PDF', async () => {
      const w = world();
      const { service, db, callRpc, mail } = makeService(w);
      // L'upsert du faux client n'alimente pas le monde : on le reflète.
      db.client.from.mockClear();
      const res = await (async () => {
        w.captures.push(captured(10990));
        return service.recordCaptureState(
          ORDER_ID,
          { state: 'captured', capturedAmountCents: 10990 },
          '7',
        );
      })();
      expect(db.writes[0]).toMatchObject({
        table: '__order_capture_state',
        method: 'upsert',
        row: {
          ocs_state: 'captured',
          ocs_captured_amount_cents: 10990,
          ocs_source: 'manual',
        },
      });
      expect(res.invoice).toEqual({
        issued: true,
        invoiceNumber: 'F2026-000001',
        mail: 'test-transport',
      });
      expect(callRpc).toHaveBeenCalledTimes(1);
      const [rpc, params, ctx] = callRpc.mock.calls[0] as unknown as [
        string,
        { p_invoice: Row; p_lines: Row[] },
        Row,
      ];
      expect(rpc).toBe('issue_order_invoice_atomic');
      expect(ctx).toEqual({ isServiceRole: true, source: 'internal' });
      expect(params.p_invoice).toMatchObject({
        inv_ord_id: ORDER_ID,
        inv_total_ttc: '109.90',
      });
      expect(params.p_lines).toHaveLength(1);
      const [, data, pdf] = mail.sendInvoice.mock.calls[0];
      expect(data).toEqual({
        orderId: ORDER_ID,
        invoiceNumber: 'F2026-000001',
        totalTtc: '109.90',
      });
      expect((pdf as Buffer).subarray(0, 8).toString('latin1')).toBe(
        '%PDF-1.4',
      );
    });

    it.each<[string, (w: World) => void, RegExp]>([
      [
        'non expédiée',
        (w) => {
          w.orders[0].ord_date_ship = null;
          w.captures.push(captured(10990));
        },
        /non expédiée/,
      ],
      [
        'encaissement non confirmé',
        () => undefined,
        /encaissement non confirmé/,
      ],
      [
        'écart de montant',
        (w) => {
          w.captures.push(captured(10000));
        },
        /écart d'encaissement/,
      ],
      [
        'déjà facturée',
        (w) => {
          w.captures.push(captured(10990));
          w.invoices.push({ inv_id: 'F2026-000009', inv_ord_id: ORDER_ID });
        },
        /déjà émise/,
      ],
      [
        'supplément non payé',
        (w) => {
          w.captures.push(captured(10990));
          w.orders.push({
            ...w.orders[0],
            ord_id: CHILD_ID,
            ord_parent: ORDER_ID,
            ord_is_pay: '0',
            ord_ords_id: '1',
          });
        },
        /supplément ORD-2 non payé/,
      ],
      [
        'supplément payé non encaissé',
        (w) => {
          w.captures.push(captured(10990));
          w.orders.push({
            ...w.orders[0],
            ord_id: CHILD_ID,
            ord_parent: ORDER_ID,
            ord_total_ttc: '12.50',
          });
        },
        /supplément ORD-2 non encaissé/,
      ],
      [
        'montants de la commande ≠ lignes',
        (w) => {
          w.captures.push(captured(10990));
          w.lines[0].orl_art_price_sell_ttc = '90.00';
        },
        /différents de ses lignes/,
      ],
    ])('pas de facture : %s', async (_l, setup, reason) => {
      const w = world();
      setup(w);
      const { service, callRpc, mail } = makeService(w);
      const out = await service.tryIssueInvoice(ORDER_ID);
      expect(out.issued).toBe(false);
      expect((out as { reason: string }).reason).toMatch(reason);
      expect(callRpc).not.toHaveBeenCalled();
      expect(mail.sendInvoice).not.toHaveBeenCalled();
    });

    it('supplément annulé ignoré ; supplément payé et encaissé facturé avec son motif', async () => {
      const w = world({
        adjustments: [
          {
            opa_ord_id: ORDER_ID,
            opa_kind: 'supplement',
            opa_amount_ttc_cents: 1250,
            opa_reason: 'Référence plus chère',
            opa_supplement_ord_id: CHILD_ID,
          },
        ],
      });
      w.captures.push(captured(10990), captured(1250, CHILD_ID));
      w.orders.push(
        {
          ...w.orders[0],
          ord_id: 'ORD-3',
          ord_parent: ORDER_ID,
          ord_ords_id: '2',
          ord_is_pay: '0',
        },
        {
          ...w.orders[0],
          ord_id: CHILD_ID,
          ord_parent: ORDER_ID,
          ord_amount_ttc: '12.50',
          ord_shipping_fee_ttc: '0.00',
          ord_total_ttc: '12.50',
        },
      );
      w.lines.push({
        orl_id: 'ORD-2-L001',
        orl_ord_id: CHILD_ID,
        orl_pg_name: 'Supplément : Référence plus chère',
        orl_art_quantity: '1',
        orl_art_price_sell_unit_ttc: '12.50',
        orl_art_price_sell_ttc: '12.50',
      });
      const { service, callRpc } = makeService(w);
      const out = await service.tryIssueInvoice(ORDER_ID);
      expect(out.issued).toBe(true);
      const { p_invoice, p_lines } = (
        callRpc.mock.calls[0] as unknown as [
          string,
          { p_invoice: Row; p_lines: Row[] },
        ]
      )[1];
      expect(p_invoice.inv_total_ttc).toBe('122.40');
      expect(p_lines[1].invl_pg_name).toBe(
        'Supplément (commande ORD-2) : Référence plus chère',
      );
    });

    it("encaissement du supplément ⇒ tentative de facture sur la commande d'origine", async () => {
      const w = world();
      w.orders.push({
        ...w.orders[0],
        ord_id: CHILD_ID,
        ord_parent: ORDER_ID,
        ord_total_ttc: '12.50',
      });
      const { service } = makeService(w);
      const spy = jest.spyOn(service, 'tryIssueInvoice');
      await service.recordCaptureState(CHILD_ID, {
        state: 'captured',
        capturedAmountCents: 1250,
      });
      expect(spy).toHaveBeenCalledWith(ORDER_ID);
    });

    it('mail en échec : facture émise quand même, échec rendu', async () => {
      const w = world();
      w.captures.push(captured(10990));
      const { service, mail } = makeService(w);
      mail.sendInvoice.mockRejectedValueOnce(new Error('smtp'));
      await expect(service.tryIssueInvoice(ORDER_ID)).resolves.toEqual({
        issued: true,
        invoiceNumber: 'F2026-000001',
        mail: 'failed',
      });
    });

    it('expédition ⇒ tentative de facture, sans jeter si elle attend', async () => {
      const { service, callRpc } = makeService(world());
      await expect(
        service.onOrderShipped({ orderId: ORDER_ID } as never),
      ).resolves.toBeUndefined();
      expect(callRpc).not.toHaveBeenCalled();
    });
  });

  // Complément BM n° 2 (2026-11-18) : paiement annulé ou remboursé dans
  // Paybox ⇒ marque « ne pas expédier », aucune facture, aucun mail.
  describe('paiement annulé ou remboursé', () => {
    const voided = (state: string, ord = ORDER_ID) => ({
      ocs_ord_id: ord,
      ocs_state: state,
      ocs_captured_amount_cents: null,
      ocs_source: 'manual',
      ocs_checked_at: '2026-11-18T12:33:00Z',
    });

    it.each([
      ['cancelled', 'Paiement annulé'],
      ['refunded', 'Remboursée — ne pas expédier'],
    ])(
      '%s : marque rendue, facture refusée avec ce motif, aucun mail',
      async (state, label) => {
        const w = world();
        w.captures.push(voided(state));
        const { service, callRpc, mail } = makeService(w);
        await expect(service.paymentVoid(ORDER_ID)).resolves.toEqual({
          enabled: true,
          paymentVoid: {
            state,
            label,
            checkedAt: '2026-11-18T12:33:00Z',
            source: 'manual',
          },
        });
        await expect(service.tryIssueInvoice(ORDER_ID)).resolves.toEqual({
          issued: false,
          reason: label,
        });
        expect((await service.getBilling(ORDER_ID)).paymentVoid?.label).toBe(
          label,
        );
        expect(callRpc).not.toHaveBeenCalled();
        expect(mail.sendInvoice).not.toHaveBeenCalled();
      },
    );

    it('saisie « cancelled » : enregistrée, aucun mail au client', async () => {
      const { service, db, mail } = makeService(world());
      const res = await service.recordCaptureState(ORDER_ID, {
        state: 'cancelled',
      });
      expect(res.invoice).toEqual({
        issued: false,
        reason: 'encaissement non confirmé',
      });
      expect(db.writes).toEqual([
        expect.objectContaining({
          table: '__order_capture_state',
          method: 'upsert',
        }),
      ]);
      expect(mail.sendInvoice).not.toHaveBeenCalled();
      expect(mail.sendSupplementPaymentRequest).not.toHaveBeenCalled();
    });

    it('autorisé ou encaissé : aucune marque', async () => {
      const w = world();
      w.captures.push(captured(10990));
      const { service } = makeService(w);
      await expect(service.paymentVoid(ORDER_ID)).resolves.toEqual({
        enabled: true,
        paymentVoid: null,
      });
    });

    it('liste : seules les commandes de la page annulées ou remboursées', async () => {
      const w = world();
      w.captures.push(
        voided('cancelled', 'ORD-A'),
        voided('refunded', 'ORD-B'),
        captured(1000, 'ORD-C'),
        voided('cancelled', 'ORD-HORS-PAGE'),
      );
      const { service } = makeService(w);
      const res = await service.listPaymentVoids(['ORD-A', 'ORD-B', 'ORD-C']);
      expect(res.enabled).toBe(true);
      expect(res.voids.map((v) => [v.orderId, v.label])).toEqual([
        ['ORD-A', 'Paiement annulé'],
        ['ORD-B', 'Remboursée — ne pas expédier'],
      ]);
    });

    it('drapeau absent : enabled false, la table n’est pas lue', async () => {
      const w = world();
      w.captures.push(voided('cancelled'));
      const { service, db } = makeService(w, false);
      await expect(service.paymentVoid(ORDER_ID)).resolves.toEqual({
        enabled: false,
        paymentVoid: null,
      });
      await expect(service.listPaymentVoids([ORDER_ID])).resolves.toEqual({
        enabled: false,
        voids: [],
      });
      expect(db.from).not.toHaveBeenCalled();
    });

    it('erreur de lecture : levée, jamais « aucune marque »', async () => {
      const { service, db } = makeService(world());
      db.from.mockImplementationOnce(() => ({
        select: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({ data: null, error: { message: 'absente' } }),
          }),
        }),
      }));
      await expect(service.paymentVoid(ORDER_ID)).rejects.toThrow(
        "Lecture de l'état d'encaissement impossible",
      );
    });
  });

  describe('PDF', () => {
    const withInvoice = () =>
      world({
        invoices: [
          {
            inv_id: 'F2026-000001',
            inv_ord_id: ORDER_ID,
            inv_cst_id: '81500',
            inv_date: '2026-11-17 18:00:00',
            inv_total_ttc: '109.90',
            inv_info: 'Aucun ajustement',
          },
        ],
        invoiceLines: [
          {
            invl_id: 'F2026-000001-L001',
            invl_inv_id: 'F2026-000001',
            invl_pg_name: 'Plaquettes',
            invl_art_quantity: '1',
            invl_art_price_sell_unit_ttc: '100.00',
            invl_art_price_sell_ttc: '100.00',
            invl_art_deposit_ttc: '0.00',
          },
        ],
      });

    it('client propriétaire : PDF rendu depuis la facture enregistrée', async () => {
      const { service } = makeService(withInvoice());
      const pdf = await service.renderPdf(ORDER_ID, '81500');
      expect(pdf.filename).toBe('facture-F2026-000001.pdf');
      const text = pdf.content.toString('latin1');
      expect(text).toContain('Dupont');
      expect(text).toContain('Plaquettes');
    });

    it('autre client : 404', async () => {
      const { service } = makeService(withInvoice());
      await expect(service.renderPdf(ORDER_ID, '999')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('numéro pour le lien client : le sien seulement, rien drapeau éteint', async () => {
      const { service } = makeService(withInvoice());
      await expect(
        service.findCustomerInvoice(ORDER_ID, '81500'),
      ).resolves.toEqual({
        invoiceNumber: 'F2026-000001',
        issuedAt: '2026-11-17 18:00:00',
      });
      await expect(
        service.findCustomerInvoice(ORDER_ID, '999'),
      ).resolves.toBeNull();
      const off = makeService(withInvoice(), false);
      await expect(
        off.service.findCustomerInvoice(ORDER_ID, '81500'),
      ).resolves.toBeNull();
      expect(off.db.from).not.toHaveBeenCalled();
    });

    it('pas de facture : 404', async () => {
      const { service } = makeService(world());
      await expect(service.renderPdf(ORDER_ID, '81500')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});

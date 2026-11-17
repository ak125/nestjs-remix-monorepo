/**
 * Mandat BM — supplément motivé (commande plus chère) et mails associés.
 *
 * OrdersService.createReasonedSupplementOrder : commande ENFANT non payée
 * d'une ligne « Supplément : <motif> », par create_order_atomic, mêmes
 * garde-fous que le supplément de rupture (partagés), plus : pas après
 * l'expédition. MailService : demande de supplément (motif, lien, annulation
 * sans accord) et facture avec PDF joint, en transport d'essai.
 */
import { BadRequestException, ConflictException } from '@nestjs/common';
import { TABLES } from '@repo/database-types';
import { SITE_ORIGIN } from '../../src/config/site.constants';
import { OrdersService } from '../../src/modules/orders/services/orders.service';
import { ORDER_EVENTS } from '../../src/modules/orders/events/order.events';
import { MailService } from '../../src/services/mail.service';

const PARENT = 'ORD-1';
type Row = Record<string, unknown>;

function fakeSupabase(tables: Record<string, Row[]>) {
  return {
    from(table: string) {
      const filters: Array<[string, unknown]> = [];
      const rows = () =>
        (tables[table] ?? []).filter((r) =>
          filters.every(([c, v]) => String(r[c]) === String(v)),
        );
      const b = {
        select: () => b,
        eq: (c: string, v: unknown) => {
          filters.push([c, v]);
          return b;
        },
        maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
        then: (f: (v: unknown) => unknown, r: (e: unknown) => unknown) =>
          Promise.resolve({ data: rows(), error: null }).then(f, r),
      };
      return b;
    },
  };
}

function parent(over: Row = {}): Row {
  return {
    ord_id: PARENT,
    ord_cst_id: '81500',
    ord_parent: '0',
    ord_is_pay: '1',
    ord_date_pay: '2026-11-10 09:05:00',
    ord_ords_id: '3',
    ord_date_ship: null,
    ord_cba_id: '11',
    ord_cda_id: '12',
    ord_billing_snapshot: { city: 'Exempleville' },
    ord_shipping_snapshot: { city: 'Exempleville' },
    ...over,
  };
}

function makeService(
  opts: { parent?: Row; children?: Row[]; customer?: Row } = {},
) {
  const emit = jest.fn();
  const service = new OrdersService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { emit } as never,
    {} as never,
    {} as never,
  );
  const callRpc = jest.fn().mockResolvedValue({ data: 'ok', error: null });
  Object.defineProperty(service, 'callRpc', {
    value: callRpc,
    configurable: true,
  });
  Object.defineProperty(service, 'supabase', {
    value: fakeSupabase({
      [TABLES.xtr_order]: [opts.parent ?? parent(), ...(opts.children ?? [])],
      [TABLES.xtr_customer]: [
        opts.customer ?? { cst_id: '81500', cst_mail: 'c@example.test' },
      ],
    }),
    configurable: true,
  });
  jest
    .spyOn(service as never, 'generateOrderNumber' as never)
    .mockResolvedValue('ORD-2' as never);
  return { service, callRpc, emit };
}

describe('OrdersService.createReasonedSupplementOrder', () => {
  beforeAll(() => {
    process.env.SUPABASE_URL ||= 'http://localhost:54321';
    process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key';
  });

  it('commande enfant non payée d’une ligne motivée, par create_order_atomic', async () => {
    const { service, callRpc, emit } = makeService();
    const res = await service.createReasonedSupplementOrder(
      PARENT,
      { amountTtcCents: 1250, reason: '  Référence plus chère  ' },
      { userId: '7' },
    );
    expect(res.orderId).toBe('ORD-2');
    expect(res.totalTtc).toBe(12.5);
    expect(res.paymentUrl).toBe(
      `${SITE_ORIGIN}/api/paybox/redirect?orderId=ORD-2&amount=12.50&email=c%40example.test`,
    );
    const [rpc, params, ctx] = callRpc.mock.calls[0];
    expect(rpc).toBe('create_order_atomic');
    expect(ctx).toEqual({ isServiceRole: true, source: 'internal' });
    expect(params.p_order).toMatchObject({
      ord_id: 'ORD-2',
      ord_parent: PARENT,
      ord_is_pay: '0',
      ord_date_pay: null,
      ord_amount_ttc: '12.50',
      ord_deposit_ttc: '0.00',
      ord_shipping_fee_ttc: '0.00',
      ord_total_ttc: '12.50',
      ord_cba_id: '11',
      ord_billing_snapshot: { city: 'Exempleville' },
    });
    expect(params.p_order.ord_info).toBe(
      `Supplément de la commande ${PARENT} : 12.50 € TTC — Référence plus chère`,
    );
    expect(params.p_lines).toEqual([
      expect.objectContaining({
        orl_id: 'ORD-2-L001',
        orl_pg_name: 'Supplément : Référence plus chère',
        orl_art_quantity: '1',
        orl_art_price_sell_unit_ttc: '12.50',
        orl_art_price_sell_ttc: '12.50',
      }),
    ]);
    expect(emit).toHaveBeenCalledWith(
      ORDER_EVENTS.CREATED,
      expect.objectContaining({ orderId: 'ORD-2', totalTtc: 12.5 }),
    );
  });

  it.each<[string, Parameters<typeof makeService>[0], unknown]>([
    ['non payée', { parent: parent({ ord_is_pay: '0' }) }, ConflictException],
    ['annulée', { parent: parent({ ord_ords_id: '2' }) }, ConflictException],
    [
      'déjà expédiée',
      { parent: parent({ ord_date_ship: '2026-11-17' }) },
      ConflictException,
    ],
    [
      'supplément vivant',
      { children: [{ ord_id: 'ORD-9', ord_parent: PARENT, ord_ords_id: '1' }] },
      ConflictException,
    ],
    [
      'client sans e-mail',
      { customer: { cst_id: '81500', cst_mail: ' ' } },
      ConflictException,
    ],
  ])('refuse : %s, sans écrire', async (_l, opts, err) => {
    const { service, callRpc, emit } = makeService(opts);
    await expect(
      service.createReasonedSupplementOrder(PARENT, {
        amountTtcCents: 100,
        reason: 'abc',
      }),
    ).rejects.toBeInstanceOf(err as never);
    expect(callRpc).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('un supplément annulé ne bloque pas', async () => {
    const { service, callRpc } = makeService({
      children: [{ ord_id: 'ORD-9', ord_parent: PARENT, ord_ords_id: '2' }],
    });
    await service.createReasonedSupplementOrder(PARENT, {
      amountTtcCents: 100,
      reason: 'abc',
    });
    expect(callRpc).toHaveBeenCalledTimes(1);
  });

  it.each([
    [{ amountTtcCents: 0, reason: 'abc' }],
    [{ amountTtcCents: 1.5, reason: 'abc' }],
    [{ amountTtcCents: 100, reason: 'ab' }],
  ])('refuse une saisie invalide %j', async (input) => {
    const { service, callRpc } = makeService();
    await expect(
      service.createReasonedSupplementOrder(PARENT, input),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(callRpc).not.toHaveBeenCalled();
  });
});

describe('MailService — mails du mandat BM en transport d’essai', () => {
  function mailInTestMode() {
    const env: Record<string, string> = {
      MAIL_TEST_TRANSPORT: 'true',
      APP_URL: 'https://dev.example.test',
    };
    const mail = new MailService({ get: (k: string) => env[k] } as never);
    const t = (
      mail as unknown as {
        transporter: { sendMail: (m: unknown) => Promise<{ message: string }> };
      }
    ).transporter;
    const sent: Array<Record<string, any>> = [];
    const real = t.sendMail.bind(t);
    t.sendMail = async (m: unknown) => {
      const info = await real(m);
      sent.push(JSON.parse(info.message));
      return info;
    };
    return { mail, sent };
  }
  const customer = {
    cst_mail: 'c@example.test',
    cst_fname: 'Léa',
    cst_name: 'Dupont',
  };

  it('demande de supplément : motif échappé, lien, annulation sans accord', async () => {
    const { mail, sent } = mailInTestMode();
    await expect(
      mail.sendSupplementPaymentRequest(customer, {
        parentOrderId: PARENT,
        supplementOrderId: 'ORD-2',
        amountTtc: '12.50',
        reason: 'Pièce <plus> chère',
        paymentUrl:
          'https://dev.example.test/api/paybox/redirect?orderId=ORD-2&amount=12.50',
      }),
    ).resolves.toBe('test-transport');
    expect(sent).toHaveLength(1);
    const html: string = sent[0].html;
    expect(html).toContain('12,50 € TTC');
    expect(html).toContain('Pièce &lt;plus&gt; chère');
    expect(html).toContain(
      'href="https://dev.example.test/api/paybox/redirect?orderId=ORD-2&amp;amount=12.50"',
    );
    expect(html).toContain('annulée avant tout encaissement');
  });

  it('facture : PDF joint et lien du compte', async () => {
    const { mail, sent } = mailInTestMode();
    await mail.sendInvoice(
      customer,
      { orderId: PARENT, invoiceNumber: 'F2026-000001', totalTtc: '109.90' },
      Buffer.from('%PDF-1.4\n'),
    );
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toBe(
      'Facture F2026-000001 - commande ORD-1 - Automecanik',
    );
    expect(sent[0].attachments).toEqual([
      expect.objectContaining({
        filename: 'facture-F2026-000001.pdf',
        contentType: 'application/pdf',
      }),
    ]);
    expect(sent[0].html).toContain(
      'https://dev.example.test/account/orders/ORD-1',
    );
  });
});

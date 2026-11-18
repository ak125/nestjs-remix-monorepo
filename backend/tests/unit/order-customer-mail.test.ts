/**
 * Mandat CG — « Écrire au client » depuis la fiche commande.
 *
 * Verrouille : modèles préremplis (a)–(e), envoi par le transport d'essai
 * avec l'expéditeur « Automecanik.com » <contact@>, aperçu = mail envoyé,
 * idempotence (double clic = un seul mail), trace ___xtr_msg + journal
 * admin, échecs sans trace fantôme, gardes d'accès, et plus aucun mail
 * automatique à l'annulation ni au remboursement.
 *
 * Données inventées uniquement (ORD-TEST-CG, client@example.test).
 */
import 'reflect-metadata';
import {
  BadRequestException,
  ExecutionContext,
  RequestMethod,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { EVENT_LISTENER_METADATA } from '@nestjs/event-emitter/dist/constants';
import { TABLES } from '@repo/database-types';
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { PermissionsGuard } from '@auth/guards/permissions.guard';
import { PermissionsService } from '../../src/auth/permissions.service';
import { REQUIRE_PERMISSION_KEY } from '../../src/auth/decorators/require-permission.decorator';
import {
  CUSTOMER_SERVICE_FROM,
  MailService,
  customerMessageFragment,
} from '../../src/services/mail.service';
import {
  PLACEHOLDER_MARK,
  buildAllCustomerMails,
  buildCustomerMail,
  type CustomerMailContext,
} from '../../src/modules/orders/services/customer-mail-templates';
import {
  CUSTOMER_MAIL_AUDIT_ACTION,
  OrderCustomerMailService,
  customerMailMessageId,
} from '../../src/modules/orders/services/order-customer-mail.service';
import { OrderCustomerMailController } from '../../src/modules/orders/controllers/order-customer-mail.controller';
import { OrderEmailListener } from '../../src/modules/orders/listeners/order-email.listener';
import { ORDER_EVENTS } from '../../src/modules/orders/events/order.events';

// Valeurs factices : le client Supabase est remplacé par fakeDb().
process.env.SUPABASE_URL ||= 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key';

const ORDER_ID = 'ORD-TEST-CG';
const REQUEST_ID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const GUARDS_METADATA = '__guards__';

const CTX: CustomerMailContext = {
  orderId: ORDER_ID,
  orderDate: '2026-11-17T10:30:00Z',
  totalTtc: '89.9',
  customerFirstName: 'Léa',
  customerLastName: 'Testeur',
  lines: [
    {
      name: 'Disque de frein',
      brand: 'MARQUE-TEST',
      reference: 'REF 123',
      quantity: '2',
    },
  ],
};

// ─── Faux client Supabase : enregistre chaque appel, clé primaire réelle ───

type Op = { method: string; args: unknown[] };
type Call = { table: string; ops: Op[] };

function fakeDb(opts: {
  order?: Record<string, unknown> | null;
  customer?: Record<string, unknown> | null;
  lines?: Array<Record<string, unknown>>;
  audit?: Array<Record<string, unknown>>;
  msgInsertError?: { code?: string; message: string };
  auditInsertError?: { message: string };
}) {
  const calls: Call[] = [];
  const msgs = new Map<string, Record<string, unknown>>();
  const audit: Array<Record<string, unknown>> = [...(opts.audit ?? [])];

  function resolve(table: string, ops: Op[]) {
    const first = ops[0];
    if (table === TABLES.xtr_msg && first.method === 'insert') {
      const row = first.args[0] as Record<string, unknown>;
      if (opts.msgInsertError)
        return { data: null, error: opts.msgInsertError };
      if (msgs.has(String(row.msg_id))) {
        return {
          data: null,
          error: { code: '23505', message: 'duplicate key value' },
        };
      }
      msgs.set(String(row.msg_id), row);
      return { data: null, error: null };
    }
    if (table === TABLES.xtr_msg && first.method === 'delete') {
      const eq = ops.find((o) => o.method === 'eq');
      msgs.delete(String(eq?.args[1]));
      return { data: null, error: null };
    }
    if (table === TABLES.xtr_msg && first.method === 'select') {
      const ids = (ops.find((o) => o.method === 'in')?.args[1] ??
        []) as string[];
      return {
        data: ids.filter((i) => msgs.has(i)).map((i) => msgs.get(i)),
        error: null,
      };
    }
    if (table === '__admin_audit_log' && first.method === 'insert') {
      if (opts.auditInsertError) {
        return { data: null, error: opts.auditInsertError };
      }
      audit.push({
        ...(first.args[0] as Record<string, unknown>),
        aal_created_at: '2026-11-18T14:00:00Z',
      });
      return { data: null, error: null };
    }
    if (table === '__admin_audit_log' && first.method === 'select') {
      return { data: [...audit].reverse(), error: null };
    }
    if (table === TABLES.xtr_order) {
      return { data: opts.order ?? null, error: null };
    }
    if (table === TABLES.xtr_customer) {
      return { data: opts.customer ?? null, error: null };
    }
    if (table === TABLES.xtr_order_line) {
      return { data: opts.lines ?? [], error: null };
    }
    throw new Error(`table inattendue ${table}`);
  }

  const from = jest.fn((table: string) => {
    const ops: Op[] = [];
    calls.push({ table, ops });
    const chain: Record<string, unknown> = {};
    for (const m of [
      'select',
      'insert',
      'delete',
      'eq',
      'in',
      'order',
      'limit',
    ]) {
      chain[m] = (...args: unknown[]) => {
        ops.push({ method: m, args });
        return chain;
      };
    }
    const done = () => Promise.resolve(resolve(table, ops));
    chain.single = () => done();
    chain.maybeSingle = () => done();
    chain.then = (f: (v: unknown) => unknown, r?: (e: unknown) => unknown) =>
      done().then(f, r);
    return chain;
  });
  return { client: { from }, calls, msgs, audit };
}

function inject(target: object, client: unknown) {
  Object.defineProperty(target, 'supabase', {
    value: client,
    configurable: true,
  });
}

function mailService(env: Record<string, string>) {
  const mail = new MailService({ get: (k: string) => env[k] } as never);
  const transporter = (
    mail as unknown as {
      transporter: {
        sendMail: (m: unknown) => Promise<{ message: string }>;
      } | null;
    }
  ).transporter;
  const sent: Array<Record<string, unknown>> = [];
  if (transporter) {
    const real = transporter.sendMail.bind(transporter);
    transporter.sendMail = async (m: unknown) => {
      const info = await real(m);
      sent.push(JSON.parse(info.message));
      return info;
    };
  }
  return { mail, sent };
}

const TEST_TRANSPORT = {
  MAIL_TEST_TRANSPORT: 'true',
  // Identifiants factices : le transport d'essai reste prioritaire.
  GMAIL_CLIENT_ID: 'x',
  GMAIL_CLIENT_SECRET: 'x',
  GMAIL_REFRESH_TOKEN: 'x',
};

const ORDER = {
  ord_id: ORDER_ID,
  ord_cst_id: '900001',
  ord_date: '2026-11-17T10:30:00Z',
  ord_total_ttc: '89.90',
};
const CUSTOMER = {
  cst_mail: 'client@example.test',
  cst_fname: 'Léa',
  cst_name: "O'Test <b>",
};
const LINES = [
  {
    orl_pg_name: 'Disque de frein',
    orl_pm_name: 'MARQUE-TEST',
    orl_art_ref: 'REF 123',
    orl_art_quantity: '2',
  },
];

function setup(
  env: Record<string, string> = TEST_TRANSPORT,
  db: Parameters<typeof fakeDb>[0] = {},
) {
  const { mail, sent } = mailService(env);
  const service = new OrderCustomerMailService(mail);
  const fake = fakeDb({
    order: ORDER,
    customer: CUSTOMER,
    lines: LINES,
    ...db,
  });
  inject(service, fake.client);
  return { service, mail, sent, db: fake };
}

const SENDABLE = {
  requestId: REQUEST_ID,
  template: 'cancel-payment-voided' as const,
  subject: `Votre commande ${ORDER_ID} est annulée`,
  body: "Bonjour,\n\nLigne 1 <script>\nLigne 2\n\nCordialement,\nL'équipe AutoMecanik",
};

describe('modèles « Écrire au client » (mandat CG)', () => {
  it('(a) reprend la phrase validée, avec le montant et le rappel de commande', () => {
    const m = buildCustomerMail('cancel-payment-voided', CTX);
    expect(m.subject).toBe(`Votre commande ${ORDER_ID} est annulée`);
    expect(m.body).toContain(
      'Votre paiement de 89,90 € a été annulé avant encaissement : aucun montant ne sera prélevé sur votre carte.',
    );
    expect(m.body).toContain(`Votre commande n° ${ORDER_ID} du 17/11/2026 :`);
    expect(m.body).toContain('- 2 × Disque de frein MARQUE-TEST, réf. REF 123');
    expect(m.body.startsWith('Bonjour Léa Testeur,')).toBe(true);
    expect(m.body).toContain("Cordialement,\nL'équipe AutoMecanik");
    expect(m.body).not.toContain(PLACEHOLDER_MARK);
  });

  it('(b) remboursement fait sur la carte, sans délai bancaire', () => {
    const m = buildCustomerMail('cancel-refunded', CTX);
    expect(m.subject).toBe('Votre remboursement de 89,90 €');
    expect(m.body).toContain(
      'Le remboursement de 89,90 € a été fait sur la carte utilisée pour cette commande.',
    );
    expect(m.body).not.toMatch(/jours|ouvr/);
  });

  it('(c) équivalent : passages à compléter, aucun lien de paiement inventé', () => {
    const m = buildCustomerMail('stock-out-equivalent', CTX);
    expect(m.body).toContain(PLACEHOLDER_MARK);
    expect(m.body).not.toMatch(/https?:\/\//);
    expect(m.body).not.toMatch(/\bOEM\b/);
    expect(m.body).toContain('remboursons intégralement 89,90 €');
    // Plusieurs lignes : le montant du remboursement est fixé à la main.
    const two = buildCustomerMail('stock-out-equivalent', {
      ...CTX,
      lines: [...CTX.lines, ...CTX.lines],
    });
    expect(two.body).toContain(`intégralement ${PLACEHOLDER_MARK}`);
  });

  it("(d) demande l'immatriculation ou la référence de la pièce", () => {
    const m = buildCustomerMail('ask-vehicle-or-reference', CTX);
    expect(m.body).toContain("l'immatriculation du véhicule");
    expect(m.body).toContain("la référence d'origine constructeur");
  });

  it('(e) message libre à compléter ; cinq modèles au total', () => {
    expect(buildCustomerMail('free', CTX).body).toContain(PLACEHOLDER_MARK);
    expect(buildAllCustomerMails(CTX).map((t) => t.template)).toEqual([
      'cancel-payment-voided',
      'cancel-refunded',
      'stock-out-equivalent',
      'ask-vehicle-or-reference',
      'free',
    ]);
  });

  it('client sans nom, montant ou date illisible : rien d’inventé', () => {
    const m = buildCustomerMail('cancel-payment-voided', {
      ...CTX,
      customerFirstName: null,
      customerLastName: ' ',
      totalTtc: null,
      orderDate: 'pas une date',
    });
    expect(m.body.startsWith('Bonjour,')).toBe(true);
    expect(m.body).toContain(`${PLACEHOLDER_MARK} : montant]`);
    expect(m.body).toContain(`${PLACEHOLDER_MARK} : date de la commande]`);
  });

  it('texte brut → paragraphes échappés', () => {
    expect(customerMessageFragment('A <b>\nB\n\n\nC & D')).toBe(
      '<p style="margin:0 0 14px;color:#1f2937;line-height:1.6;">A &lt;b&gt;<br>B</p>\n' +
        '<p style="margin:0 0 14px;color:#1f2937;line-height:1.6;">C &amp; D</p>',
    );
  });
});

describe('envoi depuis la fiche commande (mandat CG)', () => {
  it('un mail par le transport d’essai, expéditeur « Automecanik.com » <contact@>, aperçu identique', async () => {
    const { service, sent, db } = setup();
    const preview = service.preview(SENDABLE);
    expect(preview.complete).toBe(true);

    const r = await service.send(ORDER_ID, SENDABLE, '42');

    expect(r).toEqual({
      status: 'sent',
      msgId: customerMailMessageId(ORDER_ID, REQUEST_ID),
      delivery: 'test-transport',
      auditRecorded: true,
    });
    expect(sent).toHaveLength(1);
    const msg = sent[0];
    expect(CUSTOMER_SERVICE_FROM).toBe(
      '"Automecanik.com" <contact@automecanik.com>',
    );
    expect(msg.from).toEqual({
      address: 'contact@automecanik.com',
      name: 'Automecanik.com',
    });
    expect(msg.to).toEqual([{ address: 'client@example.test', name: '' }]);
    expect(msg.subject).toBe(SENDABLE.subject);
    expect(msg.html).toBe(preview.html);
    expect(String(msg.html)).toContain('Ligne 1 &lt;script&gt;<br>Ligne 2');
    expect(String(msg.html)).not.toContain('<script>');
    expect(msg.text).toBe(SENDABLE.body);

    // Trace ___xtr_msg liée à la commande, visible dans la messagerie client.
    const row = db.msgs.get(r.msgId)!;
    expect(row).toMatchObject({
      msg_id: r.msgId,
      msg_cst_id: '900001',
      msg_ord_id: ORDER_ID,
      msg_cnfa_id: '42',
      msg_subject: SENDABLE.subject,
      msg_content: customerMessageFragment(SENDABLE.body),
      msg_open: '0',
      msg_close: '0',
    });
    // Journal admin : action, commande, auteur.
    expect(db.audit).toHaveLength(1);
    expect(db.audit[0]).toMatchObject({
      aal_action: CUSTOMER_MAIL_AUDIT_ACTION,
      aal_entity_type: 'order',
      aal_entity_id: ORDER_ID,
      aal_user_id: '42',
      aal_new_value: {
        msgId: r.msgId,
        template: 'cancel-payment-voided',
        subject: SENDABLE.subject,
        delivery: 'test-transport',
      },
      aal_metadata: { requestId: REQUEST_ID },
    });
  });

  it('double clic (même clé) : un seul mail, une seule trace', async () => {
    const { service, sent, db } = setup();
    const [a, b] = await Promise.all([
      service.send(ORDER_ID, SENDABLE, '42'),
      service.send(ORDER_ID, SENDABLE, '42'),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual(['already-sent', 'sent']);
    const again = await service.send(ORDER_ID, SENDABLE, '42');
    expect(again.status).toBe('already-sent');
    expect(sent).toHaveLength(1);
    expect(db.msgs.size).toBe(1);
    expect(db.audit).toHaveLength(1);

    // Nouvelle clé (nouvel aperçu) : nouveau mail.
    await service.send(
      ORDER_ID,
      { ...SENDABLE, requestId: '9b2a4c1e-3f5d-4e6a-8b7c-0d1e2f3a4b5c' },
      '42',
    );
    expect(sent).toHaveLength(2);
  });

  it('historique : lu dans le journal, textes lus par clé primaire', async () => {
    const { service, db } = setup();
    await service.send(ORDER_ID, SENDABLE, '42');
    const composer = await service.getComposer(ORDER_ID);
    expect(composer.recipient).toBe('client@example.test');
    expect(composer.templates).toHaveLength(5);
    expect(composer.templates[0].body).toContain("Bonjour Léa O'Test <b>,");
    expect(composer.historyError).toBeNull();
    expect(composer.history).toEqual([
      {
        msgId: customerMailMessageId(ORDER_ID, REQUEST_ID),
        sentAt: '2026-11-18T14:00:00Z',
        authorId: '42',
        template: 'cancel-payment-voided',
        subject: SENDABLE.subject,
        delivery: 'test-transport',
        content: customerMessageFragment(SENDABLE.body),
      },
    ]);
    const msgRead = db.calls.find(
      (c) => c.table === TABLES.xtr_msg && c.ops[0].method === 'select',
    )!;
    expect(msgRead.ops.map((o) => o.method)).toEqual(['select', 'in']);
    expect(
      db.calls.some((c) =>
        c.ops.some((o) => o.method === 'eq' && o.args[0] === 'msg_ord_id'),
      ),
    ).toBe(false);
  });

  it('transport non configuré : erreur, réservation retirée, aucun journal', async () => {
    const { service, sent, db } = setup({});
    await expect(service.send(ORDER_ID, SENDABLE, '42')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(sent).toHaveLength(0);
    expect(db.msgs.size).toBe(0);
    expect(db.audit).toHaveLength(0);
  });

  it('boîte configurée autre que contact@ : refus, rien ne part', async () => {
    const { service, sent, db } = setup({
      ...TEST_TRANSPORT,
      GMAIL_USER_EMAIL: 'autre@example.test',
    });
    await expect(service.send(ORDER_ID, SENDABLE, '42')).rejects.toThrow(
      /contact@automecanik\.com/,
    );
    expect(sent).toHaveLength(0);
    expect(db.msgs.size).toBe(0);
    expect(db.audit).toHaveLength(0);
  });

  it('passage « À COMPLÉTER » restant : refus avant toute écriture', async () => {
    const { service, sent, db } = setup();
    const body = buildCustomerMail('free', CTX).body;
    expect(service.preview({ subject: 'Objet', body }).complete).toBe(false);
    await expect(
      service.send(ORDER_ID, { ...SENDABLE, body }, '42'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(sent).toHaveLength(0);
    expect(db.calls).toHaveLength(0);
  });

  it('client sans mail : refus, aucune écriture', async () => {
    const { service, sent, db } = setup(TEST_TRANSPORT, {
      customer: { cst_mail: null, cst_fname: 'X', cst_name: 'Y' },
    });
    await expect(service.send(ORDER_ID, SENDABLE, '42')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(sent).toHaveLength(0);
    expect(db.msgs.size).toBe(0);
  });

  it('trace impossible : aucun mail', async () => {
    const { service, sent } = setup(TEST_TRANSPORT, {
      msgInsertError: { code: '42501', message: 'permission denied' },
    });
    await expect(service.send(ORDER_ID, SENDABLE, '42')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(sent).toHaveLength(0);
  });

  it('journal admin en échec après envoi : signalé, pas caché', async () => {
    const { service, sent } = setup(TEST_TRANSPORT, {
      auditInsertError: { message: 'audit indisponible' },
    });
    const r = await service.send(ORDER_ID, SENDABLE, '42');
    expect(sent).toHaveLength(1);
    expect(r).toMatchObject({ status: 'sent', auditRecorded: false });
  });
});

describe('routes « Écrire au client » : gardes et validation', () => {
  function routes() {
    const proto = OrderCustomerMailController.prototype as unknown as Record<
      string,
      object
    >;
    return Object.getOwnPropertyNames(proto)
      .filter(
        (n) =>
          n !== 'constructor' &&
          Reflect.getMetadata(METHOD_METADATA, proto[n]) !== undefined,
      )
      .map((n) => [
        Reflect.getMetadata(METHOD_METADATA, proto[n]),
        Reflect.getMetadata(PATH_METADATA, proto[n]),
        Reflect.getMetadata(REQUIRE_PERMISSION_KEY, proto[n]),
        Reflect.getMetadata(GUARDS_METADATA, proto[n]),
      ]);
  }

  it('gardes admin de classe, canSendEmails sur chaque route (carte exhaustive)', () => {
    expect(
      Reflect.getMetadata(PATH_METADATA, OrderCustomerMailController),
    ).toBe('api/admin/orders');
    expect(
      Reflect.getMetadata(GUARDS_METADATA, OrderCustomerMailController),
    ).toEqual([AuthenticatedGuard, PermissionsGuard]);
    expect(routes()).toEqual([
      [RequestMethod.GET, ':orderId/customer-mail', 'canSendEmails', undefined],
      [
        RequestMethod.POST,
        ':orderId/customer-mail/preview',
        'canSendEmails',
        undefined,
      ],
      [
        RequestMethod.POST,
        ':orderId/customer-mail',
        'canSendEmails',
        undefined,
      ],
    ]);
  });

  it.each([
    [1, false],
    [3, true],
    [5, false],
    [7, true],
  ])('PermissionsGuard, niveau %i : envoi autorisé = %s', (level, ok) => {
    const guard = new PermissionsGuard(
      new Reflector(),
      new PermissionsService(),
    );
    const ctx = {
      getHandler: () => OrderCustomerMailController.prototype.send,
      switchToHttp: () => ({ getRequest: () => ({ user: { level } }) }),
    } as unknown as ExecutionContext;
    expect(guard.canActivate(ctx)).toBe(ok);
  });

  it('zod : corps invalides refusés avant le service', () => {
    const svc = { send: jest.fn(), preview: jest.fn() };
    const ctrl = new OrderCustomerMailController(svc as never);
    const req = { user: { id: 42 } } as never;
    for (const body of [
      {},
      { ...SENDABLE, requestId: 'pas-un-uuid' },
      { ...SENDABLE, template: 'inconnu' },
      { ...SENDABLE, subject: 'Objet\r\nBcc: x@example.test' },
      { ...SENDABLE, extra: true },
    ]) {
      expect(() => ctrl.send(ORDER_ID, body, req)).toThrow(BadRequestException);
    }
    expect(() => ctrl.send("ORD'; drop", SENDABLE, req)).toThrow(
      BadRequestException,
    );
    expect(svc.send).not.toHaveBeenCalled();
    ctrl.send(ORDER_ID, SENDABLE, req);
    expect(svc.send).toHaveBeenCalledWith(ORDER_ID, SENDABLE, '42');
  });
});

describe('annulation et remboursement : plus aucun mail automatique', () => {
  it("OrderEmailListener n'écoute que l'expédition", () => {
    const proto = OrderEmailListener.prototype as unknown as Record<
      string,
      unknown
    >;
    const events = Object.getOwnPropertyNames(proto)
      .filter((n) => typeof proto[n] === 'function')
      .flatMap(
        (n) =>
          (Reflect.getMetadata(EVENT_LISTENER_METADATA, proto[n] as object) ??
            []) as Array<{ event: string }>,
      )
      .map((m) => m.event);
    expect(events).toEqual([ORDER_EVENTS.SHIPPED]);
    expect(events).not.toContain(ORDER_EVENTS.CANCELLED);
    expect(events).not.toContain(ORDER_EVENTS.REFUNDED);
  });

  it("MailService n'expose plus les mails automatiques d'annulation et de remboursement", () => {
    const proto = MailService.prototype as unknown as Record<string, unknown>;
    expect(proto.sendCancellationEmail).toBeUndefined();
    expect(proto.sendRefundConfirmation).toBeUndefined();
  });
});

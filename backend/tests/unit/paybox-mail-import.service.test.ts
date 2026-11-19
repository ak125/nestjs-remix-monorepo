/**
 * Mandat BT — PayboxMailImportService et son passage quotidien.
 *
 * Faux Gmail et faux Supabase en mémoire ; gabarits synthétiques.
 *
 * Verrouille :
 * - sans `PAYBOX_MAIL_GMAIL_REFRESH_TOKEN` : mode off, aucune boîte ouverte,
 *   aucune lecture ni écriture, aucun passage armé ;
 * - jeton aux portées trop larges : passage refusé avant toute liste ;
 * - dry-run : lit et rapproche, n'écrit rien, n'envoie rien ;
 * - write : messages enregistrés sans carte ni adresse client, capture écrite,
 *   facture BM tentée si activée, mail d'écarts seulement s'il y en a ;
 * - expéditeur étranger, message non authentifié, téléparamétrage : corps
 *   jamais lu ;
 * - saisie manuelle jamais écrasée ; conflit d'insertion = rien écrasé ;
 * - idempotence : un second passage ne relit aucun corps et n'écrit rien.
 */
import 'reflect-metadata';
import { TABLES } from '@repo/database-types';
import { PayboxMailImportService } from '../../src/modules/orders/paybox-mail/paybox-mail-import.service';
import {
  PAYBOX_MAIL_CRON,
  PAYBOX_MAIL_JOB,
  PAYBOX_MAIL_TZ,
  PayboxMailImportScheduler,
} from '../../src/modules/orders/paybox-mail/paybox-mail-import.scheduler';
import {
  PayboxMailScopeError,
  type MailBody,
  type MailHeaders,
  type PayboxMailbox,
} from '../../src/modules/orders/paybox-mail/paybox-mail-gmail.client';
import {
  CARD,
  CUSTOMER,
  REF,
  telecollecteText,
  ticketHtml,
} from './fixtures/paybox-mail.templates';

type Row = Record<string, unknown>;
const AUTH_OK =
  'mx.google.com; dkim=pass header.i=@paybox.com header.s=s1; spf=pass';
const NOW = new Date('2026-11-14T05:30:00Z');

interface Msg {
  headers: Omit<MailHeaders, 'id'>;
  body: MailBody;
}

const MESSAGES: Record<string, Msg> = {
  tk1: {
    headers: {
      internalDate: '2026-11-07T09:15:30.000Z',
      from: 'PayBox <noreply@paybox.com>',
      subject: 'AUTO PIECE EQ.@     : Ticket paiement',
      authenticationResults: AUTH_OK,
    },
    body: { html: ticketHtml(), text: null },
  },
  tc1: {
    headers: {
      internalDate: '2026-11-14T03:55:20.000Z',
      from: 'tpeweb@paybox.com',
      subject: 'PayBox system (compte rendu de telecollecte)',
      authenticationResults: AUTH_OK,
    },
    body: { html: null, text: telecollecteText() },
  },
  hb1: {
    headers: {
      internalDate: '2026-11-14T00:55:00.000Z',
      from: 'tpeweb@paybox.com',
      subject: 'Compte rendu de teleparametrage',
      authenticationResults: AUTH_OK,
    },
    body: { html: null, text: 'synthétique' },
  },
  other: {
    headers: {
      internalDate: '2026-11-13T10:00:00.000Z',
      from: 'Quelqu’un <noreply@paybox.com.evil.test>',
      subject: 'AUTO PIECE EQ.@ : Ticket paiement',
      authenticationResults: AUTH_OK,
    },
    body: { html: ticketHtml(), text: null },
  },
  unauth: {
    headers: {
      internalDate: '2026-11-13T11:00:00.000Z',
      from: 'noreply@paybox.com',
      subject: 'AUTO PIECE EQ.@ : Ticket paiement',
      authenticationResults: 'mx.google.com; dkim=fail header.i=@paybox.com',
    },
    body: { html: ticketHtml({ ref: 'ORD-1762500000000-009' }), text: null },
  },
};

function fakeMailbox(ids: string[], opts: { scopeError?: boolean } = {}) {
  const bodyReads: string[] = [];
  const mailbox: PayboxMailbox & {
    listIds: jest.Mock;
    assertReadonly: jest.Mock;
  } = {
    assertReadonly: jest.fn(async () => {
      if (opts.scopeError)
        throw new PayboxMailScopeError(
          'Jeton refusé : portées https://mail.google.com/',
        );
    }),
    listIds: jest.fn(async () => [...ids]),
    headers: async (id: string) => ({ id, ...MESSAGES[id].headers }),
    body: async (id: string) => {
      bodyReads.push(id);
      return MESSAGES[id].body;
    },
  };
  return { mailbox, bodyReads };
}

interface World {
  messages: Row[];
  captures: Row[];
  orders: Row[];
  postbacks: Row[];
}

/** Faux Supabase : filtres eq/in/gte/lte, upsert ignoreDuplicates, insert 23505, update filtré. */
function fakeDb(w: World) {
  const tables: Record<string, Row[]> = {
    __paybox_mail_message: w.messages,
    __order_capture_state: w.captures,
    [TABLES.xtr_order]: w.orders,
    ic_postback: w.postbacks,
  };
  const keys: Record<string, string> = {
    __paybox_mail_message: 'pmm_message_id',
    __order_capture_state: 'ocs_ord_id',
  };
  const writes: Array<{ table: string; method: string; rows: Row[] }> = [];
  const from = jest.fn((table: string) => {
    const filters: Array<(r: Row) => boolean> = [];
    let pending: null | (() => { data: unknown; error: unknown }) = null;
    const rows = () =>
      (tables[table] ?? []).filter((r) => filters.every((f) => f(r)));
    const chain: Record<string, unknown> = {};
    chain.select = () => chain;
    chain.limit = () => chain;
    chain.eq = (c: string, v: unknown) => {
      filters.push((r) => String(r[c]) === String(v));
      return chain;
    };
    chain.in = (c: string, v: unknown[]) => {
      filters.push((r) => v.map(String).includes(String(r[c])));
      return chain;
    };
    chain.gte = (c: string, v: string) => {
      filters.push((r) => r[c] != null && String(r[c]) >= v);
      return chain;
    };
    chain.lte = (c: string, v: string) => {
      filters.push((r) => r[c] != null && String(r[c]) <= v);
      return chain;
    };
    chain.upsert = (list: Row[], o: { ignoreDuplicates?: boolean }) => {
      writes.push({ table, method: 'upsert', rows: list });
      for (const r of list) {
        const k = keys[table];
        if (tables[table].some((x) => x[k] === r[k])) {
          if (!o.ignoreDuplicates)
            throw new Error('upsert sans ignoreDuplicates');
          continue;
        }
        tables[table].push({ ...r });
      }
      return Promise.resolve({ data: null, error: null });
    };
    chain.insert = (r: Row) => {
      writes.push({ table, method: 'insert', rows: [r] });
      const k = keys[table];
      if (tables[table].some((x) => x[k] === r[k])) {
        return Promise.resolve({
          data: null,
          error: { code: '23505', message: 'duplicate' },
        });
      }
      tables[table].push({ ...r });
      return Promise.resolve({ data: null, error: null });
    };
    chain.update = (patch: Row) => {
      writes.push({ table, method: 'update', rows: [patch] });
      pending = () => {
        const hit = rows();
        for (const r of hit) Object.assign(r, patch);
        return {
          data: hit.map((r) => ({ ocs_ord_id: r.ocs_ord_id })),
          error: null,
        };
      };
      return chain;
    };
    chain.then = (f: (v: unknown) => unknown, r?: (e: unknown) => unknown) =>
      Promise.resolve(pending ? pending() : { data: rows(), error: null }).then(
        f,
        r,
      );
    return chain;
  });
  return { client: { from }, from, writes };
}

function world(over: Partial<World> = {}): World {
  return {
    messages: [],
    captures: [],
    orders: [
      {
        ord_id: REF,
        ord_is_pay: '1',
        ord_total_ttc: '42.20',
        ord_parent: null,
      },
    ],
    postbacks: [],
    ...over,
  };
}

function makeService(
  env: Record<string, string | undefined>,
  w: World,
  mailbox?: PayboxMailbox,
) {
  const config = { get: (k: string) => env[k] };
  const mail = {
    sendPayboxCaptureDiscrepancies: jest
      .fn()
      .mockResolvedValue('test-transport'),
  };
  const billing = {
    isEnabled: jest.fn(() => true),
    tryIssueInvoice: jest
      .fn()
      .mockResolvedValue({ issued: false, reason: 'non expédiée' }),
  };
  const service = new PayboxMailImportService(
    config as never,
    mail as never,
    billing as never,
  );
  const db = fakeDb(w);
  Object.defineProperty(service, 'supabase', {
    value: db.client,
    configurable: true,
  });
  const createMailbox = jest.fn(() => {
    if (!mailbox) throw new Error('boîte non attendue');
    return mailbox;
  });
  Object.defineProperty(service, 'createMailbox', {
    value: createMailbox,
    configurable: true,
  });
  return { service, db, mail, billing, createMailbox };
}

const ENV = (mode: string) => ({
  PAYBOX_MAIL_IMPORT_MODE: mode,
  PAYBOX_MAIL_GMAIL_REFRESH_TOKEN: 'jeton-synthetique',
  GMAIL_CLIENT_ID: 'client-synthetique',
  GMAIL_CLIENT_SECRET: 'secret-synthetique',
});

describe('PayboxMailImportService (mandat BT)', () => {
  beforeAll(() => {
    process.env.SUPABASE_URL ||= 'http://localhost:54321';
    process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key';
  });

  it('sans jeton dédié : mode off quelle que soit la valeur, rien lu ni écrit', async () => {
    const env = {
      ...ENV('write'),
      PAYBOX_MAIL_GMAIL_REFRESH_TOKEN: undefined,
      GMAIL_REFRESH_TOKEN: 'jeton-envoi',
    };
    const { service, db, createMailbox, mail } = makeService(env, world());
    expect(service.mode()).toBe('off');
    expect(await service.runScheduled(NOW)).toEqual({
      mode: 'off',
      status: 'off',
    });
    expect((await service.runDryRun(NOW)).status).toBe('off');
    expect(createMailbox).not.toHaveBeenCalled();
    expect(db.from).not.toHaveBeenCalled();
    expect(mail.sendPayboxCaptureDiscrepancies).not.toHaveBeenCalled();
  });

  it('valeur absente ou inconnue : off', () => {
    expect(
      makeService(
        { ...ENV('x'), PAYBOX_MAIL_IMPORT_MODE: undefined },
        world(),
      ).service.mode(),
    ).toBe('off');
    expect(makeService(ENV('on'), world()).service.mode()).toBe('off');
  });

  it('jeton aux portées trop larges : refusé avant toute liste, rien écrit', async () => {
    const { mailbox } = fakeMailbox(['tk1'], { scopeError: true });
    const { service, db } = makeService(ENV('write'), world(), mailbox);
    const r = await service.runScheduled(NOW);
    expect(r.status).toBe('refused');
    expect(mailbox.listIds).not.toHaveBeenCalled();
    expect(db.from).not.toHaveBeenCalled();
  });

  it('dry-run : lit et rapproche, n’écrit rien, n’envoie rien, aucun corps hors Paybox authentifié', async () => {
    const { mailbox, bodyReads } = fakeMailbox([
      'tk1',
      'tc1',
      'hb1',
      'other',
      'unauth',
    ]);
    const { service, db, mail } = makeService(ENV('dry-run'), world(), mailbox);
    const r = await service.runDryRun(NOW);
    expect(r.status).toBe('done');
    expect(r.mode).toBe('dry-run');
    expect(r.read).toMatchObject({
      listed: 5,
      tickets: 1,
      telecollectes: 1,
      heartbeats: 1,
      otherSenders: 1,
      unrecognized: 1,
    });
    expect(r.writes).toEqual([
      { orderId: REF, state: 'captured', amountCents: 4220, op: 'insert' },
    ]);
    expect(r.discrepancies?.map((d) => d.kind)).toEqual(['format_non_reconnu']);
    expect(bodyReads.sort()).toEqual(['tc1', 'tk1']);
    expect(db.writes).toEqual([]);
    expect(mail.sendPayboxCaptureDiscrepancies).not.toHaveBeenCalled();
    expect(mailbox.listIds.mock.calls[0][0]).toMatch(
      /^from:\(noreply@paybox\.com OR tpeweb@paybox\.com\) after:\d+$/,
    );
    const out = JSON.stringify(r);
    expect(out).not.toContain(CARD);
    expect(out).not.toContain(CUSTOMER);
  });

  it('write : messages sans carte ni adresse, capture écrite, facture tentée, mail d’écarts, puis passage idempotent', async () => {
    const w = world();
    const first = fakeMailbox(['tk1', 'tc1', 'hb1', 'unauth']);
    const s1 = makeService(ENV('write'), w, first.mailbox);
    const r1 = await s1.service.runScheduled(NOW);
    expect(r1.applied).toBe(1);
    expect(w.captures).toEqual([
      {
        ocs_ord_id: REF,
        ocs_state: 'captured',
        ocs_captured_amount_cents: 4220,
        ocs_source: 'paybox_mail',
        ocs_checked_at: '2026-11-14T03:55:12.000Z',
        ocs_updated_by: 'paybox_mail:tc1',
      },
    ]);
    expect(
      w.messages.map((m) => [m.pmm_message_id, m.pmm_kind]).sort(),
    ).toEqual([
      ['tc1', 'telecollecte'],
      ['tk1', 'ticket'],
      ['unauth', 'unrecognized'],
    ]);
    const stored = JSON.stringify(w.messages);
    expect(stored).not.toContain(CARD);
    expect(stored).not.toContain(CUSTOMER);
    expect(stored).not.toContain('ORD-1762500000000-009'); // corps du message non authentifié jamais lu
    expect(s1.billing.tryIssueInvoice).toHaveBeenCalledWith(REF);
    expect(s1.mail.sendPayboxCaptureDiscrepancies).toHaveBeenCalledTimes(1);
    const [day, items] = s1.mail.sendPayboxCaptureDiscrepancies.mock.calls[0];
    expect(day).toBe('2026-11-14');
    expect(items).toEqual([
      expect.objectContaining({
        label: 'Format non reconnu',
        detail: expect.stringContaining('unauth'),
      }),
    ]);
    expect(r1.mail).toBe('test-transport');

    const second = fakeMailbox(['tk1', 'tc1', 'hb1', 'unauth']);
    const s2 = makeService(ENV('write'), w, second.mailbox);
    const r2 = await s2.service.runScheduled(NOW);
    expect(second.bodyReads).toEqual([]);
    expect(r2.writes).toEqual([]);
    expect(r2.discrepancies).toEqual([]);
    expect(r2.mail).toBe('none');
    expect(s2.db.writes).toEqual([]);
    expect(s2.mail.sendPayboxCaptureDiscrepancies).not.toHaveBeenCalled();
  });

  it('saisie manuelle existante : jamais écrasée, désaccord signalé', async () => {
    const manual = {
      ocs_ord_id: REF,
      ocs_state: 'authorized',
      ocs_captured_amount_cents: null,
      ocs_source: 'manual',
    };
    const w = world({ captures: [{ ...manual }] });
    const { mailbox } = fakeMailbox(['tk1', 'tc1']);
    const { service, mail } = makeService(ENV('write'), w, mailbox);
    const r = await service.runScheduled(NOW);
    expect(w.captures).toEqual([manual]);
    expect(r.applied).toBe(0);
    expect(r.discrepancies?.map((d) => d.kind)).toEqual(['desaccord_saisie']);
    expect(mail.sendPayboxCaptureDiscrepancies).toHaveBeenCalledTimes(1);
  });

  it('ligne apparue entre la lecture et l’écriture (23505) : rien écrasé, rien compté', async () => {
    const w = world();
    const { mailbox } = fakeMailbox(['tk1', 'tc1']);
    const { service, db, billing } = makeService(ENV('write'), w, mailbox);
    const original = db.client.from;
    let raced = false;
    Object.defineProperty(service, 'supabase', {
      value: {
        from: (t: string) => {
          const c = original(t) as Record<string, unknown>;
          if (t === '__order_capture_state' && !raced) {
            const insert = c.insert as (r: Row) => Promise<unknown>;
            c.insert = (r: Row) => {
              raced = true;
              w.captures.push({
                ocs_ord_id: REF,
                ocs_state: 'cancelled',
                ocs_source: 'manual',
              });
              return insert(r);
            };
          }
          return c;
        },
      },
      configurable: true,
    });
    const r = await service.runScheduled(NOW);
    expect(r.applied).toBe(0);
    expect(w.captures).toEqual([
      { ocs_ord_id: REF, ocs_state: 'cancelled', ocs_source: 'manual' },
    ]);
    expect(billing.tryIssueInvoice).not.toHaveBeenCalled();
  });

  it('indisponibilité de la base : levée, jamais un rapport vide', async () => {
    const { mailbox } = fakeMailbox(['tk1']);
    const { service } = makeService(ENV('dry-run'), world(), mailbox);
    Object.defineProperty(service, 'supabase', {
      value: {
        from: () => ({
          select: () => ({
            in: () =>
              Promise.resolve({ data: null, error: { message: 'down' } }),
          }),
        }),
      },
      configurable: true,
    });
    await expect(service.runDryRun(NOW)).rejects.toThrow(
      'Lecture des messages Paybox impossible',
    );
  });
});

describe('PayboxMailImportScheduler (mandat BT)', () => {
  function queue(existing: Array<{ name: string; key: string }> = []) {
    return {
      getRepeatableJobs: jest.fn(async () => existing),
      removeRepeatableByKey: jest.fn(async () => undefined),
      add: jest.fn(async () => undefined),
    };
  }

  it('mode off : répétable existant retiré, aucun passage armé, jeton non contrôlé', async () => {
    const q = queue([
      { name: PAYBOX_MAIL_JOB, key: 'k1' },
      { name: 'autre', key: 'k2' },
    ]);
    const service = { mode: () => 'off', checkToken: jest.fn() };
    await new PayboxMailImportScheduler(
      q as never,
      service as never,
    ).configure();
    expect(q.removeRepeatableByKey).toHaveBeenCalledWith('k1');
    expect(q.removeRepeatableByKey).toHaveBeenCalledTimes(1);
    expect(q.add).not.toHaveBeenCalled();
    expect(service.checkToken).not.toHaveBeenCalled();
  });

  it('jeton refusé : aucun passage armé', async () => {
    const q = queue();
    const service = {
      mode: () => 'write',
      checkToken: jest.fn(async () => false),
    };
    await new PayboxMailImportScheduler(
      q as never,
      service as never,
    ).configure();
    expect(q.add).not.toHaveBeenCalled();
  });

  it('jeton accepté : un répétable à 06:30 Europe/Paris, une seule tentative', async () => {
    const q = queue();
    const service = {
      mode: () => 'dry-run',
      checkToken: jest.fn(async () => true),
    };
    await new PayboxMailImportScheduler(
      q as never,
      service as never,
    ).configure();
    expect(q.add).toHaveBeenCalledWith(
      PAYBOX_MAIL_JOB,
      {},
      expect.objectContaining({
        repeat: { cron: PAYBOX_MAIL_CRON, tz: PAYBOX_MAIL_TZ },
        attempts: 1,
      }),
    );
    expect(PAYBOX_MAIL_CRON).toBe('30 6 * * *');
    expect(PAYBOX_MAIL_TZ).toBe('Europe/Paris');
  });
});

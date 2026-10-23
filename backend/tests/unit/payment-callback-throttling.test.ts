/**
 * Callbacks de paiement sous le limiteur (stockage partagé du limiteur).
 *
 * Contrôleurs Paybox et SystemPay/Cyberplus, garde global, paliers et
 * validation Paybox réels ; base, mails, panier, cache et PaymentService
 * simulés. Signature Paybox par une paire RSA générée pour ce test, à la place
 * des clés publiques Paybox. Aucun appel réseau, aucune transaction.
 *
 * Deux stockages : la mémoire du processus (stockage par défaut de la
 * bibliothèque, et repli du stockage partagé) et RedisThrottlerStorage, sur
 * ioredis-mock ou sur un vrai Redis jetable (THROTTLER_TEST_REDIS_SOCKET).
 */
import {
  createHmac,
  createSign,
  generateKeyPairSync,
  randomUUID,
} from 'node:crypto';
import { type INestApplication, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import Redis from 'ioredis';
import RedisMock from 'ioredis-mock';
import request from 'supertest';
import { CacheService } from '@cache/cache.service';
import { CloudflareThrottlerGuard } from '../../src/common/guards/cloudflare-throttler.guard';
import { PaymentMode } from '../../src/config/payment.config';
import * as payboxKeys from '../../src/config/paybox-public-keys';
import { RedisThrottlerStorage } from '../../src/config/throttler-redis-storage.service';
import { shouldSkipThrottling } from '../../src/config/throttler-skip.config';
import { THROTTLER_TIERS } from '../../src/config/throttler-tiers.config';
import { CartDataService } from '../../src/database/services/cart-data.service';
import { PayboxCallbackController } from '../../src/modules/payments/controllers/paybox-callback.controller';
import { PaymentCallbackController } from '../../src/modules/payments/controllers/payment-callback.controller';
import { PaymentDataService } from '../../src/modules/payments/repositories/payment-data.service';
import { CyberplusService } from '../../src/modules/payments/services/cyberplus.service';
import { PayboxCallbackGateService } from '../../src/modules/payments/services/paybox-callback-gate.service';
import { PayboxService } from '../../src/modules/payments/services/paybox.service';
import { PaymentService } from '../../src/modules/payments/services/payment.service';
import { MailService } from '../../src/services/mail.service';

jest.mock('../../src/config/paybox-public-keys', () => {
  const crypto =
    jest.requireActual<typeof import('node:crypto')>('node:crypto');
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { PAYBOX_PUBLIC_KEYS: [publicKey], mockPrivateKey: privateKey };
});

// Même garde que throttler-redis-storage.service.test.ts : un vrai Redis
// seulement sur un socket temporaire dédié, jamais sur une instance partagée.
const socket = process.env.THROTTLER_TEST_REDIS_SOCKET;
if (
  socket &&
  !/^\/tmp\/automecanik-throttler-[A-Za-z0-9]+\/redis\.sock$/.test(socket)
) {
  throw new Error(
    'Real Redis tests require the dedicated temporary Unix socket',
  );
}
if (process.env.THROTTLER_TEST_REDIS_REQUIRED === '1' && !socket) {
  throw new Error(
    'THROTTLER_TEST_REDIS_REQUIRED=1 without THROTTLER_TEST_REDIS_SOCKET',
  );
}

const PAYBOX_KEY = (payboxKeys as unknown as { mockPrivateKey: string })
  .mockPrivateKey;
const FOREIGN_KEY = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
}).privateKey;
const SYSTEMPAY_HMAC = 'fixture-systempay-hmac';
// Plages de documentation (RFC 5737), pas les adresses des prestataires.
const PAYBOX_IP = '198.51.100.20';
const SYSTEMPAY_IP = '192.0.2.30';
const UNPAID = 'ORD-1761200000000-101';
const PAID = 'ORD-1761200000000-202';

type Order = {
  ord_id: string;
  ord_total_ttc: string;
  ord_is_pay: string;
  ord_date_pay: string | null;
};

const CONFIG: Record<string, unknown> = {
  PAYBOX_CALLBACK_MODE: 'strict',
  PAYBOX_SITE: '0000001',
  PAYBOX_RANG: '001',
  PAYBOX_IDENTIFIANT: '000000001',
  payment: {
    systempay: {
      siteId: '00000001',
      certificate: 'fixture-systempay-certificate',
      certificateTest: 'fixture-systempay-certificate',
      hmacKey: SYSTEMPAY_HMAC,
      signatureMethod: 'HMAC',
      mode: PaymentMode.TEST,
      apiUrl: 'https://systempay.invalid',
    },
    app: {
      url: 'http://localhost:3000',
      callbackPath: '/api/payments/callback',
    },
  },
};

/** Querystring Paybox : données signées avant « &K= », signature RSA-SHA1. */
function payboxQuery(ref: string, mt: string, key = PAYBOX_KEY): string {
  const data = `Mt=${mt}&Ref=${ref}&Auto=XXXXXX&Erreur=00000`;
  const signature = createSign('SHA1').update(data).sign(key, 'base64');
  return `${data}&K=${encodeURIComponent(signature)}`;
}

/** Corps SystemPay : HMAC-SHA256 des valeurs vads_* triées par nom. */
function systempayBody(orderId: string, hmacKey = SYSTEMPAY_HMAC) {
  const vads: Record<string, string> = {
    vads_amount: '12345',
    vads_currency: '978',
    vads_order_id: orderId,
    vads_site_id: '00000001',
    vads_trans_id: '000001',
    vads_trans_status: 'AUTHORISED',
  };
  const data = Object.keys(vads)
    .sort()
    .map((k) => vads[k])
    .join('+');
  return {
    ...vads,
    signature: createHmac('sha256', hmacKey).update(data).digest('hex'),
  };
}

let now: number;
let prefix: string;
let orders: Map<string, Order>;
let tables: string[];
let paymentData: {
  supabase: { from: (table: string) => unknown };
  getSupabaseClient: () => unknown;
  createPayment: jest.Mock;
  getOrderForPayment: jest.Mock;
  getCustomerForOrder: jest.Mock;
  isGuestCustomer: jest.Mock;
};
let paymentService: { handlePaymentCallback: jest.Mock };
let gate: jest.SpyInstance;
let systempayCheck: jest.SpyInstance;
let errorSpy: jest.SpyInstance;
let warnSpy: jest.SpyInstance;
const clients: Redis[] = [];
const apps: INestApplication[] = [];

/** Lectures de commande, journaux du gate, ic_postback : tables touchées. */
function supabaseMock() {
  return {
    from(table: string) {
      tables.push(table);
      const filters: Record<string, unknown> = {};
      const builder = {
        select: () => builder,
        update: () => builder,
        insert: async () => ({ error: null }),
        eq: (column: string, value: unknown) => {
          filters[column] = value;
          return builder;
        },
        single: async () => {
          const order = orders.get(String(filters.ord_id));
          return order
            ? { data: { ...order }, error: null }
            : { data: null, error: { message: 'not found' } };
        },
        // Garde GA4 du contrôleur : aucune ligne confirmée, aucun envoi.
        then: (resolve: (value: unknown) => unknown) =>
          resolve({ data: [], error: null }),
      };
      return builder;
    },
  };
}

function newClient(): Redis {
  const client = socket
    ? new Redis(socket, {
        keyPrefix: prefix,
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 0,
      })
    : (new RedisMock({ lazyConnect: true }) as unknown as Redis);
  clients.push(client);
  return client;
}

function adminClient(): Redis {
  return new Redis(socket as string, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 0,
    retryStrategy: () => null,
  });
}

function storageOn(client: Redis): RedisThrottlerStorage {
  return new (class extends RedisThrottlerStorage {
    protected createRedis(): Redis {
      return client;
    }
  })({ get: () => undefined } as unknown as ConfigService);
}

type Kind = 'memory' | 'redis';

/** Un processus Node : client Redis propre, ou mémoire du processus. */
async function processOn(
  kind: Kind,
  client: Redis = newClient(),
): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [
      ThrottlerModule.forRootAsync({
        useFactory: () => ({
          throttlers: THROTTLER_TIERS,
          skipIf: shouldSkipThrottling,
          ...(kind === 'redis' ? { storage: storageOn(client) } : {}),
        }),
      }),
    ],
    controllers: [PayboxCallbackController, PaymentCallbackController],
    providers: [
      { provide: APP_GUARD, useClass: CloudflareThrottlerGuard },
      {
        provide: ConfigService,
        useValue: {
          get: (key: string, fallback?: unknown) =>
            key in CONFIG ? CONFIG[key] : fallback,
        },
      },
      PayboxService,
      PayboxCallbackGateService,
      CyberplusService,
      { provide: PaymentDataService, useValue: paymentData },
      { provide: PaymentService, useValue: paymentService },
      {
        provide: MailService,
        useValue: {
          sendOrderConfirmation: jest.fn(),
          sendAdminOrderNotification: jest.fn(),
          sendGuestAccountActivation: jest.fn(),
        },
      },
      { provide: CartDataService, useValue: { clearUserCart: jest.fn() } },
      { provide: CacheService, useValue: { get: jest.fn(), set: jest.fn() } },
      { provide: EventEmitter2, useValue: { emit: jest.fn() } },
    ],
  }).compile();
  const app = moduleRef.createNestApplication();
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  // En écoute avant les requêtes : supertest n'ouvre ni ne ferme le serveur
  // au fil des requêtes simultanées.
  await app.listen(0, '127.0.0.1');
  apps.push(app);
  return app;
}

function paybox(app: INestApplication, query: string, method = 'post') {
  const agent = request(app.getHttpServer());
  const url = `/api/paybox/callback?${query}`;
  return (method === 'get' ? agent.get(url) : agent.post(url)).set(
    'CF-Connecting-IP',
    PAYBOX_IP,
  );
}

function systempay(app: INestApplication, body = systempayBody(UNPAID)) {
  return request(app.getHttpServer())
    .post('/api/payments/callback/cyberplus')
    .set('CF-Connecting-IP', SYSTEMPAY_IP)
    .type('form')
    .send(body);
}

/** Envoie n callbacks espacés de stepMs ; renvoie les statuts. */
async function sequence(
  n: number,
  stepMs: number,
  send: () => request.Test,
): Promise<number[]> {
  const statuses: number[] = [];
  for (let i = 0; i < n; i++) {
    statuses.push((await send()).status);
    now += stepMs;
  }
  return statuses;
}

const count = (statuses: number[], status: number) =>
  statuses.filter((s) => s === status).length;

beforeAll(async () => {
  if (!socket) return;
  const admin = adminClient();
  try {
    await admin.connect();
    expect(await admin.ping()).toBe('PONG');
  } finally {
    admin.disconnect();
  }
});

beforeEach(async () => {
  now = Date.UTC(2026, 9, 23, 8, 0, 0);
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  gate = jest.spyOn(PayboxCallbackGateService.prototype, 'validateCallback');
  systempayCheck = jest.spyOn(CyberplusService.prototype, 'validateCallback');
  prefix = `test:throttler:${randomUUID()}:`;
  if (!socket) await new RedisMock().flushall();
  orders = new Map([
    [
      UNPAID,
      {
        ord_id: UNPAID,
        ord_total_ttc: '123.45',
        ord_is_pay: '0',
        ord_date_pay: null,
      },
    ],
    [
      PAID,
      {
        ord_id: PAID,
        ord_total_ttc: '50.00',
        ord_is_pay: '1',
        ord_date_pay: '2026-10-23',
      },
    ],
  ]);
  tables = [];
  const supabase = supabaseMock();
  paymentData = {
    supabase,
    getSupabaseClient: () => supabase,
    // Comme mark_order_paid_atomic : la commande passe payée une seule fois.
    createPayment: jest.fn(async ({ orderId }: { orderId: string }) => {
      const order = orders.get(orderId);
      if (order) order.ord_is_pay = '1';
      return { id: `pay-${orderId}` };
    }),
    getOrderForPayment: jest.fn().mockResolvedValue(null),
    getCustomerForOrder: jest.fn().mockResolvedValue(null),
    isGuestCustomer: jest.fn().mockResolvedValue(false),
  };
  paymentService = {
    handlePaymentCallback: jest
      .fn()
      .mockResolvedValue({ id: 'pay-systempay', status: 'completed' }),
  };
});

afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
  for (const client of clients.splice(0)) client.disconnect();
  jest.restoreAllMocks();
  if (!socket) return;
  const admin = adminClient();
  try {
    await admin.connect();
    let cursor = '0';
    do {
      const [next, keys] = await admin.scan(
        cursor,
        'MATCH',
        `${prefix}*`,
        'COUNT',
        500,
      );
      if (keys.length) await admin.unlink(...keys);
      cursor = next;
    } while (cursor !== '0');
  } finally {
    admin.disconnect();
  }
});

describe.each<Kind>(['memory', 'redis'])(
  'callbacks de paiement — stockage %s',
  (kind) => {
    it('Paybox : signature valide → 200, une écriture ; répétition → 200 sans écriture', async () => {
      const app = await processOn(kind);
      const query = payboxQuery(UNPAID, '12345');
      const first = await paybox(app, query).expect(200);
      expect(first.text).toBe('OK');
      expect(paymentData.createPayment).toHaveBeenCalledTimes(1);
      expect(paymentData.createPayment.mock.calls[0][0]).toMatchObject({
        orderId: UNPAID,
        amount: 123.45,
      });

      now += 1000;
      const replay = await paybox(app, query).expect(200);
      expect(replay.text).toBe('OK');
      expect(paymentData.createPayment).toHaveBeenCalledTimes(1);
    });

    it('Paybox : signature d’une autre clé → 403, sans écriture', async () => {
      const app = await processOn(kind);
      const res = await paybox(app, payboxQuery(UNPAID, '12345', FOREIGN_KEY));
      expect(res.status).toBe(403);
      expect(paymentData.createPayment).not.toHaveBeenCalled();
      expect(tables).toContain('__paybox_gate_log');
    });

    it('Paybox : 30 callbacks par minute admis, le 31e reçoit 429 avant le contrôleur', async () => {
      const app = await processOn(kind);
      const query = payboxQuery(PAID, '5000');
      const statuses = await sequence(30, 100, () => paybox(app, query));
      expect(statuses).toEqual(Array(30).fill(200));
      expect(gate).toHaveBeenCalledTimes(30);

      const blocked = await paybox(app, query).expect(429);
      expect(blocked.headers['retry-after-payment_callback']).toBeDefined();
      expect(gate).toHaveBeenCalledTimes(30);

      // Fenêtre de 60 s et blocage écoulés : de nouveau admis.
      now += 61_000;
      await paybox(app, query).expect(200);
      expect(gate).toHaveBeenCalledTimes(31);
    });

    it('Paybox : rafale de 16 dans la même seconde → palier short, 429 au 16e', async () => {
      const app = await processOn(kind);
      const query = payboxQuery(PAID, '5000');
      const statuses = await sequence(16, 0, () => paybox(app, query));
      expect(statuses.slice(0, 15)).toEqual(Array(15).fill(200));
      expect(statuses[15]).toBe(429);
    });

    it('Paybox : 40 callbacks simultanés → exactement 15 admis (palier short)', async () => {
      const app = await processOn(kind);
      const query = payboxQuery(PAID, '5000');
      const responses = await Promise.all(
        Array.from({ length: 40 }, () => paybox(app, query)),
      );
      const statuses = responses.map((r) => r.status);
      expect(count(statuses, 200)).toBe(15);
      expect(count(statuses, 429)).toBe(25);
      expect(gate).toHaveBeenCalledTimes(15);
    });

    it('Paybox GET (alias) : sans @Throttle, palier payment_callback à 100/min', async () => {
      const app = await processOn(kind);
      const query = payboxQuery(PAID, '5000');
      const statuses = await sequence(31, 100, () => paybox(app, query, 'get'));
      expect(statuses).toEqual(Array(31).fill(200));
    });

    it('SystemPay : signature valide traitée, invalide → 500 après écriture ic_postback', async () => {
      const app = await processOn(kind);
      await systempay(app).expect(201);
      expect(paymentService.handlePaymentCallback).toHaveBeenCalledTimes(1);

      now += 1000;
      tables = [];
      const bad = await systempay(app, systempayBody(UNPAID, 'autre-cle'));
      expect(bad.status).toBe(500);
      expect(tables).toEqual(['ic_postback']);
      expect(paymentService.handlePaymentCallback).toHaveBeenCalledTimes(1);
    });

    it('SystemPay : 31e notification en 429 sans écriture ; rejeu à +15 min admis', async () => {
      const app = await processOn(kind);
      const statuses = await sequence(30, 100, () => systempay(app));
      expect(statuses).toEqual(Array(30).fill(201));

      tables = [];
      const blocked = await systempay(app).expect(429);
      expect(blocked.headers['retry-after-payment_callback']).toBeDefined();
      expect(tables).toEqual([]);
      expect(systempayCheck).toHaveBeenCalledTimes(30);

      // Rejeu automatique SystemPay : tentatives espacées d'un quart d'heure.
      now += 15 * 60_000;
      await systempay(app).expect(201);
      expect(paymentService.handlePaymentCallback).toHaveBeenCalledTimes(31);
    });

    it('deux processus : budget payment_callback commun en Redis, par processus en mémoire', async () => {
      const [a, b] = [await processOn(kind), await processOn(kind)];
      const query = payboxQuery(PAID, '5000');
      const statuses: number[] = [];
      for (let wave = 0; wave < 4; wave++) {
        const responses = await Promise.all(
          Array.from({ length: 10 }, (_, i) => paybox(i % 2 ? a : b, query)),
        );
        statuses.push(...responses.map((r) => r.status));
        now += 1100; // hors de la fenêtre short (1 s) de la vague précédente
      }
      if (kind === 'redis') {
        expect(count(statuses, 200)).toBe(30);
        expect(count(statuses, 429)).toBe(10);
      } else {
        expect(count(statuses, 200)).toBe(40);
      }
    });

    it('redémarrage de Node : budget conservé en Redis, remis à zéro en mémoire', async () => {
      const query = payboxQuery(PAID, '5000');
      const before = await processOn(kind);
      expect(await sequence(20, 100, () => paybox(before, query))).toEqual(
        Array(20).fill(200),
      );
      await before.close();
      apps.splice(apps.indexOf(before), 1);

      const after = await processOn(kind);
      const statuses = await sequence(11, 100, () => paybox(after, query));
      if (kind === 'redis') {
        expect(statuses).toEqual([...Array(10).fill(200), 429]);
      } else {
        expect(statuses).toEqual(Array(11).fill(200));
      }
    });
  },
);

describe('callbacks de paiement — panne puis retour de Redis', () => {
  type Increment = (...args: unknown[]) => Promise<unknown>;

  it('repli en mémoire journalisé : les callbacks restent traités, 429 au 31e coup local', async () => {
    const client = newClient();
    const app = await processOn('redis', client);
    const query = payboxQuery(PAID, '5000');
    expect(await sequence(10, 100, () => paybox(app, query))).toEqual(
      Array(10).fill(200),
    );

    const outage = jest
      .spyOn(
        client as unknown as { throttlerIncrement: Increment },
        'throttlerIncrement',
      )
      .mockRejectedValue(new Error('Connection is closed.'));
    const during = await sequence(31, 100, () => paybox(app, query));
    // Le repli ne voit pas les 10 coups comptés en Redis avant la panne.
    expect(during).toEqual([...Array(30).fill(200), 429]);
    const degraded = errorSpy.mock.calls.filter((c) =>
      String(c[0]).includes('budget non partagé'),
    );
    expect(degraded).toHaveLength(1);
    expect(gate).toHaveBeenCalledTimes(40);

    outage.mockRestore();
    now += 60_000;
    await paybox(app, query).expect(200);
    const recovered = warnSpy.mock.calls.filter((c) =>
      String(c[0]).includes('Redis revenu'),
    );
    expect(recovered).toHaveLength(1);
  });
});

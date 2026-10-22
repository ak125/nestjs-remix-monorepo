import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Controller, Get, type INestApplication, Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerModule, ThrottlerStorageService } from '@nestjs/throttler';
import Redis from 'ioredis';
import RedisMock from 'ioredis-mock';
import request from 'supertest';
import { CloudflareThrottlerGuard } from '../common/guards/cloudflare-throttler.guard';
import {
  RedisThrottlerStorage,
  THROTTLER_INCREMENT_LUA,
  THROTTLER_KEY_PREFIX,
} from './throttler-redis-storage.service';
import { shouldSkipThrottling } from './throttler-skip.config';
import { THROTTLER_TIERS } from './throttler-tiers.config';

// Même garde que bot-guard.metrics.test.ts : un vrai Redis seulement sur un
// socket temporaire dédié, jamais sur une instance partagée.
const socket = process.env.THROTTLER_TEST_REDIS_SOCKET;
if (
  socket &&
  !/^\/tmp\/automecanik-throttler-[A-Za-z0-9]+\/redis\.sock$/.test(socket)
) {
  throw new Error(
    'Real Redis tests require the dedicated temporary Unix socket',
  );
}

type StorageRecord = Awaited<ReturnType<ThrottlerStorageService['increment']>>;

const noConfig = { get: () => undefined } as unknown as ConfigService;
let prefix: string;
const clients: Redis[] = [];

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

function storageOn(client: Redis): RedisThrottlerStorage {
  return new (class extends RedisThrottlerStorage {
    protected createRedis(): Redis {
      return client;
    }
  })(noConfig);
}

async function connected(client: Redis): Promise<RedisThrottlerStorage> {
  const storage = storageOn(client);
  await storage.onModuleInit();
  return storage;
}

/** Ce que le garde lit d'un résultat : timeToBlockExpire ne sert que bloqué. */
function observable(r: StorageRecord) {
  return {
    totalHits: r.totalHits,
    timeToExpire: r.timeToExpire + 0, // -0 de Math.ceil côté bibliothèque
    isBlocked: r.isBlocked,
    timeToBlockExpire: r.isBlocked ? r.timeToBlockExpire + 0 : null,
  };
}

function prng(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let now: number;
let errorSpy: jest.SpyInstance;
let warnSpy: jest.SpyInstance;

beforeEach(async () => {
  now = Date.UTC(2026, 9, 23, 8, 0, 0);
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  prefix = `test:throttler:${randomUUID()}:`;
  if (!socket) await new RedisMock().flushall();
});

afterEach(() => {
  for (const client of clients.splice(0)) client.disconnect();
  jest.restoreAllMocks();
});

describe('THROTTLER_INCREMENT_LUA — parité avec ThrottlerStorageService 6.7.1', () => {
  it.each([
    ['blocage = ttl', 1000, 3, 1000],
    ['blocage < ttl', 5000, 4, 2500],
    ['blocage > ttl', 1000, 2, 4000],
    ['sans blocage', 2000, 3, 0],
  ])(
    '%s : mêmes décisions sur une séquence pseudo-aléatoire',
    async (_, ttl, limit, block) => {
      const redis = await connected(newClient());
      const reference = new ThrottlerStorageService();
      const random = prng(ttl * 31 + limit * 7 + block);
      let blocked = 0;
      for (let step = 0; step < 600; step++) {
        const r = random();
        now +=
          r < 0.4
            ? 0
            : r < 0.7
              ? Math.floor(random() * 400)
              : r < 0.9
                ? 800 + Math.floor(random() * 600)
                : 2000 + Math.floor(random() * 6000);
        const key = `k${Math.floor(random() * 3)}`;
        const expected = await reference.increment(
          key,
          ttl,
          limit,
          block,
          'short',
        );
        const actual = await redis.increment(key, ttl, limit, block, 'short');
        expect({ step, ...observable(actual) }).toEqual({
          step,
          ...observable(expected),
        });
        if (expected.isBlocked) blocked++;
      }
      expect(blocked).toBeGreaterThan(20);
      reference.onApplicationShutdown();
    },
  );

  // ioredis-mock ne reconnaît une table Lua comme tableau que si ses clés ont été
  // insérées de la dernière à la première (constructeur `{ … }`) : la liste des
  // réponses, remplie par index croissant, revient en proxy opaque. Cette forme
  // n'est donc vérifiée que sur un vrai Redis (THROTTLER_TEST_REDIS_SOCKET).
  (socket ? it : it.skip)(
    "s'arrête après la première entrée bloquée, comme la boucle du garde",
    async () => {
      // Forme d'appel de R2 : plusieurs entrées dans un seul script.
      const client = newClient() as Redis & {
        throttlerBatch(...args: unknown[]): Promise<number[][]>;
      };
      client.defineCommand('throttlerBatch', {
        numberOfKeys: 4,
        lua: THROTTLER_INCREMENT_LUA,
      });
      await client.connect();
      const run = () =>
        client.throttlerBatch(
          'throttler:a',
          'throttler:a:short',
          'throttler:b',
          'throttler:b:medium',
          now,
          1000,
          1,
          1000,
          60000,
          100,
          60000,
        );
      expect(await run()).toEqual([
        [1, 1, 0, expect.any(Number)],
        [1, 60, 0, expect.any(Number)],
      ]);
      expect(await run()).toEqual([[2, 1, 1, 1]]);
      expect(await client.llen('throttler:b:medium')).toBe(1);
    },
  );

  it('refuse des KEYS et ARGV incohérents', async () => {
    const client = newClient();
    await client.connect();
    await expect(
      client.eval(
        THROTTLER_INCREMENT_LUA,
        2,
        'throttler:a',
        'throttler:a:x',
        now,
        1000,
      ),
    ).rejects.toThrow('KEYS et ARGV');
  });
});

describe('RedisThrottlerStorage — budget commun', () => {
  it('deux processus qui alternent consomment un seul budget', async () => {
    const a = await connected(newClient());
    const b = await connected(newClient());
    const decisions: boolean[] = [];
    for (let i = 0; i < 20; i++) {
      const r = await (i % 2 ? a : b).increment('ip', 1000, 15, 1000, 'short');
      decisions.push(r.isBlocked);
    }
    expect(decisions.indexOf(true)).toBe(15);

    // Le défaut corrigé : deux stockages en mémoire donnent deux budgets.
    const [x, y] = [
      new ThrottlerStorageService(),
      new ThrottlerStorageService(),
    ];
    const local: boolean[] = [];
    for (let i = 0; i < 40; i++) {
      const r = await (i % 2 ? x : y).increment('ip', 1000, 15, 1000, 'short');
      local.push(r.isBlocked);
    }
    expect(local.filter((d) => !d)).toHaveLength(30);
    x.onApplicationShutdown();
    y.onApplicationShutdown();
  });

  it('des appels simultanés ne dépassent pas le budget', async () => {
    const a = await connected(newClient());
    const b = await connected(newClient());
    const results = await Promise.all(
      Array.from({ length: 40 }, (_, i) =>
        (i % 2 ? a : b).increment('ip', 1000, 15, 1000, 'short'),
      ),
    );
    const allowed = results.filter((r) => !r.isBlocked);
    expect(allowed.map((r) => r.totalHits).sort((m, n) => m - n)).toEqual(
      Array.from({ length: 15 }, (_, i) => i + 1),
    );
  });

  it("le blocage expire après blockDuration et repart d'un compteur neuf", async () => {
    const a = await connected(newClient());
    const b = await connected(newClient());
    for (let i = 0; i < 15; i++)
      await a.increment('ip', 1000, 15, 1000, 'short');
    expect(await b.increment('ip', 1000, 15, 1000, 'short')).toEqual({
      totalHits: 16,
      timeToExpire: 1,
      isBlocked: true,
      timeToBlockExpire: 1,
    });
    now += 999;
    expect((await a.increment('ip', 1000, 15, 1000, 'short')).isBlocked).toBe(
      true,
    );
    now += 1;
    expect(await a.increment('ip', 1000, 15, 1000, 'short')).toMatchObject({
      totalHits: 1,
      isBlocked: false,
    });
  });
});

describe('RedisThrottlerStorage — panne Redis', () => {
  type Increment = (...args: unknown[]) => Promise<unknown>;

  it('repli en mémoire du processus, jamais ouvert, journalisé une fois', async () => {
    const client = newClient();
    const storage = await connected(client);
    const command = jest
      .spyOn(
        client as unknown as { throttlerIncrement: Increment },
        'throttlerIncrement',
      )
      .mockRejectedValue(
        new Error(
          "Stream isn't writeable and enableOfflineQueue options is false",
        ),
      );
    const decisions: boolean[] = [];
    for (let i = 0; i < 20; i++) {
      decisions.push(
        (await storage.increment('ip', 1000, 15, 1000, 'short')).isBlocked,
      );
    }
    expect(decisions.indexOf(true)).toBe(15);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(String(errorSpy.mock.calls[0][0])).toContain('budget non partagé');
    expect(warnSpy).not.toHaveBeenCalled();

    command.mockRestore();
    // Borne publiée : au retour, Redis n'a pas vu les coups comptés en mémoire.
    expect(
      await storage.increment('ip', 1000, 15, 1000, 'short'),
    ).toMatchObject({
      totalHits: 1,
      isBlocked: false,
    });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0][0])).toContain('après 20 décision(s)');
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('une connexion initiale en échec ne bloque pas le démarrage et se journalise', async () => {
    const client = newClient();
    jest
      .spyOn(client, 'connect')
      .mockRejectedValue(new Error('connect ECONNREFUSED'));
    const storage = storageOn(client);
    await expect(storage.onModuleInit()).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(String(errorSpy.mock.calls[0][0])).toContain('ECONNREFUSED');
  });
});

@Controller('probe')
class ProbeController {
  @Get()
  probe(): string {
    return 'ok';
  }
}

describe('ThrottlerModule.forRootAsync avec RedisThrottlerStorage', () => {
  const apps: INestApplication[] = [];

  async function processOn(client: Redis): Promise<INestApplication> {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRootAsync({
          useFactory: () => ({
            throttlers: THROTTLER_TIERS,
            skipIf: shouldSkipThrottling,
            storage: storageOn(client),
          }),
        }),
      ],
      controllers: [ProbeController],
      providers: [{ provide: APP_GUARD, useClass: CloudflareThrottlerGuard }],
    }).compile();
    const app = moduleRef.createNestApplication();
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
    await app.init();
    apps.push(app);
    return app;
  }

  afterEach(async () => {
    for (const app of apps.splice(0)) await app.close();
  });

  it('deux applications partagent le palier short et rendent le même 429', async () => {
    const [clientA, clientB] = [newClient(), newClient()];
    const connect = jest.spyOn(clientA, 'connect');
    const [a, b] = [await processOn(clientA), await processOn(clientB)];
    expect(connect).toHaveBeenCalledTimes(1);

    const remaining: string[] = [];
    for (let i = 0; i < 15; i++) {
      const res = await request((i % 2 ? a : b).getHttpServer())
        .get('/probe')
        .set('CF-Connecting-IP', '203.0.113.7')
        .expect(200);
      remaining.push(res.headers['x-ratelimit-remaining-short']);
    }
    expect(remaining).toEqual(
      Array.from({ length: 15 }, (_, i) => String(14 - i)),
    );
    const blocked = await request(a.getHttpServer())
      .get('/probe')
      .set('CF-Connecting-IP', '203.0.113.7')
      .expect(429);
    expect(blocked.headers['retry-after-short']).toBe('1');

    const key = createHash('sha256')
      .update('ProbeController-probe-short-203.0.113.7')
      .digest('hex');
    expect(Number(await clientA.hget(THROTTLER_KEY_PREFIX + key, 'x'))).toBe(1);

    const disconnect = jest.spyOn(clientB, 'disconnect');
    await b.close();
    apps.splice(apps.indexOf(b), 1);
    expect(disconnect).toHaveBeenCalled();
  });
});

describe('copie R2 du script', () => {
  it('services/vehicle-models-rs/src/route/throttle.lua reste identique', () => {
    const copy = readFileSync(
      resolve(
        __dirname,
        '../../../services/vehicle-models-rs/src/route/throttle.lua',
      ),
      'utf8',
    );
    expect(copy).toBe(THROTTLER_INCREMENT_LUA);
  });
});

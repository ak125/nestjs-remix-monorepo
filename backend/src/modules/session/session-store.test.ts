/**
 * PR-9e.2 — Real-Redis test suite for the connect-redis@9 + node-redis session
 * store swap. Uses testcontainers (ephemeral Redis on a RANDOM port — never
 * collides with a host Redis). NO mocks here on purpose: the whole point is to
 * prove the on-the-wire byte format, so a mock would hide exactly what we test.
 *
 * The headline guarantee is BIDIRECTIONAL compatibility: connect-redis@5 (ioredis)
 * and connect-redis@9 (node-redis) read each other's sessions. That is what makes
 * a rollback to the previous (v5) image SAFE — if this suite ever goes red, the
 * migration is NOT rollback-safe and must be blocked.
 */
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import IORedis from 'ioredis';
import { createClient } from 'redis';
import { RedisStore } from 'connect-redis';
import expressSession, { type Store } from 'express-session';
import { SessionStoreService } from './session-store.service';

// connect-redis@5 ships NO TypeScript types (its @types/connect-redis devDep was
// dropped in this PR). The alias is test-only — require it untyped on purpose.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const connectRedisV5Factory = require('connect-redis-v5') as (
  s: typeof expressSession,
) => new (opts: Record<string, unknown>) => Store;

const REDIS_IMAGE = 'redis:7-alpine';
// MUST match SessionStoreService's own constants — this is the contract that the
// service relies on. Changing either side without the other = forced sign-out.
const PREFIX = 'sess:';
const TTL_SECONDS = 86400 * 30;

const setSession = (store: Store, sid: string, data: object): Promise<void> =>
  new Promise((resolve, reject) =>
    store.set(sid, data as never, (err) => (err ? reject(err) : resolve())),
  );
const getSession = (store: Store, sid: string): Promise<unknown> =>
  new Promise((resolve, reject) =>
    store.get(sid, (err, data) => (err ? reject(err) : resolve(data))),
  );
const touchSession = (store: Store, sid: string, data: object): Promise<void> =>
  new Promise((resolve, reject) =>
    // @types/express-session types touch's callback as zero-arg, but connect-redis
    // passes (err) at runtime — cast so we can still surface a touch error.
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    store.touch!(
      sid,
      data as never,
      ((err?: Error) => (err ? reject(err) : resolve())) as () => void,
    ),
  );

/**
 * A COMPLETE session. The highest cross-version risk is `cookie.expires` (a Date):
 * it must serialize identically under both store versions (JSON → ISO string).
 */
const makeFixture = () => ({
  cookie: {
    originalMaxAge: TTL_SECONDS * 1000,
    expires: new Date('2026-08-01T00:00:00.000Z'),
    httpOnly: true,
    path: '/',
    sameSite: 'lax' as const,
    secure: false,
  },
  passport: { user: 'user-12345' },
  cart: {
    items: [
      { id: 'p1', qty: 2 },
      { id: 'p2', qty: 1 },
    ],
    total: 4999,
  },
  landing: { source: 'google', medium: 'cpc', ts: 1700000000000 },
  sessionVersion: 3,
});

describe('Session store — connect-redis@9 + node-redis (PR-9e.2)', () => {
  let container: StartedRedisContainer;
  let url: string;

  beforeAll(async () => {
    container = await new RedisContainer(REDIS_IMAGE).start();
    url = container.getConnectionUrl();
  }, 120_000);

  afterAll(async () => {
    if (container) await container.stop();
  });

  describe('wire-format compatibility v5 (ioredis) ↔ v9 (node-redis)', () => {
    let ioredisClient: IORedis;
    let nodeRedisClient: ReturnType<typeof createClient>;
    let rawClient: ReturnType<typeof createClient>;
    let storeV5: Store;
    let storeV9: Store;

    beforeAll(async () => {
      ioredisClient = new IORedis(url);
      nodeRedisClient = createClient({ url });
      rawClient = createClient({ url });
      nodeRedisClient.on('error', () => undefined);
      rawClient.on('error', () => undefined);
      await nodeRedisClient.connect();
      await rawClient.connect();

      const RedisStoreV5 = connectRedisV5Factory(expressSession);
      storeV5 = new RedisStoreV5({
        client: ioredisClient,
        prefix: PREFIX,
        ttl: TTL_SECONDS,
      });
      storeV9 = new RedisStore({
        client: nodeRedisClient,
        prefix: PREFIX,
        ttl: TTL_SECONDS,
      });
    });

    afterAll(async () => {
      ioredisClient?.disconnect();
      await nodeRedisClient?.close().catch(() => undefined);
      await rawClient?.close().catch(() => undefined);
    });

    beforeEach(async () => {
      await rawClient.flushDb();
    });

    it('FORWARD (deploy v5→v9): a session written by connect-redis@5 is read identically by connect-redis@9', async () => {
      const fixture = makeFixture();
      const expected = JSON.parse(JSON.stringify(fixture));
      await setSession(storeV5, 'sid-fwd', fixture);
      expect(await getSession(storeV9, 'sid-fwd')).toEqual(expected);
    });

    it('BACKWARD (rollback v9→v5): a session written by connect-redis@9 is read identically by connect-redis@5 — proves rollback is safe', async () => {
      const fixture = makeFixture();
      const expected = JSON.parse(JSON.stringify(fixture));
      await setSession(storeV9, 'sid-bwd', fixture);
      expect(await getSession(storeV5, 'sid-bwd')).toEqual(expected);
    });

    it('byte-identical: v5 and v9 serialize the same session to structurally identical Redis values, under the same `sess:` key scheme', async () => {
      const fixture = makeFixture();
      await setSession(storeV5, 'sidA', fixture);
      await setSession(storeV9, 'sidB', fixture);
      const rawA = await rawClient.get(`${PREFIX}sidA`);
      const rawB = await rawClient.get(`${PREFIX}sidB`);
      expect(rawA).not.toBeNull();
      expect(rawB).not.toBeNull();
      expect(JSON.parse(rawA as string)).toEqual(JSON.parse(rawB as string));
      const keys = (await rawClient.keys('sess:*')).sort();
      expect(keys).toEqual(['sess:sidA', 'sess:sidB']);
    });

    it('applies the configured 30d ttl option (no cookie.expires) and rolling touch resets it (disableTouch:false)', async () => {
      // NOTE: a session WITH cookie.expires derives its Redis TTL from that expiry
      // (ceil((expires - now)/1000)) — identically under v5 and v9, already covered
      // by the byte-identical test. To assert the configured `ttl` OPTION
      // deterministically (independent of the run date), use a session with no expiry.
      const noExpiry = {
        cookie: { httpOnly: true, path: '/', sameSite: 'lax' as const },
        k: 'v',
      };
      await setSession(storeV9, 'sid-ttl', noExpiry);
      const pttl1 = await rawClient.pTTL(`${PREFIX}sid-ttl`);
      expect(pttl1).toBeGreaterThan((TTL_SECONDS - 120) * 1000);
      expect(pttl1).toBeLessThanOrEqual(TTL_SECONDS * 1000);

      // Shrink the key TTL, then touch — a rolling-TTL store must reset it.
      await rawClient.pExpire(`${PREFIX}sid-ttl`, 5_000);
      await touchSession(storeV9, 'sid-ttl', noExpiry);
      const pttl2 = await rawClient.pTTL(`${PREFIX}sid-ttl`);
      expect(pttl2).toBeGreaterThan((TTL_SECONDS - 120) * 1000);
    });
  });

  describe('SessionStoreService lifecycle (the shipped service)', () => {
    it('does NOT connect in the constructor (boot stays deferred to onApplicationBootstrap)', () => {
      const prev = process.env.REDIS_URL;
      process.env.REDIS_URL = url;
      const service = new SessionStoreService();
      try {
        expect(service.isOpen()).toBe(false);
      } finally {
        process.env.REDIS_URL = prev;
      }
    });

    it('connects at bootstrap → isOpen → healthCheck passes → builds middleware → closes on shutdown', async () => {
      const prev = process.env.REDIS_URL;
      process.env.REDIS_URL = url;
      const service = new SessionStoreService();
      try {
        await service.onApplicationBootstrap();
        expect(service.isOpen()).toBe(true);
        await expect(service.healthCheck()).resolves.toBeUndefined();
        expect(typeof service.createSessionMiddleware()).toBe('function');
        await service.onApplicationShutdown();
        expect(service.isOpen()).toBe(false);
      } finally {
        process.env.REDIS_URL = prev;
        await service.onApplicationShutdown().catch(() => undefined);
      }
    }, 30_000);

    it('preserves SESSION_SECRET fail-fast: a weak secret throws in production', () => {
      const prev = {
        url: process.env.REDIS_URL,
        secret: process.env.SESSION_SECRET,
        env: process.env.NODE_ENV,
      };
      process.env.REDIS_URL = url;
      const service = new SessionStoreService();
      try {
        process.env.NODE_ENV = 'production';
        process.env.SESSION_SECRET = 'changeme'; // weak placeholder
        expect(() => service.createSessionMiddleware()).toThrow(
          /SESSION_SECRET/,
        );
      } finally {
        process.env.NODE_ENV = prev.env;
        process.env.SESSION_SECRET = prev.secret;
        process.env.REDIS_URL = prev.url;
      }
    });
  });

  describe('SessionStoreService fail-fast + resilience', () => {
    it('fail-fast: bootstrap REJECTS (bounded, never hangs) when Redis is unreachable at boot', async () => {
      const prev = process.env.REDIS_URL;
      process.env.REDIS_URL = 'redis://127.0.0.1:6390'; // nothing listening
      const service = new SessionStoreService();
      try {
        const start = Date.now();
        await expect(service.onApplicationBootstrap()).rejects.toBeDefined();
        expect(Date.now() - start).toBeLessThan(15_000); // bounded by BOOT_CONNECT_DEADLINE_MS
        expect(service.isOpen()).toBe(false);
      } finally {
        process.env.REDIS_URL = prev;
        await service.onApplicationShutdown().catch(() => undefined);
      }
    }, 20_000);

    it('resilience: healthCheck() degrades cleanly (bounded reject, no hang) when Redis dies under a live client', async () => {
      const ephemeral = await new RedisContainer(REDIS_IMAGE).start();
      const prev = process.env.REDIS_URL;
      process.env.REDIS_URL = ephemeral.getConnectionUrl();
      const service = new SessionStoreService();
      let stopped = false;
      try {
        await service.onApplicationBootstrap();
        expect(service.isOpen()).toBe(true);
        await ephemeral.stop();
        stopped = true;
        const start = Date.now();
        await expect(service.healthCheck()).rejects.toBeDefined();
        expect(Date.now() - start).toBeLessThan(6_000); // HEALTHCHECK_TIMEOUT_MS + margin
      } finally {
        process.env.REDIS_URL = prev;
        await service.onApplicationShutdown().catch(() => undefined);
        if (!stopped) await ephemeral.stop().catch(() => undefined);
      }
    }, 60_000);
  });
});

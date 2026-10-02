import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import Redis from 'ioredis';
import RedisMock from 'ioredis-mock';
import { CacheService } from '@cache/cache.service';
import { BotGuardService } from './bot-guard.service';

const MINUTE = 60_000;
const DAY = 1440 * MINUTE;
const BASE = Date.UTC(2026, 8, 28, 12, 0, 30);
const socket = process.env.BOT_GUARD_TEST_REDIS_SOCKET;
if (
  socket &&
  !/^\/tmp\/automecanik-botguard-[A-Za-z0-9]+\/redis\.sock$/.test(socket)
) {
  throw new Error(
    'Real Redis tests require the dedicated temporary Unix socket',
  );
}

describe('BotGuard measurement integrity', () => {
  let redis: Redis;
  let cache: CacheService;
  let service: BotGuardService;
  let now: number;

  beforeEach(async () => {
    now = BASE;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const keyPrefix = `test:botguard:${randomUUID()}:`;
    redis = socket
      ? new Redis(socket, {
          keyPrefix,
          maxRetriesPerRequest: 0,
          enableOfflineQueue: false,
          lazyConnect: true,
        })
      : (new RedisMock({ keyPrefix }) as unknown as Redis);
    if (socket) await redis.connect();
    else Object.assign(redis, { status: 'ready' }); // ioredis-mock omits connection status
    cache = new CacheService();
    Object.assign(cache, { redisClient: redis, redisReady: true });
    service = new BotGuardService(
      { get: (_key: string, fallback: unknown) => fallback } as never,
      cache,
    );
  });

  afterEach(async () => {
    await redis.quit();
    jest.restoreAllMocks();
  });

  it('retains every concurrent allowed and blocked observation', async () => {
    await Promise.all(
      Array.from({ length: 80 }, (_, i) =>
        Promise.all([
          service.trackAllowed('FR'),
          service.logBlocked(`203.0.113.${i}`, 'US', 'behavior', `/test/${i}`),
        ]),
      ),
    );
    now += MINUTE;
    expect((await service.getStats()).stats24h).toMatchObject({
      totalAllowed: 80,
      totalBlocked: 80,
      total: 160,
      blockRate: '50.0%',
    });
  });

  it('ages out old observations despite uninterrupted new traffic', async () => {
    await service.trackAllowed('FR');
    now += DAY / 2;
    await service.trackAllowed('FR');
    now += DAY / 2;
    await service.trackAllowed('FR');
    now += MINUTE;
    expect((await service.getStats()).stats24h).toMatchObject({
      totalAllowed: 2,
    });
  });

  it('includes the exact lower bound and excludes the current partial minute across midnight', async () => {
    now = Date.UTC(2026, 8, 27, 23, 58, 0);
    await service.trackAllowed('FR'); // outside
    now += MINUTE;
    await service.trackAllowed('FR'); // inclusive lower bound
    now = Date.UTC(2026, 8, 28, 23, 58, 59);
    await service.trackAllowed('FR'); // last completed minute
    now += 1000;
    await service.trackAllowed('FR'); // excluded current minute
    expect((await service.getStats()).stats24h).toMatchObject({
      totalAllowed: 2,
      window: {
        from: '2026-09-27T23:59:00.000Z',
        to: '2026-09-28T23:59:00.000Z',
        resolutionSeconds: 60,
      },
    });
  });

  it('retains the latest 100 blocks under concurrent writes', async () => {
    await Promise.all(
      Array.from({ length: 130 }, (_, i) =>
        service.logBlocked(`203.0.113.${i}`, 'US', 'behavior', `/test/${i}`),
      ),
    );
    const entries = await service.getRecentBlocks();
    expect(entries).toHaveLength(100);
    expect(new Set(entries.map((entry) => entry.path)).size).toBe(100);
  });

  it('reports unavailable measurements instead of successful zeroes when Redis is unavailable', async () => {
    Object.assign(cache, { redisReady: false });
    expect((await service.getStats()).stats24h).toMatchObject({
      status: 'unavailable',
      totalAllowed: null,
      totalBlocked: null,
      total: null,
      blockRate: null,
    });
  });

  it('keeps Redis write failures non-blocking and observable without leaking request data', async () => {
    Object.assign(cache, { redisReady: false });
    await expect(service.trackAllowed('FR')).resolves.toBeUndefined();
    await expect(
      service.logBlocked('203.0.113.44', 'US', 'behavior', '/private'),
    ).resolves.toBeUndefined();
    expect(Logger.prototype.warn).toHaveBeenCalledWith(
      expect.stringContaining('BotGuard metrics unavailable'),
    );
    expect(
      JSON.stringify((Logger.prototype.warn as jest.Mock).mock.calls),
    ).not.toContain('/private');
  });

  it('does not reinterpret legacy counters as windowed history', async () => {
    await redis.set('bot-guard:stats:blocked:total', '999');
    expect((await service.getStats()).stats24h).toMatchObject({
      status: 'available',
      totalBlocked: 0,
      totalAllowed: 0,
      measurementVersion: 2,
      historyBackfilled: false,
    });
  });

  it('bounds counter retention and country-field cardinality', async () => {
    await service.trackAllowed('FR');
    await service.trackAllowed('invalid-unbounded-header');
    const key = `bot-guard:stats:v2:minute:${Math.floor(now / MINUTE)}`;
    expect(await redis.hgetall(key)).toEqual({
      allowed: '2',
      'allowed:country:FR': '1',
    });
    const ttl = await redis.ttl(key);
    expect(ttl).toBeGreaterThan(24 * 3600);
    expect(ttl).toBeLessThanOrEqual(25 * 3600);
  });

  it('filters expired recent blocks even when fresh writes extend the list TTL', async () => {
    await service.logBlocked('203.0.113.1', 'US', 'behavior', '/old');
    now += DAY / 2;
    await service.logBlocked('203.0.113.2', 'US', 'behavior', '/middle');
    now += DAY / 2 + MINUTE;
    await service.logBlocked('203.0.113.3', 'US', 'behavior', '/new');
    expect(
      (await service.getRecentBlocks()).map((entry) => entry.path),
    ).toEqual(['/new', '/middle']);
  });

  it.each(['not-a-number', '-1', '1.5', '9007199254740992'])(
    'surfaces corrupt counters (%s) as unavailable',
    async (value) => {
      const key = `bot-guard:stats:v2:minute:${Math.floor(now / MINUTE) - 1}`;
      await redis.hset(key, 'allowed', value);
      expect((await service.getStats()).stats24h).toMatchObject({
        status: 'unavailable',
        total: null,
      });
    },
  );

  it('surfaces Redis pipeline command errors instead of returning partial counts', async () => {
    if (!socket) {
      // ioredis-mock does not enforce Redis WRONGTYPE on hashes.
      // The real-Redis run below exercises the actual command failure.
      const pipeline = redis.pipeline();
      jest
        .spyOn(pipeline, 'exec')
        .mockResolvedValue([[new Error('WRONGTYPE'), null]]);
      jest.spyOn(redis, 'pipeline').mockReturnValue(pipeline);
    }
    await redis.set(
      `bot-guard:stats:v2:minute:${Math.floor(now / MINUTE) - 1}`,
      'wrong-type',
    );
    expect((await service.getStats()).stats24h).toMatchObject({
      status: 'unavailable',
      total: null,
    });
  });

  it('surfaces Redis transaction command errors without affecting the request', async () => {
    if (!socket) {
      const transaction = redis.multi();
      jest
        .spyOn(transaction, 'exec')
        .mockResolvedValue([[new Error('WRONGTYPE'), null]]);
      jest.spyOn(redis, 'multi').mockReturnValue(transaction);
    }
    await redis.set(
      `bot-guard:stats:v2:minute:${Math.floor(now / MINUTE)}`,
      'wrong-type',
    );
    await expect(service.trackAllowed('FR')).resolves.toBeUndefined();
    expect(Logger.prototype.warn).toHaveBeenCalledTimes(1);
  });

  it('throttles telemetry warnings to one per minute per process', async () => {
    Object.assign(cache, { redisReady: false });
    await Promise.all(
      Array.from({ length: 100 }, () => service.trackAllowed('FR')),
    );
    expect(Logger.prototype.warn).toHaveBeenCalledTimes(1);
    now += MINUTE;
    await service.trackAllowed('FR');
    expect(Logger.prototype.warn).toHaveBeenCalledTimes(2);
  });

  it('does not report an empty block list when Redis is unavailable', async () => {
    Object.assign(cache, { redisReady: false });
    await expect(service.getRecentBlocks()).rejects.toThrow(
      'Redis unavailable',
    );
  });
});

/**
 * Phase 7 — heartbeat-specific tests for SitemapV10SchedulerService.
 *
 * Scope : verify that `writeHeartbeat()` writes a structured payload to
 * Redis (via Bull queue.client SET command) with the correct key, value
 * shape and TTL. Cleanup on `onModuleDestroy`. Does NOT test the BullMQ
 * repeatable job scheduling (covered elsewhere / by integration).
 */

import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bull';
import {
  SitemapV10SchedulerService,
  HEARTBEAT_KEY_PREFIX,
  HEARTBEAT_TTL_SECONDS,
  type SitemapWorkerHeartbeat,
} from './sitemap-v10-scheduler.service';

const QUEUE_NAME = 'seo-monitor';

function makeMockQueue(): {
  add: jest.Mock;
  getRepeatableJobs: jest.Mock;
  removeRepeatableByKey: jest.Mock;
  client: { set: jest.Mock; del: jest.Mock };
} {
  return {
    add: jest.fn().mockResolvedValue(undefined),
    getRepeatableJobs: jest.fn().mockResolvedValue([]),
    removeRepeatableByKey: jest.fn().mockResolvedValue(undefined),
    client: {
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    },
  };
}

async function buildService(opts: {
  cronEnabled?: string | undefined;
  queue: ReturnType<typeof makeMockQueue>;
}): Promise<SitemapV10SchedulerService> {
  const env: Record<string, string | undefined> = {
    SEO_SITEMAP_CRON_ENABLED: opts.cronEnabled,
    SEO_SITEMAP_CRON: '0 3 * * *',
  };
  const moduleRef = await Test.createTestingModule({
    providers: [
      SitemapV10SchedulerService,
      { provide: getQueueToken(QUEUE_NAME), useValue: opts.queue },
      {
        provide: ConfigService,
        useValue: { get: (k: string, def?: string) => env[k] ?? def },
      },
    ],
  }).compile();
  return moduleRef.get(SitemapV10SchedulerService);
}

describe('SitemapV10SchedulerService — Phase 7 heartbeat', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('writes a structured heartbeat payload to Redis on onModuleInit', async () => {
    const queue = makeMockQueue();
    const service = await buildService({ queue });

    service.onModuleInit();
    // writeHeartbeat is called immediately (not awaited) — let microtasks flush
    await new Promise((r) => setImmediate(r));

    expect(queue.client.set).toHaveBeenCalledTimes(1);
    const [key, value, exFlag, ttl] = queue.client.set.mock.calls[0];
    expect(key).toMatch(new RegExp(`^${HEARTBEAT_KEY_PREFIX}\\d+$`));
    expect(exFlag).toBe('EX');
    expect(ttl).toBe(HEARTBEAT_TTL_SECONDS);

    const payload: SitemapWorkerHeartbeat = JSON.parse(value as string);
    expect(payload.pid).toBe(process.pid);
    expect(typeof payload.hostname).toBe('string');
    expect(payload.queue).toBe('seo-monitor');
    expect(payload.bullVersion).toBe('4.16.5');
    expect(typeof payload.startedAt).toBe('string');
    expect(typeof payload.lastHeartbeatAt).toBe('string');
    expect(payload.uptimeSec).toBeGreaterThanOrEqual(0);
    await service.onModuleDestroy();
  });

  it('does NOT start heartbeat when SEO_SITEMAP_CRON_ENABLED=false', async () => {
    const queue = makeMockQueue();
    const service = await buildService({
      cronEnabled: 'false',
      queue,
    });

    service.onModuleInit();
    await new Promise((r) => setImmediate(r));

    expect(queue.client.set).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
    await service.onModuleDestroy();
  });

  it('deletes the heartbeat key on onModuleDestroy', async () => {
    const queue = makeMockQueue();
    const service = await buildService({ queue });
    service.onModuleInit();
    await new Promise((r) => setImmediate(r));

    await service.onModuleDestroy();

    expect(queue.client.del).toHaveBeenCalledTimes(1);
    expect(queue.client.del.mock.calls[0][0]).toMatch(
      new RegExp(`^${HEARTBEAT_KEY_PREFIX}\\d+$`),
    );
  });

  it('refreshes heartbeat on the interval tick', async () => {
    jest.useFakeTimers();
    const queue = makeMockQueue();
    const service = await buildService({ queue });
    service.onModuleInit();
    await Promise.resolve(); // flush microtasks for the immediate write

    // Advance 30s — should trigger one more write
    jest.advanceTimersByTime(30_000);
    await Promise.resolve();

    // Initial write + 1 interval tick = at least 2 calls
    expect(queue.client.set.mock.calls.length).toBeGreaterThanOrEqual(2);
    await service.onModuleDestroy();
  });

  it('survives a Redis SET failure (logs warn, does not crash)', async () => {
    const queue = makeMockQueue();
    queue.client.set.mockRejectedValueOnce(new Error('redis down'));
    const service = await buildService({ queue });

    expect(() => service.onModuleInit()).not.toThrow();
    await new Promise((r) => setImmediate(r));

    // Subsequent ticks should still attempt to write (resilient).
    expect(queue.client.set).toHaveBeenCalled();
    await service.onModuleDestroy();
  });
});

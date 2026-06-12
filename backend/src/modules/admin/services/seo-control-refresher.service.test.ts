/**
 * Regression tests for SeoControlRefresherService (PR-SBD-1 SWR scheduler).
 *
 * Guards the bug fixed in #685: the refresher used to add BullMQ jobs under a
 * per-block name (`refresh-<block>-<range>`) while the processor declared a
 * bare `@Process()` — in legacy `bull` that throws
 * "Missing process handler for job type refresh-alerts-7d" on every iteration.
 *
 * The structural fix made both sides share `SEO_CONTROL_REFRESH_JOB`. These
 * tests pin that contract (job name == the processor's @Process arg) plus the
 * boot-purge of stale repeatables, so the regression cannot silently return.
 *
 * Mock-queue pattern mirrors sitemap-v10-scheduler.heartbeat.test.ts.
 */
import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bull';
import {
  SeoControlRefresherService,
  type SeoControlRefreshJobData,
} from './seo-control-refresher.service';
import {
  SEO_CONTROL_REFRESH_JOB,
  SEO_CONTROL_REFRESH_QUEUE,
} from '../constants/seo-control.constants';

type MockQueue = {
  add: jest.Mock;
  getRepeatableJobs: jest.Mock;
  removeRepeatableByKey: jest.Mock;
};

function makeMockQueue(stale: Array<{ key: string }> = []): MockQueue {
  return {
    add: jest.fn().mockResolvedValue(undefined),
    getRepeatableJobs: jest.fn().mockResolvedValue(stale),
    removeRepeatableByKey: jest.fn().mockResolvedValue(undefined),
  };
}

async function buildService(
  queue: MockQueue,
): Promise<SeoControlRefresherService> {
  const moduleRef = await Test.createTestingModule({
    providers: [
      SeoControlRefresherService,
      { provide: getQueueToken(SEO_CONTROL_REFRESH_QUEUE), useValue: queue },
    ],
  }).compile();
  return moduleRef.get(SeoControlRefresherService);
}

// Let the fire-and-forget `void scheduleAll()` (kicked off by onModuleInit) settle.
const flush = (): Promise<void> => new Promise((r) => setImmediate(r));

// TTL/2 cadence per block (see REFRESH_SCHEDULE in the service).
const EXPECTED_INTERVAL_MS: Record<SeoControlRefreshJobData['block'], number> =
  {
    alerts: 2 * 60 * 1000,
    losers: 15 * 60 * 1000,
    traffic: 30 * 60 * 1000,
    lowctr: 30 * 60 * 1000,
    conversion: 30 * 60 * 1000,
  };

describe('SeoControlRefresherService — SWR scheduling contract', () => {
  it('schedules on its own onModuleInit (no external trigger needed)', async () => {
    // Proves the service self-schedules — the processor does NOT need to inject it.
    const queue = makeMockQueue();
    const service = await buildService(queue);

    service.onModuleInit();
    await flush();

    expect(queue.add).toHaveBeenCalled();
  });

  it('purges stale repeatables BEFORE re-registering', async () => {
    const queue = makeMockQueue([{ key: 'stale:a' }, { key: 'stale:b' }]);
    const service = await buildService(queue);

    service.onModuleInit();
    await flush();

    expect(queue.getRepeatableJobs).toHaveBeenCalledTimes(1);
    expect(queue.removeRepeatableByKey).toHaveBeenCalledWith('stale:a');
    expect(queue.removeRepeatableByKey).toHaveBeenCalledWith('stale:b');
    // purge ordered before the first add
    expect(queue.getRepeatableJobs.mock.invocationCallOrder[0]).toBeLessThan(
      queue.add.mock.invocationCallOrder[0],
    );
  });

  it('registers all 10 jobs under SEO_CONTROL_REFRESH_JOB (regression guard: name == processor @Process arg)', async () => {
    const queue = makeMockQueue();
    const service = await buildService(queue);

    service.onModuleInit();
    await flush();

    // 5 blocks × 2 ranges
    expect(queue.add).toHaveBeenCalledTimes(10);

    for (const call of queue.add.mock.calls) {
      const [name, data, opts] = call as [
        string,
        SeoControlRefreshJobData,
        { repeat: { every: number }; jobId: string },
      ];
      // THE contract: every job must carry the single static name the
      // processor handles via @Process(SEO_CONTROL_REFRESH_JOB).
      expect(name).toBe(SEO_CONTROL_REFRESH_JOB);
      // idempotency key still encodes the (block,range) pair
      expect(opts.jobId).toBe(`refresh-${data.block}-${data.range}`);
      // repeat cadence = TTL/2 for that block
      expect(opts.repeat.every).toBe(EXPECTED_INTERVAL_MS[data.block]);
    }

    // exactly the 5 blocks × both ranges, once each
    const combos = queue.add.mock.calls
      .map((c) => {
        const d = c[1] as SeoControlRefreshJobData;
        return `${d.block}/${d.range}`;
      })
      .sort();
    expect(combos).toEqual(
      [
        'alerts/7d',
        'alerts/28d',
        'conversion/7d',
        'conversion/28d',
        'losers/7d',
        'losers/28d',
        'lowctr/7d',
        'lowctr/28d',
        'traffic/7d',
        'traffic/28d',
      ].sort(),
    );
  });
});

import type { ConfigService } from '@nestjs/config';
import type { Queue } from 'bull';
import { SyntheticCrawlerSchedulerService } from './synthetic-crawler.scheduler.service';
import { SYNTHETIC_CRAWL_JOB_NAME } from '../../types';

/** Laisse les fire-and-forget (`void this.…()`) de onModuleInit se résoudre. */
const flushAsync = () => new Promise((r) => setImmediate(r));

function makeQueue(repeatables: Array<{ name: string; key: string }> = []) {
  return {
    getRepeatableJobs: jest.fn(async () => repeatables),
    removeRepeatableByKey: jest.fn(async () => undefined),
    add: jest.fn(async () => undefined),
  } as unknown as jest.Mocked<Queue> & {
    getRepeatableJobs: jest.Mock;
    removeRepeatableByKey: jest.Mock;
    add: jest.Mock;
  };
}

function makeConfig(env: Record<string, string | undefined>): ConfigService {
  return {
    get: (k: string, d?: string) => env[k] ?? d,
  } as unknown as ConfigService;
}

describe('SyntheticCrawlerSchedulerService — authoritative kill-switch', () => {
  it('SEO_CP_SYNTHETIC_ENABLED=false REMOVES the stale repeatable (toggle off is not a no-op)', async () => {
    const queue = makeQueue([
      { name: SYNTHETIC_CRAWL_JOB_NAME, key: 'repeat:synthetic:1' },
      { name: 'seo-cp-cf-analytics-fetch', key: 'repeat:other:1' }, // must NOT be touched
    ]);
    const svc = new SyntheticCrawlerSchedulerService(
      queue,
      makeConfig({ SEO_CP_SYNTHETIC_ENABLED: 'false' }),
    );

    svc.onModuleInit();
    await flushAsync();

    expect(queue.getRepeatableJobs).toHaveBeenCalledTimes(1);
    expect(queue.removeRepeatableByKey).toHaveBeenCalledTimes(1);
    expect(queue.removeRepeatableByKey).toHaveBeenCalledWith(
      'repeat:synthetic:1',
    );
    // never schedules, and never touches a sibling collector's repeatable
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('enabled by default (flag unset) → schedules the q15min repeatable', async () => {
    const queue = makeQueue([]);
    const svc = new SyntheticCrawlerSchedulerService(queue, makeConfig({}));

    svc.onModuleInit();
    await flushAsync();

    expect(queue.add).toHaveBeenCalledTimes(1);
    const [name, , opts] = queue.add.mock.calls[0];
    expect(name).toBe(SYNTHETIC_CRAWL_JOB_NAME);
    expect((opts as { repeat?: { cron: string } }).repeat?.cron).toBe(
      '*/15 * * * *',
    );
  });

  it('SEO_CP_SYNTHETIC_ENABLED=0 is also treated as disabled', async () => {
    const queue = makeQueue([
      { name: SYNTHETIC_CRAWL_JOB_NAME, key: 'repeat:synthetic:9' },
    ]);
    const svc = new SyntheticCrawlerSchedulerService(
      queue,
      makeConfig({ SEO_CP_SYNTHETIC_ENABLED: '0' }),
    );

    svc.onModuleInit();
    await flushAsync();

    expect(queue.removeRepeatableByKey).toHaveBeenCalledWith(
      'repeat:synthetic:9',
    );
    expect(queue.add).not.toHaveBeenCalled();
  });
});

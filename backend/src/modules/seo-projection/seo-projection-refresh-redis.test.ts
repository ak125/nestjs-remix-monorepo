/** Real Bull + Redis + Nest lifecycle. PostgreSQL transport is simulated here;
 * SQL snapshot/ACK atomicity is proven separately by the PostgreSQL harness.
 * Uses the repository's testcontainers fixture pattern, never shared Redis.
 */
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import { BullModule, getQueueToken } from '@nestjs/bull';
import { Test, TestingModule } from '@nestjs/testing';
import Bull, { Job, Queue } from 'bull';
import { randomUUID } from 'node:crypto';
import { SeoProjectionRefreshProcessor } from './seo-projection-refresh.processor';
import { SeoProjectionWriterService } from './seo-projection-writer.service';
import {
  PROJECTION_REFRESH_JOB,
  PROJECTION_REFRESH_JOB_ID,
  PROJECTION_REFRESH_QUEUE,
  REFRESH_DEBOUNCE_MS,
  type ProjectionRefreshJobData,
} from './seo-projection.types';

function signal() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function until(condition: () => Promise<boolean> | boolean) {
  const deadline = Date.now() + 8000;
  while (!(await condition())) {
    if (Date.now() >= deadline)
      throw new Error('Redis recovery assertion timed out');
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  }
}

describe('refresh recovery — real Redis and native Nest/Bull hooks', () => {
  let container: StartedRedisContainer;
  let url: string;
  let modules: TestingModule[];
  let queues: Queue[];
  let releases: Array<() => void>;

  beforeAll(async () => {
    container = await new RedisContainer('redis:7-alpine').start();
    url = container.getConnectionUrl();
  }, 60000);
  afterAll(async () => {
    if (container) await container.stop();
  });
  beforeEach(() => {
    modules = [];
    queues = [];
    releases = [];
  });
  afterEach(async () => {
    releases.forEach((release) => release());
    for (const module of modules) await module.close();
    for (const queue of queues) await queue.close();
  });

  function backlog() {
    const pending = new Set<number>();
    const refreshed = jest.fn(async () => {
      const captured = [...pending];
      captured.forEach((id) => pending.delete(id));
      return { refreshed: true };
    });
    const hasPendingProjectionRefresh = jest.fn(async () => pending.size > 0);
    return {
      pending,
      refreshed,
      writer: { refreshViews: refreshed, hasPendingProjectionRefresh },
    };
  }

  async function start(
    writer: ReturnType<typeof backlog>['writer'],
    prefix = randomUUID(),
  ) {
    const module = await Test.createTestingModule({
      imports: [
        BullModule.forRoot({
          redis: url,
          prefix,
          // Production retry count; only failure backoff is accelerated in this fixture.
          defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 20 },
          },
        }),
        BullModule.registerQueue({ name: PROJECTION_REFRESH_QUEUE }),
      ],
      providers: [
        SeoProjectionRefreshProcessor,
        { provide: SeoProjectionWriterService, useValue: writer },
      ],
    }).compile();
    modules.push(module);
    await module.init();
    const queue = module.get<Queue<ProjectionRefreshJobData>>(
      getQueueToken(PROJECTION_REFRESH_QUEUE),
    );
    return { module, queue, prefix };
  }

  async function enqueue(queue: Queue) {
    return queue.add(
      PROJECTION_REFRESH_JOB,
      { triggeredBy: 'test' },
      {
        jobId: PROJECTION_REFRESH_JOB_ID,
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  }

  async function promoteRecovery(queue: Queue) {
    let recovery: Job | null = null;
    await until(async () => {
      recovery = await queue.getJob(PROJECTION_REFRESH_JOB_ID);
      return (
        !!recovery &&
        recovery.opts.delay === REFRESH_DEBOUNCE_MS &&
        (await recovery.getState()) === 'delayed'
      );
    });
    const job = recovery as unknown as Job;
    expect(job.opts.delay).toBe(REFRESH_DEBOUNCE_MS);
    // Assert the production debounce before advancing this fixture's delayed job.
    await job.promote();
  }

  it('characterizes the old gap: adding an active singleton does not create a successor', async () => {
    const b = backlog();
    b.pending.add(1);
    const entered = signal();
    const release = signal();
    releases.push(release.resolve);
    const queue = new Bull(PROJECTION_REFRESH_QUEUE, url, {
      prefix: randomUUID(),
    });
    queues.push(queue);
    const completed = signal();
    queue.on('completed', completed.resolve);
    void queue.process(PROJECTION_REFRESH_JOB, async () => {
      b.pending.delete(1);
      entered.resolve();
      await release.promise;
      return { refreshed: true };
    });
    await enqueue(queue);
    await entered.promise;
    b.pending.add(2);
    await enqueue(queue);
    expect(await queue.getActiveCount()).toBe(1);
    expect(await queue.getWaitingCount()).toBe(0);
    release.resolve();
    await completed.promise;
    expect(await queue.getJob(PROJECTION_REFRESH_JOB_ID)).toBeNull();
    expect([...b.pending]).toEqual([2]);
  });

  it('native completed hook schedules late work after the singleton has been removed', async () => {
    const b = backlog();
    const { queue } = await start(b.writer);
    b.pending.add(1);
    const entered = signal();
    const release = signal();
    releases.push(release.resolve);
    b.refreshed.mockImplementationOnce(async () => {
      b.pending.delete(1);
      entered.resolve();
      await release.promise;
      return { refreshed: true };
    });
    await enqueue(queue);
    await entered.promise;
    b.pending.add(2);
    await enqueue(queue);
    expect(await queue.getWaitingCount()).toBe(0);
    release.resolve();
    await promoteRecovery(queue);
    await until(() => b.pending.size === 0);
    await until(
      async () => (await queue.getJob(PROJECTION_REFRESH_JOB_ID)) === null,
    );
    expect(b.refreshed).toHaveBeenCalledTimes(2);
    expect(await queue.getDelayedCount()).toBe(0);
  });

  it('a producer after the completion lookup can still enqueue the released singleton', async () => {
    const b = backlog();
    const { queue } = await start(b.writer);
    // Initial startup lookup has completed before we install the completion barrier.
    await until(
      () => b.writer.hasPendingProjectionRefresh.mock.calls.length > 0,
    );
    const checked = signal();
    const release = signal();
    releases.push(release.resolve);
    b.writer.hasPendingProjectionRefresh.mockImplementationOnce(async () => {
      const observed = b.pending.size > 0;
      checked.resolve();
      await release.promise;
      return observed;
    });
    b.pending.add(1);
    await enqueue(queue);
    await checked.promise;
    b.pending.add(2);
    await enqueue(queue);
    release.resolve();
    await until(
      () => b.pending.size === 0 && b.refreshed.mock.calls.length === 2,
    );
  });

  it('boot reconciles committed backlog with no queued job or new writer run', async () => {
    const b = backlog();
    const old = await start(b.writer);
    await old.queue.isReady();
    await until(async () => (await old.queue.getWorkers()).length > 0);
    await old.module.close();
    modules = modules.filter((m) => m !== old.module);
    // Represents a committed DB event whose enqueue/completion callback was lost.
    b.pending.add(7);
    const restarted = await start(b.writer, old.prefix);
    await promoteRecovery(restarted.queue);
    await until(() => b.pending.size === 0);
    expect(b.refreshed).toHaveBeenCalledTimes(1);
  });

  it('boot coalesces with a job persisted before the old queue connection closed', async () => {
    const prefix = randomUUID();
    const b = backlog();
    b.pending.add(8);
    const old = new Bull(PROJECTION_REFRESH_QUEUE, url, { prefix });
    await enqueue(old);
    await old.close();
    const { queue } = await start(b.writer, prefix);
    await until(() => b.pending.size === 0);
    await until(
      async () => (await queue.getJob(PROJECTION_REFRESH_JOB_ID)) === null,
    );
    expect(b.refreshed).toHaveBeenCalledTimes(1);
  });

  it('RPC failure uses native bounded retry, then acknowledges the backlog', async () => {
    const b = backlog();
    b.pending.add(9);
    b.refreshed.mockImplementationOnce(async () => ({
      refreshed: false,
      error: 'injected RPC failure',
    }));
    const { queue } = await start(b.writer);
    await promoteRecovery(queue);
    await until(() => b.pending.size === 0);
    await until(
      async () => (await queue.getJob(PROJECTION_REFRESH_JOB_ID)) === null,
    );
    expect(b.refreshed).toHaveBeenCalledTimes(2);
  });
  it('terminal failure keeps the DB backlog without bypassing the retry limit', async () => {
    const b = backlog();
    b.pending.add(10);
    b.refreshed.mockImplementation(async () => ({
      refreshed: false,
      error: 'persistent RPC failure',
    }));
    const { queue } = await start(b.writer);
    await promoteRecovery(queue);
    await until(() => b.refreshed.mock.calls.length === 3);
    await until(
      async () => (await queue.getJob(PROJECTION_REFRESH_JOB_ID)) === null,
    );
    expect([...b.pending]).toEqual([10]);
    expect(await queue.getDelayedCount()).toBe(0);
    expect(await queue.getWaitingCount()).toBe(0);
    expect(b.writer.hasPendingProjectionRefresh).toHaveBeenCalledTimes(1);
  });
});

import { SupplierSyncScheduler } from './supplier-sync.scheduler';
import { SupplierSyncJobProcessor } from './supplier-sync.job.processor';
import type { SupplierSyncRunner } from './supplier-sync.runner';
import type { ConfigService } from '@nestjs/config';

const PERSISTED_REPEATABLE_KEY = 'sync:supplier-sync-repeatable:::0 */4 * * *';

/** Bull keeps repeatables in Redis across restarts: seed what an earlier `flag=true` boot armed. */
function mockQueue(persisted: Array<{ name: string; key: string }> = []) {
  return {
    add: jest.fn(async () => ({ id: '1' })),
    getRepeatableJobs: jest.fn(async () => persisted),
    removeRepeatableByKey: jest.fn(async () => undefined),
  } as unknown as import('bull').Queue;
}

/** ConfigService stub returning a fixed SUPPLIER_TRUTH_SYNC_ENABLED value. */
function mockConfig(enabled: boolean): ConfigService {
  return {
    get: jest.fn((key: string) =>
      key === 'SUPPLIER_TRUTH_SYNC_ENABLED'
        ? enabled
          ? 'true'
          : 'false'
        : undefined,
    ),
  } as unknown as ConfigService;
}

const flushMicrotasks = () => new Promise((resolve) => setImmediate(resolve));

describe('SupplierSyncScheduler', () => {
  it('onModuleInit is SYNCHRONOUS (returns void, defers work) — CLAUDE.md non-blocking rule', () => {
    const s = new SupplierSyncScheduler(mockQueue(), mockConfig(true));
    const ret = s.onModuleInit();
    expect(ret).toBeUndefined(); // not a Promise
  });

  it('INERT by default: flag!=true ⇒ onModuleInit arms NO repeatable job (no queue.add ever)', async () => {
    const q = mockQueue();
    new SupplierSyncScheduler(q, mockConfig(false)).onModuleInit();
    await flushMicrotasks(); // even if work were deferred, give it a tick
    expect(q.add).not.toHaveBeenCalled();
  });

  it('active→inactive: flag!=true ⇒ onModuleInit disarms the repeatable a previous boot left in Redis', async () => {
    const q = mockQueue([
      { name: 'sync', key: PERSISTED_REPEATABLE_KEY },
      { name: 'other-job', key: 'other-job:x:::* * * * *' },
    ]);
    new SupplierSyncScheduler(q, mockConfig(false)).onModuleInit();
    await flushMicrotasks();
    expect(q.removeRepeatableByKey).toHaveBeenCalledTimes(1);
    expect(q.removeRepeatableByKey).toHaveBeenCalledWith(
      PERSISTED_REPEATABLE_KEY,
    );
    expect(q.add).not.toHaveBeenCalled();
  });

  it('flag!=true and Redis unreachable ⇒ onModuleInit stays synchronous and does not throw', async () => {
    const q = mockQueue();
    (q.getRepeatableJobs as jest.Mock).mockRejectedValueOnce(
      new Error('ECONNREFUSED'),
    );
    const s = new SupplierSyncScheduler(q, mockConfig(false));
    expect(s.onModuleInit()).toBeUndefined();
    await flushMicrotasks();
    expect(q.removeRepeatableByKey).not.toHaveBeenCalled();
  });

  it('isSyncEnabled reflects the flag', () => {
    expect(
      new SupplierSyncScheduler(mockQueue(), mockConfig(false)).isSyncEnabled(),
    ).toBe(false);
    expect(
      new SupplierSyncScheduler(mockQueue(), mockConfig(true)).isSyncEnabled(),
    ).toBe(true);
  });

  it('flag=true ⇒ onModuleInit arms the repeatable cron job', async () => {
    const q = mockQueue();
    new SupplierSyncScheduler(q, mockConfig(true)).onModuleInit();
    await flushMicrotasks(); // configureRepeatable is deferred with void
    expect(q.add).toHaveBeenCalledWith(
      'sync',
      {},
      expect.objectContaining({
        repeat: { cron: '0 */4 * * *' },
        jobId: 'supplier-sync-repeatable',
      }),
    );
  });

  it('configureRepeatable enqueues a repeatable cron job with a fixed jobId (idempotent)', async () => {
    const q = mockQueue();
    await new SupplierSyncScheduler(q, mockConfig(true)).configureRepeatable();
    expect(q.add).toHaveBeenCalledWith(
      'sync',
      {},
      expect.objectContaining({
        repeat: { cron: '0 */4 * * *' },
        jobId: 'supplier-sync-repeatable',
      }),
    );
  });

  it('triggerNow enqueues a one-off job (no repeat)', async () => {
    const q = mockQueue();
    await new SupplierSyncScheduler(q, mockConfig(true)).triggerNow();
    const call = (q.add as jest.Mock).mock.calls[0];
    expect(call[0]).toBe('sync');
    expect(call[2].repeat).toBeUndefined();
  });
});

describe('SupplierSyncJobProcessor', () => {
  function mockRunner() {
    return {
      runSync: jest.fn(async () => ({
        suppliersRun: 1,
        suppliersFailed: 0,
        suppliersSkipped: 0,
        refs: 2,
        offersInserted: 2,
      })),
    } as unknown as SupplierSyncRunner;
  }

  it('runs one sync cycle via the runner', async () => {
    const runner = mockRunner();
    const summary = await new SupplierSyncJobProcessor(
      runner,
      mockConfig(true),
    ).handle();
    expect(runner.runSync).toHaveBeenCalled();
    expect(summary).toMatchObject({ offersInserted: 2 });
  });

  it('flag!=true ⇒ a residual, retried or one-off job never reaches the runner (no portal login, no DB write)', async () => {
    const runner = mockRunner();
    const result = await new SupplierSyncJobProcessor(
      runner,
      mockConfig(false),
    ).handle();
    expect(runner.runSync).not.toHaveBeenCalled();
    expect(result).toEqual({ skipped: 'SUPPLIER_TRUTH_SYNC_ENABLED!=true' });
  });
});

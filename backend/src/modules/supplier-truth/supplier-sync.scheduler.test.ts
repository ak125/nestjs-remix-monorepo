import { SupplierSyncScheduler } from './supplier-sync.scheduler';
import { SupplierSyncJobProcessor } from './supplier-sync.job.processor';
import type { SupplierSyncRunner } from './supplier-sync.runner';
import type { ConfigService } from '@nestjs/config';

function mockQueue() {
  return {
    add: jest.fn(async () => ({ id: '1' })),
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
  it('runs one sync cycle via the runner', async () => {
    const runner = {
      runSync: jest.fn(async () => ({
        suppliersRun: 1,
        suppliersFailed: 0,
        suppliersSkipped: 0,
        refs: 2,
        projectionsUpserted: 2,
      })),
    } as unknown as SupplierSyncRunner;
    const summary = await new SupplierSyncJobProcessor(runner).handle();
    expect(runner.runSync).toHaveBeenCalled();
    expect(summary.projectionsUpserted).toBe(2);
  });
});

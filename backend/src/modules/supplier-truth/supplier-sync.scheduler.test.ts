import { SupplierSyncScheduler } from './supplier-sync.scheduler';
import { SupplierSyncJobProcessor } from './supplier-sync.job.processor';
import type { SupplierSyncRunner } from './supplier-sync.runner';

function mockQueue() {
  return {
    add: jest.fn(async () => ({ id: '1' })),
  } as unknown as import('bull').Queue;
}

describe('SupplierSyncScheduler', () => {
  it('onModuleInit is SYNCHRONOUS (returns void, defers work) — CLAUDE.md non-blocking rule', () => {
    const s = new SupplierSyncScheduler(mockQueue());
    const ret = s.onModuleInit();
    expect(ret).toBeUndefined(); // not a Promise
  });

  it('configureRepeatable enqueues a repeatable cron job with a fixed jobId (idempotent)', async () => {
    const q = mockQueue();
    await new SupplierSyncScheduler(q).configureRepeatable();
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
    await new SupplierSyncScheduler(q).triggerNow();
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

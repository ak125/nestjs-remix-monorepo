import {
  SUPPLIER_OFFER_RELEVE_JOB,
  SupplierSyncScheduler,
} from './supplier-sync.scheduler';
import { SupplierSyncJobProcessor } from './supplier-sync.job.processor';
import type { SupplierSyncRunner } from './supplier-sync.runner';
import type { SupplierOfferReleveRunner } from './supplier-offer-releve.runner';
import {
  FRAICHEUR_RELEVE_MAX_MINUTES,
  RELEVE_CRON,
  RELEVE_INTERVALLE_MINUTES,
} from './supplier-offer-releve';
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

/** ConfigService stub: SUPPLIER_TRUTH_SYNC_ENABLED, puis SUPPLIER_OFFER_RELEVE_ENABLED. */
function mockConfig(enabled: boolean, releve = false): ConfigService {
  return {
    get: jest.fn((key: string) =>
      key === 'SUPPLIER_TRUTH_SYNC_ENABLED'
        ? enabled
          ? 'true'
          : 'false'
        : key === 'SUPPLIER_OFFER_RELEVE_ENABLED'
          ? releve
            ? 'true'
            : undefined
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

  function mockReleve() {
    return {
      runReleve: jest.fn(async () => ({ lignes: 1, relevesEcrits: 1 })),
    } as unknown as SupplierOfferReleveRunner;
  }

  it('runs one sync cycle via the runner', async () => {
    const runner = mockRunner();
    const summary = await new SupplierSyncJobProcessor(
      runner,
      mockConfig(true),
      mockReleve(),
    ).handle();
    expect(runner.runSync).toHaveBeenCalled();
    expect(summary).toMatchObject({ offersInserted: 2 });
  });

  it('flag!=true ⇒ a residual, retried or one-off job never reaches the runner (no portal login, no DB write)', async () => {
    const runner = mockRunner();
    const result = await new SupplierSyncJobProcessor(
      runner,
      mockConfig(false),
      mockReleve(),
    ).handle();
    expect(runner.runSync).not.toHaveBeenCalled();
    expect(result).toEqual({ skipped: 'SUPPLIER_TRUTH_SYNC_ENABLED!=true' });
  });

  it('relevé : drapeau absent ⇒ job résiduel ignoré, aucun portail lu', async () => {
    const releve = mockReleve();
    const result = await new SupplierSyncJobProcessor(
      mockRunner(),
      mockConfig(true, false),
      releve,
    ).handleReleve();
    expect(releve.runReleve).not.toHaveBeenCalled();
    expect(result).toEqual({ skipped: 'SUPPLIER_OFFER_RELEVE_ENABLED!=true' });
  });

  it('relevé : drapeau « true » ⇒ un passage du relevé', async () => {
    const releve = mockReleve();
    await new SupplierSyncJobProcessor(
      mockRunner(),
      mockConfig(false, true),
      releve,
    ).handleReleve();
    expect(releve.runReleve).toHaveBeenCalledTimes(1);
  });
});

describe('Relevé des offres planifié (complément BK n° 4)', () => {
  it('cadence plus courte que la fraîcheur exigée : un relevé reste frais entre deux passages', () => {
    expect(RELEVE_CRON).toBe(`*/${RELEVE_INTERVALLE_MINUTES} * * * *`);
    expect(RELEVE_INTERVALLE_MINUTES).toBeLessThan(
      FRAICHEUR_RELEVE_MAX_MINUTES,
    );
  });

  it('drapeau absent (défaut) ⇒ aucun relevé armé, même si la synchro catalogue l’est', async () => {
    const q = mockQueue();
    new SupplierSyncScheduler(q, mockConfig(true, false)).onModuleInit();
    await flushMicrotasks();
    const noms = (q.add as jest.Mock).mock.calls.map((c) => c[0]);
    expect(noms).not.toContain(SUPPLIER_OFFER_RELEVE_JOB);
  });

  it('drapeau absent ⇒ désarme le relevé qu’un démarrage précédent a laissé', async () => {
    const cle = `${SUPPLIER_OFFER_RELEVE_JOB}:supplier-offer-releve-repeatable:::${RELEVE_CRON}`;
    const q = mockQueue([{ name: SUPPLIER_OFFER_RELEVE_JOB, key: cle }]);
    new SupplierSyncScheduler(q, mockConfig(false, false)).onModuleInit();
    await flushMicrotasks();
    expect(q.removeRepeatableByKey).toHaveBeenCalledWith(cle);
  });

  it('drapeau « true » ⇒ arme le relevé toutes les 15 min, jobId fixe', async () => {
    const q = mockQueue();
    new SupplierSyncScheduler(q, mockConfig(false, true)).onModuleInit();
    await flushMicrotasks();
    expect(q.add).toHaveBeenCalledWith(
      SUPPLIER_OFFER_RELEVE_JOB,
      {},
      expect.objectContaining({
        repeat: { cron: RELEVE_CRON },
        jobId: 'supplier-offer-releve-repeatable',
      }),
    );
    expect(q.add).not.toHaveBeenCalledWith('sync', {}, expect.anything());
  });
});

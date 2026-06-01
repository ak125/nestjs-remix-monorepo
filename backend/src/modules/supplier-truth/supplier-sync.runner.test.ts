import { SupplierSyncRunner } from './supplier-sync.runner';
import type { SupplierTruthRepository } from './supplier-truth.repository';
import type { SupplierSyncProcessor } from './supplier-sync.processor';
import type { SupplierConnector } from './connectors/supplier-connector.interface';

function makeConnector(): jest.Mocked<SupplierConnector> & { closed: boolean } {
  const c = {
    supplierId: '26',
    platform: 'inoshop',
    closed: false,
    login: jest.fn(async () => {}),
    fetchAvailability: jest.fn(async () => []),
    close: jest.fn(async function (this: { closed: boolean }) {
      // marked below
    }),
  } as unknown as jest.Mocked<SupplierConnector> & { closed: boolean };
  return c;
}

// refs all get pmId = brands[0]; DistriCash (registry) carries `brands` → filter passes.
const repo = (refs: string[], brands: number[] = [59]) =>
  ({
    getWorkingSet: jest.fn(async () =>
      refs.map((ref) => ({ ref, pmId: brands[0] ?? 59 })),
    ),
    getSupplierLinkedBrands: jest.fn(async () => brands),
  }) as unknown as SupplierTruthRepository;

const processor = () =>
  ({
    syncRefs: jest.fn(async () => ({
      observations: 1,
      snapshotsInserted: 1,
      unresolved: 0,
      projectionsUpserted: 1,
    })),
  }) as unknown as SupplierSyncProcessor;

describe('SupplierSyncRunner.runSync', () => {
  it('logs in and syncs the bounded working-set for a credentialed supplier', async () => {
    const connector = makeConnector();
    const proc = processor();
    const runner = new SupplierSyncRunner(
      repo(['ELH4261', 'SCL4123']),
      proc,
      () => connector,
      () => ({ user: 'u', password: 'p' }),
    );

    const summary = await runner.runSync();

    expect(connector.login).toHaveBeenCalledWith({ user: 'u', password: 'p' });
    expect(proc.syncRefs).toHaveBeenCalledWith(
      connector,
      ['ELH4261', 'SCL4123'],
      expect.any(Date),
    );
    expect(connector.close).toHaveBeenCalled(); // resources released
    expect(summary.suppliersRun).toBe(1);
    expect(summary.refs).toBe(2);
    expect(summary.projectionsUpserted).toBe(1);
  });

  it('skips a supplier with no credentials (never logs in)', async () => {
    const connector = makeConnector();
    const runner = new SupplierSyncRunner(
      repo(['ELH4261']),
      processor(),
      () => connector,
      () => null, // no creds
    );
    const summary = await runner.runSync();
    expect(connector.login).not.toHaveBeenCalled();
    expect(summary.suppliersRun).toBe(0);
    expect(summary.suppliersSkipped).toBe(1);
  });

  it('does nothing when the working-set is empty (no portal hits)', async () => {
    const connector = makeConnector();
    const runner = new SupplierSyncRunner(
      repo([]),
      processor(),
      () => connector,
      () => ({ user: 'u', password: 'p' }),
    );
    const summary = await runner.runSync();
    expect(connector.login).not.toHaveBeenCalled();
    expect(summary.refs).toBe(0);
  });

  it('a connector failure is isolated (counted skipped, browser still closed)', async () => {
    const connector = makeConnector();
    (connector.login as jest.Mock).mockRejectedValueOnce(
      new Error('login boom'),
    );
    const runner = new SupplierSyncRunner(
      repo(['ELH4261']),
      processor(),
      () => connector,
      () => ({ user: 'u', password: 'p' }),
    );
    const summary = await runner.runSync();
    expect(summary.suppliersRun).toBe(0);
    expect(summary.suppliersSkipped).toBe(1);
    expect(connector.close).toHaveBeenCalled();
  });

  it('skips when the supplier carries NONE of the working-set brands (never logs in)', async () => {
    const connector = makeConnector();
    const runner = new SupplierSyncRunner(
      repo(['ELH4261'], []), // supplier carries no brands → ref filtered out
      processor(),
      () => connector,
      () => ({ user: 'u', password: 'p' }),
    );
    const summary = await runner.runSync();
    expect(connector.login).not.toHaveBeenCalled();
    expect(summary.suppliersRun).toBe(0);
    expect(summary.suppliersSkipped).toBe(1);
  });
});

import type { ConfigService } from '@nestjs/config';
import { PATH_METADATA } from '@nestjs/common/constants';
import { SupplierTruthModule } from './supplier-truth.module';
import { SupplierTruthController } from './supplier-truth.controller';

describe('SupplierTruthModule wiring (read-only API — no sync duplication)', () => {
  const imports = Reflect.getMetadata('imports', SupplierTruthModule) ?? [];
  const controllers =
    Reflect.getMetadata('controllers', SupplierTruthModule) ?? [];
  const providers = Reflect.getMetadata('providers', SupplierTruthModule) ?? [];

  it('declares only the read-only controller and imports no data access', () => {
    expect(controllers).toEqual([SupplierTruthController]);
    // The status endpoint reads the env flag + the static connector registry.
    // Nothing here reaches the database, so the read slice is not imported.
    expect(imports).toHaveLength(0);
  });

  it('does NOT re-provide the sync runtime (queue/scheduler/processor/runner live in WorkerModule)', () => {
    // Anti-parallel-system guard: this module adds ONLY the read endpoint. Re-
    // providing the scheduler/@Processor here would create a second consumer on
    // the same BullMQ queue (double processing once active) + a duplicate armer.
    expect(providers).toHaveLength(0);
  });

  it('exposes exactly one route: status', () => {
    // `projection/:pieceId` was removed with the never-applied supplier_truth_v1
    // migration — it read a table that has never existed. A DB-backed route here
    // needs H3's own migration first.
    const proto = SupplierTruthController.prototype;
    const routes = Object.getOwnPropertyNames(proto)
      .filter((name) => name !== 'constructor')
      .map((name) =>
        Reflect.getMetadata(PATH_METADATA, proto[name as keyof typeof proto]),
      )
      .filter((path): path is string => typeof path === 'string');
    expect(routes).toEqual(['status']);
  });
});

function mockConfig(value: string): ConfigService {
  return { get: jest.fn(() => value) } as unknown as ConfigService;
}

describe('SupplierTruthController is strictly read-only', () => {
  it('status reports OBSERVABLE_DORMANT + connectable suppliers', () => {
    const status = new SupplierTruthController(mockConfig('false')).status();

    expect(status.mode).toBe('OBSERVABLE_DORMANT');
    expect(status.syncEnabled).toBe(false);
    const ids = status.connectableSuppliers.map((s) => s.supplierId).sort();
    expect(ids).toEqual(['19', '71']); // CAL + DistriCash
  });

  it('reports ACTIVE only when the flag is exactly "true" (conservative)', () => {
    expect(new SupplierTruthController(mockConfig('true')).status().mode).toBe(
      'ACTIVE',
    );
    // any other value (e.g. '1', 'TRUE') stays dormant — fail-safe
    expect(
      new SupplierTruthController(mockConfig('1')).status().syncEnabled,
    ).toBe(false);
  });
});

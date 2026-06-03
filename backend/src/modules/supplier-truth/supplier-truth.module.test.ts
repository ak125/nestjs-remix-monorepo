import type { ConfigService } from '@nestjs/config';
import { SupplierTruthModule } from './supplier-truth.module';
import { SupplierTruthController } from './supplier-truth.controller';
import { SupplierTruthReadModule } from './supplier-truth-read.module';
import { SupplierTruthService } from './supplier-truth.service';
import { AvailabilityState } from './domain/availability-state';

describe('SupplierTruthModule wiring (read-only API — no sync duplication)', () => {
  const imports = Reflect.getMetadata('imports', SupplierTruthModule) ?? [];
  const controllers =
    Reflect.getMetadata('controllers', SupplierTruthModule) ?? [];
  const providers = Reflect.getMetadata('providers', SupplierTruthModule) ?? [];

  it('reuses the shared read slice + declares the read-only controller', () => {
    expect(imports).toContain(SupplierTruthReadModule);
    expect(controllers).toEqual([SupplierTruthController]);
  });

  it('does NOT re-provide the sync runtime (queue/scheduler/processor/runner live in WorkerModule)', () => {
    // Anti-parallel-system guard: this module adds ONLY the read endpoint. Re-
    // providing the scheduler/@Processor here would create a second consumer on
    // the same BullMQ queue (double processing once active) + a duplicate armer.
    expect(providers).toHaveLength(0);
  });
});

function mockConfig(value: string): ConfigService {
  return { get: jest.fn(() => value) } as unknown as ConfigService;
}

describe('SupplierTruthController is strictly read-only', () => {
  it('status reports OBSERVABLE_DORMANT + connectable suppliers, no DB hit', () => {
    const service = {
      getProjection: jest.fn(),
    } as unknown as SupplierTruthService;
    const controller = new SupplierTruthController(
      service,
      mockConfig('false'),
    );

    const status = controller.status();

    expect(status.mode).toBe('OBSERVABLE_DORMANT');
    expect(status.syncEnabled).toBe(false);
    const ids = status.connectableSuppliers.map((s) => s.supplierId).sort();
    expect(ids).toEqual(['19', '71']); // CAL + DistriCash
    expect(service.getProjection).not.toHaveBeenCalled(); // status hits no DB
  });

  it('reports ACTIVE only when the flag is exactly "true" (conservative)', () => {
    const service = {
      getProjection: jest.fn(),
    } as unknown as SupplierTruthService;
    expect(
      new SupplierTruthController(service, mockConfig('true')).status().mode,
    ).toBe('ACTIVE');
    // any other value (e.g. '1', 'TRUE') stays dormant — fail-safe
    expect(
      new SupplierTruthController(service, mockConfig('1')).status()
        .syncEnabled,
    ).toBe(false);
  });

  it('projection delegates to the read service (UNKNOWN when unverified)', async () => {
    const view = {
      state: AvailabilityState.UNKNOWN,
      confidence: 0,
      delayDays: null,
      sourceSupplier: null,
    };
    const service = {
      getProjection: jest.fn(async () => view),
    } as unknown as SupplierTruthService;
    const controller = new SupplierTruthController(
      service,
      mockConfig('false'),
    );

    await expect(controller.projection(123)).resolves.toBe(view);
    expect(service.getProjection).toHaveBeenCalledWith(123);
  });
});

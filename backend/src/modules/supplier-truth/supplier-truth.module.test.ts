import { BullModule } from '@nestjs/bull';
import { SupplierTruthModule } from './supplier-truth.module';
import { SupplierTruthController } from './supplier-truth.controller';
import { SupplierTruthService } from './supplier-truth.service';
import { SupplierTruthRepository } from './supplier-truth.repository';
import { SupplierTruthEventSink } from './supplier-truth-event-sink';
import { SupplierSyncProcessor } from './supplier-sync.processor';
import { SupplierSyncRunner } from './supplier-sync.runner';
import { SupplierSyncJobProcessor } from './supplier-sync.job.processor';
import { SupplierSyncScheduler } from './supplier-sync.scheduler';
import { DatabaseModule } from '../../database/database.module';
import { AvailabilityState } from './domain/availability-state';

/** Token of a provider entry, whether a plain class or a `{ provide, useFactory }`. */
function providerToken(p: unknown): unknown {
  return typeof p === 'object' && p !== null && 'provide' in p
    ? (p as { provide: unknown }).provide
    : p;
}

describe('SupplierTruthModule wiring (structural — no infra boot)', () => {
  const imports = Reflect.getMetadata('imports', SupplierTruthModule) ?? [];
  const controllers =
    Reflect.getMetadata('controllers', SupplierTruthModule) ?? [];
  const providers = Reflect.getMetadata('providers', SupplierTruthModule) ?? [];
  const exportsMeta = Reflect.getMetadata('exports', SupplierTruthModule) ?? [];
  const providerTokens = providers.map(providerToken);

  it('registers the supplier-sync BullMQ queue + DatabaseModule', () => {
    expect(imports).toContain(DatabaseModule);
    expect(
      imports.some(
        (m: unknown) =>
          typeof m === 'object' &&
          m !== null &&
          (m as { module?: unknown }).module === BullModule,
      ),
    ).toBe(true);
  });

  it('declares the read-only controller', () => {
    expect(controllers).toEqual([SupplierTruthController]);
  });

  it('wires every sentinel component (repo, service, REAL sink, processor, runner, job, scheduler)', () => {
    for (const token of [
      SupplierTruthRepository,
      SupplierTruthService,
      SupplierTruthEventSink,
      SupplierSyncProcessor,
      SupplierSyncRunner,
      SupplierSyncJobProcessor,
      SupplierSyncScheduler,
    ]) {
      expect(providerTokens).toContain(token);
    }
  });

  it('injects the REAL event sink into the processor + runner factories (not noopSink)', () => {
    const runnerProvider = providers.find(
      (p: unknown) => providerToken(p) === SupplierSyncRunner,
    );
    const processorProvider = providers.find(
      (p: unknown) => providerToken(p) === SupplierSyncProcessor,
    );
    expect(runnerProvider.inject).toContain(SupplierTruthEventSink);
    expect(processorProvider.inject).toContain(SupplierTruthEventSink);
  });

  it('exports only the read service (funnel entry point)', () => {
    expect(exportsMeta).toEqual([SupplierTruthService]);
  });
});

describe('SupplierTruthEventSink is injectable + writes no DB (logs only)', () => {
  it('constructs and emits without throwing and without any DB client', () => {
    const sink = new SupplierTruthEventSink();
    expect(typeof sink.emit).toBe('function');
    // No supabase/db member — degradation events route to logs, never a write.
    expect(
      (sink as unknown as { supabase?: unknown }).supabase,
    ).toBeUndefined();
    expect(() =>
      sink.emit('supplier.truth.degraded', { supplierId: '71' }),
    ).not.toThrow();
  });
});

describe('SupplierTruthController is strictly read-only', () => {
  const inertScheduler = {
    isSyncEnabled: () => false,
  } as unknown as SupplierSyncScheduler;

  it('status reports OBSERVABLE_DORMANT + connectable suppliers, no portal hit', () => {
    const service = {
      getProjection: jest.fn(),
    } as unknown as SupplierTruthService;
    const controller = new SupplierTruthController(service, inertScheduler);

    const status = controller.status();

    expect(status.mode).toBe('OBSERVABLE_DORMANT');
    expect(status.syncEnabled).toBe(false);
    const ids = status.connectableSuppliers.map((s) => s.supplierId).sort();
    expect(ids).toEqual(['19', '71']); // CAL + DistriCash
    expect(service.getProjection).not.toHaveBeenCalled(); // status hits no DB
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
    const controller = new SupplierTruthController(service, inertScheduler);

    await expect(controller.projection(123)).resolves.toBe(view);
    expect(service.getProjection).toHaveBeenCalledWith(123);
  });
});

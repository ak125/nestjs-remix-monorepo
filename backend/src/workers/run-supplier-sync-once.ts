/**
 * One-shot controlled supplier-sync run (ops entrypoint) — SAFE BY DEFAULT.
 *
 * Boots the REAL production DI (`WorkerModule`) and invokes the existing
 * `SupplierSyncRunner.runSync()` exactly ONCE — no scheduler armed, no 4h cron,
 * one-shot. Bounded by `SUPPLIER_SYNC_MAX_REFS_PER_RUN` (set it small for a first
 * run). Reuses the real wiring — no parallel construction.
 *
 * REFUSES to do anything real unless `SUPPLIER_SYNC_ONESHOT_CONFIRM=true` is set
 * (see `./run-supplier-sync-once.guard`). A real run performs CAL/DCA portal
 * logins with real credentials and writes the (funnel-dormant) observation tables
 * `supplier_inventory_snapshots` / `supplier_truth_projection` on the shared prod
 * DB — a real, owner-gated supplier activation. Without the flag it exits with no
 * portal login and no DB write.
 *
 * Run (only after an explicit owner GO), from backend/, COMPILED (not tsx, which
 * breaks Playwright `$eval`):
 *   SUPPLIER_SYNC_ONESHOT_CONFIRM=true SUPPLIER_SYNC_MAX_REFS_PER_RUN=10 \
 *     node dist/workers/run-supplier-sync-once.js
 */
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';
import { SupplierSyncRunner } from '../modules/supplier-truth/supplier-sync.runner';
import {
  isOneshotConfirmed,
  ONESHOT_REFUSAL,
} from './run-supplier-sync-once.guard';

async function main(): Promise<void> {
  if (!isOneshotConfirmed()) {
    // eslint-disable-next-line no-console
    console.error(ONESHOT_REFUSAL);
    process.exit(2);
  }
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: ['error', 'warn', 'log'],
  });
  const runner = app.get(SupplierSyncRunner);
  const summary = await runner.runSync();
  // eslint-disable-next-line no-console
  console.log('SUPPLIER_SYNC_ONESHOT_SUMMARY ' + JSON.stringify(summary));
  // Hard-exit to skip onModuleDestroy — avoids touching the shared Bull
  // repeatables the long-running worker process owns.
  process.exit(0);
}

// Only run when invoked directly (`node …`), never on import (keeps the guard
// unit-testable + prevents accidental execution).
if (require.main === module) {
  void main();
}

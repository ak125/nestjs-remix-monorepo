/**
 * WriteGuardModule — P1.5 Write Ownership & Collision Guard (v2.1)
 *
 * Global module exporting the full Write Gate stack:
 * - ContentWriteGateService (facade — the ONLY entry point for content writes)
 * - ContentMergeEngine (text/array merge logic)
 * - ContentRegressionGuard (anti-regression decisions)
 * - ContentWriteExecutor (lock + CAS + write + receipt)
 * - WriteGuardLockService (distributed Redis lock)
 * - WriteGuardCasService (compare-and-swap)
 * - WriteGuardLedgerService (collision + receipt persistence)
 *
 * Boot invariant: validates that every active role in the registry
 * has a non-empty writeScope derived from FIELD_CATALOG.
 */

import { Global, Logger, Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WriteGuardLockService } from './write-guard-lock.service';
import { WriteGuardCasService } from './write-guard-cas.service';
import { WriteGuardLedgerService } from './write-guard-ledger.service';
import { ContentMergeEngine } from './content-merge-engine.service';
import { ContentRegressionGuard } from './content-regression-guard.service';
import { ContentWriteExecutor } from './content-write-executor.service';
import { ContentWriteGateService } from './content-write-gate.service';
import { FeatureFlagsModule } from './feature-flags.module';
import { OperatingMatrixModule } from './operating-matrix.module';
import { OperatingMatrixService } from './operating-matrix.service';

@Global()
@Module({
  imports: [ConfigModule, FeatureFlagsModule, OperatingMatrixModule],
  providers: [
    // P1.5 core
    WriteGuardLockService,
    WriteGuardCasService,
    WriteGuardLedgerService,
    // v2.1 Write Gate stack
    ContentMergeEngine,
    ContentRegressionGuard,
    ContentWriteExecutor,
    ContentWriteGateService,
  ],
  exports: [
    WriteGuardLockService,
    WriteGuardCasService,
    WriteGuardLedgerService,
    ContentMergeEngine,
    ContentRegressionGuard,
    ContentWriteExecutor,
    ContentWriteGateService,
  ],
})
export class WriteGuardModule implements OnModuleInit {
  private readonly logger = new Logger(WriteGuardModule.name);

  constructor(private readonly matrix: OperatingMatrixService) {}

  onModuleInit(): void {
    // Boot invariant: validate catalog ↔ registry coherence.
    // Single source of truth for these log lines = OperatingMatrixService.formatBootLog()
    // (synchronous, in-memory iteration over EXECUTION_REGISTRY + FIELD_CATALOG —
    // no remote IO, conforms to .claude/rules/backend.md § "Non-blocking onModuleInit").
    for (const entry of this.matrix.formatBootLog()) {
      this.logger[entry.level](entry.message);
    }
  }
}

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
import { EXECUTION_REGISTRY } from './execution-registry.constants';
import { deriveWriteScope, FIELD_CATALOG } from './field-catalog.constants';

@Global()
@Module({
  imports: [ConfigModule, FeatureFlagsModule],
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

  onModuleInit(): void {
    // ── Boot invariant: validate catalog ↔ registry coherence ──
    const rolesSeen = new Set<string>();
    let fieldsTotal = 0;

    for (const entry of Object.values(EXECUTION_REGISTRY)) {
      const scope = deriveWriteScope(entry.roleId);

      if (scope.ownedFields.length === 0) {
        this.logger.warn(
          `WriteGuard: role ${entry.roleId} has no owned fields in FIELD_CATALOG`,
        );
      } else {
        this.logger.log(
          `WriteGuard: role ${entry.roleId} owns ${scope.ownedFields.length} fields ` +
            `across ${scope.resourceGroups.length} groups (${scope.resourceGroups.join(', ')})`,
        );
      }

      rolesSeen.add(entry.roleId);
      fieldsTotal += scope.ownedFields.length;
    }

    // Check for orphan catalog entries (fields referencing roles not in registry)
    const orphanRoles = new Set<string>();
    for (const field of FIELD_CATALOG) {
      if (!rolesSeen.has(field.ownerRole)) {
        orphanRoles.add(field.ownerRole);
      }
    }
    if (orphanRoles.size > 0) {
      this.logger.warn(
        `WriteGuard: FIELD_CATALOG references roles not in registry: ${[...orphanRoles].join(', ')}`,
      );
    }

    this.logger.log(
      `WriteGuard: initialized — ${FIELD_CATALOG.length} catalog entries, ` +
        `${fieldsTotal} owned fields across ${rolesSeen.size} roles`,
    );
  }
}

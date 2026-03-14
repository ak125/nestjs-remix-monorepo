/**
 * ExecutionPlanResolverService — Phase 2 Orchestration (P2.1)
 *
 * Resolves a canonical ExecutionPlan from a RoleId + ExecutionMode.
 * Enforces: role must exist in registry, mode must be allowed.
 * Throws on any ambiguity or missing configuration.
 *
 * @see .spec/00-canon/phase2-canon.md v1.1.0 — P2.1 Orchestration
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  EXECUTION_REGISTRY,
  EXECUTION_REGISTRY_VERSION,
} from './execution-registry.constants';
import type {
  ExecutionMode,
  ExecutionPlan,
  WriteMode,
} from './execution-registry.types';
import { EXECUTION_MODES } from './execution-registry.types';
import type { RoleId } from './role-ids';

@Injectable()
export class ExecutionPlanResolverService {
  private readonly logger = new Logger(ExecutionPlanResolverService.name);

  /**
   * Resolve an ExecutionPlan for the given role and mode.
   *
   * @throws if roleId is not in the registry
   * @throws if executionMode is not in the entry's allowedModes
   */
  resolveExecutionPlan(
    roleId: RoleId,
    executionMode: ExecutionMode,
    overrides?: Partial<{
      writeMode: WriteMode;
      correlationId: string;
    }>,
  ): ExecutionPlan {
    // 1. Lookup registry entry
    const entry = EXECUTION_REGISTRY[roleId];
    if (!entry) {
      throw new Error(
        `[P2.1] No execution registry entry for role "${roleId}". ` +
          `Cannot execute without a registered role.`,
      );
    }

    // 2. Validate execution mode is canonical
    if (!EXECUTION_MODES.includes(executionMode)) {
      throw new Error(
        `[P2.1] Unknown execution mode "${executionMode}". ` +
          `Allowed: ${EXECUTION_MODES.join(', ')}`,
      );
    }

    // 3. Validate mode is allowed for this role
    if (!entry.allowedModes.includes(executionMode)) {
      throw new Error(
        `[P2.1] Execution mode "${executionMode}" is not allowed for role "${roleId}". ` +
          `Allowed modes: ${entry.allowedModes.join(', ')}`,
      );
    }

    // 4. Resolve write mode
    const writeMode = overrides?.writeMode ?? entry.defaultWriteMode;

    // 5. Build plan
    const plan: ExecutionPlan = {
      registryEntry: entry,
      executionMode,
      writeMode,
      contractVersion: EXECUTION_REGISTRY_VERSION,
      roleLockStatus: 'locked',
      resolvedAt: new Date().toISOString(),
      correlationId: overrides?.correlationId ?? this.generateCorrelationId(),
    };

    this.logger.log(
      `[P2.1] Resolved plan: role=${roleId} mode=${executionMode} ` +
        `write=${writeMode} enricher=${entry.enricherServiceKey} ` +
        `contract=${entry.contractSchemaRef}`,
    );

    return plan;
  }

  /**
   * Check if a role has a registered execution entry.
   */
  hasEntry(roleId: RoleId): boolean {
    return roleId in EXECUTION_REGISTRY;
  }

  private generateCorrelationId(): string {
    const ts = Date.now().toString(36);
    const rnd = Math.random().toString(36).slice(2, 8);
    return `p2-${ts}-${rnd}`;
  }
}

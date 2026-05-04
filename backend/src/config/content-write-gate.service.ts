/**
 * ContentWriteGateService — P1.5 v2.1
 *
 * Thin facade. Routes writeToTarget() through:
 *   1. Ownership check
 *   2. Read existing state
 *   3. ContentMergeEngine (per-field merge)
 *   4. ContentRegressionGuard (per-field decision)
 *   5. ContentWriteExecutor (lock + CAS + write + receipt)
 *
 * This is the ONLY entry point for content writes.
 * No DB write logic lives here — it delegates everything.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getEffectiveSupabaseKey } from '@common/utils';
import type { ResourceGroup } from './execution-registry.types';
import type { RoleId } from './role-ids';
import {
  FIELD_CATALOG_INDEX,
  getOwnedFieldsForGroup,
  resolveWriteTarget,
} from './field-catalog.constants';
import { ContentMergeEngine } from './content-merge-engine.service';
import type { MergeFieldResult } from './content-merge-engine.service';
import { ContentRegressionGuard } from './content-regression-guard.service';
import { ContentWriteExecutor } from './content-write-executor.service';
import { WriteGuardCasService } from './write-guard-cas.service';
import { FeatureFlagsService } from './feature-flags.service';

// ── Public types ──

export interface WriteGateResult {
  written: boolean;
  reason?: string;
  fieldsWritten: string[];
  fieldsSkipped: string[];
  fieldsStripped: string[];
  mergeDetails: MergeFieldResult[];
}

export interface WriteTargetInput {
  roleId: RoleId;
  target: ResourceGroup;
  pkValue: string | number;
  payload: Record<string, unknown>;
  correlationId: string;
  restoreMode?: 'none' | 'protected_restore';
}

@Injectable()
export class ContentWriteGateService {
  private readonly logger = new Logger(ContentWriteGateService.name);
  private readonly supabase: SupabaseClient;

  constructor(
    private readonly config: ConfigService,
    private readonly mergeEngine: ContentMergeEngine,
    private readonly regressionGuard: ContentRegressionGuard,
    private readonly writeExecutor: ContentWriteExecutor,
    private readonly casService: WriteGuardCasService,
    private readonly featureFlags: FeatureFlagsService,
  ) {
    const url = this.config.get<string>('SUPABASE_URL') || '';
    // ADR-028 Option D — fallback to ANON_KEY in read-only mode (RLS protects writes)
    const key = getEffectiveSupabaseKey();
    this.supabase = createClient(url, key);
  }

  /**
   * Main entry point for all content writes.
   *
   * Steps A-B happen here (read + merge planning).
   * Steps C-J are delegated to ContentWriteExecutor.
   */
  async writeToTarget(input: WriteTargetInput): Promise<WriteGateResult> {
    const { roleId, target, pkValue, payload, correlationId, restoreMode } =
      input;

    const writeTarget = resolveWriteTarget(target);
    if (!writeTarget) {
      return {
        written: false,
        reason: 'unknown_target',
        fieldsWritten: [],
        fieldsSkipped: [],
        fieldsStripped: [],
        mergeDetails: [],
      };
    }

    // ── Step 1: Ownership check ──
    const fieldsStripped: string[] = [];
    const mergedPayload: Record<string, unknown> = {};

    for (const [field, value] of Object.entries(payload)) {
      const catalogKey = `${writeTarget.table}.${field}`;
      const entry = FIELD_CATALOG_INDEX.get(catalogKey);

      if (entry && entry.ownerRole !== roleId) {
        // Not owned by this role
        fieldsStripped.push(field);
        this.logger.warn(
          `WriteGate: ${field} stripped — owner=${entry.ownerRole} requester=${roleId}`,
        );
        continue;
      }

      mergedPayload[field] = value;
    }

    if (Object.keys(mergedPayload).length === 0) {
      return {
        written: false,
        reason: 'all_fields_stripped',
        fieldsWritten: [],
        fieldsSkipped: [],
        fieldsStripped,
        mergeDetails: [],
      };
    }

    // ── Step A: Read existing state (before lock) ──
    const fieldNames = Object.keys(mergedPayload);
    const { data: existing } = await this.supabase
      .from(writeTarget.table)
      .select(fieldNames.join(','))
      .eq(writeTarget.pkField, pkValue)
      .single();

    const existingRow = (existing as unknown as Record<string, unknown>) ?? {};

    // ── Step A (cont): Compute baseHash for CAS ──
    const ownedFields = getOwnedFieldsForGroup(roleId, target);
    const pgId =
      typeof pkValue === 'number' ? pkValue : parseInt(String(pkValue), 10);
    const baseHash = this.featureFlags.writeGuardEnabled
      ? await this.casService.readAndHash(target, pgId, ownedFields)
      : undefined;

    // ── Step B: Build merged payload via regression guard ──
    const mergeDetails: MergeFieldResult[] = [];
    const fieldsSkipped: string[] = [];
    const finalPayload: Record<string, unknown> = {};

    // Special case: protected_restore bypasses merge
    if (restoreMode === 'protected_restore') {
      for (const [field, value] of Object.entries(mergedPayload)) {
        mergeDetails.push({
          field,
          strategy: 'protected_restore',
          existingLen: 0,
          newLen: 0,
          finalLen: 0,
          mergedValue: value,
          shouldWrite: true,
        });
        finalPayload[field] = value;
      }
    } else {
      // Normal merge path
      for (const [field, value] of Object.entries(mergedPayload)) {
        const result = this.regressionGuard.evaluate(
          writeTarget.table,
          field,
          existingRow[field],
          value,
        );

        mergeDetails.push(result);

        if (result.shouldWrite) {
          finalPayload[field] = result.mergedValue;
        } else {
          fieldsSkipped.push(field);
          this.logger.log(
            `WriteGate: ${field} skipped — strategy=${result.strategy} ` +
              `(${result.existingLen}c → ${result.newLen}c)`,
          );
        }
      }
    }

    if (Object.keys(finalPayload).length === 0) {
      return {
        written: false,
        reason: 'all_fields_skipped_by_merge',
        fieldsWritten: [],
        fieldsSkipped,
        fieldsStripped,
        mergeDetails,
      };
    }

    // ── Steps C-J: Delegate to executor ──
    const execResult = await this.writeExecutor.execute(
      roleId,
      target,
      pkValue,
      finalPayload,
      mergeDetails,
      correlationId,
      baseHash,
    );

    return {
      written: execResult.written,
      reason: execResult.reason,
      fieldsWritten: execResult.fieldsWritten,
      fieldsSkipped,
      fieldsStripped,
      mergeDetails,
    };
  }
}

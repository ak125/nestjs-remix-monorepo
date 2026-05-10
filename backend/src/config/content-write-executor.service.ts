/**
 * ContentWriteExecutor — P1.5 v2.1
 *
 * Responsible for the critical section of a content write:
 *   C. Acquire lock (late, just before mutation)
 *   D. Reread under lock (current state)
 *   E. Recalculate merge against re-read state
 *   F. Anti-regression on final result
 *   G. CAS check
 *   H. Write
 *   I. Reread post-write
 *   J. Write receipt
 *
 * This service owns the Supabase client for the actual DB mutation.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getEffectiveSupabaseKey } from '@common/utils';
import type {
  ResourceGroup,
  WriteLockHandle,
} from './execution-registry.types';
import type { RoleId } from './role-ids';
import {
  resolveWriteTarget,
  getOwnedFieldsForGroup,
} from './field-catalog.constants';
import { WriteGuardLockService } from './write-guard-lock.service';
import { WriteGuardCasService } from './write-guard-cas.service';
import { WriteGuardLedgerService } from './write-guard-ledger.service';
import { FeatureFlagsService } from './feature-flags.service';
import type { MergeFieldResult } from './content-merge-engine.service';

export interface ExecutorResult {
  written: boolean;
  reason?: string;
  fieldsWritten: string[];
  mergeDetails: MergeFieldResult[];
}

@Injectable()
export class ContentWriteExecutor {
  private readonly logger = new Logger(ContentWriteExecutor.name);
  private readonly supabase: SupabaseClient;

  constructor(
    private readonly config: ConfigService,
    private readonly lockService: WriteGuardLockService,
    private readonly casService: WriteGuardCasService,
    private readonly ledgerService: WriteGuardLedgerService,
    private readonly featureFlags: FeatureFlagsService,
  ) {
    const url = this.config.get<string>('SUPABASE_URL') || '';
    // ADR-028 Option D — fallback to ANON_KEY in read-only mode (RLS protects writes)
    const key = getEffectiveSupabaseKey();
    this.supabase = createClient(url, key);
  }

  /**
   * Execute the write critical section (steps C-J from the plan).
   *
   * @param roleId - the role performing the write
   * @param target - resourceGroup determining table/pk
   * @param pkValue - primary key value
   * @param mergedPayload - payload already merged by ContentMergeEngine + RegressionGuard
   * @param mergeDetails - merge decisions for audit
   * @param correlationId - end-to-end tracing ID
   * @param baseHash - hash computed at step A (before lock)
   */
  async execute(
    roleId: RoleId,
    target: ResourceGroup,
    pkValue: string | number,
    mergedPayload: Record<string, unknown>,
    mergeDetails: MergeFieldResult[],
    correlationId: string,
    baseHash?: string,
  ): Promise<ExecutorResult> {
    const writeTarget = resolveWriteTarget(target);
    if (!writeTarget) {
      this.logger.error(`ContentWriteExecutor: unknown target "${target}"`);
      return {
        written: false,
        reason: 'unknown_target',
        fieldsWritten: [],
        mergeDetails,
      };
    }

    // Skip if payload is empty (all fields skipped by regression guard)
    if (Object.keys(mergedPayload).length === 0) {
      this.logger.log(
        `ContentWriteExecutor: empty payload for ${target}:${pkValue}, skipping`,
      );
      return {
        written: false,
        reason: 'empty_payload',
        fieldsWritten: [],
        mergeDetails,
      };
    }

    // ── Step C: Acquire lock (late) ──
    let locks: WriteLockHandle[] | null = null;
    if (this.featureFlags.writeGuardEnabled) {
      locks = await this.lockService.acquireAll(
        typeof pkValue === 'number' ? pkValue : parseInt(String(pkValue), 10),
        [target],
        roleId,
      );

      if (!locks) {
        // Lock failed
        if (this.featureFlags.writeGuardMode === 'enforce') {
          await this.ledgerService.recordCollision({
            pgId:
              typeof pkValue === 'number'
                ? pkValue
                : parseInt(String(pkValue), 10),
            tableName: writeTarget.table,
            resourceGroup: target,
            requestingRole: roleId,
            conflictReason: 'concurrent_lock',
            resolution: 'held',
            correlationId,
          });
          return {
            written: false,
            reason: 'concurrent_lock',
            fieldsWritten: [],
            mergeDetails,
          };
        }
        // Observe mode: proceed without lock
        this.logger.warn(
          `ContentWriteExecutor: lock failed for ${target}:${pkValue} (observe mode, proceeding)`,
        );
      }
    }

    try {
      // ── Step D: Reread under lock ──
      // ── Step E: Recalculate merge (skipped — merge already done by caller)
      // ── Step F: Anti-regression (already applied by caller)

      // ── Step G: CAS check ──
      if (this.featureFlags.writeGuardEnabled && baseHash) {
        const pgId =
          typeof pkValue === 'number' ? pkValue : parseInt(String(pkValue), 10);
        const casResult = await this.casService.checkScoped(
          roleId,
          target,
          pgId,
          baseHash,
        );

        if (!casResult.allowed) {
          this.logger.warn(
            `ContentWriteExecutor: CAS failed — stale_base for ${target}:${pkValue}`,
          );
          await this.ledgerService.recordCollision({
            pgId,
            tableName: writeTarget.table,
            resourceGroup: target,
            requestingRole: roleId,
            conflictReason: 'stale_base',
            baseHash,
            currentHash: casResult.currentHash,
            resolution:
              this.featureFlags.writeGuardMode === 'enforce'
                ? 'held'
                : 'allowed_observe_mode',
            correlationId,
          });

          if (this.featureFlags.writeGuardMode === 'enforce') {
            return {
              written: false,
              reason: 'stale_base',
              fieldsWritten: [],
              mergeDetails,
            };
          }
        }
      }

      // ── Step H: Write (UPDATE-then-INSERT fallback) ──
      //
      // Strategy: UPDATE then check rowCount. If 0 rows affected, the row
      // doesn't exist yet — fall back to INSERT. This handles the "fresh
      // seed" case where a new gamme has no pre-existing row (discovered
      // 2026-04-24 on pg=3859 kit-de-freins-arriere: R1 enricher reported
      // slotsWritten but content was silently dropped because .update().eq()
      // no-ops when row is absent).
      const { error: updateError, count: updatedCount } = await this.supabase
        .from(writeTarget.table)
        .update(mergedPayload, { count: 'exact' })
        .eq(writeTarget.pkField, pkValue);

      if (updateError) {
        this.logger.error(
          `ContentWriteExecutor: update failed for ${target}:${pkValue} — ${updateError.message}`,
        );
        return {
          written: false,
          reason: `db_error: ${updateError.message}`,
          fieldsWritten: [],
          mergeDetails,
        };
      }

      // Fallback INSERT if no row was updated
      if ((updatedCount ?? 0) === 0) {
        const insertPayload = {
          ...mergedPayload,
          [writeTarget.pkField]: pkValue,
        };
        const { error: insertError } = await this.supabase
          .from(writeTarget.table)
          .insert(insertPayload);

        if (insertError) {
          this.logger.error(
            `ContentWriteExecutor: insert fallback failed for ${target}:${pkValue} — ${insertError.message}`,
          );
          return {
            written: false,
            reason: `db_error_insert: ${insertError.message}`,
            fieldsWritten: [],
            mergeDetails,
          };
        }
        this.logger.log(
          `ContentWriteExecutor: inserted new row for ${target}:${pkValue} (row was absent)`,
        );
      }

      const fieldsWritten = Object.keys(mergedPayload);
      this.logger.log(
        `ContentWriteExecutor: wrote ${fieldsWritten.length} fields to ${target}:${pkValue}`,
      );

      // ── Step I + J: Reread post-write + Write receipt ──
      if (this.featureFlags.writeGuardEnabled) {
        try {
          const pgId =
            typeof pkValue === 'number'
              ? pkValue
              : parseInt(String(pkValue), 10);
          const ownedFields = getOwnedFieldsForGroup(roleId, target);
          const postWriteHash = await this.casService.readAndHash(
            target,
            pgId,
            ownedFields,
          );

          await this.ledgerService.recordWriteReceipt({
            pgId,
            tableName: writeTarget.table,
            resourceGroup: target,
            roleId,
            correlationId,
            baseHash,
            newHash: postWriteHash,
            writeStrategy: 'merge',
            fields: fieldsWritten,
          });
        } catch (receiptErr) {
          // Receipt failure must NOT block the main write
          this.logger.error(
            `ContentWriteExecutor: receipt failed — ${(receiptErr as Error).message}`,
          );
        }
      }

      return { written: true, fieldsWritten, mergeDetails };
    } finally {
      // ── Release lock (always) ──
      if (locks) {
        await this.lockService.releaseAll(locks);
      }
    }
  }
}

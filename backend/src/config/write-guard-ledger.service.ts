/**
 * WriteGuardLedgerService — P1.5 Write Ownership & Collision Guard
 *
 * Persists:
 * - Collision events → __write_collision_ledger (failures/conflicts)
 * - Write receipts → __write_audit_log (successful writes, post-write reread)
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  CollisionLedgerEntry,
  WriteReceiptEntry,
} from './execution-registry.types';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getEffectiveSupabaseKey } from '@common/utils';

@Injectable()
export class WriteGuardLedgerService {
  private readonly logger = new Logger(WriteGuardLedgerService.name);
  private readonly supabase: SupabaseClient;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('SUPABASE_URL') || '';
    // ADR-028 Option D — fallback to ANON_KEY in read-only mode (RLS protects writes)
    const key = getEffectiveSupabaseKey();
    this.supabase = createClient(url, key);
  }

  /**
   * Record a collision event (conflict, denied write, stale base, etc.)
   */
  async recordCollision(entry: CollisionLedgerEntry): Promise<number | null> {
    const { data, error } = await this.supabase
      .from('__write_collision_ledger')
      .insert({
        pg_id: entry.pgId,
        table_name: entry.tableName,
        field_name: entry.fieldName ?? null,
        resource_group: entry.resourceGroup ?? null,
        requesting_role: entry.requestingRole,
        owner_role: entry.ownerRole ?? null,
        conflict_reason: entry.conflictReason,
        write_mode: entry.writeMode ?? null,
        base_hash: entry.baseHash ?? null,
        current_hash: entry.currentHash ?? null,
        payload_hash: entry.payloadHash ?? null,
        payload_fields: entry.payloadFields ?? null,
        payload_preview: entry.payloadPreview
          ? entry.payloadPreview.slice(0, 500)
          : null,
        resolution: entry.resolution,
        correlation_id: entry.correlationId,
      })
      .select('id')
      .single();

    if (error) {
      this.logger.error(
        `WriteGuardLedger: failed to record collision: ${error.message}`,
      );
      return null;
    }

    this.logger.warn(
      `WriteGuardLedger: collision recorded #${data?.id} — ` +
        `reason=${entry.conflictReason} role=${entry.requestingRole} ` +
        `pg_id=${entry.pgId} group=${entry.resourceGroup ?? '?'}`,
    );

    return data?.id ?? null;
  }

  /**
   * Record a successful write receipt (post-write reread hash).
   */
  async recordWriteReceipt(entry: WriteReceiptEntry): Promise<number | null> {
    const { data, error } = await this.supabase
      .from('__write_audit_log')
      .insert({
        pg_id: entry.pgId,
        table_name: entry.tableName,
        fields: entry.fields,
        resource_group: entry.resourceGroup,
        role_id: entry.roleId,
        correlation_id: entry.correlationId,
        base_hash: entry.baseHash ?? null,
        new_hash: entry.newHash,
        write_strategy: entry.writeStrategy,
        field_count: entry.fields.length,
      })
      .select('id')
      .single();

    if (error) {
      this.logger.error(
        `WriteGuardLedger: failed to record write receipt: ${error.message}`,
      );
      return null;
    }

    this.logger.log(
      `WriteGuardLedger: write receipt #${data?.id} — ` +
        `role=${entry.roleId} pg_id=${entry.pgId} ` +
        `group=${entry.resourceGroup} fields=${entry.fields.length}`,
    );

    return data?.id ?? null;
  }

  /**
   * Resolve a held collision (manual or automated).
   */
  async resolveCollision(
    id: number,
    resolution: string,
    resolvedBy: string,
  ): Promise<void> {
    const { error } = await this.supabase
      .from('__write_collision_ledger')
      .update({
        resolution,
        resolved_at: new Date().toISOString(),
        resolved_by: resolvedBy,
      })
      .eq('id', id);

    if (error) {
      this.logger.error(
        `WriteGuardLedger: failed to resolve collision #${id}: ${error.message}`,
      );
    }
  }

  /**
   * Get unresolved collisions for a pgId (for admin dashboard).
   */
  async getUnresolvedForPgId(pgId: number): Promise<unknown[]> {
    const { data, error } = await this.supabase
      .from('__write_collision_ledger')
      .select('*')
      .eq('pg_id', pgId)
      .eq('resolution', 'held')
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`WriteGuardLedger: query failed: ${error.message}`);
      return [];
    }

    return data ?? [];
  }
}

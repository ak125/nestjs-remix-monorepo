/**
 * WriteGuardCasService — P1.5 Write Ownership & Collision Guard
 *
 * Compare-and-Swap scoped to ownedFields per resourceGroup.
 * - Reads only the fields owned by the executing role
 * - Computes SHA-256 hash of those fields (deterministic)
 * - Before write: re-reads and compares to baseHash
 * - If hash differs → stale_base conflict
 *
 * Also handles ownership checks and write class hierarchy validation.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import type {
  CasResult,
  FieldOwnership,
  ResourceGroup,
} from './execution-registry.types';
import { WRITE_CLASS_RANK } from './execution-registry.types';
import type { RoleId } from './role-ids';
import {
  FIELD_CATALOG_INDEX,
  getOwnedFieldsForGroup,
  GROUP_TABLE_MAP,
} from './field-catalog.constants';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getEffectiveSupabaseKey } from '@common/utils';

export interface OwnershipViolation {
  field: string;
  table: string;
  declaredOwner: string;
  requestingRole: string;
}

@Injectable()
export class WriteGuardCasService {
  private readonly logger = new Logger(WriteGuardCasService.name);
  private readonly supabase: SupabaseClient;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('SUPABASE_URL') || '';
    // ADR-028 Option D — fallback to ANON_KEY in read-only mode (RLS protects writes)
    const key = getEffectiveSupabaseKey();
    this.supabase = createClient(url, key);
  }

  /**
   * Read the owned fields for a role+group from DB and compute their hash.
   * This is called BEFORE the lock is acquired (read-only, safe).
   */
  async readAndHash(
    group: ResourceGroup,
    pgId: number,
    fields: FieldOwnership[],
  ): Promise<string> {
    if (fields.length === 0) return '';

    const meta = GROUP_TABLE_MAP[group];
    if (!meta) {
      this.logger.warn(`WriteGuardCas: unknown group "${group}"`);
      return '';
    }

    const fieldNames = fields.map((f) => f.field);
    const { data, error } = await this.supabase
      .from(meta.table)
      .select(fieldNames.join(','))
      .eq(meta.pkField, pgId)
      .single();

    if (error || !data) {
      // Row doesn't exist yet — empty hash (first write is always clean)
      return '';
    }

    return this.computeScopedHash(
      data as unknown as Record<string, unknown>,
      fieldNames,
    );
  }

  /**
   * CAS check: re-read owned fields and compare to baseHash.
   * Must be called AFTER lock is acquired (within the critical section).
   */
  async checkScoped(
    roleId: RoleId,
    group: ResourceGroup,
    pgId: number,
    baseHash: string,
  ): Promise<CasResult> {
    const fields = getOwnedFieldsForGroup(roleId, group);
    const currentHash = await this.readAndHash(group, pgId, fields);

    if (baseHash === '' && currentHash === '') {
      // Both empty — row doesn't exist, no conflict
      return {
        allowed: true,
        resourceGroup: group,
        baseHash,
        currentHash,
      };
    }

    if (currentHash !== baseHash) {
      return {
        allowed: false,
        reason: 'stale_base',
        resourceGroup: group,
        baseHash,
        currentHash,
      };
    }

    return {
      allowed: true,
      resourceGroup: group,
      baseHash,
      currentHash,
    };
  }

  /**
   * Check that every field in the payload is owned by the requesting role.
   * Returns violations (empty array = all OK).
   */
  checkOwnership(
    roleId: RoleId,
    table: string,
    payloadFields: string[],
  ): OwnershipViolation[] {
    const violations: OwnershipViolation[] = [];

    for (const field of payloadFields) {
      const key = `${table}.${field}`;
      const entry = FIELD_CATALOG_INDEX.get(key);

      if (!entry) {
        // Field not in catalog — not protected, skip
        continue;
      }

      if (entry.ownerRole !== roleId) {
        violations.push({
          field,
          table,
          declaredOwner: entry.ownerRole,
          requestingRole: roleId,
        });
      }
    }

    return violations;
  }

  /**
   * Check write class hierarchy: incoming write class must be >= field's declared class.
   * Returns true if write is allowed by hierarchy.
   */
  checkClassHierarchy(
    incomingClass: string,
    fieldTable: string,
    fieldName: string,
  ): boolean {
    const entry = FIELD_CATALOG_INDEX.get(`${fieldTable}.${fieldName}`);
    if (!entry) return true; // Not in catalog = not protected

    const incomingRank =
      WRITE_CLASS_RANK[incomingClass as keyof typeof WRITE_CLASS_RANK] ?? 0;
    const fieldRank = WRITE_CLASS_RANK[entry.writeClass];

    return incomingRank >= fieldRank;
  }

  /**
   * Deterministic SHA-256 hash of specified fields from a row.
   * Fields are sorted alphabetically for stability.
   */
  computeScopedHash(row: Record<string, unknown>, fields: string[]): string {
    const sorted = [...fields]
      .sort()
      .map((f) => `${f}:${JSON.stringify(row[f] ?? null)}`);
    return createHash('sha256').update(sorted.join('|')).digest('hex');
  }
}

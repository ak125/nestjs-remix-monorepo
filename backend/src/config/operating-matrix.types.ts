/**
 * Operating Matrix Types — single-source view over registry × catalog × agents.
 *
 * Consumed by OperatingMatrixService (boot invariant + admin endpoint + CLI dump).
 * No runtime logic here — pure shapes.
 */

import type { RoleId } from './role-ids';
import type {
  ExecutionMode,
  ResourceGroup,
  WriteMode,
} from './execution-registry.types';

export interface MatrixSourcesHash {
  executionRegistry: string;
  executionRegistryTypes: string;
  fieldCatalog: string;
  roleIds: string;
}

export interface MatrixRoleRegistrySnapshot {
  present: boolean;
  contractSchemaRef?: string;
  enricherServiceKey?: string;
  agentFiles?: string[];
  allowedModes?: ExecutionMode[];
  defaultWriteMode?: WriteMode;
  stopPolicy?: { maxRetries: number; timeoutMs: number };
}

export interface MatrixRoleWriteScope {
  resourceGroups: ResourceGroup[];
  ownedTables: string[];
  ownedFieldsCount: number;
}

export interface MatrixRoleEntry {
  roleId: RoleId;
  deprecated: boolean;
  registry: MatrixRoleRegistrySnapshot;
  writeScope: MatrixRoleWriteScope;
  agents: string[];
  healthScore: number;
}

export type MatrixGapReason = 'agents_without_registry';

export interface MatrixGap {
  roleId: RoleId;
  reason: MatrixGapReason;
  agentCount: number;
  agents: string[];
}

export type MatrixAnomalyReason =
  | 'deprecated_but_in_registry'
  | 'duplicate_field_in_catalog'
  | 'in_field_catalog_but_no_group_table_map';

export interface MatrixAnomaly {
  roleId?: RoleId;
  table?: string;
  field?: string;
  reason: MatrixAnomalyReason;
}

export interface OperatingMatrix {
  registryVersion: string;
  catalogFieldCount: number;
  sourcesHash: MatrixSourcesHash;
  agentScanSkipped: boolean;
  agentScanSkipReason?: 'production_default' | 'no_paths_found';
  agentScanRootsConfigured: string[];
  /** Found at runtime — present in JSON only when scan ran. Not part of CI compare (filesystem-dependent). */
  agentScanRootsFound?: string[];
  roles: MatrixRoleEntry[];
  /**
   * Agent filename (basename, sans .md) → RoleId résolu via frontmatter `role:`.
   * Plus de valeur 'UNKNOWN' depuis ADR-037 — un agent sans `role:` valide
   * fait échouer le boot du WriteGuardModule (fail-fast).
   */
  agentsIndex: Record<string, RoleId>;
  gaps: MatrixGap[];
  anomalies: MatrixAnomaly[];
}

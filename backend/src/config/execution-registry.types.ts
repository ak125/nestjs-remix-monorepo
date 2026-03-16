/**
 * Execution Registry Types — Phase 2 Orchestration (P2.1)
 *
 * Defines the canonical execution plan structure for content pipelines.
 * Every content generation/refresh must resolve an ExecutionPlan before
 * dispatching to an enricher service.
 *
 * P1.5 additions: WriteScope, FieldOwnership, ResourceGroup, WriteClass,
 * ConflictPolicy — Write Ownership & Collision Guard.
 *
 * @see .spec/00-canon/phase2-canon.md v1.1.0 — P2.1 Orchestration
 */

import type { RoleId } from './role-ids';
import type { PageType } from '../workers/types/content-refresh.types';

// ── Execution Modes (canonical, closed list) ──

export const EXECUTION_MODES = [
  'create',
  'regenerate',
  'refresh_partial',
  'refresh_full',
  'repair',
  'qa_only',
  'hold_only',
] as const;
export type ExecutionMode = (typeof EXECUTION_MODES)[number];

// ── Write Modes (canonical, closed list) ──

export const WRITE_MODES = [
  'shadow_write',
  'draft_write',
  'versioned_replace',
  'hold_write',
  'blocked_no_write',
] as const;
export type WriteMode = (typeof WRITE_MODES)[number];

// ── P1.5: Write Classes (hierarchy: Content > Metadata > State > Derived) ──

export const WRITE_CLASSES = [
  'content',
  'metadata',
  'state',
  'derived',
] as const;
export type WriteClass = (typeof WRITE_CLASSES)[number];

export const WRITE_CLASS_RANK: Record<WriteClass, number> = {
  content: 3,
  metadata: 2,
  state: 1,
  derived: 0,
};

// ── P1.5: Write Strategies ──

export const WRITE_STRATEGIES = [
  'replace',
  'merge',
  'append',
  'state_transition',
] as const;
export type WriteStrategy = (typeof WRITE_STRATEGIES)[number];

// ── P1.5: Conflict Policies ──

export const CONFLICT_POLICIES = [
  'reject',
  'hold',
  'retry',
  'manual_review',
] as const;
export type ConflictPolicy = (typeof CONFLICT_POLICIES)[number];

// ── P1.5: Resource Groups (the real locking granularity) ──

export const RESOURCE_GROUPS = [
  'seo_gamme_main',
  'purchase_guide_main',
  'page_brief_main',
  'r3_conseil_section',
  'r4_reference_main',
  'r8_vehicle_main',
] as const;
export type ResourceGroup = (typeof RESOURCE_GROUPS)[number];

// ── P1.5: Collision Reasons (normalized) ──

export const COLLISION_REASONS = [
  'ownership_denied',
  'stale_base',
  'content_regression',
  'class_violation',
  'concurrent_lock',
  'redis_unavailable',
] as const;
export type CollisionReason = (typeof COLLISION_REASONS)[number];

// ── P1.5: Collision Resolutions (normalized) ──

export const COLLISION_RESOLUTIONS = [
  'held',
  'rejected',
  'retried',
  'resolved_manual',
  'allowed_observe_mode',
  'superseded',
] as const;
export type CollisionResolution = (typeof COLLISION_RESOLUTIONS)[number];

// ── P1.5: Field Ownership (one entry per physical DB field in the catalog) ──

export interface FieldOwnership {
  table: string;
  field: string;
  ownerRole: RoleId;
  writeClass: WriteClass;
  writeStrategy: WriteStrategy;
  conflictPolicy: ConflictPolicy;
  resourceGroup: ResourceGroup;
}

// ── P1.5: Write Scope (derived from FIELD_CATALOG, never duplicated manually) ──

export interface WriteScope {
  /** Resource groups this role locks before writing */
  resourceGroups: ResourceGroup[];
  /** Owned fields (auto-derived from FIELD_CATALOG) */
  ownedFields: string[];
  /** Tables touched (auto-derived from FIELD_CATALOG) */
  ownedTables: string[];
}

// ── P1.5: Write Lock Handle (returned by WriteGuardLockService) ──

export interface WriteLockHandle {
  key: string;
  token: string;
  resourceGroup: ResourceGroup;
}

// ── P1.5: CAS Result ──

export interface CasResult {
  allowed: boolean;
  reason?: CollisionReason;
  resourceGroup: ResourceGroup;
  baseHash: string;
  currentHash: string;
}

// ── P1.5: Collision Ledger Entry ──

export interface CollisionLedgerEntry {
  pgId: number;
  tableName: string;
  fieldName?: string;
  resourceGroup?: ResourceGroup;
  requestingRole: string;
  ownerRole?: string;
  conflictReason: CollisionReason;
  writeMode?: string;
  baseHash?: string;
  currentHash?: string;
  payloadHash?: string;
  payloadFields?: string[];
  payloadPreview?: string;
  resolution: CollisionResolution;
  correlationId: string;
}

// ── P1.5: Write Receipt Entry ──

export interface WriteReceiptEntry {
  pgId: number;
  tableName: string;
  fields: string[];
  resourceGroup: ResourceGroup;
  roleId: string;
  correlationId: string;
  baseHash?: string;
  newHash: string;
  writeStrategy: string;
}

// ── Registry Entry ──

export interface ExecutionRegistryEntry {
  /** Canonical role this entry governs */
  roleId: RoleId;
  /** Worker-facing page type label */
  pageType: PageType;
  /** Reference to the Zod contract schema file (e.g. 'page-contract-r1.schema') */
  contractSchemaRef: string;
  /** NestJS service key for the enricher/generator */
  enricherServiceKey: string;
  /** Agent definition files (relative to .claude/agents/) */
  agentFiles: string[];
  /** Ordered prompt chain keys */
  promptChain: string[];
  /** Execution modes allowed for this role */
  allowedModes: ExecutionMode[];
  /** Default write mode when not explicitly specified */
  defaultWriteMode: WriteMode;
  /** Stop policy for retries and timeouts */
  stopPolicy: { maxRetries: number; timeoutMs: number };
  /** Escalation policy on gate failures and timeouts */
  escalationPolicy: {
    onGateFail: 'block' | 'escalate_g5';
    onTimeout: 'hold' | 'escalate_g5';
  };
  /** Upstream phases required before execution (e.g. 'phase16_admissibility') */
  requiredUpstreamPhases: string[];
  /** P1.5: Write scope — auto-derived from FIELD_CATALOG at boot. Optional during rollout. */
  writeScope?: WriteScope;
}

// ── Resolved Execution Plan ──

export interface ExecutionPlan {
  /** The registry entry used for resolution */
  registryEntry: ExecutionRegistryEntry;
  /** Selected execution mode */
  executionMode: ExecutionMode;
  /** Selected write mode */
  writeMode: WriteMode;
  /** Contract schema version (from module metadata) */
  contractVersion: string;
  /** Role is always locked once plan is resolved */
  roleLockStatus: 'locked';
  /** ISO timestamp of resolution */
  resolvedAt: string;
  /** Correlation ID for end-to-end tracing */
  correlationId: string;
  /** P1.5: Resolved write scope (from registry entry) */
  writeScope?: WriteScope;
  /** P1.5: Active lock handles (set after acquisition, one per resourceGroup) */
  writeLocks?: WriteLockHandle[];
  /** P1.5: Base hashes per resourceGroup (computed before lock, used for CAS) */
  baseHashes?: Partial<Record<ResourceGroup, string>>;
}

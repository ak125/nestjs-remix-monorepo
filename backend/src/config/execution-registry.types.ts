/**
 * Execution Registry Types — Phase 2 Orchestration (P2.1)
 *
 * Defines the canonical execution plan structure for content pipelines.
 * Every content generation/refresh must resolve an ExecutionPlan before
 * dispatching to an enricher service.
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
}

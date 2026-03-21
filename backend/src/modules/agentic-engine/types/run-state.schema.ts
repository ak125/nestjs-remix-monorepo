/**
 * Agentic Engine — Zod Schemas
 *
 * Pattern: Zod-first validation (like gamme-rpc.schema.ts)
 * Types derived via z.infer<>
 */
import { z } from 'zod';
import {
  RUN_PHASES,
  STEP_TYPES,
  EVIDENCE_TYPES,
  BRANCH_STATUSES,
  GATE_VERDICTS,
  GATE_TYPES,
  APPLY_DECISIONS,
  GOAL_TYPES,
} from '../constants/agentic.constants';

// ── Run ──

export const AgenticRunSchema = z.object({
  id: z.string().uuid(),
  goal: z.string().min(1),
  goal_type: z.string().min(1),
  phase: z.enum(RUN_PHASES),
  plan: z.record(z.unknown()).nullable().optional(),
  winning_branch_id: z.string().uuid().nullable().optional(),
  critic_loops: z.number().int().min(0).default(0),
  branches_total: z.number().int().min(0).default(0),
  branches_completed: z.number().int().min(0).default(0),
  feature_flags: z.record(z.unknown()).default({}),
  correlation_id: z.string().nullable().optional(),
  triggered_by: z.string().min(1),
  error_message: z.string().nullable().optional(),
  total_tokens_used: z.number().int().min(0).default(0),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
  completed_at: z.string().datetime().nullable().optional(),
  duration_ms: z.number().int().nullable().optional(),
});
export type AgenticRun = z.infer<typeof AgenticRunSchema>;

// ── Create Run Input ──

export const CreateRunInputSchema = z.object({
  goal: z.string().min(1).max(2000),
  goal_type: z.enum(GOAL_TYPES),
  triggered_by: z.string().min(1).max(200),
  correlation_id: z.string().max(200).optional(),
  feature_flags: z.record(z.unknown()).optional(),
});
export type CreateRunInput = z.infer<typeof CreateRunInputSchema>;

// ── Branch ──

export const AgenticBranchSchema = z.object({
  id: z.string().uuid(),
  run_id: z.string().uuid(),
  strategy_label: z.string().min(1),
  status: z.enum(BRANCH_STATUSES),
  output: z.record(z.unknown()).nullable().optional(),
  critic_score: z.number().min(0).max(100).nullable().optional(),
  critic_feedback: z.string().nullable().optional(),
  started_at: z.string().datetime().nullable().optional(),
  completed_at: z.string().datetime().nullable().optional(),
  duration_ms: z.number().int().nullable().optional(),
  error_message: z.string().nullable().optional(),
});
export type AgenticBranch = z.infer<typeof AgenticBranchSchema>;

// ── Step ──

export const AgenticStepSchema = z.object({
  id: z.string().uuid(),
  branch_id: z.string().uuid(),
  run_id: z.string().uuid(),
  step_name: z.string().min(1),
  step_type: z.enum(STEP_TYPES),
  step_index: z.number().int().min(0),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'skipped']),
  input_hash: z.string().nullable().optional(),
  output: z.record(z.unknown()).nullable().optional(),
  provider_used: z.string().nullable().optional(),
  tokens_used: z.number().int().nullable().optional(),
  duration_ms: z.number().int().nullable().optional(),
  error_message: z.string().nullable().optional(),
  created_at: z.string().datetime().optional(),
});
export type AgenticStep = z.infer<typeof AgenticStepSchema>;

// ── Evidence ──

export const EvidenceProvenanceSchema = z.object({
  source: z.string().min(1),
  truth_level: z.enum(['L1', 'L2', 'L3', 'L4']).optional(),
  timestamp: z.string().datetime(),
});
export type EvidenceProvenance = z.infer<typeof EvidenceProvenanceSchema>;

export const AgenticEvidenceSchema = z.object({
  id: z.string().uuid(),
  run_id: z.string().uuid(),
  branch_id: z.string().uuid().nullable().optional(),
  step_id: z.string().uuid().nullable().optional(),
  evidence_type: z.enum(EVIDENCE_TYPES),
  content: z.record(z.unknown()),
  provenance: EvidenceProvenanceSchema,
  created_at: z.string().datetime().optional(),
});
export type AgenticEvidence = z.infer<typeof AgenticEvidenceSchema>;

// ── Checkpoint ──

export const AgenticCheckpointSchema = z.object({
  id: z.string().uuid(),
  run_id: z.string().uuid(),
  phase: z.enum(RUN_PHASES),
  snapshot: z.record(z.unknown()),
  created_at: z.string().datetime().optional(),
});
export type AgenticCheckpoint = z.infer<typeof AgenticCheckpointSchema>;

// ── Gate Result ──

export const AgenticGateResultSchema = z.object({
  id: z.string().uuid(),
  run_id: z.string().uuid(),
  gate_name: z.string().min(1),
  gate_type: z.enum(GATE_TYPES),
  verdict: z.enum(GATE_VERDICTS),
  reason: z.string().min(1),
  evidence_id: z.string().uuid().nullable().optional(),
  checked_at: z.string().datetime().optional(),
});
export type AgenticGateResult = z.infer<typeof AgenticGateResultSchema>;

// ── Safe to Apply Decision ──

export const SafeToApplySchema = z.object({
  decision: z.enum(APPLY_DECISIONS),
  hard_gates_passed: z.boolean(),
  soft_warn_count: z.number().int().min(0),
  reason: z.string().min(1),
});
export type SafeToApply = z.infer<typeof SafeToApplySchema>;

// ── BullMQ Job Data ──

export const AgenticJobDataSchema = z.object({
  runId: z.string().uuid(),
  branchId: z.string().uuid().optional(),
  criticFeedback: z.string().optional(),
});
export type AgenticJobData = z.infer<typeof AgenticJobDataSchema>;

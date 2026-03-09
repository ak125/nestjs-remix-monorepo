/**
 * Agentic Engine — EventEmitter2 Event Definitions
 *
 * Pattern: constants + payload types (like notifications module)
 */

// ── Event Names ──

export const AGENTIC_EVENTS = {
  RUN_CREATED: 'agentic.run.created',
  RUN_PHASE_CHANGED: 'agentic.run.phase_changed',
  RUN_COMPLETED: 'agentic.run.completed',
  RUN_FAILED: 'agentic.run.failed',
  RUN_SUSPENDED: 'agentic.run.suspended',
  BRANCH_COMPLETED: 'agentic.branch.completed',
  BRANCH_FAILED: 'agentic.branch.failed',
  STEP_COMPLETED: 'agentic.step.completed',
  GATE_CHECKED: 'agentic.gate.checked',
  EVIDENCE_RECORDED: 'agentic.evidence.recorded',
  BUDGET_WARNING: 'agentic.budget.warning',
  QUEUE_PAUSED: 'agentic.queue.paused',
} as const;

// ── Event Payloads ──

export interface RunCreatedEvent {
  runId: string;
  goalType: string;
  triggeredBy: string;
}

export interface RunPhaseChangedEvent {
  runId: string;
  fromPhase: string;
  toPhase: string;
  timestamp: string;
}

export interface RunCompletedEvent {
  runId: string;
  winningBranchId: string | null;
  durationMs: number;
  totalTokensUsed: number;
}

export interface RunFailedEvent {
  runId: string;
  phase: string;
  errorMessage: string;
}

export interface BranchCompletedEvent {
  runId: string;
  branchId: string;
  criticScore: number | null;
}

export interface StepCompletedEvent {
  runId: string;
  branchId: string;
  stepId: string;
  stepType: string;
  tokensUsed: number | null;
  durationMs: number | null;
}

export interface GateCheckedEvent {
  runId: string;
  gateName: string;
  gateType: string;
  verdict: string;
  reason: string;
}

export interface EvidenceRecordedEvent {
  runId: string;
  evidenceId: string;
  evidenceType: string;
}

export interface BudgetWarningEvent {
  goalType: string;
  totalUsed: number;
  limit: number;
  percentUsed: number;
}

export interface QueuePausedEvent {
  reason: string;
  consecutiveFailures: number;
}

/**
 * BullMQ Job Data Types for agentic-engine queue
 *
 * Each job type has a distinct data shape.
 */

export interface AgenticPlanJobData {
  runId: string;
  correlationId?: string;
  criticFeedback?: string;
}

export interface AgenticSolveJobData {
  runId: string;
  branchId: string;
  correlationId?: string;
}

export interface AgenticCritiqueJobData {
  runId: string;
}

export interface AgenticVerifyJobData {
  runId: string;
}

export interface AgenticArbitrateJobData {
  runId: string;
}

export interface AgenticAirlockCheckJobData {
  runId: string;
}

export interface AgenticApplyJobData {
  runId: string;
}

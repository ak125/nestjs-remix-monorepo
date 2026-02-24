/**
 * Canary render engine types (P5).
 *
 * Defines the policy, decision, and error types for canary engine routing.
 */

// ─────────────────────────────────────────────────────────────
// Canary policy (parsed from env vars at constructor time)
// ─────────────────────────────────────────────────────────────

export interface CanaryPolicy {
  /** Video types eligible for canary rendering (empty = none eligible) */
  eligibleVideoTypes: string[];
  /** Template IDs eligible (empty = all templates for eligible types) */
  eligibleTemplateIds: string[];
  /** Max canary executions per UTC day */
  quotaPerDay: number;
  /** Per-engine timeout override in ms */
  engineTimeoutMs: number;
}

// ─────────────────────────────────────────────────────────────
// Canary decision (returned by evaluateCanary)
// ─────────────────────────────────────────────────────────────

export interface CanaryDecision {
  /** Whether this request should use the canary engine */
  useCanary: boolean;
  /** Human-readable reason for the decision */
  reason: string;
  /** Current daily usage count */
  dailyUsageCount: number;
  /** Remaining quota for today */
  remainingQuota: number;
}

// ─────────────────────────────────────────────────────────────
// Canary-specific error
// ─────────────────────────────────────────────────────────────

export class RenderEngineUnavailableError extends Error {
  constructor(public readonly engineName: string) {
    super(`Render engine '${engineName}' is not available`);
    this.name = 'RenderEngineUnavailableError';
  }
}

import { z } from "zod";

/**
 * Lifecycle status of any registry entry (file / table / RPC / dep / runtime).
 *
 * Per ADR-058 invariant V1-3 "Classification jamais forcée" :
 * builders MUST never throw on ambiguous input — they must classify as
 * `UNKNOWN` + `sourceConfidence: 'low'` and log the reason. False classification
 * pollutes the canon more than a visible UNKNOWN in the coverage report.
 *
 * @see ADR-058 §Invariants V1
 * @see memory feedback_coverage_per_dimension_thresholds.md
 */
export const StatusSchema = z.enum([
  "LIVE",       // production runtime, inbound references, ownership confirmed
  "LEGACY",     // still callable but slated for removal
  "DEPRECATED", // marked @deprecated, no new consumers, will be removed
  "ARCHIVED",   // moved to _archive/ or equivalent, not loaded by runtime
  "UNKNOWN",    // status indéterminable — JAMAIS forcer une classification
]);

export type Status = z.infer<typeof StatusSchema>;

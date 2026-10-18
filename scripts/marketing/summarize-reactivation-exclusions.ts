/** Offline V1 CLI JSON projection only; never selects contacts or authorizes sends.
 * Usage: node node_modules/tsx/dist/cli.mjs --tsconfig scripts/marketing/tsconfig.json
 *   scripts/marketing/summarize-reactivation-exclusions.ts < pilot.json
 */
import { readFileSync } from "node:fs";
import { validateResult, type PilotResult } from "./reactivation-pilot";

export function summarizeExclusions(input: unknown) {
  validateResult(input);
  const result = input as PilotResult;
  const seen = new Set<string>();
  const reasons = new Map<string, number>();
  let included = 0;
  for (const row of result.audience) {
    const key = row.project + ":" + row.customer_id;
    if (seen.has(key)) throw new Error("INVALID_OUTPUT");
    seen.add(key);
    if (row.included) {
      if (
        row.project !== "automecanik" ||
        row.reasons.length !== 1 ||
        row.reasons[0] !== "inactive_with_scoped_consent"
      )
        throw new Error("INVALID_OUTPUT");
      included++;
    } else {
      if (
        row.reasons.includes("inactive_with_scoped_consent") ||
        row.reasons.some((reason) => !/^[a-z][a-z0-9_]{0,63}$/.test(reason))
      )
        throw new Error("INVALID_OUTPUT");
      // Per-reason counts are non-exclusive; each identity counts once per reason.
      for (const reason of new Set(row.reasons))
        reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
    }
  }
  if (
    result.simulation.candidates !==
    (result.simulation.cancelled ? 0 : included)
  )
    throw new Error("INVALID_OUTPUT");
  return {
    schema_version: "1.0.0",
    input_schema_version: result.schema_version,
    project: result.project,
    environment: result.environment,
    synthetic: true,
    status: "draft",
    data_at: result.data_at,
    as_of: result.as_of,
    inactive_days: result.approval_request.audience_rules.inactive_days,
    total_identities: seen.size,
    included_identities: included,
    excluded_identities: seen.size - included,
    exclusions_by_reason: Object.fromEntries(
      [...reasons].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
    ),
    reason_count_semantics: "non_exclusive_unique_project_customer_per_reason",
    // Project only validated public fields: validateResult does not strip the
    // caller's original object, so copying it would expose unknown input fields.
    simulation: {
      transport: result.simulation.transport,
      real_sends: result.simulation.real_sends,
      candidates: result.simulation.candidates,
      cancelled: result.simulation.cancelled,
    },
    can_execute: false,
  };
}

export function summarizeJson(text: string) {
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    throw new Error("INVALID_JSON");
  }
  try {
    return summarizeExclusions(input);
  } catch {
    throw new Error("INVALID_PILOT_RESULT");
  }
}

if (require.main === module) {
  try {
    if (process.argv.length !== 2) throw new Error("INVALID_ARGUMENT");
    process.stdout.write(
      JSON.stringify(summarizeJson(readFileSync(0, "utf8")), null, 2) + "\n",
    );
  } catch (error) {
    const allowed = new Set([
      "INVALID_JSON",
      "INVALID_PILOT_RESULT",
      "INVALID_ARGUMENT",
    ]);
    const code =
      error instanceof Error && allowed.has(error.message)
        ? error.message
        : "SUMMARY_FAILED";
    process.stderr.write(code + "\n");
    process.exitCode = 1;
  }
}

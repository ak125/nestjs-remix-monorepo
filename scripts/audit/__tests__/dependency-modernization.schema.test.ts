// scripts/audit/__tests__/dependency-modernization.schema.test.ts
//
// Unit tests for PR-9a Zod schema invariants. Mirrors the pattern in
// scripts/audit/build-cleanup-candidates.test.ts. Run via `tsx --test`.
import { test } from "node:test";
import * as assert from "node:assert";
import {
  FamilyOverlayEntrySchema,
  FamilyOverlayEntryBase,
  MigrationBlockerSchema,
  CompatibilityContractSchema,
  OperationalOwnerSchema,
  TimeOfDaySchema,
  RuntimeFreezeWindowSchema,
} from "../dependency-modernization.schema";

// Minimal valid family — used as baseline; each negative test mutates one field.
function baseFamily(): any {
  return {
    family: "test-family",
    blast_radius: "tooling",
    target_major: "1.x",
    pr_assignment: "deferred",
    source_url: "https://example.com/releases",
    members: ["typescript"],
    upgrade_strategy: "in-place",
    runtime_criticality: "low",
    requires_staging_soak: false,
    production_approved: true,
    rollback_complexity: "trivial",
    migration_blockers: [],
    observability_requirements: [],
    data_migration_required: false,
    supports_dual_runtime: "none",
    rollback_rto_minutes: 30,
    upgrade_owner_domain: ["platform-tooling"],
    requires_perf_baseline: false,
    rollback_runbook_required: false,
    expected_user_impact: ["none"],
    perf_baseline_metrics: [],
    estimated_recovery_sequence: ["revert-pr"],
    stateful_surface: ["none"],
    rollback_validation_checks: ["none"],
    canary_abort_conditions: [],
    runtime_state_coupling: ["none"],
    safe_parallel_window_minutes: 0,
    rollback_data_loss_risk: "none",
    runtime_entrypoints: ["build-only"],
    operational_owner: "platform-tooling-team",
    estimated_canary_duration_minutes: 0,
    rollback_requires_human_approval: false,
    rollback_tested_at: null,
    rollback_drill_commit: null,
    known_incompatible_families: [],
    upgrade_cost_estimate: { estimated_engineer_days: 1, estimated_review_load: "low" },
    runtime_slo_impact: [],
    runtime_dependency_edges: { depends_on_runtime: [] },
    rollback_preconditions: [],
    observability_sli_queries: {},
    state_schema_version: "n/a",
    rollback_blast_scope: ["none"],
    runtime_capabilities: ["none"],
    failure_domain: ["tooling"],
    rollback_confidence_level: "theoretical",
    state_transition_strategy: "none",
    incident_comm_protocol: ["none"],
    compatibility_contracts: [],
    runtime_freeze_window: null,
    orchestrator_policy: { rollback_mode: "manual-only", deploy_mode: "atomic" },
    dependency_lineage: { supersedes: [] },
    state_compatibility_window_minutes: 0,
    runtime_budget_constraints: {},
    state_reconciliation_strategy: { duplicate_resolution: "n/a" },
    orchestrator_lock_scope: [],
    rollback_observability_grace_period_minutes: 0,
    runtime_contract_expiry: null,
  };
}

test("baseline minimal family parses", () => {
  const result = FamilyOverlayEntrySchema.safeParse(baseFamily());
  assert.strictEqual(result.success, true, JSON.stringify(result, null, 2));
});

// ---------------- Regex / shape tests ----------------

test("MigrationBlockerSchema rejects lowercase first letter", () => {
  assert.strictEqual(MigrationBlockerSchema.safeParse("node20Required").success, false);
  assert.strictEqual(MigrationBlockerSchema.safeParse("Node20Required").success, true);
});

test("CompatibilityContractSchema requires -v<int> suffix", () => {
  assert.strictEqual(CompatibilityContractSchema.safeParse("session-cookie").success, false);
  assert.strictEqual(CompatibilityContractSchema.safeParse("session-cookie-v7").success, true);
  assert.strictEqual(CompatibilityContractSchema.safeParse("session-cookie-vX").success, false);
});

test("OperationalOwnerSchema requires -team suffix", () => {
  assert.strictEqual(OperationalOwnerSchema.safeParse("auth").success, false);
  assert.strictEqual(OperationalOwnerSchema.safeParse("auth-team").success, true);
  assert.strictEqual(OperationalOwnerSchema.safeParse("AuthTeam").success, false);
});

test("TimeOfDaySchema accepts valid HH:MM and rejects out-of-range", () => {
  assert.strictEqual(TimeOfDaySchema.safeParse("22:00").success, true);
  assert.strictEqual(TimeOfDaySchema.safeParse("06:30").success, true);
  assert.strictEqual(TimeOfDaySchema.safeParse("24:00").success, false);
  assert.strictEqual(TimeOfDaySchema.safeParse("25:30").success, false);
  assert.strictEqual(TimeOfDaySchema.safeParse("12:60").success, false);
});

test("RuntimeFreezeWindowSchema accepts null", () => {
  assert.strictEqual(RuntimeFreezeWindowSchema.safeParse(null).success, true);
  assert.strictEqual(
    RuntimeFreezeWindowSchema.safeParse({ start: "22:00", end: "06:00" }).success,
    true,
  );
});

// ---------------- Cross-field invariant tests ----------------

const refines: Array<[string, (f: any) => any]> = [
  ["requires_staging_soak=true without staging_soak_hours", (f) => ({ ...f, requires_staging_soak: true })],
  ["benchmark-only with production_approved=true", (f) => ({ ...f, upgrade_strategy: "benchmark-only" })],
  ["spike-only with production_approved=true", (f) => ({ ...f, upgrade_strategy: "spike-only" })],
  [
    "critical + production_approved with empty observability_requirements",
    (f) => ({ ...f, runtime_criticality: "critical", runtime_slo_impact: ["api-p99"] }),
  ],
  [
    "dangerous + in-place is incompatible",
    (f) => ({
      ...f,
      rollback_complexity: "dangerous",
      rollback_runbook_required: true,
      estimated_recovery_sequence: ["revert-pr"],
      rollback_validation_checks: ["no-sentry-spike"],
      rollback_preconditions: ["canary-disabled"],
    }),
  ],
  [
    "data_migration_required=true with rollback_complexity=trivial",
    (f) => ({ ...f, data_migration_required: true, rollback_data_loss_risk: "replayable" }),
  ],
  [
    "dual_runtime=none + dual-runtime stage",
    (f) => ({
      ...f,
      deployment_sequence: ["dual-runtime", "canary", "full-rollout"],
      canary_abort_conditions: ["sentry-error-rate-spike"],
      estimated_canary_duration_minutes: 60,
    }),
  ],
  ["rollback_rto_minutes out-of-range (0)", (f) => ({ ...f, rollback_rto_minutes: 0 })],
  ["rollback_rto_minutes out-of-range (>1440)", (f) => ({ ...f, rollback_rto_minutes: 1441 })],
  [
    "dangerous without rollback_runbook_required=true",
    (f) => ({
      ...f,
      rollback_complexity: "dangerous",
      upgrade_strategy: "staged-rollout",
      rollback_runbook_required: false,
      estimated_recovery_sequence: ["revert-pr"],
      rollback_validation_checks: ["no-sentry-spike"],
      rollback_preconditions: ["canary-disabled"],
    }),
  ],
  [
    "requires_perf_baseline=true without budgets (production-approved)",
    (f) => ({
      ...f,
      requires_perf_baseline: true,
      runtime_criticality: "high",
      runtime_slo_impact: ["api-p99"],
      observability_requirements: ["sentry"],
    }),
  ],
  [
    "irreversible without rollback_requires_human_approval",
    (f) => ({
      ...f,
      data_migration_required: true,
      rollback_data_loss_risk: "irreversible",
      state_transition_strategy: "replay",
      state_reconciliation_strategy: { duplicate_resolution: "manual-review" },
      rollback_requires_human_approval: false,
    }),
  ],
  [
    "canary in sequence with estimated_canary_duration_minutes=0",
    (f) => ({
      ...f,
      deployment_sequence: ["canary", "full-rollout"],
      canary_abort_conditions: ["sentry-error-rate-spike"],
      estimated_canary_duration_minutes: 0,
    }),
  ],
  [
    "data_migration_required=true with rollback_data_loss_risk=none",
    (f) => ({
      ...f,
      data_migration_required: true,
      rollback_complexity: "moderate",
      state_transition_strategy: "replay",
      state_reconciliation_strategy: { duplicate_resolution: "latest-write-wins" },
    }),
  ],
  [
    "known_incompatible_families contains self",
    (f) => ({ ...f, family: "self-ref", known_incompatible_families: ["self-ref"] }),
  ],
  [
    "depends_on_runtime contains self",
    (f) => ({
      ...f,
      family: "self-dag",
      runtime_dependency_edges: { depends_on_runtime: ["self-dag"] },
    }),
  ],
  [
    "rollback_tested_at set without rollback_drill_commit",
    (f) => ({ ...f, rollback_tested_at: "2026-05-17T10:00:00Z", rollback_drill_commit: null }),
  ],
  [
    "human_approval=true with orchestrator_policy.rollback_mode=auto-allowed",
    (f) => ({
      ...f,
      rollback_requires_human_approval: true,
      orchestrator_policy: { rollback_mode: "auto-allowed", deploy_mode: "staged" },
    }),
  ],
  [
    "dual-write with state_compatibility_window_minutes=0",
    (f) => ({
      ...f,
      data_migration_required: true,
      rollback_data_loss_risk: "partial-loss",
      state_transition_strategy: "dual-write",
      state_reconciliation_strategy: { duplicate_resolution: "latest-write-wins" },
      supports_dual_runtime: "full",
      safe_parallel_window_minutes: 60,
      state_compatibility_window_minutes: 0,
    }),
  ],
  [
    "runtime_freeze_window start == end",
    (f) => ({ ...f, runtime_freeze_window: { start: "22:00", end: "22:00" } }),
  ],
  [
    "dual-write + duplicate_resolution=n/a",
    (f) => ({
      ...f,
      data_migration_required: true,
      rollback_data_loss_risk: "partial-loss",
      state_transition_strategy: "dual-write",
      state_reconciliation_strategy: { duplicate_resolution: "n/a" },
      supports_dual_runtime: "full",
      safe_parallel_window_minutes: 60,
      state_compatibility_window_minutes: 60,
    }),
  ],
  [
    "non-`none` expected_user_impact without comm protocol",
    (f) => ({ ...f, expected_user_impact: ["short-api-restart"], incident_comm_protocol: ["none"] }),
  ],
];

for (const [label, mutate] of refines) {
  test(`refine rejects: ${label}`, () => {
    const f = mutate(baseFamily());
    const result = FamilyOverlayEntrySchema.safeParse(f);
    assert.strictEqual(
      result.success,
      false,
      `Expected refine to reject but it succeeded: ${label}\n${JSON.stringify(f, null, 2)}`,
    );
  });
}

// FamilyOverlayEntryBase is extendable (for InventoryFamilySchema).
test("FamilyOverlayEntryBase is a ZodObject (extendable)", () => {
  assert.ok(typeof FamilyOverlayEntryBase.extend === "function");
});

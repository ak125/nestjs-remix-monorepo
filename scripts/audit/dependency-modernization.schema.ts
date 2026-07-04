// scripts/audit/dependency-modernization.schema.ts
//
// Zod schemas for PR-9a dependency modernization control plane.
//
// SoT for the artifact shape consumed by:
//   - scripts/audit/build-dependency-modernization-inventory.ts (generator)
//   - scripts/audit/render-dependency-modernization-matrix.ts (matrix codegen)
//   - audit/dependencies/family-overlay.yaml (human overlay)
//   - PR-9b..9g executors
//
// Projection over audit/registry/deps.json + package-lock.json + overlay.
// NOT a new policy engine — `inventoryFormat: "pr-9-modernization-inventory"`.
import { z } from "zod";
import { DependencyBucketSchema } from "../../packages/registry/src/entries/dep-entry";

export const INVENTORY_FORMAT = "pr-9-modernization-inventory" as const;
// 1.1.0 : PackageOccurrence gained the atomic `bucket` field, sourced from the
// L1 DepEntry.occurrences[] tuple (dep-entry.ts). Prior 1.0.0 occurrences were
// reconstructed by index-zip of parallel arrays and could mis-pair.
export const SCHEMA_VERSION = "1.1.0" as const;
export const MATRIX_VERSION = "pr9-v1" as const;

// ---------------- Enums ----------------

export const BlastRadiusSchema = z.enum([
  "tooling",
  "validation",
  "runtime-backend",
  "runtime-frontend",
  "queues",
  "auth",
  "observability",
  "data",
  "internal",
  "unassigned",
]);

export const PrAssignmentSchema = z.enum([
  "pr-9b",
  "pr-9c",
  "pr-9d",
  "pr-9e",
  "pr-9f",
  "pr-9g",
  "deferred",
]);

export const UpgradeStrategySchema = z.enum([
  "in-place",          // bump in a single PR, no parallel runtime
  "parallel-run",      // old and new cohabit for one release window
  "abstraction-first", // refactor consumers behind interface, then bump impl
  "spike-only",        // exploratory branch — no merge to main
  "staged-rollout",    // phased deploy (workers-first, canary, full)
  "benchmark-only",    // measurement only — never production
]);

export const RuntimeCriticalitySchema = z.enum([
  "critical", // user-facing path, sign-out / payment / public SEO
  "high",     // background queues, observability, internal admin
  "medium",   // build pipeline, partial outage tolerable
  "low",      // dev-only tooling, no runtime impact
]);

export const DeploymentStageSchema = z.enum([
  "workers-first",
  "api-second",
  "frontend-first",
  "dual-runtime",
  "canary",
  "full-rollout",
]);

export const RollbackComplexitySchema = z.enum([
  "trivial",   // `git revert` is enough, no data/state migration
  "moderate",  // revert + verify but no irreversible state change
  "dangerous", // requires written runbook (data re-emission, banners, staged rollback)
]);

export const ObservabilityRequirementSchema = z.enum([
  "sentry",
  "structured-logs",
  "queue-metrics",
  "session-roundtrip",
  "health-endpoint",
  "synthetic-crawler",
  "traces",
]);

export const MigrationBlockerSchema = z.string().regex(/^[A-Z][A-Za-z0-9]+$/, {
  message: "migration_blockers entries must be CamelCase tokens (e.g. Node20Required)",
});

export const DualRuntimeSupportSchema = z.enum(["full", "partial", "none"]);

export const UpgradeOwnerDomainSchema = z.string().regex(/^[a-z][a-z0-9-]+$/, {
  message: "upgrade_owner_domain entries must be kebab-case domain IDs (e.g. backend-runtime, auth, queues)",
});

export const UserImpactSchema = z.enum([
  "forced-signout",
  "banner-display",
  "short-api-restart",
  "queue-delay",
  "page-reload-required",
  "cdn-cache-flush",
  "none",
]);

export const PerfBaselineMetricSchema = z.enum([
  "cold-start",
  "p99",
  "p95",
  "build-time",
  "memory",
  "bundle-size",
  "lcp",
  "hydration-time",
]);

export const RecoveryStepSchema = z.string().regex(/^[a-z][a-z0-9-]+$/, {
  message: "estimated_recovery_sequence entries must be kebab-case step tokens (e.g. disable-canary, rollback-api)",
});

export const StatefulSurfaceSchema = z.enum([
  "redis-sessions",
  "redis-cache",
  "repeatable-jobs",
  "hydration-cache",
  "cookies",
  "realtime-channels",
  "none",
]);

export const RollbackValidationCheckSchema = z.enum([
  "session-roundtrip",
  "queue-depth-stable",
  "no-sentry-spike",
  "health-endpoint-ok",
  "traces-continuity",
  "synthetic-crawler-green",
  "form-submit-smoke",
  "none",
]);

export const CanaryAbortConditionSchema = z.string().regex(/^[a-z][a-z0-9-]+$/, {
  message: "canary_abort_conditions entries must be kebab-case quantitative tokens (e.g. p99-regression-20pct)",
});

export const RuntimeStateCouplingSchema = z.enum([
  "redis",
  "cookies",
  "queue-ids",
  "cache-keys",
  "realtime-channels",
  "cdn",
  "dom",
  "none",
]);

export const RollbackDataLossRiskSchema = z.enum([
  "none",         // rollback yields zero data loss
  "replayable",   // state diverges briefly but can be re-emitted
  "partial-loss", // some user-visible state lost (e.g. mid-flight sessions)
  "irreversible", // dropped column / destroyed data — automated rollback forbidden
]);

export const RuntimeEntrypointSchema = z.enum([
  "api",
  "workers",
  "cron",
  "ssr",
  "edge",
  "build-only",
]);

export const OperationalOwnerSchema = z.string().regex(/^[a-z][a-z0-9-]+-team$/, {
  message: "operational_owner must be a kebab-case team slug ending in -team (e.g. auth-team)",
});

export const ReviewLoadSchema = z.enum(["low", "medium", "high", "extreme"]);

export const SloIdSchema = z.string().regex(/^[a-z][a-z0-9-]+$/, {
  message: "runtime_slo_impact entries must be kebab-case SLO IDs (e.g. api-p99)",
});

export const FamilySlugSchema = z.string().regex(/^[a-z][a-z0-9-]+$/, {
  message: "family slug must be kebab-case",
});

export const NullableIsoDatetimeSchema = z.union([
  z.string().datetime({ offset: true }),
  z.null(),
]);

export const NullableGitShaSchema = z.union([
  z.string().regex(/^[0-9a-f]{40}$/, { message: "must be a 40-char lowercase git SHA" }),
  z.null(),
]);

export const UpgradeCostEstimateSchema = z.object({
  estimated_engineer_days: z.number().int().positive(),
  estimated_review_load: ReviewLoadSchema,
});

export const RuntimeDependencyEdgesSchema = z.object({
  depends_on_runtime: z.array(FamilySlugSchema),
});

export const RuntimeCapabilitySchema = z.enum([
  "supports-canary",
  "supports-shadow",
  "supports-dual-write",
  "supports-feature-flag",
  "none",
]);

export const FailureDomainSchema = z.enum([
  "authentication",
  "queues",
  "seo-rendering",
  "api-runtime",
  "data-layer",
  "observability",
  "frontend-ssr",
  "tooling",
  "none",
]);

export const RollbackConfidenceLevelSchema = z.enum([
  "theoretical",
  "simulated",
  "drilled",
  "production-proven",
]);

export const StateTransitionStrategySchema = z.enum([
  "dual-write",
  "replay",
  "lazy-migration",
  "hard-cut",
  "none",
]);

export const IncidentCommProtocolSchema = z.enum([
  "status-page",
  "banner",
  "support-ticket-tag",
  "slack-channel",
  "email-notification",
  "none",
]);

export const CompatibilityContractSchema = z.string().regex(/^[a-z][a-z0-9-]+-v\d+$/, {
  message: "compatibility_contracts entries must match '<kebab-prefix>-v<integer>' (e.g. session-cookie-v7)",
});

export const TimeOfDaySchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, {
  message: "time-of-day must be HH:MM (24h)",
});

export const RuntimeFreezeWindowSchema = z.union([
  z.object({ start: TimeOfDaySchema, end: TimeOfDaySchema }),
  z.null(),
]);

export const OrchestratorRollbackModeSchema = z.enum(["manual-only", "auto-allowed"]);
export const OrchestratorDeployModeSchema = z.enum(["staged", "atomic", "canary-only"]);

export const OrchestratorPolicySchema = z.object({
  rollback_mode: OrchestratorRollbackModeSchema,
  deploy_mode: OrchestratorDeployModeSchema,
});

export const DependencyLineageSchema = z.object({
  supersedes: z.array(CompatibilityContractSchema),
});

export const RuntimeBudgetConstraintsSchema = z.object({
  max_p99_regression_pct: z.number().int().min(0).max(100).optional(),
  max_memory_growth_pct: z.number().int().min(0).max(100).optional(),
  max_cold_start_regression_pct: z.number().int().min(0).max(100).optional(),
  max_lcp_regression_pct: z.number().int().min(0).max(100).optional(),
});

export const DuplicateResolutionSchema = z.enum([
  "latest-write-wins",
  "first-write-wins",
  "merge",
  "manual-review",
  "n/a",
]);

export const StateReconciliationStrategySchema = z.object({
  duplicate_resolution: DuplicateResolutionSchema,
});

export const OrchestratorLockScopeSchema = z.string().regex(/^[a-z][a-z0-9-]+$/, {
  message: "orchestrator_lock_scope entries must be kebab-case tokens",
});

export const NullableIsoDateSchema = z.union([
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "must be ISO-8601 date YYYY-MM-DD" }),
  z.null(),
]);

export const StateSchemaVersionSchema = z.string().min(1);

// ---------------- Overlay entry (base + refined) ----------------

// Defined as raw z.object so it stays extendable for InventoryFamilySchema below.
// Cross-field invariants are applied via FamilyOverlayEntrySchema (refined export).
export const FamilyOverlayEntryBase = z.object({
  family: FamilySlugSchema,
  blast_radius: BlastRadiusSchema,
  target_major: z.string().min(1),
  pr_assignment: PrAssignmentSchema,
  source_url: z.string().url(),
  notes: z.string().optional(),
  members: z.array(z.string().min(1)).min(1),

  // Execution
  upgrade_strategy: UpgradeStrategySchema,
  runtime_criticality: RuntimeCriticalitySchema,
  requires_staging_soak: z.boolean(),
  staging_soak_hours: z.number().int().nonnegative().optional(),
  node_runtime_requirement: z.string().min(1).optional(),
  peer_dependency_cluster: z.array(z.string().min(1)).optional(),
  deployment_sequence: z.array(DeploymentStageSchema).optional(),
  production_approved: z.boolean(),

  // Governance
  rollback_complexity: RollbackComplexitySchema,
  migration_blockers: z.array(MigrationBlockerSchema),
  observability_requirements: z.array(ObservabilityRequirementSchema),

  // Operational
  data_migration_required: z.boolean(),
  supports_dual_runtime: DualRuntimeSupportSchema,
  rollback_rto_minutes: z.number().int().positive(),
  upgrade_owner_domain: z.array(UpgradeOwnerDomainSchema).min(1),
  requires_perf_baseline: z.boolean(),

  // Control-plane
  rollback_runbook_required: z.boolean(),
  expected_user_impact: z.array(UserImpactSchema),
  perf_baseline_metrics: z.array(PerfBaselineMetricSchema),
  estimated_recovery_sequence: z.array(RecoveryStepSchema),

  // State + canary
  stateful_surface: z.array(StatefulSurfaceSchema).min(1),
  rollback_validation_checks: z.array(RollbackValidationCheckSchema).min(1),
  canary_abort_conditions: z.array(CanaryAbortConditionSchema),
  runtime_state_coupling: z.array(RuntimeStateCouplingSchema).min(1),
  safe_parallel_window_minutes: z.number().int().nonnegative(),

  // Orchestration
  rollback_data_loss_risk: RollbackDataLossRiskSchema,
  runtime_entrypoints: z.array(RuntimeEntrypointSchema).min(1),
  operational_owner: OperationalOwnerSchema,
  estimated_canary_duration_minutes: z.number().int().nonnegative(),
  rollback_requires_human_approval: z.boolean(),

  // Lifecycle + planning
  rollback_tested_at: NullableIsoDatetimeSchema,
  rollback_drill_commit: NullableGitShaSchema,
  known_incompatible_families: z.array(FamilySlugSchema),
  upgrade_cost_estimate: UpgradeCostEstimateSchema,
  runtime_slo_impact: z.array(SloIdSchema),

  // Runtime DAG + canary auto-eval
  runtime_dependency_edges: RuntimeDependencyEdgesSchema,
  rollback_preconditions: z.array(z.string().regex(/^[a-z][a-z0-9-]+$/)),
  observability_sli_queries: z.record(SloIdSchema, z.string().min(1)),
  state_schema_version: StateSchemaVersionSchema,
  rollback_blast_scope: z.array(z.enum([
    "api", "workers", "sessions", "cache", "cdn", "ssr", "queue", "realtime", "none",
  ])).min(1),

  // Platform-engineering
  runtime_capabilities: z.array(RuntimeCapabilitySchema).min(1),
  failure_domain: z.array(FailureDomainSchema).min(1),
  rollback_confidence_level: RollbackConfidenceLevelSchema,
  state_transition_strategy: StateTransitionStrategySchema,
  incident_comm_protocol: z.array(IncidentCommProtocolSchema).min(1),

  // Contract + orchestration
  compatibility_contracts: z.array(CompatibilityContractSchema),
  runtime_freeze_window: RuntimeFreezeWindowSchema,
  orchestrator_policy: OrchestratorPolicySchema,
  dependency_lineage: DependencyLineageSchema,
  state_compatibility_window_minutes: z.number().int().nonnegative(),

  // Budget + reconciliation + lock + grace + expiry
  runtime_budget_constraints: RuntimeBudgetConstraintsSchema,
  state_reconciliation_strategy: StateReconciliationStrategySchema,
  orchestrator_lock_scope: z.array(OrchestratorLockScopeSchema),
  rollback_observability_grace_period_minutes: z.number().int().nonnegative(),
  runtime_contract_expiry: NullableIsoDateSchema,
});

// Cross-field invariants — applied when parsing the overlay file.
export const FamilyOverlayEntrySchema = FamilyOverlayEntryBase
  .refine(
    (v) => !v.requires_staging_soak || typeof v.staging_soak_hours === "number",
    { message: "staging_soak_hours required when requires_staging_soak is true" },
  )
  .refine(
    (v) => !(v.upgrade_strategy === "benchmark-only" && v.production_approved === true),
    { message: "benchmark-only is incompatible with production_approved=true" },
  )
  .refine(
    (v) => !(v.upgrade_strategy === "spike-only" && v.production_approved === true),
    { message: "spike-only is incompatible with production_approved=true" },
  )
  .refine(
    (v) =>
      !(["critical", "high"].includes(v.runtime_criticality) && v.production_approved) ||
      v.observability_requirements.length > 0,
    { message: "critical/high + production_approved requires observability_requirements>0" },
  )
  .refine(
    (v) => !(v.rollback_complexity === "dangerous" && v.upgrade_strategy === "in-place"),
    { message: "rollback_complexity=dangerous is incompatible with upgrade_strategy=in-place" },
  )
  .refine(
    (v) => !(v.data_migration_required === true && v.rollback_complexity === "trivial"),
    { message: "data_migration_required=true forbids rollback_complexity=trivial" },
  )
  .refine(
    (v) =>
      !(v.supports_dual_runtime === "none" &&
        Array.isArray(v.deployment_sequence) &&
        v.deployment_sequence.includes("dual-runtime")),
    { message: "supports_dual_runtime=none is incompatible with deployment_sequence containing 'dual-runtime'" },
  )
  .refine(
    (v) => v.rollback_rto_minutes >= 1 && v.rollback_rto_minutes <= 1440,
    { message: "rollback_rto_minutes must be between 1 and 1440" },
  )
  .refine(
    (v) => !(v.rollback_complexity === "dangerous" && v.rollback_runbook_required !== true),
    { message: "rollback_complexity=dangerous implies rollback_runbook_required=true" },
  )
  .refine(
    (v) => !(v.requires_perf_baseline === true && v.perf_baseline_metrics.length === 0),
    { message: "requires_perf_baseline=true forbids empty perf_baseline_metrics" },
  )
  .refine(
    (v) => !(v.rollback_complexity === "dangerous" && v.estimated_recovery_sequence.length === 0),
    { message: "rollback_complexity=dangerous forbids empty estimated_recovery_sequence" },
  )
  .refine(
    (v) =>
      !(v.rollback_complexity === "dangerous" &&
        (v.rollback_validation_checks.length === 0 || v.rollback_validation_checks.every((c) => c === "none"))),
    { message: "rollback_complexity=dangerous requires non-`none` rollback_validation_checks entry" },
  )
  .refine(
    (v) =>
      !(Array.isArray(v.deployment_sequence) &&
        v.deployment_sequence.includes("canary") &&
        v.canary_abort_conditions.length === 0),
    { message: "deployment_sequence containing 'canary' requires non-empty canary_abort_conditions" },
  )
  .refine(
    (v) => v.supports_dual_runtime !== "none" || v.safe_parallel_window_minutes === 0,
    { message: "supports_dual_runtime=none requires safe_parallel_window_minutes=0" },
  )
  .refine(
    (v) => v.supports_dual_runtime === "none" || v.safe_parallel_window_minutes > 0,
    { message: "supports_dual_runtime=full|partial requires safe_parallel_window_minutes>0" },
  )
  .refine(
    (v) => !(v.rollback_data_loss_risk === "irreversible" && v.rollback_requires_human_approval !== true),
    { message: "rollback_data_loss_risk=irreversible forbids rollback_requires_human_approval=false" },
  )
  .refine(
    (v) =>
      !(Array.isArray(v.deployment_sequence) &&
        v.deployment_sequence.includes("canary") &&
        v.estimated_canary_duration_minutes <= 0),
    { message: "deployment_sequence containing 'canary' requires estimated_canary_duration_minutes>0" },
  )
  .refine(
    (v) => !(v.data_migration_required === true && v.rollback_data_loss_risk === "none"),
    { message: "data_migration_required=true forbids rollback_data_loss_risk=none" },
  )
  .refine(
    (v) => !v.known_incompatible_families.includes(v.family),
    { message: "known_incompatible_families must not contain the family's own slug" },
  )
  .refine(
    (v) =>
      !(["critical", "high"].includes(v.runtime_criticality) && v.production_approved) ||
      v.runtime_slo_impact.length > 0,
    { message: "critical/high + production_approved requires runtime_slo_impact>0" },
  )
  .refine(
    (v) => (v.rollback_tested_at === null) === (v.rollback_drill_commit === null),
    { message: "rollback_tested_at and rollback_drill_commit MUST be both null or both set" },
  )
  .refine(
    (v) => !v.runtime_dependency_edges.depends_on_runtime.includes(v.family),
    { message: "runtime_dependency_edges.depends_on_runtime must not contain own slug" },
  )
  .refine(
    (v) => !(v.rollback_complexity === "dangerous" && v.rollback_preconditions.length === 0),
    { message: "rollback_complexity=dangerous requires non-empty rollback_preconditions" },
  )
  .refine(
    (v) => !(v.rollback_requires_human_approval === true && v.orchestrator_policy.rollback_mode !== "manual-only"),
    { message: "rollback_requires_human_approval=true requires orchestrator_policy.rollback_mode=manual-only" },
  )
  .refine(
    (v) => !(v.state_transition_strategy === "dual-write" && v.state_compatibility_window_minutes <= 0),
    { message: "state_transition_strategy=dual-write requires state_compatibility_window_minutes>0" },
  )
  .refine(
    (v) => v.runtime_freeze_window === null || v.runtime_freeze_window.start !== v.runtime_freeze_window.end,
    { message: "runtime_freeze_window.start MUST differ from end (or set to null)" },
  )
  .refine(
    (v) => {
      if (!v.requires_perf_baseline) return true;
      if (v.production_approved === false) return true; // spike/benchmark exempt
      const b = v.runtime_budget_constraints;
      return (
        b.max_p99_regression_pct !== undefined ||
        b.max_memory_growth_pct !== undefined ||
        b.max_cold_start_regression_pct !== undefined ||
        b.max_lcp_regression_pct !== undefined
      );
    },
    { message: "requires_perf_baseline=true on production_approved family requires at least one budget" },
  )
  .refine(
    (v) =>
      !(["dual-write", "replay"].includes(v.state_transition_strategy) &&
        v.state_reconciliation_strategy.duplicate_resolution === "n/a"),
    { message: "state_transition_strategy=dual-write|replay requires duplicate_resolution≠n/a" },
  )
  .refine(
    (v) => {
      const hasImpact = v.expected_user_impact.some((i) => i !== "none");
      const hasProto = v.incident_comm_protocol.some((p) => p !== "none");
      return !hasImpact || hasProto;
    },
    { message: "non-`none` expected_user_impact requires at least one non-`none` incident_comm_protocol" },
  );

export const FamilyOverlaySchema = z.object({
  schemaVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  families: z.array(FamilyOverlayEntrySchema).min(1),
});

// ---------------- Inventory artifact (generator output) ----------------

export const PackageOccurrenceSchema = z.object({
  workspace: z.string().min(1),
  declaredIn: z.string().min(1),
  bucket: DependencyBucketSchema,
  specifier: z.string().min(1),
});

export const PackageEntrySchema = z.object({
  name: z.string().min(1),
  occurrences: z.array(PackageOccurrenceSchema).min(1),
  resolved_versions: z.array(z.string()).min(1),
  divergent_specifiers: z.boolean(),
  divergent_resolved: z.boolean(),
});

export const InventoryFamilySchema = FamilyOverlayEntryBase.extend({
  packages: z.array(PackageEntrySchema),
  total_occurrences: z.number().int().nonnegative(),
  peer_dependency_cluster_resolved: z.array(z.string().min(1)),
});

export const InventoryArtifactSchema = z.object({
  inventoryFormat: z.literal(INVENTORY_FORMAT),
  schemaVersion: z.literal(SCHEMA_VERSION),
  matrixVersion: z.literal(MATRIX_VERSION),
  artifact_immutability_hash: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  generatedFrom: z.object({
    deps_registry: z.literal("audit/registry/deps.json"),
    deps_registry_sha: z.string().regex(/^sha256:[0-9a-f]{64}$/),
    overlay: z.literal("audit/dependencies/family-overlay.yaml"),
    overlay_sha: z.string().regex(/^sha256:[0-9a-f]{64}$/),
    lockfile: z.literal("package-lock.json"),
    lockfile_sha: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  }),
  summary: z.object({
    total_packages: z.number().int().nonnegative(),
    total_occurrences: z.number().int().nonnegative(),
    families_count: z.number().int().nonnegative(),
    unassigned_count: z.number().int().nonnegative(),
    divergent_packages_count: z.number().int().nonnegative(),
    by_blast_radius: z.record(z.string(), z.number().int().nonnegative()),
    by_pr_assignment: z.record(z.string(), z.number().int().nonnegative()),
  }),
  families: z.array(InventoryFamilySchema),
  unassigned_packages: z.array(PackageEntrySchema),
  divergences: z.array(
    z.object({
      name: z.string(),
      kind: z.enum(["specifier", "resolved"]),
      occurrences: z.array(PackageOccurrenceSchema),
      resolved_versions: z.array(z.string()),
    }),
  ),
});

export type FamilyOverlayEntry = z.infer<typeof FamilyOverlayEntrySchema>;
export type FamilyOverlay = z.infer<typeof FamilyOverlaySchema>;
export type InventoryFamily = z.infer<typeof InventoryFamilySchema>;
export type InventoryArtifact = z.infer<typeof InventoryArtifactSchema>;

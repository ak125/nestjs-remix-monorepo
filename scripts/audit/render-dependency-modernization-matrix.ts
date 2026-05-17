#!/usr/bin/env tsx
// scripts/audit/render-dependency-modernization-matrix.ts
//
// PR-9a — Renders the 12 markdown tables in
// audit/dependencies/dependency-upgrade-matrix.md from the inventory JSON.
// Idempotent + deterministic. Eliminates MD↔YAML drift.
//
// Usage:
//   tsx scripts/audit/render-dependency-modernization-matrix.ts
//   tsx scripts/audit/render-dependency-modernization-matrix.ts --check
import * as fs from "node:fs";
import * as path from "node:path";
import {
  InventoryArtifactSchema,
  type InventoryArtifact,
  type InventoryFamily,
} from "./dependency-modernization.schema";

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const INVENTORY = path.join(REPO_ROOT, "audit", "dependencies", "dependency-modernization-inventory.json");
const MATRIX = path.join(REPO_ROOT, "audit", "dependencies", "dependency-upgrade-matrix.md");

function read(): InventoryArtifact {
  return InventoryArtifactSchema.parse(JSON.parse(fs.readFileSync(INVENTORY, "utf8")));
}

// Escape pipe characters in cell content so they don't break the markdown table.
function cell(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return "—";
  return String(value).replace(/\|/g, "\\|");
}

function fmtList(arr: ReadonlyArray<string> | undefined, fallback = "—"): string {
  if (!arr || arr.length === 0) return fallback;
  return arr.join(", ");
}

function fmtFreezeWindow(w: InventoryFamily["runtime_freeze_window"]): string {
  if (w === null) return "null";
  return `${w.start}→${w.end}`;
}

function fmtBudgets(b: InventoryFamily["runtime_budget_constraints"]): string {
  const parts: string[] = [];
  if (b.max_p99_regression_pct !== undefined) parts.push(`p99:${b.max_p99_regression_pct}%`);
  if (b.max_memory_growth_pct !== undefined) parts.push(`memory:${b.max_memory_growth_pct}%`);
  if (b.max_cold_start_regression_pct !== undefined) parts.push(`cold-start:${b.max_cold_start_regression_pct}%`);
  if (b.max_lcp_regression_pct !== undefined) parts.push(`lcp:${b.max_lcp_regression_pct}%`);
  if (parts.length === 0) return "{}";
  return `{${parts.join(", ")}}`;
}

function fmtDrillStatus(f: InventoryFamily): string {
  if (f.rollback_tested_at && f.rollback_drill_commit) {
    return `${f.rollback_tested_at} / ${f.rollback_drill_commit.slice(0, 7)}`;
  }
  return "null / null";
}

// ---------------- Renderers (one per AUTO-TABLE id) ----------------

function renderTable(header: string[], rows: string[][]): string {
  const sep = header.map(() => "---").join(" | ");
  const head = `| ${header.join(" | ")} |`;
  const sepLine = `| ${sep} |`;
  const body = rows.map((r) => `| ${r.join(" | ")} |`).join("\n");
  return `${head}\n${sepLine}\n${body}`;
}

const RENDERERS: Record<string, (inv: InventoryArtifact) => string> = {
  "upgrade-plan": (inv) =>
    renderTable(
      ["Family", "Blast radius", "Target major", "PR", "Upgrade strategy", "Runtime criticality"],
      inv.families.map((f) => [
        cell(f.family),
        cell(f.blast_radius),
        cell(f.target_major),
        cell(f.pr_assignment),
        cell(f.upgrade_strategy),
        cell(f.runtime_criticality),
      ]),
    ),

  execution: (inv) =>
    renderTable(
      [
        "Family",
        "Soak (h)",
        "Node",
        "Deployment sequence",
        "Production approved",
      ],
      inv.families.map((f) => [
        cell(f.family),
        cell(f.requires_staging_soak ? f.staging_soak_hours ?? 0 : 0),
        cell(f.node_runtime_requirement ?? "—"),
        cell(fmtList(f.deployment_sequence as ReadonlyArray<string> | undefined, "n/a")),
        cell(f.production_approved ? "✓" : "✗"),
      ]),
    ),

  governance: (inv) =>
    renderTable(
      ["Family", "Rollback complexity", "Migration blockers", "Observability requirements"],
      inv.families.map((f) => [
        cell(f.family),
        cell(f.rollback_complexity),
        cell(fmtList(f.migration_blockers, "[]")),
        cell(fmtList(f.observability_requirements, "[]")),
      ]),
    ),

  operational: (inv) =>
    renderTable(
      [
        "Family",
        "Data migration",
        "Dual runtime",
        "RTO (min)",
        "Owner domain",
        "Perf baseline",
      ],
      inv.families.map((f) => [
        cell(f.family),
        cell(f.data_migration_required ? "yes" : "no"),
        cell(f.supports_dual_runtime),
        cell(f.rollback_rto_minutes),
        cell(fmtList(f.upgrade_owner_domain)),
        cell(f.requires_perf_baseline ? "yes" : "no"),
      ]),
    ),

  "control-plane": (inv) =>
    renderTable(
      [
        "Family",
        "Runbook required",
        "User impact",
        "Perf metrics",
        "Recovery sequence",
      ],
      inv.families.map((f) => [
        cell(f.family),
        cell(f.rollback_runbook_required ? "true" : "false"),
        cell(fmtList(f.expected_user_impact)),
        cell(fmtList(f.perf_baseline_metrics, "[]")),
        cell(fmtList(f.estimated_recovery_sequence, "[]")),
      ]),
    ),

  "state-canary": (inv) =>
    renderTable(
      [
        "Family",
        "Stateful surface",
        "Rollback validation checks",
        "Canary abort conditions",
        "Runtime state coupling",
        "Safe parallel window (min)",
      ],
      inv.families.map((f) => [
        cell(f.family),
        cell(fmtList(f.stateful_surface)),
        cell(fmtList(f.rollback_validation_checks)),
        cell(fmtList(f.canary_abort_conditions, "[]")),
        cell(fmtList(f.runtime_state_coupling)),
        cell(f.safe_parallel_window_minutes),
      ]),
    ),

  orchestration: (inv) =>
    renderTable(
      [
        "Family",
        "Data loss risk",
        "Runtime entrypoints",
        "Operational owner",
        "Canary duration (min)",
        "Human approval",
      ],
      inv.families.map((f) => [
        cell(f.family),
        cell(f.rollback_data_loss_risk),
        cell(fmtList(f.runtime_entrypoints)),
        cell(f.operational_owner),
        cell(f.estimated_canary_duration_minutes),
        cell(f.rollback_requires_human_approval ? "true" : "false"),
      ]),
    ),

  "lifecycle-planning": (inv) =>
    renderTable(
      [
        "Family",
        "Drill (tested_at / commit)",
        "Known incompatible families",
        "Engineer days",
        "Review load",
        "Runtime SLO impact",
      ],
      inv.families.map((f) => [
        cell(f.family),
        cell(fmtDrillStatus(f)),
        cell(fmtList(f.known_incompatible_families, "[]")),
        cell(f.upgrade_cost_estimate.estimated_engineer_days),
        cell(f.upgrade_cost_estimate.estimated_review_load),
        cell(fmtList(f.runtime_slo_impact, "[]")),
      ]),
    ),

  "runtime-dag": (inv) =>
    renderTable(
      [
        "Family",
        "depends_on_runtime",
        "Rollback preconditions",
        "SLI queries (count)",
        "State schema version",
        "Rollback blast scope",
      ],
      inv.families.map((f) => [
        cell(f.family),
        cell(fmtList(f.runtime_dependency_edges.depends_on_runtime, "[]")),
        cell(fmtList(f.rollback_preconditions, "[]")),
        cell(Object.keys(f.observability_sli_queries).length),
        cell(f.state_schema_version),
        cell(fmtList(f.rollback_blast_scope)),
      ]),
    ),

  "platform-engineering": (inv) =>
    renderTable(
      [
        "Family",
        "Runtime capabilities",
        "Failure domain",
        "Rollback confidence",
        "State transition strategy",
        "Incident comm protocol",
      ],
      inv.families.map((f) => [
        cell(f.family),
        cell(fmtList(f.runtime_capabilities)),
        cell(fmtList(f.failure_domain)),
        cell(f.rollback_confidence_level),
        cell(f.state_transition_strategy),
        cell(fmtList(f.incident_comm_protocol)),
      ]),
    ),

  "contract-orchestration": (inv) =>
    renderTable(
      [
        "Family",
        "Compatibility contracts",
        "Freeze window",
        "Orchestrator policy",
        "Lineage supersedes",
        "State compat window (min)",
      ],
      inv.families.map((f) => [
        cell(f.family),
        cell(fmtList(f.compatibility_contracts, "[]")),
        cell(fmtFreezeWindow(f.runtime_freeze_window)),
        cell(`{${f.orchestrator_policy.rollback_mode}, ${f.orchestrator_policy.deploy_mode}}`),
        cell(fmtList(f.dependency_lineage.supersedes, "[]")),
        cell(f.state_compatibility_window_minutes),
      ]),
    ),

  "budget-reconciliation": (inv) =>
    renderTable(
      [
        "Family",
        "Runtime budget constraints",
        "Duplicate resolution",
        "Lock scope",
        "Grace period (min)",
        "Contract expiry",
      ],
      inv.families.map((f) => [
        cell(f.family),
        cell(fmtBudgets(f.runtime_budget_constraints)),
        cell(f.state_reconciliation_strategy.duplicate_resolution),
        cell(fmtList(f.orchestrator_lock_scope, "[]")),
        cell(f.rollback_observability_grace_period_minutes),
        cell(f.runtime_contract_expiry ?? "null"),
      ]),
    ),

  "peer-clusters": (inv) =>
    renderTable(
      ["Family", "Overlay patterns", "Resolved members (frozen)"],
      inv.families
        .filter((f) => f.peer_dependency_cluster && f.peer_dependency_cluster.length > 0)
        .map((f) => [
          cell(f.family),
          cell(fmtList(f.peer_dependency_cluster as ReadonlyArray<string> | undefined, "[]")),
          cell(fmtList(f.peer_dependency_cluster_resolved, "[]")),
        ]),
    ),
};

function replaceFence(md: string, id: string, body: string): string {
  const start = `<!-- AUTO-TABLE:${id} START -->`;
  const end = `<!-- AUTO-TABLE:${id} END -->`;
  const re = new RegExp(`${escapeRegex(start)}[\\s\\S]*?${escapeRegex(end)}`);
  return md.replace(re, `${start}\n${body}\n${end}`);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function main() {
  const checkMode = process.argv.includes("--check");
  const inv = read();
  const current = fs.readFileSync(MATRIX, "utf8");
  let md = current;
  for (const [id, render] of Object.entries(RENDERERS)) {
    md = replaceFence(md, id, render(inv));
  }
  if (checkMode) {
    if (current !== md) {
      console.error("✘ matrix drift: re-run `tsx scripts/audit/render-dependency-modernization-matrix.ts`");
      process.exit(1);
    }
    console.log("✓ matrix in sync with inventory");
    return;
  }
  fs.writeFileSync(MATRIX, md, "utf8");
  console.log(
    `✓ rendered ${Object.keys(RENDERERS).length} tables into ${path.relative(REPO_ROOT, MATRIX)}`,
  );
}

if (require.main === module) {
  main();
}

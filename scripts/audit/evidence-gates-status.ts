#!/usr/bin/env tsx
//
// evidence-gates-status.ts
//
// On-demand status reporter for Diagnostic Control Plane V1 evidence gates
// (ADR-077). Stateless — emits stdout JSON or table only; never writes a
// persistent state file (would conceptually violate G6 :
// __diag_kg_divergence_log).
//
// Behavior
//   - Reads .spec/00-canon/repository-registry/evidence-gates.yaml (canon).
//   - For each `auto` / `hybrid` gate : optionally queries the Prometheus
//     exposition format at $PREPROD_METRICS_URL/api/observability/metrics and
//     evaluates the gate's condition against the counter value.
//   - For each `reactive` gate    : reports REQUESTED iff requested_at is set.
//   - For each `derived` gate     : resolves status recursively from depends_on.
//   - Output : JSON (default) or pretty table (`--format=table`).
//   - Exit code : 0 if all gates GATED as expected ; 1 if any FIRED or ERROR.
//
// Usage
//   npx tsx scripts/audit/evidence-gates-status.ts [--format=json|table] \
//                                                  [--no-metrics]       \
//                                                  [--metrics-url=URL]
//
//   PREPROD_METRICS_URL=http://49.12.233.2:3200 npm run audit:evidence-gates
//
// Env
//   PREPROD_METRICS_URL — base URL of /api/observability/metrics (default
//                        unset = treat auto/hybrid gates as ERROR=no-data and
//                        exit 0 in --no-metrics mode).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import yaml from "js-yaml";
// Import the TS source directly (per @repo/registry doctrine — tsx scripts use
// relative paths to avoid the build prerequisite).
import {
  EvidenceGatesRegistrySchema,
  type EvidenceGateEntry,
  type EvidenceGatesRegistry,
  type GateStatus,
} from "../../packages/registry/src/overlay/evidence-gates.ts";

const REPO_ROOT = resolve(__dirname, "../..");
const OVERLAY_PATH = resolve(
  REPO_ROOT,
  ".spec/00-canon/repository-registry/evidence-gates.yaml",
);

interface CliOptions {
  format: "json" | "table";
  noMetrics: boolean;
  metricsUrl: string | null;
}

interface GateStatusRow {
  id: string;
  item: string;
  status: GateStatus;
  trigger_type: string;
  trigger_summary: string;
  metric_value: number | null;
  reason: string;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    format: "json",
    noMetrics: false,
    metricsUrl: process.env.PREPROD_METRICS_URL ?? null,
  };
  for (const arg of argv) {
    if (arg === "--format=table") opts.format = "table";
    else if (arg === "--format=json") opts.format = "json";
    else if (arg === "--no-metrics") opts.noMetrics = true;
    else if (arg.startsWith("--metrics-url=")) opts.metricsUrl = arg.slice("--metrics-url=".length);
  }
  return opts;
}

function loadRegistry(): EvidenceGatesRegistry {
  const raw = readFileSync(OVERLAY_PATH, "utf-8");
  return EvidenceGatesRegistrySchema.parse(yaml.load(raw));
}

export function parsePromMetric(
  body: string,
  metricName: string,
): number | null {
  // Parse Prometheus exposition format : "metric_name{labels} value\n"
  // We accept any label set and sum across them (counter aggregation).
  const re = new RegExp(
    `^${metricName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\{[^}]*\\})?\\s+([0-9eE+\\-.]+)`,
    "gm",
  );
  let total = 0;
  let matched = false;
  for (const m of body.matchAll(re)) {
    total += Number(m[2]);
    matched = true;
  }
  return matched ? total : null;
}

async function fetchPromMetric(
  baseUrl: string,
  metricName: string,
): Promise<number | null> {
  const url = `${baseUrl.replace(/\/$/, "")}/api/observability/metrics`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return parsePromMetric(await res.text(), metricName);
}

export function evaluateCondition(value: number, condition: string): boolean {
  // Supported : "== 0", ">= 1.30", "> 0.05", "< 100", "!= 0"
  const m = condition.trim().match(/^(==|!=|>=|<=|>|<)\s*(-?[\d.]+)$/);
  if (!m) throw new Error(`Unsupported condition syntax: "${condition}"`);
  const op = m[1];
  const threshold = Number(m[2]);
  switch (op) {
    case "==": return value === threshold;
    case "!=": return value !== threshold;
    case ">=": return value >= threshold;
    case "<=": return value <= threshold;
    case ">":  return value >  threshold;
    case "<":  return value <  threshold;
  }
  return false;
}

async function evaluateGate(
  gate: EvidenceGateEntry,
  opts: CliOptions,
  byId: Map<string, GateStatusRow>,
): Promise<GateStatusRow> {
  const base: GateStatusRow = {
    id: gate.id,
    item: gate.item,
    status: "GATED",
    trigger_type: gate.trigger.type,
    trigger_summary: "",
    metric_value: null,
    reason: "default: gated until trigger fires",
  };

  if (gate.trigger.type === "reactive") {
    base.trigger_summary = `signal=${gate.trigger.signal}`;
    if (gate.trigger.requested_at) {
      base.status = "REQUESTED";
      base.reason = `requested at ${gate.trigger.requested_at} by ${gate.trigger.requested_by ?? "unknown"}`;
    }
    return base;
  }

  if (gate.trigger.type === "derived") {
    base.trigger_summary = `derived from ${gate.trigger.depends_on.join(",")}`;
    const upstream = gate.trigger.depends_on
      .map((id) => byId.get(id))
      .filter((g): g is GateStatusRow => Boolean(g));
    if (upstream.length === 0) {
      base.status = "ERROR";
      base.reason = "depends_on references unknown gate(s)";
    } else if (upstream.every((g) => g.status === "FIRED")) {
      base.status = "FIRED";
      base.reason = `all dependencies fired: ${upstream.map((g) => g.id).join(",")}`;
    } else {
      const blocking = upstream.filter((g) => g.status !== "FIRED");
      base.reason = `waiting on ${blocking.map((g) => `${g.id}=${g.status}`).join(",")}`;
    }
    return base;
  }

  if (gate.trigger.type === "auto") {
    base.trigger_summary = `${gate.trigger.metric} ${gate.trigger.condition} (window ${gate.trigger.window_days}d)`;
    if (opts.noMetrics || !opts.metricsUrl) {
      base.status = "ERROR";
      base.reason = "no metrics URL configured (set PREPROD_METRICS_URL or pass --metrics-url)";
      return base;
    }
    try {
      const value = await fetchPromMetric(opts.metricsUrl, gate.trigger.metric);
      base.metric_value = value;
      if (value === null) {
        base.status = "ERROR";
        base.reason = `metric "${gate.trigger.metric}" absent from /api/observability/metrics`;
      } else if (evaluateCondition(value, gate.trigger.condition)) {
        base.status = "FIRED";
        base.reason = `${gate.trigger.metric}=${value} satisfies "${gate.trigger.condition}"`;
      } else {
        base.reason = `${gate.trigger.metric}=${value} does not satisfy "${gate.trigger.condition}"`;
      }
    } catch (e) {
      base.status = "ERROR";
      base.reason = `fetch failed: ${(e as Error).message}`;
    }
    return base;
  }

  if (gate.trigger.type === "hybrid") {
    const autoSummary = gate.trigger.auto_conditions
      .map((c) => `${c.metric} ${c.condition}`)
      .join(" OR ");
    const reactiveSummary = gate.trigger.reactive_conditions
      .map((c) => `signal=${c.signal}`)
      .join(" OR ");
    base.trigger_summary = `(${autoSummary}) OR (${reactiveSummary})`;

    // Reactive side first (cheap)
    const requested = gate.trigger.reactive_conditions.find((c) => c.requested_at);
    if (requested) {
      base.status = "REQUESTED";
      base.reason = `reactive: requested at ${requested.requested_at} by ${requested.requested_by ?? "unknown"}`;
      return base;
    }

    if (opts.noMetrics || !opts.metricsUrl) {
      base.status = "ERROR";
      base.reason = "hybrid gate: no metrics URL configured for auto branch";
      return base;
    }

    for (const c of gate.trigger.auto_conditions) {
      try {
        const value = await fetchPromMetric(opts.metricsUrl, c.metric);
        if (value !== null && evaluateCondition(value, c.condition)) {
          base.status = "FIRED";
          base.metric_value = value;
          base.reason = `auto: ${c.metric}=${value} satisfies "${c.condition}"`;
          return base;
        }
      } catch {
        // ignore one branch failure ; we evaluate all conditions
      }
    }
    base.reason = "no auto condition met and no reactive request";
    return base;
  }

  return base;
}

function renderTable(rows: GateStatusRow[]): string {
  const header = ["ID", "STATUS", "TYPE", "ITEM", "REASON"];
  const widths = header.map((_, i) =>
    Math.max(
      header[i].length,
      ...rows.map((r) => {
        const v = [r.id, r.status, r.trigger_type, r.item, r.reason][i] ?? "";
        return v.length;
      }),
    ),
  );
  const fmt = (vals: string[]) =>
    vals.map((v, i) => v.padEnd(widths[i])).join("  ");
  const lines = [fmt(header), fmt(widths.map((w) => "-".repeat(w)))];
  for (const r of rows) {
    lines.push(fmt([r.id, r.status, r.trigger_type, r.item, r.reason]));
  }
  return lines.join("\n");
}

async function main(): Promise<number> {
  const opts = parseArgs(process.argv.slice(2));
  const registry = loadRegistry();

  const byId = new Map<string, GateStatusRow>();
  // Two-pass: evaluate non-derived first, then derived gates.
  const sorted = [...registry.entries].sort((a, b) => {
    const isDerivedA = a.trigger.type === "derived" ? 1 : 0;
    const isDerivedB = b.trigger.type === "derived" ? 1 : 0;
    return isDerivedA - isDerivedB;
  });

  const rows: GateStatusRow[] = [];
  for (const gate of sorted) {
    const row = await evaluateGate(gate, opts, byId);
    byId.set(row.id, row);
    rows.push(row);
  }
  rows.sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));

  if (opts.format === "table") {
    process.stdout.write(renderTable(rows) + "\n");
  } else {
    process.stdout.write(
      JSON.stringify(
        {
          source_adr: "ADR-077",
          source_adr_url: registry.source_adr_url,
          canon_freeze_date: registry.canon_freeze_date,
          generated_at: new Date().toISOString(),
          metrics_url: opts.metricsUrl,
          gates: rows,
        },
        null,
        2,
      ) + "\n",
    );
  }

  const flipped = rows.some((r) => r.status === "FIRED" || r.status === "REQUESTED");
  return flipped ? 1 : 0;
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === resolve(__filename);

if (invokedDirectly) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      console.error("evidence-gates-status failed:", err);
      process.exit(2);
    },
  );
}

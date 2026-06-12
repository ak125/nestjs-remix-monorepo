#!/usr/bin/env -S node --import tsx
/**
 * scripts/audit/pricing-profitability-projection.ts
 *
 * Phase B compta analytique — CLI wrapper that runs the multi-effects
 * profitability projection against the live `pricing_cost_bucket_aggregates`
 * RPC + the active `pricing_rules` seed in the shared DB, and outputs the
 * 7-axis scorecard as canonical JSON to `audit/registry/`.
 *
 * Doctrine : docs/pricing/economic-governance-system.md
 * Cost model : docs/pricing/cost-allocation-model.md
 * Core logic : backend/src/modules/pricing/services/pricing-projection.core.ts
 *
 * Read-only end-to-end : never writes to `pricing_rules` or any table.
 *
 * Usage :
 *   tsx scripts/audit/pricing-profitability-projection.ts \
 *     [--customer-type B2C|PRO] \
 *     [--candidate-rules <path/to/candidate-rules.json>] \
 *     [--inputs <path/to/projection-inputs.json>] \
 *     [--out <path/to/output.json>]
 *
 * Defaults :
 *   --customer-type B2C
 *   --candidate-rules : (absent) → use the active `pricing_rules` rows = legacy seed
 *                                  (delta = 0 baseline ; sanity check that the engine
 *                                   reproduces current state).
 *   --inputs : DEFAULT_PROJECTION_INPUTS (industry estimates ± 30 %).
 *   --out    : audit/registry/pricing-profitability-projection.json
 *
 * Exit codes :
 *   0 — scorecard produced (regardless of borderline flag)
 *   1 — DB connection / RPC error
 *   2 — input file unreadable / malformed
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { argv, exit, env } from "node:process";
import { createClient } from "@supabase/supabase-js";

import {
  computeGridSimulation,
  type CostBucketAggregate,
} from "../../backend/src/modules/pricing/services/pricing-simulation.core";
import {
  computeProjectionFromSimulation,
  DEFAULT_PROJECTION_INPUTS,
  type ProjectionInputs,
  type ProjectionReport,
} from "../../backend/src/modules/pricing/services/pricing-projection.core";
import type {
  CustomerType,
  PricingRule,
} from "../../backend/src/modules/pricing/services/pricing-strategy.service";

interface CliArgs {
  customerType: CustomerType;
  candidateRulesPath: string | null;
  inputsPath: string | null;
  outPath: string;
}

function parseArgs(): CliArgs {
  const out: CliArgs = {
    customerType: "B2C",
    candidateRulesPath: null,
    inputsPath: null,
    outPath: "audit/registry/pricing-profitability-projection.json",
  };
  for (let i = 2; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    switch (flag) {
      case "--customer-type":
        if (value !== "B2C" && value !== "PRO") {
          throw new Error(`--customer-type must be B2C or PRO (got ${value})`);
        }
        out.customerType = value;
        i++;
        break;
      case "--candidate-rules":
        out.candidateRulesPath = value;
        i++;
        break;
      case "--inputs":
        out.inputsPath = value;
        i++;
        break;
      case "--out":
        out.outPath = value;
        i++;
        break;
      default:
        throw new Error(`unknown flag: ${flag}`);
    }
  }
  return out;
}

function readJson<T>(path: string): T {
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as T;
  } catch (err) {
    throw new Error(
      `failed to read JSON at ${path}: ${(err as Error).message}`,
    );
  }
}

interface SupabaseRuleRow {
  id: number;
  min_cost_cents: number;
  max_cost_cents: number | null;
  margin_rate: string;
  min_margin_amount_cents: number;
  max_margin_rate: string | null;
  customer_type: CustomerType | null;
  supplier_pm_id: string | null;
  category_gamme_id: number | null;
  priority: number;
  active: boolean;
  effective_from: string | null;
  effective_to: string | null;
}

interface SupabaseAggregateRow {
  representative_cost_cents: number;
  piece_count: number;
  sum_achat_x_qty_cents: number | string;
  sum_vente_ttc_x_qty_cents: number | string;
}

function mapRule(row: SupabaseRuleRow): PricingRule {
  return {
    id: row.id,
    minCostCents: row.min_cost_cents,
    maxCostCents: row.max_cost_cents,
    marginRate: Number(row.margin_rate),
    minMarginAmountCents: row.min_margin_amount_cents,
    maxMarginRate:
      row.max_margin_rate === null ? null : Number(row.max_margin_rate),
    customerType: row.customer_type,
    supplierPmId: row.supplier_pm_id,
    categoryGammeId: row.category_gamme_id,
    priority: row.priority,
    active: row.active,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
  };
}

function mapAggregate(row: SupabaseAggregateRow): CostBucketAggregate {
  return {
    representativeCostCents: row.representative_cost_cents,
    pieceCount: row.piece_count,
    sumAchatXQtyCents: Number(row.sum_achat_x_qty_cents),
    sumVenteTtcXQtyCents: Number(row.sum_vente_ttc_x_qty_cents),
  };
}

async function main(): Promise<void> {
  const args = parseArgs();

  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) required in env",
    );
  }
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  // 1. Load bucket aggregates from the read-only RPC.
  const { data: aggData, error: aggErr } = await supabase.rpc(
    "pricing_cost_bucket_aggregates",
  );
  if (aggErr) {
    throw new Error(`pricing_cost_bucket_aggregates RPC: ${aggErr.message}`);
  }
  const buckets = (aggData as SupabaseAggregateRow[]).map(mapAggregate);

  // 2. Load rules (either active seed from DB, or a candidate file).
  let rules: PricingRule[];
  if (args.candidateRulesPath) {
    rules = readJson<PricingRule[]>(args.candidateRulesPath);
  } else {
    const { data: ruleData, error: ruleErr } = await supabase
      .from("pricing_rules")
      .select("*")
      .eq("active", true);
    if (ruleErr) {
      throw new Error(`pricing_rules select: ${ruleErr.message}`);
    }
    rules = (ruleData as SupabaseRuleRow[]).map(mapRule);
  }

  // 3. Load projection inputs (industry defaults unless overridden).
  const inputs: ProjectionInputs = args.inputsPath
    ? readJson<ProjectionInputs>(args.inputsPath)
    : DEFAULT_PROJECTION_INPUTS;

  // 4. Compose the simulation + projection (both pure).
  const simulation = computeGridSimulation(buckets, rules, args.customerType);
  const projection: ProjectionReport = computeProjectionFromSimulation(
    buckets,
    simulation,
    inputs,
  );

  // 5. Persist canonical JSON (audit/registry/ is a projection sink — never edited by hand).
  mkdirSync(dirname(args.outPath), { recursive: true });
  const envelope = {
    schemaVersion: "1.0.0",
    generatedAt: new Date().toISOString(),
    candidateRulesPath:
      args.candidateRulesPath ?? "(active pricing_rules from DB)",
    inputsPath: args.inputsPath ?? "(DEFAULT_PROJECTION_INPUTS)",
    simulation,
    projection,
  };
  writeFileSync(
    args.outPath,
    JSON.stringify(envelope, null, 2) + "\n",
    "utf-8",
  );

  // 6. Human-readable summary on stdout (no surprise side effects).
  console.log(`# Pricing profitability projection (${args.customerType})`);
  console.log(`# customerType = ${projection.customerType}`);
  console.log(`# totalPieceCount = ${projection.totalPieceCount}`);
  console.log(`# hasBorderlineAxis = ${projection.hasBorderlineAxis}`);
  console.log("# Axes:");
  for (const axis of projection.axes) {
    const value =
      axis.valueCents === null
        ? "n/a"
        : `${(axis.valueCents / 100).toFixed(2)} €`;
    const env =
      axis.lowCents !== null && axis.highCents !== null
        ? ` [${(axis.lowCents / 100).toFixed(2)}, ${(axis.highCents / 100).toFixed(2)} €]`
        : "";
    console.log(
      `#   ${axis.key.padEnd(28)} = ${value}${env}   [${axis.confidence}]`,
    );
    if (axis.pendingReason) console.log(`#     → ${axis.pendingReason}`);
  }
  console.log(`# Output: ${join(process.cwd(), args.outPath)}`);
}

main().catch((err) => {
  const isSupabaseErr = String(err.message ?? "").includes("RPC");
  console.error(`pricing-profitability-projection: ${err.message}`);
  exit(isSupabaseErr ? 1 : 2);
});

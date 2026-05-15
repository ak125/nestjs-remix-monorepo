/**
 * ADR-066 — auto_modele_family audit READ-ONLY
 *
 * Verifies whether the auto_modele table has the columns required to materialize
 * the `vehicle_family_id` view for R2 cluster_key v2:
 *   - modele_phase       (pre-facelift / facelift / restylage)
 *   - modele_platform    (PSA EMP2, VAG MQB, ...)
 *   - modele_generation  (gen 1, gen 2, ...)
 *
 * STRICT READ-ONLY — no DDL, no INSERT, no UPDATE. Uses information_schema only.
 *
 * Outputs :
 *   - Status 0 + JSON report to stdout if audit passes (≥3/3 columns present)
 *   - Status 1 if columns missing → fallback documented (cluster_key v1) +
 *     debt logged for future backfill PR (ownership SEO+Data, separate scope).
 *
 * Per ADR-066 §"PR 1 — audit-only fallback-safe (anti-bricolage)" :
 *   This script runs as PR 1 step 1. No mutation. If columns missing,
 *   r2-vehicle-family.service.ts uses fallback `cluster_key v1 =
 *   brand::model::fuel::body × pg_id` (no MV needed).
 *
 * Usage :
 *   pnpm tsx scripts/audit/r2-modele-family-audit.ts
 *   pnpm tsx scripts/audit/r2-modele-family-audit.ts --json    # machine-readable
 */

import { createClient } from "@supabase/supabase-js";

interface AuditResult {
  tableExists: boolean;
  columns: {
    modele_phase: boolean;
    modele_platform: boolean;
    modele_generation: boolean;
  };
  presentCount: number;
  decision: "create_mv" | "fallback_v1";
  reason: string;
  timestamp: string;
}

async function audit(): Promise<AuditResult> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required for audit script",
    );
  }

  const sb = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // STEP 1 — Check table existence (read-only, information_schema).
  const { data: tableRow, error: tableErr } = await sb
    .from("information_schema.tables")
    .select("table_name")
    .eq("table_schema", "public")
    .eq("table_name", "auto_modele")
    .maybeSingle();

  if (tableErr) {
    throw new Error(`information_schema query failed: ${tableErr.message}`);
  }

  const tableExists = Boolean(tableRow);

  if (!tableExists) {
    return {
      tableExists: false,
      columns: { modele_phase: false, modele_platform: false, modele_generation: false },
      presentCount: 0,
      decision: "fallback_v1",
      reason: "auto_modele table not found in public schema",
      timestamp: new Date().toISOString(),
    };
  }

  // STEP 2 — Check column presence (3 expected for vehicle_family_id materialization).
  const { data: cols, error: colsErr } = await sb
    .from("information_schema.columns")
    .select("column_name")
    .eq("table_schema", "public")
    .eq("table_name", "auto_modele")
    .in("column_name", ["modele_phase", "modele_platform", "modele_generation"]);

  if (colsErr) {
    throw new Error(`information_schema columns query failed: ${colsErr.message}`);
  }

  const present = new Set((cols ?? []).map((r) => r.column_name as string));
  const columns = {
    modele_phase: present.has("modele_phase"),
    modele_platform: present.has("modele_platform"),
    modele_generation: present.has("modele_generation"),
  };
  const presentCount = Object.values(columns).filter(Boolean).length;

  // Decision rule (per ADR-066) : 3/3 → create MV authorized ; otherwise fallback v1.
  const decision = presentCount === 3 ? "create_mv" : "fallback_v1";
  const reason =
    decision === "create_mv"
      ? "All 3 columns present → vehicle_family_id MV creation authorized (future migration)"
      : `Only ${presentCount}/3 columns present → fallback cluster_key v1 (brand::model::fuel::body × pg_id). Debt logged to ADR-066 for separate backfill PR (ownership SEO+Data).`;

  return {
    tableExists,
    columns,
    presentCount,
    decision,
    reason,
    timestamp: new Date().toISOString(),
  };
}

async function main() {
  const jsonMode = process.argv.includes("--json");

  try {
    const result = await audit();

    if (jsonMode) {
      process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    } else {
      console.log("ADR-066 — auto_modele_family audit (READ-ONLY)");
      console.log("─".repeat(60));
      console.log(`Table auto_modele exists      : ${result.tableExists ? "YES" : "NO"}`);
      console.log(`  modele_phase present        : ${result.columns.modele_phase ? "✓" : "✗"}`);
      console.log(`  modele_platform present     : ${result.columns.modele_platform ? "✓" : "✗"}`);
      console.log(`  modele_generation present   : ${result.columns.modele_generation ? "✓" : "✗"}`);
      console.log(`Columns present count         : ${result.presentCount}/3`);
      console.log(`Decision                      : ${result.decision}`);
      console.log(`Reason                        : ${result.reason}`);
      console.log(`Timestamp                     : ${result.timestamp}`);
    }

    // Exit 0 in both cases — audit-only, not a gate. The decision is informational
    // and consumed by r2-vehicle-family.service.ts at runtime via env or DB check.
    process.exit(0);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`audit failed: ${msg}`);
    process.exit(2);
  }
}

main();

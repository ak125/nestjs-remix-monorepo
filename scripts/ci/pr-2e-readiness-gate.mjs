#!/usr/bin/env node
// =============================================================================
// PR 2E readiness gate — Supabase-backed machine check.
// =============================================================================
// Industry-standard binary gate (ADR-072 PR 2D-3) consumed by
// .github/workflows/pr-2e-readiness-gate.yml. No bricolage : it queries the
// canonical Supabase project via the official client, writes a Markdown
// report for the PR comment, and exits non-zero when the gate does not pass.
//
// Pass criterion : snapshots >= autoTypes AND autoTypes > 0
//   (canon MEMORY project-r2-v2-canon-sequence-202605)
//
// Required env :
//   SUPABASE_URL                 — canonical project URL
//   SUPABASE_SERVICE_ROLE_KEY    — read-only count(*) is the only DB op
// =============================================================================

import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";

const REPORT_PATH = "gate-report.md";
const SAMPLE_SIZE = 10;

function fail(message) {
  console.error(`[pr-2e-gate] ${message}`);
  writeFileSync(
    REPORT_PATH,
    `### 🚦 PR 2E readiness gate — ❌ ERROR\n\n${message}\n`,
  );
  process.exit(2);
}

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  fail("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function countTable(table, idColumn) {
  const { count, error } = await supabase
    .from(table)
    .select(idColumn, { count: "exact", head: true });
  if (error) {
    throw new Error(`count_${table}_failed: ${error.message}`);
  }
  return count ?? 0;
}

async function fetchSample() {
  const { data, error } = await supabase
    .from("auto_type")
    .select("type_id")
    .order("type_id", { ascending: true })
    .limit(SAMPLE_SIZE);
  if (error) {
    throw new Error(`sample_fetch_failed: ${error.message}`);
  }
  const rows = data ?? [];
  const typeIds = rows
    .map((row) => Number.parseInt(row.type_id, 10))
    .filter((id) => Number.isFinite(id) && id > 0);
  if (typeIds.length === 0) {
    return [];
  }
  const { data: pages, error: pagesError } = await supabase
    .from("__seo_r8_pages")
    .select("type_id, current_snapshot_id")
    .in("type_id", typeIds);
  if (pagesError) {
    throw new Error(`sample_pages_join_failed: ${pagesError.message}`);
  }
  const pageMap = new Map();
  for (const row of pages ?? []) {
    pageMap.set(Number(row.type_id), row.current_snapshot_id ?? null);
  }
  return typeIds.map((typeId) => ({
    typeId,
    hasSnapshot:
      typeof pageMap.get(typeId) === "number" && pageMap.get(typeId) > 0,
  }));
}

function renderReport({ snapshots, autoTypes, pass, lag, lagPercent, sample }) {
  const status = pass ? "✅ PASS" : "❌ BLOCKED";
  const lines = [];
  lines.push(`### 🚦 PR 2E readiness gate — ${status}`);
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("| --- | --- |");
  lines.push(
    `| \`snapshots\` (\`__seo_r8_snapshot_store\` rows) | **${snapshots}** |`,
  );
  lines.push(`| \`autoTypes\` (\`auto_type\` rows) | **${autoTypes}** |`);
  lines.push(`| \`lag\` (snapshots − autoTypes) | ${lag} |`);
  lines.push(`| \`lagPercent\` | ${lagPercent.toFixed(2)}% |`);
  lines.push(`| \`pass\` | \`${pass}\` |`);
  lines.push("");
  if (sample.length > 0) {
    const covered = sample.filter((row) => row.hasSnapshot).length;
    lines.push(
      `**Sample** (first ${sample.length} \`type_id\`) — ${covered}/${sample.length} have a snapshot:`,
    );
    lines.push("");
    lines.push("```");
    for (const row of sample) {
      const mark = row.hasSnapshot ? "✓" : "·";
      lines.push(`  ${mark} type_id=${row.typeId}`);
    }
    lines.push("```");
    lines.push("");
  }
  if (!pass) {
    lines.push(
      "> ❌ **Block reason** — `snapshots < autoTypes`. Run the seed job before merging this PR.",
    );
    lines.push(">");
    lines.push("> ```bash");
    lines.push(
      "> # Industry-standard path : trigger the admin endpoint",
      "> curl -X POST https://<admin-host>/api/admin/seo/r2/r8-seed/run \\",
      "> -H 'Content-Type: application/json' \\",
      "> -H 'Cookie: <admin session>' \\",
      `> -d '{"idempotencyKey":"pr-2e-seed-$(date +%s)","dryRun":false}'`,
    );
    lines.push("> ```");
    lines.push(">");
    lines.push(
      "> Then poll `GET /api/admin/seo/r2/r8-seed/run/{runId}` until `status: completed`.",
    );
  } else {
    lines.push(
      "> ✅ Gate passing — PR 2E is unblocked at the data layer. Reviewer signoff still required.",
    );
  }
  lines.push("");
  lines.push(
    `_Computed at ${new Date().toISOString()} — script: \`scripts/ci/pr-2e-readiness-gate.mjs\`._`,
  );
  return lines.join("\n");
}

async function main() {
  const [snapshots, autoTypes, sample] = await Promise.all([
    countTable("__seo_r8_snapshot_store", "id"),
    countTable("auto_type", "type_id"),
    fetchSample().catch((err) => {
      console.warn(`[pr-2e-gate] sample fetch failed: ${err.message}`);
      return [];
    }),
  ]);

  const lag = snapshots - autoTypes;
  const lagPercent =
    autoTypes === 0 ? 0 : ((autoTypes - snapshots) / autoTypes) * 100;
  const pass = snapshots >= autoTypes && autoTypes > 0;

  const report = renderReport({
    snapshots,
    autoTypes,
    pass,
    lag,
    lagPercent,
    sample,
  });

  writeFileSync(REPORT_PATH, report);
  console.log(report);

  if (!pass) {
    console.error(
      `[pr-2e-gate] BLOCKED — snapshots=${snapshots} < autoTypes=${autoTypes}`,
    );
    process.exit(1);
  }

  console.log(
    `[pr-2e-gate] OK — snapshots=${snapshots} >= autoTypes=${autoTypes}`,
  );
}

main().catch((err) => {
  fail(`unexpected: ${err.stack ?? err.message}`);
});

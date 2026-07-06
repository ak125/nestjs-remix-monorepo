#!/usr/bin/env tsx
/**
 * Served-content write-sink ratchet — block-new CI gate (Tranche B1b, ADR-058 §23 ratchet step).
 *
 * PURPOSE (owner steer): a SEATBELT before B2, not a new architecture. It prevents a *new*
 * ungoverned path to actually-served content from landing silently while B2..B5 close the
 * *existing* bypasses. It does NOT reroute writers, touch ContentWriteGate, add provenance,
 * or classify governed-vs-bypass. Every current served-content write sink is FROZEN as a
 * known-debt baseline; only a NEW sink (a new `file::target` pair not in the baseline) fails
 * CI — forcing owner review ("new served writer → which enforcement owner?").
 *
 * Denominator + owner matrix come from the read-only audits (do not re-derive here):
 *   audit/tranche-b0-served-output-inventory-2026-07-06.md   (served denominator)
 *   audit/tranche-b1a-enforcement-ownership-2026-07-06.md    (9 enforcement owners)
 *
 * DETECTION IS MULTI-MECHANISM ON PURPOSE — no single pattern sees all of TS/const/RPC/SQL:
 *   1. direct_literal   — `.from('<served_table>')…​.insert|update|upsert|delete(` in backend/src TS.
 *   2. const_map        — `.from(<SERVED_CONST_MAP>…)…​.insert|update|upsert|delete(` (R7/R8/blog/gate maps).
 *   3. rpc_publisher    — `.rpc('<served_publish_rpc>')` in backend/src TS.
 *   4. sql_migration    — `INSERT INTO|UPDATE <served_table>` or `CREATE … FUNCTION … <served_table>`
 *                         in backend/supabase/migrations + backend/sql (governed DB writes).
 *
 * COVERAGE (what a detector CANNOT see — documented, not hidden):
 *   - Fully-dynamic table names computed at runtime (e.g. `.from(fieldDef.table)` where `fieldDef`
 *     is resolved from data) — only KNOWN const maps are enumerated. New dynamic channels need a
 *     baseline/config update (a governed act) — a genuine limit, called out, never silently "green".
 *   - Out-of-process manual scripts (backend/scripts, root scripts, psql, .sql run by hand) — B0
 *     Layer-3 territory, closable only by DB-REVOKE (owner-gated), OUT of this app-scope ratchet.
 *   - Raw arbitrary-SQL write (`execute_sql`) — already removed from backend/src (B0 §3); not re-added here.
 *   - This gate does NOT decide governed-vs-bypass; it forces a human to answer that on each NEW sink.
 *
 * Exit codes (mirrors check-contract-drift-ratchet.ts): 0 = no new sink · 1 = new sink(s) · 2 = invariant.
 * `--refresh` is MAINTAINER-ONLY MANUAL — never CI-wired. `--json` prints the current sink set.
 */
import { readFileSync, writeFileSync, renameSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { z } from "zod";

const REPO_ROOT = process.cwd();
const BASELINE_PATH = join(REPO_ROOT, "audit/baselines/served-content-write-sinks-baseline.json");

// ── Control config (derived from B0+B1a; citations in the audits, not re-litigated here) ──────
// Served CONTENT tables read at render on a public/indexed page (B0 §1, §2).
export const SERVED_TABLES: readonly string[] = [
  "__seo_gamme",
  "__seo_r1_image_prompts",
  "__seo_gamme_car",
  "__seo_gamme_conseil",
  "__seo_r3_image_prompts",
  "__seo_gamme_purchase_guide",
  "__seo_r1_gamme_slots",
  "__seo_r7_pages",
  "__seo_r8_pages",
  "__blog_advice",
  "__blog_guide",
  "__blog_seo_marque",
  "__diag_symptom",
  "__diag_cause",
  "__diag_system",
  "__diag_safety_rule",
  "___meta_tags_ariane",
  "__seo_reference",
  "__seo_observable",
];
// Const channels whose target resolves to a served table — writers use these, NOT string literals
// (B0/B1a). Bare maps (R7/R8/gate) whose members are all served R-page tables/satellites; plus
// MEMBER-precise entries on the shared `TABLES` map (member-level to avoid flagging non-served
// members like `TABLES.pieces_gamme`).
export const SERVED_CONST_CHANNELS: readonly string[] = [
  "R7_TABLES", // .pages/.versions/.fingerprints/.queue/.qa (R7 served write system)
  "R8_TABLES", // R8 served write system
  "GROUP_TABLE_MAP", // ContentWriteGate group→served-table map
  "TABLES.meta_tags_ariane", // ___meta_tags_ariane (served SEO meta)
  "TABLES.blog_advice", // __blog_advice (served blog/home/R3)
  "TABLES.blog_guide", // __blog_guide (served blog)
];
// DEFINER/publish RPCs that mutate a served row (B0 §1 R8, B1a Owner ③).
export const SERVED_PUBLISH_RPCS: readonly string[] = ["__seo_r8_publish_snapshot"];

const WRITE_VERBS = "insert|update|upsert|delete";
const CHAIN = "[\\s\\S]{0,300}?"; // bounded window across a fluent .from(...).verb(...) chain

// ── Finding model ─────────────────────────────────────────────────────────────────────────
export const MechanismSchema = z.enum([
  "direct_literal",
  "const_map",
  "rpc_publisher",
  "sql_migration",
]);
export type Mechanism = z.infer<typeof MechanismSchema>;

export const FindingSchema = z.object({
  mechanism: MechanismSchema,
  id: z.string().min(1), // stable `<repo-relative-file>::<target>` — line-independent (low churn)
});
export type Finding = z.infer<typeof FindingSchema>;

export const BaselineSchema = z.object({
  schemaVersion: z.literal("v1"),
  createdAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  createdOnCommit: z.string().nullable(),
  sourcePr: z.number().int().positive().nullable(),
  mode: z.literal("block-new-only"),
  summary: z.record(MechanismSchema, z.number().int().nonnegative()),
  findings: z.array(FindingSchema),
  notes: z.array(z.string()).default([]),
});
export type Baseline = z.infer<typeof BaselineSchema>;

const key = (f: Finding) => `${f.mechanism}::${f.id}`;
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ── Detectors (pure — take file {path,text}, return findings) ────────────────────────────────
export function detectTsSinks(path: string, text: string): Finding[] {
  const out: Finding[] = [];
  for (const table of SERVED_TABLES) {
    const re = new RegExp(`\\.from\\(\\s*['"\`]${escapeRe(table)}['"\`]\\s*\\)${CHAIN}\\.(${WRITE_VERBS})\\s*\\(`);
    if (re.test(text)) out.push({ mechanism: "direct_literal", id: `${path}::${table}` });
  }
  for (const channel of SERVED_CONST_CHANNELS) {
    const re = new RegExp(`\\.from\\(\\s*${escapeRe(channel)}\\b${CHAIN}\\.(${WRITE_VERBS})\\s*\\(`);
    if (re.test(text)) out.push({ mechanism: "const_map", id: `${path}::${channel}` });
  }
  for (const rpc of SERVED_PUBLISH_RPCS) {
    // Match both the raw client (`.rpc('fn'`) and the governed wrapper (`callRpc('fn'`) used
    // by SupabaseBaseService — the R8 publisher goes through `this.callRpc(...)` (B1a Owner ③).
    const re = new RegExp(`(?:\\.rpc|callRpc)(?:<[^>]*>)?\\(\\s*['"\`]${escapeRe(rpc)}['"\`]`);
    if (re.test(text)) out.push({ mechanism: "rpc_publisher", id: `${path}::${rpc}` });
  }
  return out;
}

export function detectSqlSinks(path: string, text: string): Finding[] {
  const out: Finding[] = [];
  for (const table of SERVED_TABLES) {
    const t = escapeRe(table);
    const writes = new RegExp(`(insert\\s+into|update)\\s+${t}\\b`, "i");
    const fnWrites = new RegExp(`(insert\\s+into|update)\\s+${t}\\b`, "i"); // same signal inside CREATE FUNCTION bodies
    if (writes.test(text) || fnWrites.test(text)) out.push({ mechanism: "sql_migration", id: `${path}::${table}` });
  }
  return out;
}

// ── Scanner ──────────────────────────────────────────────────────────────────────────────────
function walk(dir: string, pred: (p: string) => boolean, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === "dist" || name === "__fixtures__") continue;
      walk(p, pred, acc);
    } else if (pred(p)) acc.push(p);
  }
  return acc;
}

export function scanSinks(root: string): Finding[] {
  const findings: Finding[] = [];
  const tsFiles = walk(
    join(root, "backend/src"),
    (p) => p.endsWith(".ts") && !p.endsWith(".test.ts") && !p.endsWith(".spec.ts"),
  );
  for (const f of tsFiles) {
    const rel = relative(root, f);
    findings.push(...detectTsSinks(rel, readFileSync(f, "utf8")));
  }
  for (const sqlDir of ["backend/supabase/migrations", "backend/sql"]) {
    const sqlFiles = walk(join(root, sqlDir), (p) => p.endsWith(".sql"));
    for (const f of sqlFiles) {
      const rel = relative(root, f);
      findings.push(...detectSqlSinks(rel, readFileSync(f, "utf8")));
    }
  }
  // Deterministic order + dedupe
  const seen = new Set<string>();
  return findings
    .filter((f) => (seen.has(key(f)) ? false : (seen.add(key(f)), true)))
    .sort((a, b) => key(a).localeCompare(key(b)));
}

// ── Baseline + diff ────────────────────────────────────────────────────────────────────────
export function loadBaseline(path = BASELINE_PATH): Baseline {
  if (!existsSync(path)) {
    console.error(`[served-write-ratchet] baseline missing: ${path}`);
    process.exit(2);
  }
  return BaselineSchema.parse(JSON.parse(readFileSync(path, "utf8")));
}

export function diffFindings(current: Finding[], baseline: Finding[]): { added: Finding[]; removed: Finding[] } {
  const bset = new Set(baseline.map(key));
  const cset = new Set(current.map(key));
  return {
    added: current.filter((f) => !bset.has(key(f))),
    removed: baseline.filter((f) => !cset.has(key(f))),
  };
}

function summarize(findings: Finding[]): Record<Mechanism, number> {
  const s: Record<Mechanism, number> = {
    direct_literal: 0,
    const_map: 0,
    rpc_publisher: 0,
    sql_migration: 0,
  };
  for (const f of findings) s[f.mechanism] += 1;
  return s;
}

export function refresh(current: Finding[], commit: string | null): Baseline {
  return BaselineSchema.parse({
    schemaVersion: "v1",
    createdAt: new Date().toISOString().slice(0, 10),
    createdOnCommit: commit,
    sourcePr: null,
    mode: "block-new-only",
    summary: summarize(current),
    findings: current,
    notes: [
      "Frozen served-content write-sink debt (Tranche B1b). block-new-only: a NEW file::target pair fails CI.",
      "Existing entries are KNOWN debt to be closed by B2..B5 — they are warn-frozen here, not endorsed.",
      "Refresh is maintainer-only-manual; a new sink must be reviewed for its enforcement owner before baselining.",
    ],
  });
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────────
function main() {
  const args = process.argv.slice(2);
  const current = scanSinks(REPO_ROOT);

  if (args.includes("--json")) {
    console.log(JSON.stringify({ count: current.length, summary: summarize(current), findings: current }, null, 2));
    return;
  }

  if (args.includes("--refresh")) {
    const commit = process.env.GITHUB_SHA ?? null;
    const next = refresh(current, commit);
    const tmp = `${BASELINE_PATH}.tmp`;
    writeFileSync(tmp, JSON.stringify(next, null, 2) + "\n");
    renameSync(tmp, BASELINE_PATH);
    console.log(`[served-write-ratchet] baseline refreshed: ${current.length} sinks → ${relative(REPO_ROOT, BASELINE_PATH)}`);
    return;
  }

  if (current.length === 0) {
    console.error("[served-write-ratchet] INVARIANT: scanner found 0 sinks — detectors likely broke. Failing closed.");
    process.exit(2);
  }

  const baseline = loadBaseline();
  const { added, removed } = diffFindings(current, baseline.findings);

  if (removed.length) {
    console.log(`ℹ️  ${removed.length} baselined sink(s) no longer present (a B2..B5 closure or move) — informational:`);
    for (const f of removed) console.log(`   − ${key(f)}`);
    console.log("   (reductions are always allowed; refresh the baseline in a maintainer PR to clear them.)");
  }

  if (added.length) {
    console.error(`\n❌ ${added.length} NEW served-content write sink(s) — ungoverned path to served content must be reviewed:`);
    for (const f of added) console.error(`   + ${key(f)}`);
    console.error(
      "\nEach new sink needs an explicit enforcement owner (B1a §2). Route it through the owner boundary for its\n" +
        "mechanism, OR (if legitimately governed) add it to the baseline via a maintainer refresh with justification.\n" +
        "Baseline: " + relative(REPO_ROOT, BASELINE_PATH),
    );
    process.exit(1);
  }

  console.log(`✅ served-content write sinks: ${current.length} known, 0 new (block-new-only).`);
}

// Only run as CLI (tests import the pure fns).
import { fileURLToPath } from "node:url";
if (process.argv[1] === fileURLToPath(import.meta.url)) main();

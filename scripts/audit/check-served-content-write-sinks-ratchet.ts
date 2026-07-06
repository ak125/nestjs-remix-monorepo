#!/usr/bin/env tsx
/**
 * Served-content write-sink ratchet — block-new CI gate (Tranche B1b, ADR-058 §23 ratchet step).
 *
 * PURPOSE (owner steer): a SEATBELT before B2, not a new architecture. It prevents a *new*
 * ungoverned path to actually-served content from landing silently while B2..B5 close the
 * *existing* bypasses. It does NOT reroute writers, touch ContentWriteGate, add provenance,
 * or classify governed-vs-bypass. Every current served-content write sink is FROZEN as a
 * known-debt baseline with an OCCURRENCE COUNT; the ratchet is COUNT-EXACT and fails on any
 * drift — forcing owner review ("new served writer → which enforcement owner?"):
 *   - a NEW `file::target` pair, OR a HIGHER count at an existing pair (a 2nd writer to the
 *     same file+table that the pair-key alone would hide) → fail;
 *   - a LOWER/absent count (a real B2..B5 closure OR a detector going blind) → also fail,
 *     unless the baseline is refreshed in the SAME PR (a real closure does this → drift = 0).
 *     A coverage loss must never masquerade as a reduction.
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
  count: z.number().int().positive(), // # of write occurrences for this file::target — a 2nd writer bumps it
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
// Count NON-overlapping write occurrences — so a SECOND writer to the same file::target bumps the
// count (a new sink instance the file::target key alone would otherwise hide). Regex MUST be global.
const countMatches = (text: string, re: RegExp): number => (text.match(re) ?? []).length;

// ── Detectors (pure — take file {path,text}, return findings with occurrence counts) ──────────
export function detectTsSinks(path: string, text: string): Finding[] {
  const out: Finding[] = [];
  for (const table of SERVED_TABLES) {
    const re = new RegExp(`\\.from\\(\\s*['"\`]${escapeRe(table)}['"\`]\\s*\\)${CHAIN}\\.(${WRITE_VERBS})\\s*\\(`, "g");
    const n = countMatches(text, re);
    if (n) out.push({ mechanism: "direct_literal", id: `${path}::${table}`, count: n });
  }
  for (const channel of SERVED_CONST_CHANNELS) {
    const re = new RegExp(`\\.from\\(\\s*${escapeRe(channel)}\\b${CHAIN}\\.(${WRITE_VERBS})\\s*\\(`, "g");
    const n = countMatches(text, re);
    if (n) out.push({ mechanism: "const_map", id: `${path}::${channel}`, count: n });
  }
  for (const rpc of SERVED_PUBLISH_RPCS) {
    // Match both the raw client (`.rpc('fn'`) and the governed wrapper (`callRpc('fn'`) used
    // by SupabaseBaseService — the R8 publisher goes through `this.callRpc(...)` (B1a Owner ③).
    const re = new RegExp(`(?:\\.rpc|callRpc)(?:<[^>]*>)?\\(\\s*['"\`]${escapeRe(rpc)}['"\`]`, "g");
    const n = countMatches(text, re);
    if (n) out.push({ mechanism: "rpc_publisher", id: `${path}::${rpc}`, count: n });
  }
  return out;
}

export function detectSqlSinks(path: string, text: string): Finding[] {
  const out: Finding[] = [];
  for (const table of SERVED_TABLES) {
    const t = escapeRe(table);
    // INSERT INTO | UPDATE | DELETE FROM | TRUNCATE [TABLE] — every destructive write to served
    // content, incl. inside CREATE FUNCTION bodies. DELETE/TRUNCATE destroy served rows too.
    const re = new RegExp(`(insert\\s+into|update|delete\\s+from|truncate(\\s+table)?)\\s+${t}\\b`, "gi");
    const n = countMatches(text, re);
    if (n) out.push({ mechanism: "sql_migration", id: `${path}::${table}`, count: n });
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
  // Aggregate by key (sum occurrence counts) + deterministic order.
  const byKey = new Map<string, Finding>();
  for (const f of findings) {
    const ex = byKey.get(key(f));
    if (ex) ex.count += f.count;
    else byKey.set(key(f), { ...f });
  }
  return [...byKey.values()].sort((a, b) => key(a).localeCompare(key(b)));
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
  const bcount = new Map(baseline.map((f) => [key(f), f.count]));
  const ccount = new Map(current.map((f) => [key(f), f.count]));
  return {
    // new key OR MORE occurrences at an existing key (a 2nd writer to the same file::target)
    added: current.filter((f) => (bcount.get(key(f)) ?? 0) < f.count),
    // gone key OR FEWER occurrences — a real closure OR a detector going blind; never silent
    removed: baseline.filter((f) => (ccount.get(key(f)) ?? 0) < f.count),
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
      "Frozen served-content write-sink debt (Tranche B1b). COUNT-EXACT block-new: a new file::target pair OR",
      "a higher occurrence count at an existing pair (a 2nd writer to the same file+table) fails CI.",
      "A DECREASE/DISAPPEARANCE also fails — a real B2..B5 closure MUST refresh this baseline in the SAME PR;",
      "an unexplained drop = detector regression. Coverage loss must never masquerade as a reduction.",
      "Existing entries are KNOWN debt to be closed by B2..B5 — warn-frozen here, not endorsed.",
      "Refresh is maintainer-only-manual, run in the same PR that changes the served-write surface.",
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
  const countOf = (arr: Finding[], k: string) => arr.find((f) => key(f) === k)?.count ?? 0;

  if (added.length) {
    console.error(`\n❌ ${added.length} NEW or INCREASED served-content write sink(s) — ungoverned path to served content:`);
    for (const f of added) console.error(`   + ${key(f)}  (was ${countOf(baseline.findings, key(f))}, now ${f.count})`);
    console.error(
      "\nEach new/increased sink needs an explicit enforcement owner (B1a §2). Route it through the owner boundary\n" +
        "for its mechanism, OR (if legitimately governed) refresh the baseline in THIS PR with justification.",
    );
  }

  if (removed.length) {
    // A drop is NOT a free "reduction": either a real B2..B5 closure (which MUST update the baseline
    // in the same PR → removed becomes 0) or a DETECTOR REGRESSION. Both must be explicit — fail-closed.
    console.error(`\n❌ ${removed.length} served-content write sink(s) DECREASED/DISAPPEARED without a baseline update:`);
    for (const f of removed) console.error(`   − ${key(f)}  (baseline ${f.count}, now ${countOf(current, key(f))})`);
    console.error(
      "\nA drop is EITHER a real closure — then refresh the baseline in THIS SAME PR so the ratchet stays honest —\n" +
        "OR a detector regression — then fix the detector. A coverage loss must never masquerade as a reduction.",
    );
  }

  if (added.length || removed.length) {
    console.error(
      "\nBaseline: " + relative(REPO_ROOT, BASELINE_PATH) +
        "\nRefresh (maintainer, in the SAME PR that changes the surface): npm run audit:served-write-ratchet:refresh",
    );
    process.exit(1);
  }

  const totalOcc = current.reduce((s, f) => s + f.count, 0);
  console.log(`✅ served-content write sinks: count-exact match with baseline (${current.length} keys, ${totalOcc} occurrences).`);
}

// Only run as CLI (tests import the pure fns).
import { fileURLToPath } from "node:url";
if (process.argv[1] === fileURLToPath(import.meta.url)) main();

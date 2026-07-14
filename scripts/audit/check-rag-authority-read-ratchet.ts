#!/usr/bin/env tsx
/**
 * RAG-authority-read ratchet — block-new CI gate (ADR-059 loop, plan §Fermeture B3).
 *
 * PURPOSE: the `seo-no-rag-as-content-source` ast-grep rule stays `severity: warning`
 * while the known B1..B8 RAG-writer debt exists (a warning naturally exits 0, so the
 * scan alone freezes nothing). This ratchet FREEZES that debt at an exact per-file
 * occurrence-count baseline and fails on drift, so `warning` becomes a genuine ratchet:
 *
 *   FAIL on any of →
 *     1. total findings increase beyond the accepted baseline;
 *     2. a finding appears in a NEW file (writer path added);
 *     3. a previously-deleted writer path reappears (new-file vs the refreshed baseline);
 *     4. a new authority-scoped RAG read reaches scope (count up at a file, or new file);
 *     5. an accepted count changes without an explicit baseline update (any mismatch).
 *   Reductions ALSO fail unless the baseline is refreshed in the SAME PR — a real
 *   B-tranche closure refreshes DOWN (→ drift 0); a detector going blind must never
 *   masquerade as a closure. `--refresh` is MAINTAINER-ONLY, never CI-wired.
 *
 * DETECTOR = the ast-grep rule itself (not a re-implemented pattern → no parallel
 * detector / no bricolage). We consume `ast-grep scan --rule <file> --json` output and
 * group by file. Per-file COUNT is the stable fingerprint for this pattern (the match
 * text is always the `RAG_KNOWLEDGE_PATH` identifier; line numbers shift on unrelated
 * edits — mirrors check-served-content-write-sinks-ratchet.ts, which uses count for the
 * same reason).
 *
 * Exit codes: 0 = no drift · 1 = drift (blocking) · 2 = invariant (baseline/scan error).
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, renameSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = process.cwd();
const RULE_ID = "seo-no-rag-as-content-source";
const RULE_FILE = ".ast-grep/rules/seo-no-rag-as-content-source.yml";
const BASELINE_PATH = join(
  REPO_ROOT,
  "audit/baselines/rag-authority-read-baseline.json",
);

export interface Baseline {
  rule: string;
  total: number;
  /** repo-relative file → occurrence count (sorted keys for deterministic diffs). */
  files: Record<string, number>;
  note?: string;
}

export interface AstGrepMatch {
  file: string;
  ruleId: string;
}

/** Group ast-grep matches (already filtered to RULE_ID) by file → count. */
export function countByFile(matches: AstGrepMatch[]): Record<string, number> {
  const byFile: Record<string, number> = {};
  for (const m of matches) {
    if (m.ruleId !== RULE_ID) continue;
    byFile[m.file] = (byFile[m.file] ?? 0) + 1;
  }
  return sortKeys(byFile);
}

function sortKeys(o: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of Object.keys(o).sort()) out[k] = o[k];
  return out;
}

/** Run the ast-grep rule and return the current per-file count map. */
export function scanCurrent(): Record<string, number> {
  const raw = execFileSync(
    "npx",
    [
      "--no-install",
      "ast-grep",
      "scan",
      "--config",
      "sgconfig.yml",
      "--rule",
      RULE_FILE,
      "--json",
    ],
    { cwd: REPO_ROOT, encoding: "utf-8", maxBuffer: 128 * 1024 * 1024 },
  );
  const matches = JSON.parse(raw) as AstGrepMatch[];
  return countByFile(matches);
}

export interface Drift {
  newFiles: string[];
  increased: { file: string; from: number; to: number }[];
  reducedWithoutRefresh: { file: string; from: number; to: number }[];
  totalFrom: number;
  totalTo: number;
}

/** Pure comparator (unit-tested). ok = the frozen debt is exactly preserved. */
export function diffBaseline(
  current: Record<string, number>,
  baseline: Baseline,
): { ok: boolean; drift: Drift } {
  const newFiles = Object.keys(current)
    .filter((f) => !(f in baseline.files))
    .sort();

  const increased = Object.keys(current)
    .filter((f) => f in baseline.files && current[f] > baseline.files[f])
    .map((f) => ({ file: f, from: baseline.files[f], to: current[f] }));

  const reducedWithoutRefresh = Object.keys(baseline.files)
    .filter((f) => (current[f] ?? 0) < baseline.files[f])
    .map((f) => ({ file: f, from: baseline.files[f], to: current[f] ?? 0 }));

  const totalTo = Object.values(current).reduce((a, b) => a + b, 0);
  const ok =
    newFiles.length === 0 &&
    increased.length === 0 &&
    reducedWithoutRefresh.length === 0;

  return {
    ok,
    drift: {
      newFiles,
      increased,
      reducedWithoutRefresh,
      totalFrom: baseline.total,
      totalTo,
    },
  };
}

function loadBaseline(): Baseline {
  if (!existsSync(BASELINE_PATH)) {
    console.error(
      `[rag-authority-read-ratchet] baseline missing: ${BASELINE_PATH}`,
    );
    console.error(
      "Run `npm run audit:rag-authority-read-ratchet:refresh` (maintainer-only) to seed it.",
    );
    process.exit(2);
  }
  return JSON.parse(readFileSync(BASELINE_PATH, "utf-8")) as Baseline;
}

function writeBaseline(files: Record<string, number>): void {
  const baseline: Baseline = {
    rule: RULE_ID,
    total: Object.values(files).reduce((a, b) => a + b, 0),
    files: sortKeys(files),
    note:
      "Known B1..B8 RAG-authority-read debt, FROZEN. Additions/new files fail. A B-tranche " +
      "structural deletion refreshes this DOWN in the same PR. --refresh is maintainer-only.",
  };
  const tmp = `${BASELINE_PATH}.tmp`;
  writeFileSync(tmp, JSON.stringify(baseline, null, 2) + "\n");
  renameSync(tmp, BASELINE_PATH);
}

function main(): void {
  const args = process.argv.slice(2);
  let current: Record<string, number>;
  try {
    current = scanCurrent();
  } catch (e) {
    console.error(
      `[rag-authority-read-ratchet] scan failed: ${(e as Error).message}`,
    );
    process.exit(2);
  }

  if (args.includes("--json")) {
    console.log(
      JSON.stringify(
        {
          rule: RULE_ID,
          total: Object.values(current).reduce((a, b) => a + b, 0),
          files: current,
        },
        null,
        2,
      ),
    );
    return;
  }
  if (args.includes("--refresh")) {
    writeBaseline(current);
    console.log(
      `[rag-authority-read-ratchet] baseline refreshed → ${Object.values(current).reduce((a, b) => a + b, 0)} findings / ${Object.keys(current).length} files.`,
    );
    return;
  }

  const baseline = loadBaseline();
  const { ok, drift } = diffBaseline(current, baseline);
  if (ok) {
    console.log(
      `✓ rag-authority-read ratchet: frozen at ${drift.totalTo} findings / ${Object.keys(current).length} files (no drift).`,
    );
    return;
  }
  console.error("✖ rag-authority-read ratchet: DRIFT vs frozen baseline.");
  if (drift.newFiles.length)
    console.error(
      `  NEW files with RAG-authority reads (add a writer? re-introduced a deleted one?):\n    - ${drift.newFiles.join("\n    - ")}`,
    );
  for (const i of drift.increased)
    console.error(
      `  MORE findings in ${i.file}: ${i.from} → ${i.to} (new authority-scoped RAG read).`,
    );
  for (const r of drift.reducedWithoutRefresh)
    console.error(
      `  FEWER findings in ${r.file}: ${r.from} → ${r.to} — a real closure must refresh the baseline in the SAME PR (npm run audit:rag-authority-read-ratchet:refresh).`,
    );
  console.error(
    `  total ${drift.totalFrom} → ${drift.totalTo}. CI must NEVER call --refresh.`,
  );
  process.exit(1);
}

// Only run when executed directly (not when imported by the test).
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

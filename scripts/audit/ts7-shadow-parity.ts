#!/usr/bin/env tsx
// scripts/audit/ts7-shadow-parity.ts
//
// TS6-vs-TS7 shadow type-check comparison — observation only.
//
// Sanctioned by audit/dependencies/family-overlay.yaml family `tooling-typescript-go`:
//   upgrade_strategy: benchmark-only · runtime_entrypoints: [build-only]
//   runtime_capabilities: [supports-shadow] · production_approved: false  <- HARD VETO
//
// This script NEVER mutates package.json, package-lock.json, or any tsconfig.
// TS7 is installed into a gitignored cache (node_modules/.cache), i.e. outside
// the project's versioned state, and invoked by absolute path. It is not, and
// must not become, a repo dependency: `typescript` belongs to the
// `tooling-typescript-eslint` peer_dependency_cluster, and typescript-eslint
// still caps its peer range at `typescript <6.1.0`.
//
// WHY A PINNED CACHE INSTALL RATHER THAN `npx` PER RUN
//   For isolation and to avoid re-downloading the compiler on every run — NOT
//   because npx cannot execute it. The correct npx form works fine:
//     npx --package=typescript@7.0.2 -- tsc --noEmit -p <p>      # works
//   What does NOT work is the shorthand, and the failure is easy to misread:
//     npx -y typescript@7.0.2 tsc --noEmit -p <p>
//       → error TS5042: Option 'project' cannot be mixed with source files
//   because npx resolves the package's single bin and leaves the `tsc` token as
//   a positional source file. `--version` still prints 7.0.2, so the shorthand
//   looks healthy. Verified 2026-07-26 (both forms).
//
// Outputs:
//   - audit/dependencies/ts7-shadow-parity.json   committed, TIMINGS-FREE, deterministic
//   - audit/ts7-shadow-timings/<runId>.json       gitignored, carries all wall-clock
//
// The split is deliberate: wall-clock can never be byte-reproducible, so it is
// never committed and therefore never has to be exempted from a determinism gate.
//
// Usage:
//   tsx scripts/audit/ts7-shadow-parity.ts
//   tsx scripts/audit/ts7-shadow-parity.ts --parity-only   # skip timing reps (fast)
//   tsx scripts/audit/ts7-shadow-parity.ts --check         # regen parity half, sha-compare
//   tsx scripts/audit/ts7-shadow-parity.ts --project=frontend

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const REPO_ROOT = path.resolve(__dirname, "..", "..");

/** Pinned exactly. Never `@7`, never `@latest` — the artifact is keyed on this. */
export const TS7_VERSION = "7.0.2";

export const SCHEMA_VERSION = "1.0.0";

const PARITY_ARTIFACT = path.join(REPO_ROOT, "audit", "dependencies", "ts7-shadow-parity.json");
const TIMINGS_DIR = path.join(REPO_ROOT, "audit", "ts7-shadow-timings");

/** Timing reps per compiler per project. Run #1 is discarded as FS warm-up. */
const REPS = 4;

/**
 * Every tsconfig project in the repo, asserted against discovery so that a new
 * or deleted project fails loudly instead of silently dropping out of coverage.
 * Nothing else in this repo tracks tsconfig topology, so this list is its own
 * tripwire. `backend/tsconfig.build.json` is excluded: it is an emit variant of
 * backend/tsconfig.json and is not what `turbo typecheck` runs.
 */
export const EXPECTED_PROJECTS = [
  "backend",
  "frontend",
  "packages/cwv-taxonomy",
  "packages/database-types",
  "packages/design-tokens",
  "packages/domain-commerce",
  "packages/registry",
  "packages/seo-role-contracts",
  "packages/seo-roles",
  "packages/seo-types",
  "packages/seo-url-contract",
  "services/remotion-renderer",
] as const;

/**
 * Config-level diagnostics that mean "TS7 rejected this tsconfig outright".
 * When any of these fire, the file-level diagnostic comparison is meaningless,
 * so the project is classified BLOCKED_CONFIG and no parity claim is made.
 *   5023 unknown option · 5024 option requires a value
 *   5069 option requires another option
 *   5101/5107/5108 deprecated-then-removed option
 *   5109/5110 module <-> moduleResolution incompatibility
 */
export const BLOCKING_CONFIG_CODES = new Set([5023, 5024, 5069, 5101, 5107, 5108, 5109, 5110]);

/**
 * Watch-mode status lines only. These carry no type information and are never
 * emitted by a one-shot `--noEmit` run anyway.
 *   6031 "Starting compilation in watch mode"
 *   6032 "File change detected"
 *   6194 "Found N errors. Watching for file changes"
 *
 * Deliberately NOT ignored (they were, briefly, and that was a defect):
 *   TS6059 "File is not under 'rootDir'"
 *   TS6307 "File is not listed within the file list of project"
 * Both are real diagnostics about the project's file graph, and both are
 * exactly the kind of thing a resolution-mode change can flip. Suppressing them
 * would let a genuine difference read as PARITY. Neither occurs in this repo
 * today (verified across all 12 projects on both compilers), so including them
 * costs nothing and closes the hole.
 */
export const IGNORED_CODES = new Set([6031, 6032, 6194]);

export interface Diagnostic {
  file: string | null;
  line: number | null;
  col: number | null;
  code: number;
  severity: string;
  message: string;
}

// --- Diagnostic parsing -----------------------------------------------------

const WITH_FILE = /^(.+?)\((\d+),(\d+)\):\s+(error|warning|message)\s+TS(\d+):\s+(.*)$/;
const WITHOUT_FILE = /^(?:.*?\s)?(error|warning|message)\s+TS(\d+):\s+(.*)$/;

/**
 * Parse `tsc --pretty false` output. Format is stable and identical across TS6
 * and TS7: `relPath(line,col): error TSxxxx: message`, or file-less for config
 * errors. Continuation lines (indented detail) are attached to nothing and
 * dropped — only the keyed header line matters for comparison.
 */
export function parseDiagnostics(raw: string): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line || /^\s/.test(rawLine)) continue;

    const withFile = WITH_FILE.exec(line);
    if (withFile) {
      const code = Number(withFile[5]);
      if (IGNORED_CODES.has(code)) continue;
      out.push({
        file: withFile[1].split(path.sep).join("/"),
        line: Number(withFile[2]),
        col: Number(withFile[3]),
        severity: withFile[4],
        code,
        message: withFile[6].trim(),
      });
      continue;
    }

    const noFile = WITHOUT_FILE.exec(line);
    if (noFile) {
      const code = Number(noFile[2]);
      if (IGNORED_CODES.has(code)) continue;
      out.push({
        file: null,
        line: null,
        col: null,
        severity: noFile[1],
        code,
        message: noFile[3].trim(),
      });
    }
  }
  return out;
}

/**
 * Classification key. Column is DELIBERATELY excluded: TS7's Go scanner may
 * compute UTF-16 columns differently on tabs/CRLF/astral characters, which would
 * manufacture false DIVERGENT verdicts. Column drift is reported separately.
 */
export function looseKey(d: Diagnostic): string {
  return `${d.file ?? "<config>"}|${d.line ?? 0}|TS${d.code}`;
}

export function strictKey(d: Diagnostic): string {
  return `${d.file ?? "<config>"}|${d.line ?? 0}|${d.col ?? 0}|TS${d.code}`;
}

/** Multiset, not a Set — two identical diagnostics on one line must not collapse. */
export function countMap(items: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const k of items) m.set(k, (m.get(k) ?? 0) + 1);
  return m;
}

/** Multiset difference a\b, expanded by multiplicity, sorted for determinism. */
export function multisetDiff(a: Map<string, number>, b: Map<string, number>): string[] {
  const out: string[] = [];
  for (const [k, n] of a) {
    const excess = n - (b.get(k) ?? 0);
    for (let i = 0; i < excess; i++) out.push(k);
  }
  return out.sort();
}

export type Classification = "PARITY" | "BLOCKED_CONFIG" | "DIVERGENT";

export interface ProjectResult {
  project: string;
  classification: Classification;
  ts6DiagnosticCount: number;
  ts7DiagnosticCount: number;
  configDiagnostics: string[];
  onlyInTs6: string[];
  onlyInTs7: string[];
  rootCauseCandidates: string[];
  columnDrift: number;
  messageDeltas: string[];
}

/**
 * Resolution failures that cascade: one of these makes every downstream symbol
 * `any`, which SUPPRESSES many real TS6 errors and shows up as a large
 * `onlyInTs6` list from a single root cause. Surfaced so a reader triages these
 * first rather than reading the diff top-to-bottom.
 */
const CASCADE_CODES = new Set([2307, 2306, 2688, 1479, 2834, 2835, 7016]);

export function classify(
  project: string,
  ts6: Diagnostic[],
  ts7: Diagnostic[],
  ts7ExitCode: number,
): ProjectResult {
  const ts7Config = ts7.filter((d) => d.file === null || BLOCKING_CONFIG_CODES.has(d.code));
  const blocking = ts7Config.filter((d) => BLOCKING_CONFIG_CODES.has(d.code));

  const ts6File = ts6.filter((d) => !BLOCKING_CONFIG_CODES.has(d.code));
  const ts7File = ts7.filter((d) => !BLOCKING_CONFIG_CODES.has(d.code));

  const ts6Loose = countMap(ts6File.map(looseKey));
  const ts7Loose = countMap(ts7File.map(looseKey));
  const onlyInTs6 = multisetDiff(ts6Loose, ts7Loose);
  const onlyInTs7 = multisetDiff(ts7Loose, ts6Loose);

  // Column drift: matched under the loose key but not under the strict key.
  const ts6Strict = countMap(ts6File.map(strictKey));
  const ts7Strict = countMap(ts7File.map(strictKey));
  const columnDrift = multisetDiff(ts6Strict, ts7Strict).filter(
    (k) => !onlyInTs6.includes(k.replace(/\|\d+\|TS/, "|TS")),
  ).length;

  // Same position + code, different wording. Informational, never gates.
  const ts7ByKey = new Map(ts7File.map((d) => [looseKey(d), d]));
  const messageDeltas: string[] = [];
  for (const d of ts6File) {
    const peer = ts7ByKey.get(looseKey(d));
    if (peer && peer.message !== d.message) messageDeltas.push(looseKey(d));
  }

  let classification: Classification;
  if (blocking.length > 0 || (ts7ExitCode !== 0 && ts7File.length === 0)) {
    classification = "BLOCKED_CONFIG";
  } else if (onlyInTs6.length === 0 && onlyInTs7.length === 0 && ts7Config.length === 0) {
    classification = "PARITY";
  } else {
    classification = "DIVERGENT";
  }

  return {
    project,
    classification,
    ts6DiagnosticCount: ts6File.length,
    ts7DiagnosticCount: ts7File.length,
    configDiagnostics: ts7Config.map((d) => `TS${d.code}: ${d.message}`).sort(),
    onlyInTs6,
    onlyInTs7,
    rootCauseCandidates: ts7File
      .filter((d) => CASCADE_CODES.has(d.code))
      .map(looseKey)
      .sort(),
    columnDrift,
    messageDeltas: messageDeltas.sort(),
  };
}

// --- Compiler invocation ----------------------------------------------------

export function discoverProjects(root: string): string[] {
  const found: string[] = [];
  for (const base of ["backend", "frontend", "packages", "services"]) {
    const abs = path.join(root, base);
    if (!fs.existsSync(abs)) continue;
    if (fs.existsSync(path.join(abs, "tsconfig.json"))) {
      found.push(base);
      continue;
    }
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === "node_modules") continue;
      if (fs.existsSync(path.join(abs, entry.name, "tsconfig.json"))) {
        found.push(`${base}/${entry.name}`);
      }
    }
  }
  return found.sort();
}

/**
 * Install the pinned TS7 into a gitignored cache and return the absolute path to
 * its `tsc`. It lives inside the repo directory tree but outside the project's
 * versioned state: nothing is added to package.json / package-lock.json, so no
 * determinism gate is involved and `overrides.typescript` is not perturbed.
 */
export function ensureTs7(): string {
  // Deliberately NOT the OS temp dir: a predictable path under a world-writable
  // directory is a symlink/TOCTOU hazard (CodeQL js/insecure-temporary-file).
  // node_modules/.cache is gitignored, not world-writable, and persists, so the
  // pinned install is reused across runs instead of re-downloaded.
  const home = path.join(REPO_ROOT, "node_modules", ".cache", "ts7-shadow", TS7_VERSION);
  const bin = path.join(home, "node_modules", ".bin", "tsc");

  if (!fs.existsSync(bin)) {
    fs.mkdirSync(home, { recursive: true });
    fs.writeFileSync(
      path.join(home, "package.json"),
      JSON.stringify({ name: "ts7-shadow-scratch", private: true }) + "\n",
    );
    execFileSync(
      "npm",
      ["install", "--no-save", "--no-audit", "--no-fund", `typescript@${TS7_VERSION}`],
      { cwd: home, stdio: "pipe" },
    );
  }

  const reported = execFileSync(bin, ["--version"], { encoding: "utf8" }).trim();
  if (!reported.includes(TS7_VERSION)) {
    throw new Error(`TS7 pin mismatch: expected ${TS7_VERSION}, got "${reported}"`);
  }
  return bin;
}

/**
 * Refuse to measure a half-installed tree.
 *
 * Learned the hard way: run from a git worktree whose workspace-nested
 * node_modules were never installed and whose `frontend/.react-router/types`
 * was never generated, and BOTH compilers report the same 14 phantom TS2307s.
 * The comparison still reads PARITY, so the run looks successful while the
 * timings and diagnostic counts describe a tree nobody ships. Fail loudly
 * instead — no silent fallback.
 */
export function preflight(projects: string[]): void {
  const problems: string[] = [];

  if (!fs.existsSync(path.join(REPO_ROOT, "node_modules", "typescript"))) {
    problems.push("node_modules/typescript is missing (TS6 baseline unavailable)");
  }

  for (const project of projects) {
    const pkg = path.join(REPO_ROOT, project, "package.json");
    if (!fs.existsSync(pkg)) continue;
    const manifest = JSON.parse(fs.readFileSync(pkg, "utf8"));
    const declaresDeps =
      Object.keys(manifest.dependencies ?? {}).length > 0 ||
      Object.keys(manifest.devDependencies ?? {}).length > 0;
    if (declaresDeps && !fs.existsSync(path.join(REPO_ROOT, project, "node_modules"))) {
      problems.push(`${project}/node_modules is missing — its own deps cannot resolve`);
    }
  }

  // frontend/tsconfig.json `include`s .react-router/types and rootDirs it.
  // Mirrors `frontend/package.json` -> "typecheck": "react-router typegen && tsc".
  if (projects.includes("frontend")) {
    const typegenBin = path.join(REPO_ROOT, "node_modules", ".bin", "react-router");
    if (fs.existsSync(typegenBin)) {
      try {
        execFileSync(typegenBin, ["typegen"], {
          cwd: path.join(REPO_ROOT, "frontend"),
          stdio: "pipe",
        });
      } catch (err) {
        problems.push(`react-router typegen failed: ${(err as Error).message}`);
      }
    }
    if (!fs.existsSync(path.join(REPO_ROOT, "frontend", ".react-router", "types"))) {
      problems.push("frontend/.react-router/types absent — run `react-router typegen`");
    }
  }

  if (problems.length) {
    console.error("Preflight failed — refusing to publish numbers from an incomplete tree:");
    for (const p of problems) console.error(`  - ${p}`);
    console.error("\nRun from a fully-installed checkout (`npm install` at the repo root).");
    process.exit(1);
  }
}

export function ts6Version(): string {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, "node_modules", "typescript", "package.json"), "utf8"),
  );
  return pkg.version;
}

interface RunResult {
  raw: string;
  exitCode: number;
  durationMs: number;
}

/**
 * One cold type-check. The buildinfo is always redirected into scratch: 7 of the
 * 12 projects set `composite: true`, which forces buildinfo emission even under
 * --noEmit, and clobbering the real `node_modules/.cache/tsc/*.tsbuildinfo`
 * would poison the incremental cache that ci.yml restores across runs.
 */
function runCompiler(bin: string, project: string, scratch: string): RunResult {
  const buildInfo = path.join(scratch, "shadow.tsbuildinfo");
  if (fs.existsSync(buildInfo)) fs.rmSync(buildInfo);

  const args = [
    "--noEmit",
    "--pretty",
    "false",
    "--tsBuildInfoFile",
    buildInfo,
    "-p",
    path.join(project, "tsconfig.json"),
  ];

  const started = process.hrtime.bigint();
  let raw = "";
  let exitCode = 0;
  try {
    raw = execFileSync(bin, args, {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    exitCode = e.status ?? 1;
    raw = `${e.stdout ?? ""}${e.stderr ?? ""}`;
  }
  const durationMs = Number((process.hrtime.bigint() - started) / 1_000_000n);
  return { raw, exitCode, durationMs };
}

export function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

// --- Main -------------------------------------------------------------------

function main(): void {
  const argv = process.argv.slice(2);
  const checkMode = argv.includes("--check");
  const parityOnly = argv.includes("--parity-only") || checkMode;
  const only = argv.find((a) => a.startsWith("--project="))?.slice("--project=".length);

  const discovered = discoverProjects(REPO_ROOT);
  const expected = [...EXPECTED_PROJECTS].sort();
  const missing = expected.filter((p) => !discovered.includes(p));
  const unexpected = discovered.filter((p) => !expected.includes(p));
  if (missing.length || unexpected.length) {
    console.error("tsconfig topology drift — update EXPECTED_PROJECTS.");
    if (missing.length) console.error(`  disappeared: ${missing.join(", ")}`);
    if (unexpected.length) console.error(`  new:         ${unexpected.join(", ")}`);
    process.exit(1);
  }

  const projects = only ? discovered.filter((p) => p === only || p.endsWith(`/${only}`)) : discovered;
  if (projects.length === 0) {
    console.error(`No project matched --project=${only}`);
    process.exit(1);
  }

  preflight(projects);

  const ts7Bin = ensureTs7();
  const ts6Bin = path.join(REPO_ROOT, "node_modules", ".bin", "tsc");
  const ts6 = ts6Version();

  console.log(`TS6 ${ts6}  vs  TS7 ${TS7_VERSION}   (${projects.length} projects)\n`);

  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "ts7-shadow-run-"));
  const results: ProjectResult[] = [];
  const timings: Record<string, unknown>[] = [];

  try {
    for (const project of projects) {
      // Parity pass: one cold run each, sequential, never concurrent.
      const ts6Run = runCompiler(ts6Bin, project, scratch);
      const ts7Run = runCompiler(ts7Bin, project, scratch);

      const result = classify(
        project,
        parseDiagnostics(ts6Run.raw),
        parseDiagnostics(ts7Run.raw),
        ts7Run.exitCode,
      );
      results.push(result);

      let ts6Times = [ts6Run.durationMs];
      let ts7Times = [ts7Run.durationMs];
      if (!parityOnly) {
        for (let i = 1; i < REPS; i++) {
          ts6Times.push(runCompiler(ts6Bin, project, scratch).durationMs);
          ts7Times.push(runCompiler(ts7Bin, project, scratch).durationMs);
        }
        // Discard run #1 on both sides as OS page-cache warm-up.
        ts6Times = ts6Times.slice(1);
        ts7Times = ts7Times.slice(1);
      }

      const ts6Median = median(ts6Times);
      const ts7Median = median(ts7Times);
      timings.push({
        project,
        ts6MedianMs: ts6Median,
        ts7MedianMs: ts7Median,
        speedup: ts7Median > 0 ? Number((ts6Median / ts7Median).toFixed(2)) : null,
        ts6RunsMs: ts6Times,
        ts7RunsMs: ts7Times,
      });

      const speed = parityOnly ? "" : `  ${ts6Median}ms -> ${ts7Median}ms (${(ts6Median / Math.max(ts7Median, 1)).toFixed(1)}x)`;
      console.log(`  ${result.classification.padEnd(15)} ${project}${speed}`);
      if (result.configDiagnostics.length) {
        console.log(`      ${result.configDiagnostics[0]}`);
      }
    }
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }

  // Source-level and config-level counts are reported separately and must never
  // be collapsed into one "0 diagnostics" claim: today every project is clean at
  // source level while 8 carry a TS5108 config diagnostic under TS7.
  const summary = {
    parity: results.filter((r) => r.classification === "PARITY").length,
    blockedConfig: results.filter((r) => r.classification === "BLOCKED_CONFIG").length,
    divergent: results.filter((r) => r.classification === "DIVERGENT").length,
    ts6SourceDiagnostics: results.reduce((n, r) => n + r.ts6DiagnosticCount, 0),
    ts7SourceDiagnostics: results.reduce((n, r) => n + r.ts7DiagnosticCount, 0),
    ts7ConfigDiagnostics: results.reduce((n, r) => n + r.configDiagnostics.length, 0),
  };

  // Committed half: deterministic for a fixed (repo state x compiler versions).
  // No timestamp, no hostname, no cpu count, no wall-clock.
  const artifact = {
    schemaVersion: SCHEMA_VERSION,
    ts6Version: ts6,
    ts7Version: TS7_VERSION,
    partial: projects.length !== expected.length ? projects : undefined,
    summary,
    projects: results,
    inputHash: inputHash(projects, ts6),
    stalenessFindings: [
      "audit/dependencies/family-overlay.yaml family `tooling-typescript-go` declares" +
        " members: ['@typescript/native-preview'] with target_major 'tsc-go-preview' and" +
        " migration_blockers: [NotProductionReady]. As of 2026-07-26 TypeScript 7 has shipped" +
        " stable as `typescript@7.0.2`, while @typescript/native-preview is frozen at" +
        " 7.0.0-dev.20260707.2. The overlay's factual premise is stale. production_approved=false" +
        " is NOT contested here — the binding blocker is that typescript-eslint@8.65.0 still" +
        " declares peer `typescript: >=4.8.4 <6.1.0`, and `typescript` sits in the" +
        " `tooling-typescript-eslint` peer_dependency_cluster, where partial upgrades are" +
        " forbidden by central rule #6. Updating the overlay is a humans-only L2 edit.",
    ],
  };

  if (checkMode) {
    if (!fs.existsSync(PARITY_ARTIFACT)) {
      console.error(`\nMissing ${path.relative(REPO_ROOT, PARITY_ARTIFACT)} — run without --check first.`);
      process.exit(1);
    }
    const committed = fs.readFileSync(PARITY_ARTIFACT, "utf8");
    const fresh = serialize(artifact);
    if (sha(committed) !== sha(fresh)) {
      console.error("\nParity artifact is stale. Regenerate: npm run audit:ts7-shadow");
      process.exit(1);
    }
    console.log("\nParity artifact up to date.");
    return;
  }

  fs.writeFileSync(PARITY_ARTIFACT, serialize(artifact));

  if (!parityOnly) {
    fs.mkdirSync(TIMINGS_DIR, { recursive: true });
    const runId = new Date().toISOString().replace(/[:.]/g, "-");
    fs.writeFileSync(
      path.join(TIMINGS_DIR, `${runId}.json`),
      JSON.stringify(
        {
          runId,
          ts6Version: ts6,
          ts7Version: TS7_VERSION,
          env: {
            node: process.version,
            cpus: os.cpus().length,
            loadavg: os.loadavg(),
            nodeOptions: process.env.NODE_OPTIONS ?? null,
          },
          reps: REPS,
          note: "Run #1 per compiler discarded as FS warm-up. Sequential, never concurrent.",
          timings,
        },
        null,
        2,
      ) + "\n",
    );
  }

  console.log(
    `\n  PARITY ${summary.parity} · BLOCKED_CONFIG ${summary.blockedConfig} · DIVERGENT ${summary.divergent}`,
  );
  console.log(`  -> ${path.relative(REPO_ROOT, PARITY_ARTIFACT)}`);
  console.log("\n  Observation only. TS7 is NOT a repo dependency and must not become one");
  console.log("  while typescript-eslint caps its peer range at typescript <6.1.0.");
}

function serialize(artifact: unknown): string {
  return JSON.stringify(artifact, null, 2) + "\n";
}

function sha(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

/** Keyed on the tsconfig contents that actually determine the result. */
function inputHash(projects: string[], ts6: string): string {
  const parts = [`ts6:${ts6}`, `ts7:${TS7_VERSION}`];
  for (const p of ["packages/typescript-config/base.json", "packages/typescript-config/node-cjs-legacy.json"]) {
    parts.push(`${p}:${sha(fs.readFileSync(path.join(REPO_ROOT, p), "utf8"))}`);
  }
  for (const project of projects) {
    const f = path.join(REPO_ROOT, project, "tsconfig.json");
    parts.push(`${project}:${sha(fs.readFileSync(f, "utf8"))}`);
  }
  return `sha256:${sha(parts.join("\n"))}`;
}

if (require.main === module) {
  main();
}

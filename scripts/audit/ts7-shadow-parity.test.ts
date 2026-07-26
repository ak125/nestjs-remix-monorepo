#!/usr/bin/env tsx
// scripts/audit/ts7-shadow-parity.test.ts
//
// Unit tests for the pure comparison logic of the TS6/TS7 shadow harness.
// Deliberately does NOT invoke a compiler: no network, no install, fast.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  parseDiagnostics,
  looseKey,
  strictKey,
  countMap,
  multisetDiff,
  classify,
  median,
  discoverProjects,
  EXPECTED_PROJECTS,
  BLOCKING_CONFIG_CODES,
  IGNORED_CODES,
  TS7_VERSION,
} from "./ts7-shadow-parity";

import * as path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "..", "..");

// --- parseDiagnostics -------------------------------------------------------

test("parses a file-scoped diagnostic", () => {
  const d = parseDiagnostics("src/a.ts(12,5): error TS2345: Argument of type 'x'.");
  assert.equal(d.length, 1);
  assert.deepEqual(d[0], {
    file: "src/a.ts",
    line: 12,
    col: 5,
    severity: "error",
    code: 2345,
    message: "Argument of type 'x'.",
  });
});

test("parses the config-level TS5108 that blocks node10 projects under TS7", () => {
  const raw =
    "packages/seo-url-contract/tsconfig.json(3,3): error TS5108: Option 'moduleResolution=node10' has been removed. Please remove it from your configuration.";
  const d = parseDiagnostics(raw);
  assert.equal(d.length, 1);
  assert.equal(d[0].code, 5108);
  assert.ok(BLOCKING_CONFIG_CODES.has(d[0].code));
});

test("parses a file-less diagnostic", () => {
  const d = parseDiagnostics("error TS5042: Option 'project' cannot be mixed with source files.");
  assert.equal(d.length, 1);
  assert.equal(d[0].file, null);
  assert.equal(d[0].code, 5042);
});

test("drops watch-mode status lines and indented continuation lines", () => {
  const raw = [
    "error TS6031: Starting compilation in watch mode...",
    "src/a.ts(1,1): error TS2304: Cannot find name 'x'.",
    "  The expected type comes from property 'y'.",
  ].join("\n");
  const d = parseDiagnostics(raw);
  assert.equal(d.length, 1);
  assert.equal(d[0].code, 2304);
});

test("IGNORED_CODES contains ONLY watch-mode status codes", () => {
  assert.deepEqual([...IGNORED_CODES].sort((a, b) => a - b), [6031, 6032, 6194]);
});

test("TS6059 (outside rootDir) is NOT ignored — it is a real file-graph diagnostic", () => {
  const d = parseDiagnostics(
    "src/a.ts(1,1): error TS6059: File 'x.ts' is not under 'rootDir' 'src'.",
  );
  assert.equal(d.length, 1, "TS6059 must survive parsing");
  assert.equal(d[0].code, 6059);
  assert.ok(!IGNORED_CODES.has(6059));
});

test("TS6307 (missing from composite file list) is NOT ignored", () => {
  const d = parseDiagnostics(
    "src/a.ts(1,1): error TS6307: File 'x.ts' is not listed within the file list of project.",
  );
  assert.equal(d.length, 1, "TS6307 must survive parsing");
  assert.equal(d[0].code, 6307);
  assert.ok(!IGNORED_CODES.has(6307));
});

test("a TS6059 present only under TS7 yields DIVERGENT, not a false PARITY", () => {
  // Regression guard: these two codes were briefly in IGNORED_CODES, which would
  // have suppressed exactly this signal — a resolution-mode change altering the
  // project file graph — and reported PARITY.
  const ts7 = parseDiagnostics(
    "src/a.ts(1,1): error TS6059: File 'x.ts' is not under 'rootDir' 'src'.",
  );
  const r = classify("packages/registry", [], ts7, 1);
  assert.equal(r.classification, "DIVERGENT");
  assert.deepEqual(r.onlyInTs7, ["src/a.ts|1|TS6059"]);
});

test("normalizes separators to POSIX so TS6/TS7 paths compare", () => {
  const d = parseDiagnostics("src/nested/a.ts(3,1): error TS1005: ';' expected.");
  assert.equal(d[0].file, "src/nested/a.ts");
  assert.ok(!d[0].file!.includes("\\"));
});

test("empty output yields no diagnostics", () => {
  assert.deepEqual(parseDiagnostics(""), []);
  assert.deepEqual(parseDiagnostics("\n\n"), []);
});

// --- keys and multisets -----------------------------------------------------

test("looseKey excludes the column, strictKey includes it", () => {
  const [a] = parseDiagnostics("src/a.ts(4,9): error TS2322: Type mismatch.");
  const [b] = parseDiagnostics("src/a.ts(4,11): error TS2322: Type mismatch.");
  assert.equal(looseKey(a), looseKey(b), "column drift must not split the loose key");
  assert.notEqual(strictKey(a), strictKey(b));
});

test("countMap is a multiset — duplicates on one line do not collapse", () => {
  const m = countMap(["k", "k", "j"]);
  assert.equal(m.get("k"), 2);
  assert.equal(m.get("j"), 1);
});

test("multisetDiff respects multiplicity and sorts", () => {
  const a = countMap(["x", "x", "x", "y"]);
  const b = countMap(["x", "y"]);
  assert.deepEqual(multisetDiff(a, b), ["x", "x"]);
  assert.deepEqual(multisetDiff(b, a), []);
});

// --- classify ---------------------------------------------------------------

test("PARITY when both compilers are silent", () => {
  const r = classify("packages/seo-types", [], [], 0);
  assert.equal(r.classification, "PARITY");
  assert.equal(r.ts6DiagnosticCount, 0);
  assert.equal(r.ts7DiagnosticCount, 0);
});

test("PARITY when both emit the same diagnostic multiset", () => {
  const ts6 = parseDiagnostics("src/a.ts(1,1): error TS2304: Cannot find name 'x'.");
  const ts7 = parseDiagnostics("src/a.ts(1,3): error TS2304: Cannot find name 'x' here.");
  const r = classify("p", ts6, ts7, 1);
  assert.equal(r.classification, "PARITY", "column + wording drift alone is not divergence");
  assert.equal(r.columnDrift, 1);
  assert.deepEqual(r.messageDeltas, ["src/a.ts|1|TS2304"]);
});

test("BLOCKED_CONFIG takes precedence over any file-level comparison", () => {
  const ts6 = parseDiagnostics("src/a.ts(1,1): error TS2304: Cannot find name 'x'.");
  const ts7 = parseDiagnostics(
    "tsconfig.json(3,3): error TS5108: Option 'moduleResolution=node10' has been removed.",
  );
  const r = classify("backend", ts6, ts7, 1);
  assert.equal(r.classification, "BLOCKED_CONFIG");
  assert.equal(r.configDiagnostics.length, 1);
  assert.match(r.configDiagnostics[0], /TS5108/);
});

test("BLOCKED_CONFIG when TS7 fails with no file-level diagnostics at all", () => {
  assert.equal(classify("p", [], [], 1).classification, "BLOCKED_CONFIG");
});

test("DIVERGENT reports both directions", () => {
  const ts6 = parseDiagnostics("src/a.ts(1,1): error TS2304: Cannot find name 'x'.");
  const ts7 = parseDiagnostics("src/b.ts(2,1): error TS2307: Cannot find module 'y'.");
  const r = classify("p", ts6, ts7, 1);
  assert.equal(r.classification, "DIVERGENT");
  assert.deepEqual(r.onlyInTs6, ["src/a.ts|1|TS2304"]);
  assert.deepEqual(r.onlyInTs7, ["src/b.ts|2|TS2307"]);
});

test("cascade-prone TS7 resolution failures are surfaced as root-cause candidates", () => {
  // One TS2307 in TS7 makes downstream symbols `any`, suppressing real TS6
  // errors. The diff would otherwise read as "TS7 found 2 fewer bugs".
  const ts6 = parseDiagnostics(
    [
      "src/a.ts(5,1): error TS2339: Property 'q' does not exist.",
      "src/a.ts(6,1): error TS2339: Property 'r' does not exist.",
    ].join("\n"),
  );
  const ts7 = parseDiagnostics("src/a.ts(1,1): error TS2307: Cannot find module 'dep'.");
  const r = classify("p", ts6, ts7, 1);
  assert.equal(r.classification, "DIVERGENT");
  assert.equal(r.onlyInTs6.length, 2);
  assert.deepEqual(r.rootCauseCandidates, ["src/a.ts|1|TS2307"]);
});

// --- misc -------------------------------------------------------------------

test("median handles odd and even sample counts", () => {
  assert.equal(median([5, 1, 3]), 3);
  assert.equal(median([1, 2, 3, 4]), 3);
  assert.equal(median([7]), 7);
});

test("TS7 version is pinned exactly, never a range", () => {
  assert.match(TS7_VERSION, /^\d+\.\d+\.\d+$/);
});

test("discovery matches EXPECTED_PROJECTS — the topology tripwire", () => {
  assert.deepEqual(discoverProjects(REPO_ROOT), [...EXPECTED_PROJECTS].sort());
});

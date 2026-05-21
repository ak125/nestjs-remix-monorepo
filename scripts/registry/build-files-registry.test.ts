#!/usr/bin/env tsx
/**
 * Tests for computeReachableSet — transitive runtime reachability over the
 * import graph (build-files-registry.js). Pure function, no I/O.
 *
 * Run: npm run registry:test:files-reachability
 */
import { test } from "node:test";
import assert from "node:assert/strict";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { computeReachableSet } = require("./build-files-registry.js");

type F = { path: string; imports?: string[] };

test("seeds are always reachable", () => {
  const files: F[] = [{ path: "a", imports: [] }];
  const r = computeReachableSet(files, new Set(["a"]));
  assert.ok(r.has("a"));
});

test("transitive: entrypoint → b → c marks all three LIVE", () => {
  const files: F[] = [
    { path: "entry", imports: ["b"] },
    { path: "b", imports: ["c"] },
    { path: "c", imports: [] },
  ];
  const r = computeReachableSet(files, new Set(["entry"]));
  assert.deepEqual([...r].sort(), ["b", "c", "entry"]);
});

test("dead cluster (not reached from any seed) stays unreachable", () => {
  const files: F[] = [
    { path: "entry", imports: ["b"] },
    { path: "b", imports: [] },
    { path: "dead1", imports: ["dead2"] }, // imports each other but no seed reaches them
    { path: "dead2", imports: ["dead1"] },
  ];
  const r = computeReachableSet(files, new Set(["entry"]));
  assert.ok(r.has("entry") && r.has("b"));
  assert.ok(!r.has("dead1") && !r.has("dead2"));
});

test("cycles do not loop forever", () => {
  const files: F[] = [
    { path: "entry", imports: ["b"] },
    { path: "b", imports: ["c"] },
    { path: "c", imports: ["b"] }, // b ↔ c cycle
  ];
  const r = computeReachableSet(files, new Set(["entry"]));
  assert.deepEqual([...r].sort(), ["b", "c", "entry"]);
});

test("non-file import specifiers (npm/alias) are skipped, not crash", () => {
  const files: F[] = [
    { path: "entry", imports: ["@common/x", "react", "b"] },
    { path: "b", imports: [] },
  ];
  const r = computeReachableSet(files, new Set(["entry"]));
  assert.deepEqual([...r].sort(), ["b", "entry"]);
});

test("no seeds → empty reachable set", () => {
  const files: F[] = [{ path: "a", imports: ["b"] }, { path: "b", imports: [] }];
  const r = computeReachableSet(files, new Set());
  assert.equal(r.size, 0);
});

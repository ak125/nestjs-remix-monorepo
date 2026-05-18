// scripts/audit/__tests__/build-dependency-modernization-inventory.test.ts
//
// Unit tests for the generator helpers (expandCluster, computeImmutabilityHash).
// Run via `tsx --test`.
import { test } from "node:test";
import * as assert from "node:assert";
import { expandCluster, computeImmutabilityHash } from "../build-dependency-modernization-inventory";

// ---------------- expandCluster ----------------

test("expandCluster: exact name passes through", () => {
  const out = expandCluster(["typescript"], new Set(["typescript", "eslint"]));
  assert.deepStrictEqual(out, ["typescript"]);
});

test("expandCluster: scoped glob '@nestjs/*' expands to all members", () => {
  const all = new Set(["@nestjs/core", "@nestjs/common", "eslint", "react"]);
  const out = expandCluster(["@nestjs/*"], all);
  assert.deepStrictEqual(out, ["@nestjs/common", "@nestjs/core"]);
});

test("expandCluster: suffix glob 'eslint-plugin-*' expands matches", () => {
  const all = new Set([
    "eslint-plugin-import",
    "eslint-plugin-jsx-a11y",
    "react",
    "typescript",
  ]);
  const out = expandCluster(["eslint-plugin-*"], all);
  assert.deepStrictEqual(out, ["eslint-plugin-import", "eslint-plugin-jsx-a11y"]);
});

test("expandCluster: empty input ⇒ empty output", () => {
  const out = expandCluster([], new Set(["a", "b"]));
  assert.deepStrictEqual(out, []);
});

test("expandCluster: deduplicates overlapping patterns", () => {
  const all = new Set(["@nestjs/core", "@nestjs/common"]);
  const out = expandCluster(["@nestjs/*", "@nestjs/core"], all);
  assert.deepStrictEqual(out, ["@nestjs/common", "@nestjs/core"]);
});

test("expandCluster: pattern matching no member yields empty set for that pattern", () => {
  const all = new Set(["typescript", "eslint"]);
  const out = expandCluster(["@nonexistent/*"], all);
  assert.deepStrictEqual(out, []);
});

test("expandCluster: output is sorted ascending", () => {
  const all = new Set(["z-pkg", "a-pkg", "m-pkg"]);
  const out = expandCluster(["*-pkg"], all);
  assert.deepStrictEqual(out, ["a-pkg", "m-pkg", "z-pkg"]);
});

// ---------------- computeImmutabilityHash ----------------

test("computeImmutabilityHash: identical inputs ⇒ identical hash (replay determinism)", () => {
  const a = computeImmutabilityHash("sha256:aa", "sha256:bb", "sha256:cc");
  const b = computeImmutabilityHash("sha256:aa", "sha256:bb", "sha256:cc");
  assert.strictEqual(a, b);
});

test("computeImmutabilityHash: any input perturbation ⇒ different hash", () => {
  const base = computeImmutabilityHash("sha256:aa", "sha256:bb", "sha256:cc");
  const perturbed1 = computeImmutabilityHash("sha256:ad", "sha256:bb", "sha256:cc");
  const perturbed2 = computeImmutabilityHash("sha256:aa", "sha256:bd", "sha256:cc");
  const perturbed3 = computeImmutabilityHash("sha256:aa", "sha256:bb", "sha256:cd");
  assert.notStrictEqual(base, perturbed1);
  assert.notStrictEqual(base, perturbed2);
  assert.notStrictEqual(base, perturbed3);
});

test("computeImmutabilityHash: format is 'sha256:<64 hex>'", () => {
  const h = computeImmutabilityHash("sha256:1", "sha256:2", "sha256:3");
  assert.match(h, /^sha256:[0-9a-f]{64}$/);
});

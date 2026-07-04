// scripts/registry/validate-deps-fidelity.test.ts
//
// Regression tests for PROOF A (semantic fidelity). Every case builds a
// synthetic (manifests, registry) pair and asserts the validator's verdict —
// no hardcoded upstream versions anywhere; the manifest is always the truth.
//
// Run: `tsx --test scripts/registry/validate-deps-fidelity.test.ts`
import { test } from "node:test";
import * as assert from "node:assert";
import {
  tuplesFromManifests,
  flattenRegistryTuples,
  diffTuples,
  checkInvariants,
  isPriorityName,
  type Manifest,
} from "./validate-deps-fidelity";

const { depId } = require("./lib/utils.js");

// ── Synthetic fixture reproducing the ORIGINAL bug's geometry ──────────────
// Workspace NAME lexical order differs from package.json PATH lexical order:
//   names sort:  @repo/a, @repo/b, root       (root name sorts last)
//   paths sort:  package.json, packages/a/…, packages/b/…  (root path sorts first)
// The old builder deduped names[] and paths[] independently, then the inventory
// zipped them by index — guaranteeing a shifted, false pairing.
const MANIFESTS: Manifest[] = [
  { path: "package.json", pkg: { name: "root", dependencies: { zod: "^4.4.3" } } },
  { path: "packages/a/package.json", pkg: { name: "@repo/a", dependencies: { zod: "^4.4.3" } } },
  { path: "packages/b/package.json", pkg: { name: "@repo/b", dependencies: { zod: "^4.4.3" } } },
];

// What the NEW builder emits: atomic occurrences, correct pairing.
function correctRegistry() {
  return [
    {
      id: depId("zod", "^4.4.3"),
      name: "zod",
      version: "^4.4.3",
      occurrences: [
        { workspace: "root", declaredIn: "package.json", bucket: "dependencies", specifier: "^4.4.3" },
        { workspace: "@repo/a", declaredIn: "packages/a/package.json", bucket: "dependencies", specifier: "^4.4.3" },
        { workspace: "@repo/b", declaredIn: "packages/b/package.json", bucket: "dependencies", specifier: "^4.4.3" },
      ],
    },
  ];
}

// What the OLD index-zip produced: names sorted vs paths sorted, zipped by index.
function oldZipRegistry() {
  const names = ["@repo/a", "@repo/b", "root"].sort(); // dedup+sort names (old workspaces[])
  const paths = ["package.json", "packages/a/package.json", "packages/b/package.json"].sort(); // dedup+sort paths (old declaredIn[])
  const occurrences = names.map((workspace, i) => ({
    workspace,
    declaredIn: paths[i] ?? paths[0], // the exact `declaredIn[i] ?? declaredIn[0]` zip
    bucket: "dependencies",
    specifier: "^4.4.3",
  }));
  return [{ id: depId("zod", "^4.4.3"), name: "zod", version: "^4.4.3", occurrences }];
}

// ── Fidelity: correct registry passes ──────────────────────────────────────

test("fidelity: atomic occurrences match the manifest scan exactly", () => {
  const m = tuplesFromManifests(MANIFESTS);
  const r = flattenRegistryTuples(correctRegistry());
  const diff = diffTuples(m, r);
  assert.deepStrictEqual(diff.missingInRegistry, []);
  assert.deepStrictEqual(diff.extraInRegistry, []);
});

// ── Fidelity: EXPLICIT regression of the old independent-sort + index-zip ───

test("fidelity: the OLD index-zip output is caught as a divergence", () => {
  const m = tuplesFromManifests(MANIFESTS);
  const r = flattenRegistryTuples(oldZipRegistry());
  const diff = diffTuples(m, r);
  // The zip mis-pairs @repo/a→package.json etc.; validator must flag both sides.
  assert.ok(
    diff.missingInRegistry.length > 0,
    "manifest declarations must be reported missing from the mis-paired registry",
  );
  assert.ok(
    diff.extraInRegistry.length > 0,
    "the fabricated (workspace, path) pairs must be reported as unbacked extras",
  );
  // Concretely: @repo/a is really declared in packages/a/package.json.
  assert.ok(
    diff.missingInRegistry.some(
      (t) => t.workspace === "@repo/a" && t.declaredIn === "packages/a/package.json",
    ),
    "the true @repo/a pairing is missing from the old zip output",
  );
});

test("fidelity: invariant #4 alone catches the old zip's false pairing", () => {
  const v = checkInvariants(oldZipRegistry() as any, MANIFESTS);
  assert.ok(
    v.some((x) => x.invariant === "manifest-name-equals-workspace" || x.invariant === "manifest-declares-specifier"),
    "invariant #4 must fire on the mis-paired (workspace, declaredIn) tuple",
  );
});

// ── Dual-bucket: same name+specifier in two buckets = two distinct occurrences

test("dual-bucket: a package in dependencies AND peerDependencies is two occurrences, not a dup", () => {
  const manifests: Manifest[] = [
    {
      path: "packages/x/package.json",
      pkg: { name: "@repo/x", dependencies: { zod: "^4.4.3" }, peerDependencies: { zod: "^4.4.3" } },
    },
  ];
  const registry = [
    {
      id: depId("zod", "^4.4.3"),
      name: "zod",
      version: "^4.4.3",
      occurrences: [
        { workspace: "@repo/x", declaredIn: "packages/x/package.json", bucket: "dependencies", specifier: "^4.4.3" },
        { workspace: "@repo/x", declaredIn: "packages/x/package.json", bucket: "peerDependencies", specifier: "^4.4.3" },
      ],
    },
  ];
  const diff = diffTuples(tuplesFromManifests(manifests), flattenRegistryTuples(registry));
  assert.deepStrictEqual(diff.missingInRegistry, []);
  assert.deepStrictEqual(diff.extraInRegistry, []);
  // And they are NOT flagged as duplicates (bucket differs → distinct tuple).
  const v = checkInvariants(registry as any, manifests);
  assert.deepStrictEqual(v.filter((x) => x.invariant === "no-duplicate-occurrence"), []);
});

test("invariant: an exact-repeat occurrence IS a duplicate", () => {
  const manifests: Manifest[] = [
    { path: "p/package.json", pkg: { name: "p", dependencies: { zod: "^4.4.3" } } },
  ];
  const registry = [
    {
      id: depId("zod", "^4.4.3"),
      name: "zod",
      version: "^4.4.3",
      occurrences: [
        { workspace: "p", declaredIn: "p/package.json", bucket: "dependencies", specifier: "^4.4.3" },
        { workspace: "p", declaredIn: "p/package.json", bucket: "dependencies", specifier: "^4.4.3" },
      ],
    },
  ];
  const v = checkInvariants(registry as any, manifests);
  assert.ok(v.some((x) => x.invariant === "no-duplicate-occurrence"));
});

// ── Targeted single-field corruptions ──────────────────────────────────────

const ONE_MANIFEST: Manifest[] = [
  { path: "backend/package.json", pkg: { name: "@fafa/backend", dependencies: { zod: "^4.4.3" } } },
];
const good = () => ({
  id: depId("zod", "^4.4.3"),
  name: "zod",
  version: "^4.4.3",
  occurrences: [
    { workspace: "@fafa/backend", declaredIn: "backend/package.json", bucket: "dependencies", specifier: "^4.4.3" },
  ],
});

test("false declaredIn is caught (invariant #4 declaredIn-exists)", () => {
  const bad = good();
  bad.occurrences[0].declaredIn = "frontend/package.json";
  const v = checkInvariants([bad] as any, ONE_MANIFEST);
  assert.ok(v.some((x) => x.invariant === "declaredIn-exists" || x.invariant === "manifest-declares-specifier"));
  const diff = diffTuples(tuplesFromManifests(ONE_MANIFEST), flattenRegistryTuples([bad]));
  assert.ok(diff.missingInRegistry.length > 0 && diff.extraInRegistry.length > 0);
});

test("false workspace is caught (invariant #4 manifest-name-equals-workspace)", () => {
  const bad = good();
  bad.occurrences[0].workspace = "@fafa/frontend";
  const v = checkInvariants([bad] as any, ONE_MANIFEST);
  assert.ok(v.some((x) => x.invariant === "manifest-name-equals-workspace"));
});

test("false specifier is caught (invariants #2/#3/#4)", () => {
  const bad = good();
  bad.occurrences[0].specifier = "^3.0.0"; // ≠ version, ≠ id, ≠ manifest
  const v = checkInvariants([bad] as any, ONE_MANIFEST);
  assert.ok(v.some((x) => x.invariant === "specifier-equals-version"));
  assert.ok(v.some((x) => x.invariant === "id-equals-depId"));
  assert.ok(v.some((x) => x.invariant === "manifest-declares-specifier"));
});

// ── Nest / RR / Zod = priority diagnostics, truth from manifests only ───────

test("priority families are flagged without any hardcoded expected version", () => {
  assert.ok(isPriorityName("@nestjs/core"));
  assert.ok(isPriorityName("react-router"));
  assert.ok(isPriorityName("@react-router/dev"));
  assert.ok(isPriorityName("zod"));
  assert.ok(!isPriorityName("eslint"));
});

test("Nest/RR/Zod drift is detected purely from the manifest (no version constant)", () => {
  // Manifest says @nestjs/core ^11.1.27; registry still claims ^10 → divergence,
  // detected because manifest ≠ registry, NOT because ^11 is written anywhere here.
  const manifests: Manifest[] = [
    { path: "backend/package.json", pkg: { name: "@fafa/backend", dependencies: { "@nestjs/core": "^11.1.27" } } },
  ];
  const staleRegistry = [
    {
      id: depId("@nestjs/core", "^10.0.0"),
      name: "@nestjs/core",
      version: "^10.0.0",
      occurrences: [
        { workspace: "@fafa/backend", declaredIn: "backend/package.json", bucket: "dependencies", specifier: "^10.0.0" },
      ],
    },
  ];
  const diff = diffTuples(tuplesFromManifests(manifests), flattenRegistryTuples(staleRegistry));
  assert.ok(diff.missingInRegistry.some((t) => t.name === "@nestjs/core" && t.specifier === "^11.1.27"));
  assert.ok(diff.extraInRegistry.some((t) => t.name === "@nestjs/core" && t.specifier === "^10.0.0"));
  assert.ok(isPriorityName("@nestjs/core"));
});

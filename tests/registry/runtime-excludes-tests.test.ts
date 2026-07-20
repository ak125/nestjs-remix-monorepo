/**
 * tests/registry/runtime-excludes-tests.test.ts
 *
 * Regression guard for the runtime-producer defect (PR-E) where a Jest/spec file's
 * local `@Module()` — a test double (e.g. `ProbeModule` for
 * `Test.createTestingModule(...)`) — was projected into the runtime registry as a LIVE
 * `nestjs-module`, and into runtime-entrypoints.
 *
 * Contract (the correct boundary):
 *   - test files STAY in the files registry (inventory), classified `kind: 'test'`;
 *   - test files are ABSENT from the runtime registry, ABSENT from runtime-entrypoints,
 *     and carry `runtime: false` in the files registry.
 *
 * The predicate `isTestPath` is imported from the producer itself (single source of
 * truth — the same function gates both `classifyKind()` and the Nest/Remix metadata
 * collection in build-deep-inventory.js).
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

import { isTestPath } from "../../scripts/audit/build-deep-inventory.js";

const ROOT = path.join(__dirname, "..", "..");
const readJson = (rel: string) =>
  JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));

describe("isTestPath (shared predicate)", () => {
  test("recognises spec / test / e2e-spec / __tests__ paths", () => {
    assert.equal(isTestPath("backend/tests/unit/route-wildcard-middleware.test.ts"), true);
    assert.equal(isTestPath("backend/src/foo.spec.ts"), true);
    assert.equal(isTestPath("backend/src/foo.e2e-spec.ts"), true);
    assert.equal(isTestPath("frontend/app/x.test.tsx"), true);
    assert.equal(isTestPath("packages/x/__tests__/y.ts"), true);
  });

  test("does not flag ordinary runtime source", () => {
    assert.equal(isTestPath("backend/src/modules/errors/services/error.service.ts"), false);
    assert.equal(isTestPath("backend/src/app.module.ts"), false);
    assert.equal(isTestPath("backend/src/testing-utils/helper.ts"), false);
  });
});

describe("runtime registry never contains test files (producer invariant)", () => {
  const runtime = readJson("audit/registry/runtime.json");
  const files = readJson("audit/registry/files.json");
  const canonical = readJson("audit/registry/canonical.json");
  const entrypoints = readJson("audit/runtime-entrypoints.json");

  // The runtime REGISTRY is the projected runtime surface (nestjs-module / controller /
  // processor …). No test file may appear there. NB: the broad `runtime_files`
  // keep-list in runtime-entrypoints.json legitimately contains tooling `*.test.ts`
  // referenced by npm scripts (a keep-alive path, not the @Module defect) — so it is
  // NOT asserted globally here; the specific @Module test double is checked below.
  test("no runtime.json entry is a test path", () => {
    const leaked = runtime.entries
      .map((e: { path: string }) => e.path)
      .filter((p: string) => isTestPath(p));
    assert.deepEqual(leaked, [], `test files leaked into runtime registry: ${leaked.join(", ")}`);
  });

  test("no canonical.runtime entry is a test path", () => {
    const leaked = (canonical.runtime || [])
      .map((e: { path: string }) => e.path)
      .filter((p: string) => isTestPath(p));
    assert.deepEqual(leaked, [], `test files leaked into canonical runtime: ${leaked.join(", ")}`);
  });

  // The exact defect the owner flagged: a Jest file whose local @Module() (ProbeModule
  // for Test.createTestingModule) was projected as a LIVE nestjs-module. Its ONLY
  // runtime membership was via that @Module, so it must now be absent from every runtime
  // surface while remaining in the files inventory as kind:'test', runtime:false.
  test("the ProbeModule test double is inventoried but on no runtime surface", () => {
    const p = "backend/tests/unit/route-wildcard-middleware.test.ts";
    const inFiles = files.entries.find((e: { path: string }) => e.path === p);
    assert.ok(inFiles, `${p} missing from files inventory`);
    assert.equal(inFiles.kind, "test");
    assert.equal(inFiles.runtime, false);
    assert.ok(
      !runtime.entries.some((e: { path: string }) => e.path === p),
      `${p} must be absent from the runtime registry`
    );
    assert.ok(
      !(canonical.runtime || []).some((e: { path: string }) => e.path === p),
      `${p} must be absent from canonical runtime`
    );
    assert.ok(
      !(entrypoints.runtime_files || []).includes(p),
      `${p} must be absent from runtime entrypoints`
    );
  });
});

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
 *
 * PROVENANCE : ce fichier est repris VERBATIM de la PR #1227 (branche
 * `chore/pr-e-registry-canonical-closure`), restée draft depuis le 2026-07-04. Son
 * correctif n'avait jamais été récolté — vérifié par sha256 sur `build-deep-inventory.js`.
 * Adoption, pas réécriture (invariant 2 de CLAUDE.md). Seule adaptation : sur `main`,
 * `build-deep-inventory.js` exporte déjà `inventoryInputFingerprint` ; l'export a été
 * ÉTENDU, jamais remplacé — reprendre le `module.exports` de #1227 tel quel l'aurait effacé.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";

import { isTestPath } from "../../scripts/audit/build-deep-inventory.js";

const ROOT = path.join(__dirname, "..", "..");
const readJson = (rel: string) =>
  JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));

type RuntimeRow = {
  id: string;
  path: string;
  kind: string;
  status: string;
  sourceConfidence: string;
  dependsOn: string[];
};

// Execute the real CLI producer, replacing only its I/O boundary. Cache freshness
// has its own integration suite; these fixtures exercise projection, not a mock.
function projectRuntime(
  buckets: Record<string, string[]>,
  files: { path: string; imports: string[] }[] = [],
): RuntimeRow[] {
  const script = path.join(ROOT, "scripts/registry/build-runtime-registry.js");
  const nativeRequire = createRequire(script);
  let output: { entries: RuntimeRow[] } | undefined;
  const moduleObject = { exports: {} as { main: () => void } };
  runInNewContext(fs.readFileSync(script, "utf8"), {
    module: moduleObject,
    process,
    require: (name: string) => name === "./lib/utils" ? {
      ...nativeRequire(name),
      readJsonSafe: () => ({ entrypoints: buckets }),
      loadInventoryCache: () => ({ files }),
      makeLogger: () => () => {},
      writeDeterministicJson: (_file: string, value: unknown) => {
        output = JSON.parse(JSON.stringify(value));
        return "0".repeat(64);
      },
    } : nativeRequire(name),
  });
  moduleObject.exports.main();
  assert.ok(output, "producer must publish a projection");
  return output.entries;
}

describe("runtime projection preserves detected nodes and closes internal edges", () => {
  const service = "backend/src/modules/support/services/faq.service.ts";
  const controller = "backend/src/modules/support/controllers/faq.controller.ts";
  const worker = "backend/src/workers/processors/seo-monitor.processor.ts";

  test("a DI service is emitted, not only referenced by its controller", () => {
    const rows = projectRuntime({
      nestjs_controllers: [controller], di_live_files: [controller, service],
    }, [{ path: controller, imports: [service] }]);
    assert.equal(rows.find(e => e.path === service)?.kind, "nestjs-service");
    assert.equal(rows.find(e => e.path === service)?.status, "LIVE");
    assert.deepEqual(rows.find(e => e.path === controller)?.dependsOn, ["runtime:" + service]);
  });

  test("a registered Bull processor is emitted as worker, once", () => {
    const rows = projectRuntime({
      bull_processors: [worker, worker], di_live_files: [worker],
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].kind, "worker");
    assert.equal(rows[0].status, "LIVE");
    assert.equal(rows[0].sourceConfidence, "medium");
  });

  test("a processor outside workers is still classified by its decorator bucket", () => {
    const processor = "backend/src/modules/system/processors/metrics.processor.ts";
    const rows = projectRuntime({ bull_processors: [processor], di_live_files: [processor] });
    assert.equal(rows[0]?.kind, "worker");
  });

  test("a decorator without DI wiring is UNKNOWN, not an activated worker", () => {
    const rows = projectRuntime({ bull_processors: [worker], di_live_files: [] });
    assert.equal(rows[0]?.kind, "worker");
    assert.equal(rows[0]?.status, "UNKNOWN");
    assert.equal(rows[0]?.sourceConfidence, "low");
  });

  test("unprojected buckets and external specifiers cannot become dangling edges", () => {
    const workflow = ".github/workflows/build.yml";
    const rows = projectRuntime({
      nestjs_controllers: [controller], ci_workflows: [workflow],
      di_live_classes: ["ExampleService"],
    }, [{ path: controller, imports: [workflow, "ExampleService", "@database/client", service] }]);
    assert.deepEqual(rows[0].dependsOn, []);
  });

  test("duplicate imports yield one edge and do not depend on bucket input order", () => {
    const buckets = { di_live_files: [service, controller], nestjs_controllers: [controller] };
    const files = [{ path: controller, imports: [service, service] }];
    const rows = projectRuntime(buckets, files);
    assert.deepEqual(rows.find(e => e.path === controller)?.dependsOn, ["runtime:" + service]);
    assert.deepEqual(rows, projectRuntime({ nestjs_controllers: [controller], di_live_files: [controller, service] }, files));
    assert.deepEqual(buckets.di_live_files, [service, controller], "inputs must not be reordered in place");
  });

  test("legacy buckets and explicit app entry confidence remain compatible", () => {
    const rows = projectRuntime({
      app_entries: [worker], workers: [worker], nestjs_services: [service],
    });
    assert.equal(rows.length, 2);
    assert.equal(rows.find(e => e.path === worker)?.sourceConfidence, "high");
    assert.equal(rows.find(e => e.path === service)?.kind, "nestjs-service");
  });

  test("a detected but unwired processor remains UNKNOWN when referenced", () => {
    const module = "backend/src/workers/worker.module.ts";
    const rows = projectRuntime({ app_entries: [module], bull_processors: [worker], di_live_files: [module] }, [
      { path: module, imports: [worker] },
    ]);
    assert.deepEqual(rows.find(e => e.path === module)?.dependsOn, ["runtime:" + worker]);
    assert.equal(rows.find(e => e.path === worker)?.status, "UNKNOWN");
  });
});

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

  test("runtime projection has no internal references to absent entries", () => {
    for (const rows of [runtime.entries, canonical.runtime] as RuntimeRow[][]) {
      const ids = new Set(rows.map(e => e.id));
      const dangling = rows.flatMap(e => e.dependsOn.filter(id => !ids.has(id)).map(to => ({ from: e.id, to })));
      assert.deepEqual(dangling, [], "every projected dependency must have a projected target");
    }
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

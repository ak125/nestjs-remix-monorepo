import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { load as parseYaml } from "js-yaml";
import {
  RuntimeContractSchema,
  type RuntimeContract,
} from "../canonical/runtime-contract";

// ──────────────────────────────────────────────────────────────────────────
// Tests for runtime-topology.yaml — Repository Contract V1 (PR-5).
// Mirrors db-contract.test.ts pattern. node:test via tsx --test.
//
// 9 test cases (post-review pass 4):
//   §4.1  schema integrity (this file)
//   §4.2  cross-contract L1 runtime.json id match              (next commit)
//   §4.3  cross-contract domains.yaml                          (next commit)
//   §4.4a cross-contract ownership.yaml glob match             (next commit)
//   §4.4b cross-contract ownership.yaml owner FK               (next commit)
//   §4.5a cross-contract architecture.yaml#layers[].id FK      (next commit)
//   §4.5b layer-path coherence via inferLayerFromPath          (next commit)
//   §4.6  size warning soft threshold (entries.length < 600)   (next commit)
//   §4.7  determinism (build twice, byte-identical)            (next commit)
// ──────────────────────────────────────────────────────────────────────────

const REPO_ROOT = path.resolve(__dirname, "../../../..");
const YAML_PATH = path.join(
  REPO_ROOT,
  ".spec/00-canon/repository-registry/runtime-topology.yaml",
);

function loadRealContract(): RuntimeContract {
  const raw = readFileSync(YAML_PATH, "utf8");
  const parsed = parseYaml(raw);
  return RuntimeContractSchema.parse(parsed);
}

// V1 MINIMAL fixture for negative-path tests.
const validFixture = {
  schemaVersion: "1.0.0",
  adr: "ADR-058",
  entrypoints: [
    {
      id: "runtime:backend/src/app.module.ts",
      kind: "nestjs-module",
      path: "backend/src/app.module.ts",
      layer: "backend",
      domain: "D13",
      owner: "@ak125",
      status: "LIVE",
    },
  ],
};

describe("§4.1 schema integrity — real runtime-topology.yaml", () => {
  test("parses and validates", () => {
    const contract = loadRealContract();
    assert.equal(contract.schemaVersion, "1.0.0");
    assert.match(contract.adr, /^ADR-\d{3,}$/);
    assert.ok(
      contract.entrypoints.length >= 1,
      "must declare at least 1 entrypoint",
    );
    assert.ok(
      contract.entrypoints.length <= 5000,
      `entrypoints.length=${contract.entrypoints.length} exceeds sanity cap 5000`,
    );
  });

  test("every entry has the 7 required fields", () => {
    const contract = loadRealContract();
    for (const entry of contract.entrypoints) {
      assert.ok(entry.id, "missing id");
      assert.ok(entry.kind, "missing kind");
      assert.ok(entry.path, "missing path");
      assert.ok(entry.layer, "missing layer");
      assert.ok(entry.domain, "missing domain");
      assert.ok(entry.owner, "missing owner");
      assert.ok(entry.status, "missing status");
    }
  });
});

describe("§4.1 schema integrity — fixture-based negative paths", () => {
  test("rejects extra top-level field (.strict() at root)", () => {
    const tampered = { ...validFixture, extra: "smuggled" };
    const result = RuntimeContractSchema.safeParse(tampered);
    assert.equal(result.success, false);
  });

  test("rejects extra field on entry (.strict() at entry level)", () => {
    const tampered = {
      ...validFixture,
      entrypoints: [
        { ...validFixture.entrypoints[0], sourceConfidence: "high" },
      ],
    };
    const result = RuntimeContractSchema.safeParse(tampered);
    assert.equal(result.success, false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message).join("\n");
      assert.match(messages, /sourceConfidence|unrecognized|extra/i);
    }
  });

  test("rejects schemaVersion not in semver", () => {
    const tampered = { ...validFixture, schemaVersion: "1.0" };
    const result = RuntimeContractSchema.safeParse(tampered);
    assert.equal(result.success, false);
  });

  test("rejects domain UNKNOWN (canon SoT must be explicit)", () => {
    const tampered = {
      ...validFixture,
      entrypoints: [{ ...validFixture.entrypoints[0], domain: "UNKNOWN" }],
    };
    const result = RuntimeContractSchema.safeParse(tampered);
    assert.equal(result.success, false);
  });

  test("rejects owner not matching @org or @org/team", () => {
    const tampered = {
      ...validFixture,
      entrypoints: [{ ...validFixture.entrypoints[0], owner: "ak125" }],
    };
    const result = RuntimeContractSchema.safeParse(tampered);
    assert.equal(result.success, false);
  });

  test("rejects id format not matching `runtime:<path>`", () => {
    const tampered = {
      ...validFixture,
      entrypoints: [
        {
          ...validFixture.entrypoints[0],
          id: "nest-controller:AppController",
        },
      ],
    };
    const result = RuntimeContractSchema.safeParse(tampered);
    assert.equal(result.success, false);
  });

  test("rejects id that does not encode path (id ≠ runtime:path)", () => {
    const tampered = {
      ...validFixture,
      entrypoints: [
        {
          ...validFixture.entrypoints[0],
          id: "runtime:backend/src/other.module.ts", // path says app.module.ts
        },
      ],
    };
    const result = RuntimeContractSchema.safeParse(tampered);
    assert.equal(result.success, false);
  });

  test("rejects duplicate entrypoint.id", () => {
    const tampered = {
      ...validFixture,
      entrypoints: [
        validFixture.entrypoints[0],
        validFixture.entrypoints[0],
      ],
    };
    const result = RuntimeContractSchema.safeParse(tampered);
    assert.equal(result.success, false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message).join("\n");
      assert.match(messages, /Duplicate/);
    }
  });

  test("accepts valid fixture (positive control)", () => {
    const result = RuntimeContractSchema.safeParse(validFixture);
    assert.equal(result.success, true);
  });
});

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { CanonicalRegistrySchema, SchemaVersion } from "../index";

describe("CanonicalRegistrySchema (Layer 3 projection)", () => {
  test("accepts a minimal empty registry with valid meta", () => {
    const valid = {
      schemaVersion: SchemaVersion,
      meta: {
        generatedAt: "2026-05-13T17:00:00.000Z",
        generatorVersion: "1.0.0",
        inputHashes: {
          "audit/registry/files.json": "abc",
          "audit/registry/db.json": "def",
        },
      },
    };
    const parsed = CanonicalRegistrySchema.parse(valid);
    assert.deepEqual(parsed.files, []); // default
    assert.deepEqual(parsed.db.tables, []);
    assert.deepEqual(parsed.db.rpc, []);
    assert.deepEqual(parsed.deps, []);
    assert.deepEqual(parsed.runtime, []);
    assert.equal(parsed.meta.generatorVersion, "1.0.0");
  });

  test("accepts a full registry with one entry per layer", () => {
    const valid = {
      schemaVersion: SchemaVersion,
      files: [
        {
          schemaVersion: SchemaVersion,
          id: "f1",
          path: "backend/src/f1.ts",
          domain: "D1" as const,
          kind: "service" as const,
          status: "LIVE" as const,
          owner: "@ak125",
          sourceConfidence: "high" as const,
          runtime: true,
          loc: 10,
        },
      ],
      db: {
        tables: [
          {
            schemaVersion: SchemaVersion,
            id: "t1",
            name: "t1",
            domain: "D1" as const,
            status: "LIVE" as const,
            owner: "@ak125",
            sourceConfidence: "high" as const,
            rlsEnabled: true,
          },
        ],
        rpc: [
          {
            schemaVersion: SchemaVersion,
            id: "r1",
            name: "r1",
            domain: "D1" as const,
            status: "LIVE" as const,
            owner: "@ak125",
            sourceConfidence: "high" as const,
            parseMode: "parsed" as const,
          },
        ],
      },
      deps: [
        {
          schemaVersion: SchemaVersion,
          id: "npm:zod@3.25.76",
          name: "zod",
          version: "3.25.76",
          source: "npm" as const,
          status: "LIVE" as const,
          owner: "@ak125",
          sourceConfidence: "high" as const,
        },
      ],
      runtime: [
        {
          schemaVersion: SchemaVersion,
          id: "backend:AppModule",
          path: "backend/src/app.module.ts",
          kind: "nestjs-module" as const,
          status: "LIVE" as const,
          sourceConfidence: "high" as const,
        },
      ],
      meta: {
        generatedAt: "2026-05-13T17:00:00.000Z",
        generatorVersion: "1.0.0",
        inputHashes: {},
      },
    };
    assert.doesNotThrow(() => CanonicalRegistrySchema.parse(valid));
  });

  test("rejects missing meta (mandatory for reproducibility audit)", () => {
    const invalid = {
      schemaVersion: SchemaVersion,
      // meta missing
    };
    assert.throws(() => CanonicalRegistrySchema.parse(invalid));
  });

  test("rejects malformed generatedAt timestamp", () => {
    const invalid = {
      schemaVersion: SchemaVersion,
      meta: {
        generatedAt: "yesterday",
        generatorVersion: "1.0.0",
        inputHashes: {},
      },
    };
    assert.throws(() => CanonicalRegistrySchema.parse(invalid));
  });

  test("rejects wrong schemaVersion (anti-drift)", () => {
    const invalid = {
      schemaVersion: "2.0.0", // mismatch SchemaVersion literal
      meta: {
        generatedAt: "2026-05-13T17:00:00.000Z",
        generatorVersion: "1.0.0",
        inputHashes: {},
      },
    };
    assert.throws(() => CanonicalRegistrySchema.parse(invalid));
  });
});

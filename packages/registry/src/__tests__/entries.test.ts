import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  FileEntrySchema,
  DbTableEntrySchema,
  RpcEntrySchema,
  DepEntrySchema,
  RuntimeEntrySchema,
  SchemaVersion,
} from "../index";

describe("FileEntrySchema round-trip", () => {
  test("accepts a minimal valid LIVE service entry", () => {
    const valid = {
      schemaVersion: SchemaVersion,
      id: "seo.r7.brand-enricher",
      path: "backend/src/modules/seo/services/r7-brand-enricher.service.ts",
      domain: "D3" as const,
      kind: "service" as const,
      status: "LIVE" as const,
      owner: "@ak125/seo-team",
      sourceConfidence: "high" as const,
      runtime: true,
      loc: 320,
    };
    const parsed = FileEntrySchema.parse(valid);
    assert.equal(parsed.id, "seo.r7.brand-enricher");
    assert.deepEqual(parsed.imports, []); // default
    assert.deepEqual(parsed.importedBy, []);
    assert.equal(parsed.deletePolicy, "FREE"); // default
    assert.equal(parsed.risk, "low"); // default
  });

  test("accepts UNKNOWN status + low confidence (V1-3 'jamais forcer')", () => {
    const ambiguous = {
      schemaVersion: SchemaVersion,
      id: "unknown.foo",
      path: "backend/src/legacy/foo.ts",
      domain: "UNKNOWN" as const,
      kind: "service" as const,
      status: "UNKNOWN" as const,
      owner: "__unassigned__",
      sourceConfidence: "low" as const,
      runtime: false,
      loc: 0,
    };
    assert.doesNotThrow(() => FileEntrySchema.parse(ambiguous));
  });

  test("rejects negative LOC (invariant : nonnegative)", () => {
    const invalid = {
      schemaVersion: SchemaVersion,
      id: "x",
      path: "x.ts",
      domain: "D1" as const,
      kind: "service" as const,
      status: "LIVE" as const,
      owner: "o",
      sourceConfidence: "high" as const,
      runtime: true,
      loc: -1,
    };
    assert.throws(() => FileEntrySchema.parse(invalid));
  });

  test("rejects empty id (invariant : id non-empty)", () => {
    const invalid = {
      schemaVersion: SchemaVersion,
      id: "",
      path: "x.ts",
      domain: "D1" as const,
      kind: "service" as const,
      status: "LIVE" as const,
      owner: "o",
      sourceConfidence: "high" as const,
      runtime: true,
      loc: 1,
    };
    assert.throws(() => FileEntrySchema.parse(invalid));
  });
});

describe("DbTableEntrySchema round-trip", () => {
  test("accepts a valid table with columns + indexes + RLS", () => {
    const valid = {
      schemaVersion: SchemaVersion,
      id: "__seo_gsc_daily",
      name: "__seo_gsc_daily",
      schema: "public",
      domain: "D3" as const,
      status: "LIVE" as const,
      owner: "@ak125/seo-monitoring",
      sourceConfidence: "high" as const,
      columns: [
        { name: "id", type: "uuid", nullable: false, hasDefault: true },
        { name: "url", type: "text", nullable: false, hasDefault: false },
      ],
      indexes: [
        { name: "pk_seo_gsc_daily", columns: ["id"], unique: true },
      ],
      rlsEnabled: true,
    };
    const parsed = DbTableEntrySchema.parse(valid);
    assert.equal(parsed.rlsEnabled, true);
    assert.equal(parsed.columns.length, 2);
    assert.deepEqual(parsed.usedBy, []); // default
  });

  test("rejects missing rlsEnabled field", () => {
    const invalid = {
      schemaVersion: SchemaVersion,
      id: "foo",
      name: "foo",
      domain: "D1" as const,
      status: "LIVE" as const,
      owner: "x",
      sourceConfidence: "high" as const,
    };
    assert.throws(() => DbTableEntrySchema.parse(invalid));
  });
});

describe("RpcEntrySchema round-trip with parse modes", () => {
  test("accepts a 'parsed' RPC (high confidence)", () => {
    const valid = {
      schemaVersion: SchemaVersion,
      id: "public.get_piece_detail",
      name: "get_piece_detail",
      schema: "public",
      domain: "D1" as const,
      status: "LIVE" as const,
      owner: "@ak125/catalog-team",
      sourceConfidence: "high" as const,
      parseMode: "parsed" as const,
      args: [{ name: "piece_id", type: "integer", mode: "IN" as const }],
      returnType: "TABLE(...)",
      language: "plpgsql",
      securityDefiner: true,
      searchPath: ["public"],
      definedInMigrations: ["20260301_pieces_core.sql"],
    };
    assert.doesNotThrow(() => RpcEntrySchema.parse(valid));
  });

  test("accepts an 'unknown_signature' RPC with parseError + status UNKNOWN", () => {
    const valid = {
      schemaVersion: SchemaVersion,
      id: "public.weird_overloaded#sig:abc",
      name: "weird_overloaded",
      domain: "D1" as const,
      status: "UNKNOWN" as const,
      owner: "__unassigned__",
      sourceConfidence: "low" as const,
      parseMode: "unknown_signature" as const,
      definedInMigrations: ["20260101_legacy.sql"],
      parseError: "Could not parse overloaded function signature",
    };
    assert.doesNotThrow(() => RpcEntrySchema.parse(valid));
  });

  test("rejects invalid parseMode value", () => {
    const invalid = {
      schemaVersion: SchemaVersion,
      id: "x",
      name: "x",
      domain: "D1" as const,
      status: "LIVE" as const,
      owner: "o",
      sourceConfidence: "high" as const,
      parseMode: "fully_parsed", // invalid
    };
    assert.throws(() => RpcEntrySchema.parse(invalid));
  });
});

describe("DepEntrySchema round-trip", () => {
  test("accepts a valid npm dep entry", () => {
    const valid = {
      schemaVersion: SchemaVersion,
      id: "npm:zod@3.25.76",
      name: "zod",
      version: "3.25.76",
      source: "npm" as const,
      occurrences: [
        {
          workspace: "@repo/registry",
          declaredIn: "packages/registry/package.json",
          bucket: "dependencies" as const,
          specifier: "3.25.76",
        },
      ],
      status: "LIVE" as const,
      owner: "@ak125",
      sourceConfidence: "high" as const,
    };
    assert.doesNotThrow(() => DepEntrySchema.parse(valid));
  });

  test("rejects empty version", () => {
    const invalid = {
      schemaVersion: SchemaVersion,
      id: "npm:zod@",
      name: "zod",
      version: "",
      source: "npm" as const,
      occurrences: [
        {
          workspace: "@repo/registry",
          declaredIn: "packages/registry/package.json",
          bucket: "dependencies" as const,
          specifier: "3.25.76",
        },
      ],
      status: "LIVE" as const,
      owner: "x",
      sourceConfidence: "high" as const,
    };
    assert.throws(() => DepEntrySchema.parse(invalid));
  });

  test("rejects empty occurrences (provenance must never be empty)", () => {
    const invalid = {
      schemaVersion: SchemaVersion,
      id: "npm:zod@3.25.76",
      name: "zod",
      version: "3.25.76",
      source: "npm" as const,
      occurrences: [],
      status: "LIVE" as const,
      owner: "x",
      sourceConfidence: "high" as const,
    };
    assert.throws(() => DepEntrySchema.parse(invalid));
  });
});

describe("RuntimeEntrySchema round-trip", () => {
  test("accepts a NestJS module with dependsOn DAG", () => {
    const valid = {
      schemaVersion: SchemaVersion,
      id: "backend:PaymentsModule",
      path: "backend/src/modules/payments/payments.module.ts",
      kind: "nestjs-module" as const,
      status: "LIVE" as const,
      sourceConfidence: "high" as const,
      dependsOn: ["backend:DatabaseModule", "backend:CryptoModule"],
    };
    assert.doesNotThrow(() => RuntimeEntrySchema.parse(valid));
  });

  test("accepts a Remix route with servesRoute", () => {
    const valid = {
      schemaVersion: SchemaVersion,
      id: "frontend:routes/pieces.$slug",
      path: "frontend/app/routes/pieces.$slug.tsx",
      kind: "remix-route" as const,
      status: "LIVE" as const,
      sourceConfidence: "high" as const,
      servesRoute: "/pieces/:slug",
    };
    assert.doesNotThrow(() => RuntimeEntrySchema.parse(valid));
  });

  test("rejects unknown runtime kind", () => {
    const invalid = {
      schemaVersion: SchemaVersion,
      id: "x",
      path: "x.ts",
      kind: "lambda", // invalid
      status: "LIVE" as const,
      sourceConfidence: "high" as const,
    };
    assert.throws(() => RuntimeEntrySchema.parse(invalid));
  });
});

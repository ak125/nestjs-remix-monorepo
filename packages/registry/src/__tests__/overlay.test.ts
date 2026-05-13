import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  OwnershipEntrySchema,
  OwnershipRegistrySchema,
  DomainEntrySchema,
  DomainsRegistrySchema,
  StatusOverrideEntrySchema,
  StatusOverridesSchema,
  DeletePolicyEntrySchema,
  DeletePolicyOverlaySchema,
  SchemaVersion,
} from "../index";

describe("OwnershipEntrySchema (domain required for PR-G block-new gate)", () => {
  test("accepts a high-confidence human entry", () => {
    const valid = {
      glob: "backend/src/modules/payments/**",
      domain: "D1" as const,
      owner: "@ak125/payments-team",
      sourceConfidence: "high" as const,
      sla: { responseTimeHours: 4, uptimeTarget: 99.9 },
      risk: "critical" as const,
    };
    const parsed = OwnershipEntrySchema.parse(valid);
    assert.equal(parsed.domain, "D1");
    assert.equal(parsed.risk, "critical");
  });

  test("accepts a low-confidence auto-derived entry awaiting human review", () => {
    const valid = {
      glob: "backend/src/rm/**",
      domain: "D2" as const,
      owner: "__unassigned__",
      sourceConfidence: "low" as const,
      statusHint: "LEGACY" as const,
      risk: "medium" as const,
    };
    assert.doesNotThrow(() => OwnershipEntrySchema.parse(valid));
  });

  test("rejects missing domain (required for PR-G gate)", () => {
    const invalid = {
      glob: "foo/**",
      // domain missing
      owner: "x",
      sourceConfidence: "high" as const,
    };
    assert.throws(() => OwnershipEntrySchema.parse(invalid));
  });

  test("OwnershipRegistry round-trip", () => {
    const valid = {
      schemaVersion: SchemaVersion,
      entries: [
        {
          glob: "agents/**",
          domain: "D7" as const,
          owner: "@ak125",
          sourceConfidence: "high" as const,
        },
      ],
    };
    const parsed = OwnershipRegistrySchema.parse(valid);
    assert.equal(parsed.entries.length, 1);
  });
});

describe("DomainsRegistrySchema (D1..D8 + criticality P0..P8)", () => {
  test("accepts a complete domain entry", () => {
    const valid = {
      id: "D1" as const,
      name: "Catalog Core",
      description: "Core catalog tables, P0 75GB",
      criticality: "P0" as const,
      globs: ["backend/src/modules/catalog/**"],
      owner: "@ak125/catalog-team",
    };
    assert.doesNotThrow(() => DomainEntrySchema.parse(valid));
  });

  test("rejects criticality outside P0..P8", () => {
    const invalid = {
      id: "D1" as const,
      name: "X",
      criticality: "P9", // out of range
      owner: "x",
    };
    assert.throws(() => DomainEntrySchema.parse(invalid));
  });

  test("DomainsRegistry round-trip", () => {
    const valid = {
      schemaVersion: SchemaVersion,
      entries: [
        {
          id: "D1" as const,
          name: "Catalog Core",
          criticality: "P0" as const,
          owner: "@ak125/catalog-team",
        },
      ],
    };
    assert.doesNotThrow(() => DomainsRegistrySchema.parse(valid));
  });
});

describe("StatusOverridesSchema (mandatory audit fields)", () => {
  test("accepts a valid override with reason + setAt + setBy", () => {
    const valid = {
      glob: "backend/src/rm/**",
      status: "LEGACY" as const,
      reason: "ADR-004 rm-module-scope (DEV-only, not deployed)",
      setAt: "2026-05-13",
      setBy: "@ak125",
    };
    assert.doesNotThrow(() => StatusOverrideEntrySchema.parse(valid));
  });

  test("rejects missing reason (auditability invariant)", () => {
    const invalid = {
      glob: "x/**",
      status: "LEGACY" as const,
      setAt: "2026-05-13",
      setBy: "x",
    };
    assert.throws(() => StatusOverrideEntrySchema.parse(invalid));
  });

  test("rejects malformed date", () => {
    const invalid = {
      glob: "x/**",
      status: "LEGACY" as const,
      reason: "r",
      setAt: "13-05-2026", // wrong format
      setBy: "x",
    };
    assert.throws(() => StatusOverrideEntrySchema.parse(invalid));
  });

  test("StatusOverrides round-trip empty", () => {
    const valid = { schemaVersion: SchemaVersion };
    const parsed = StatusOverridesSchema.parse(valid);
    assert.deepEqual(parsed.entries, []);
  });
});

describe("DeletePolicyOverlaySchema (canon ADR_REQUIRED for SoT artifacts)", () => {
  test("accepts the canonical SoT/governance paths", () => {
    const valid = {
      schemaVersion: SchemaVersion,
      entries: [
        {
          glob: "audit/registry/**",
          policy: "ADR_REQUIRED" as const,
          reason: "Registry artifacts are Layer 1 SoT + Layer 3 projection",
        },
        {
          glob: "__seo_*",
          policy: "ADR_REQUIRED" as const,
          reason: "SEO governance tables",
        },
      ],
    };
    const parsed = DeletePolicyOverlaySchema.parse(valid);
    assert.equal(parsed.entries.length, 2);
  });

  test("rejects empty reason in DeletePolicyEntry", () => {
    const invalid = {
      glob: "x/**",
      policy: "LOCKED" as const,
      reason: "", // empty
    };
    assert.throws(() => DeletePolicyEntrySchema.parse(invalid));
  });
});

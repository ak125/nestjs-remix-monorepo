import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  SchemaVersion,
  SchemaVersionSchema,
  StatusSchema,
  SourceConfidenceSchema,
  DomainIdSchema,
  FileKindSchema,
  RiskSchema,
  DeletePolicySchema,
  DerivedFromSchema,
} from "../index";

describe("SchemaVersion", () => {
  test("accepts the canonical literal '1.0.0'", () => {
    assert.equal(SchemaVersion, "1.0.0");
    assert.deepEqual(SchemaVersionSchema.parse("1.0.0"), "1.0.0");
  });

  test("rejects any other version string", () => {
    assert.throws(() => SchemaVersionSchema.parse("1.0.1"));
    assert.throws(() => SchemaVersionSchema.parse("2.0.0"));
    assert.throws(() => SchemaVersionSchema.parse(""));
  });
});

describe("StatusSchema (invariant V1-3 : UNKNOWN allowed)", () => {
  test("accepts the 5 canonical values incl. UNKNOWN", () => {
    for (const s of ["LIVE", "LEGACY", "DEPRECATED", "ARCHIVED", "UNKNOWN"]) {
      assert.equal(StatusSchema.parse(s), s);
    }
  });

  test("rejects invented status values (anti-pattern 'force classification')", () => {
    assert.throws(() => StatusSchema.parse("ACTIVE"));
    assert.throws(() => StatusSchema.parse("live")); // case-sensitive
    assert.throws(() => StatusSchema.parse(""));
  });
});

describe("SourceConfidenceSchema (3 levels)", () => {
  test("accepts high/medium/low", () => {
    assert.equal(SourceConfidenceSchema.parse("high"), "high");
    assert.equal(SourceConfidenceSchema.parse("medium"), "medium");
    assert.equal(SourceConfidenceSchema.parse("low"), "low");
  });

  test("rejects invalid confidence labels", () => {
    assert.throws(() => SourceConfidenceSchema.parse("very-high"));
    assert.throws(() => SourceConfidenceSchema.parse("HIGH")); // case-sensitive
  });
});

describe("DomainIdSchema (D1..D15 + UNKNOWN, aligned domain-map.md v1.4.2)", () => {
  test("accepts D1..D15 and UNKNOWN", () => {
    const all = [
      "D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8",
      "D9", "D10", "D11", "D12", "D13", "D14", "D15",
      "UNKNOWN",
    ];
    for (const d of all) {
      assert.equal(DomainIdSchema.parse(d), d);
    }
  });

  test("rejects out-of-range domain IDs", () => {
    assert.throws(() => DomainIdSchema.parse("D0"));
    assert.throws(() => DomainIdSchema.parse("D16"));
    assert.throws(() => DomainIdSchema.parse("D99"));
    assert.throws(() => DomainIdSchema.parse("d1")); // case-sensitive
  });
});

describe("FileKindSchema includes 'extension' for PG extension functions", () => {
  test("accepts all canonical kinds including extension", () => {
    for (const k of [
      "service",
      "controller",
      "route",
      "script",
      "test",
      "config",
      "migration",
      "doc",
      "extension",
    ]) {
      assert.equal(FileKindSchema.parse(k), k);
    }
  });

  test("rejects unknown kinds", () => {
    assert.throws(() => FileKindSchema.parse("module"));
  });
});

describe("RiskSchema (4 levels)", () => {
  test("accepts low/medium/high/critical", () => {
    for (const r of ["low", "medium", "high", "critical"]) {
      assert.equal(RiskSchema.parse(r), r);
    }
  });

  test("rejects custom risk labels", () => {
    assert.throws(() => RiskSchema.parse("blocker"));
  });
});

describe("DeletePolicySchema (3 levels)", () => {
  test("accepts FREE/ADR_REQUIRED/LOCKED", () => {
    assert.equal(DeletePolicySchema.parse("FREE"), "FREE");
    assert.equal(DeletePolicySchema.parse("ADR_REQUIRED"), "ADR_REQUIRED");
    assert.equal(DeletePolicySchema.parse("LOCKED"), "LOCKED");
  });

  test("rejects invented policies", () => {
    assert.throws(() => DeletePolicySchema.parse("DELETE_OK"));
  });
});

describe("DerivedFromSchema covers all V1 source types", () => {
  test("accepts each canonical source", () => {
    for (const d of [
      "depcruise",
      "madge",
      "knip",
      "codeowners",
      "heuristic",
      "manual",
    ]) {
      assert.equal(DerivedFromSchema.parse(d), d);
    }
  });

  test("rejects undeclared source types", () => {
    assert.throws(() => DerivedFromSchema.parse("ast-grep"));
  });
});

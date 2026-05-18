import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { load as parseYaml } from "js-yaml";
import {
  DepGovernanceContractSchema,
  type DepGovernanceContract,
} from "../canonical/dep-governance-contract";
import { FamilyIdSchema } from "../shared/family";

// ──────────────────────────────────────────────────────────────────────────
// Tests for dep-governance.yaml — Repository Contract V1 (PR-D).
// Mirrors runtime-contract.test.ts pattern. node:test via tsx --test.
//
// 8+ test cases:
//   §4.1  schema integrity (positive + negatives)
//   §4.2  cross-contract L1 deps.json id match
//   §4.3  cross-contract domains.yaml
//   §4.4  cross-contract ownership.yaml owner FK
//   §4.5  family enum coverage (every family declared in schema is used OR documented as reserved)
//   §4.6  size warning soft threshold (entries.length < 500)
//   §4.7  determinism (build twice, byte-identical)
// ──────────────────────────────────────────────────────────────────────────

const REPO_ROOT = path.resolve(__dirname, "../../../..");
const YAML_PATH = path.join(
  REPO_ROOT,
  ".spec/00-canon/repository-registry/dep-governance.yaml",
);

function loadRealContract(): DepGovernanceContract {
  const raw = readFileSync(YAML_PATH, "utf8");
  const parsed = parseYaml(raw);
  return DepGovernanceContractSchema.parse(parsed);
}

// V1 MINIMAL fixture for negative-path tests.
const validFixture = {
  schemaVersion: "1.0.0",
  adr: "ADR-058",
  dependencies: [
    {
      id: "npm:zod@^3.25.76",
      name: "zod",
      family: "validation",
      domain: "D14",
      owner: "@ak125",
    },
  ],
};

describe("§4.1 schema integrity — real dep-governance.yaml", () => {
  test("parses and validates", () => {
    const contract = loadRealContract();
    assert.equal(contract.schemaVersion, "1.0.0");
    assert.match(contract.adr, /^ADR-\d{3,}$/);
    assert.ok(
      contract.dependencies.length >= 1,
      "must declare at least 1 dependency",
    );
    assert.ok(
      contract.dependencies.length <= 2000,
      `dependencies.length=${contract.dependencies.length} exceeds sanity cap 2000`,
    );
  });

  test("every entry has the 5 required fields (id, name, family, domain, owner)", () => {
    const contract = loadRealContract();
    for (const dep of contract.dependencies) {
      assert.ok(dep.id, "missing id");
      assert.ok(dep.name, "missing name");
      assert.ok(dep.family, "missing family");
      assert.ok(dep.domain, "missing domain");
      assert.ok(dep.owner, "missing owner");
    }
  });
});

describe("§4.1 schema integrity — fixture-based negative paths", () => {
  test("rejects extra top-level field (.strict() at root)", () => {
    const tampered = { ...validFixture, extra: "smuggled" };
    assert.equal(DepGovernanceContractSchema.safeParse(tampered).success, false);
  });

  test("rejects extra field on dep entry (.strict() at entry level)", () => {
    const tampered = {
      ...validFixture,
      dependencies: [
        { ...validFixture.dependencies[0], license: "MIT" },
      ],
    };
    const result = DepGovernanceContractSchema.safeParse(tampered);
    assert.equal(result.success, false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message).join("\n");
      assert.match(messages, /license|unrecognized|extra/i);
    }
  });

  test("rejects domain UNKNOWN (canon SoT must be explicit)", () => {
    const tampered = {
      ...validFixture,
      dependencies: [{ ...validFixture.dependencies[0], domain: "UNKNOWN" }],
    };
    assert.equal(DepGovernanceContractSchema.safeParse(tampered).success, false);
  });

  test("rejects family not in canonical enum", () => {
    const tampered = {
      ...validFixture,
      dependencies: [{ ...validFixture.dependencies[0], family: "frontend" }], // typo: should be frontend-ui
    };
    assert.equal(DepGovernanceContractSchema.safeParse(tampered).success, false);
  });

  test("rejects owner not matching @org or @org/team", () => {
    const tampered = {
      ...validFixture,
      dependencies: [{ ...validFixture.dependencies[0], owner: "ak125" }],
    };
    assert.equal(DepGovernanceContractSchema.safeParse(tampered).success, false);
  });

  test("rejects id format not matching npm:<name>@<version>", () => {
    const tampered = {
      ...validFixture,
      dependencies: [
        { ...validFixture.dependencies[0], id: "zod@3.25.76" },
      ],
    };
    assert.equal(DepGovernanceContractSchema.safeParse(tampered).success, false);
  });

  test("rejects id-name mismatch (id decodes to different name than name field)", () => {
    const tampered = {
      ...validFixture,
      dependencies: [
        {
          ...validFixture.dependencies[0],
          id: "npm:other-package@1.0.0",
          name: "zod",
        },
      ],
    };
    const result = DepGovernanceContractSchema.safeParse(tampered);
    assert.equal(result.success, false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message).join("\n");
      assert.match(messages, /id-name mismatch/);
    }
  });

  test("rejects duplicate dependency.id", () => {
    const tampered = {
      ...validFixture,
      dependencies: [
        validFixture.dependencies[0],
        validFixture.dependencies[0],
      ],
    };
    const result = DepGovernanceContractSchema.safeParse(tampered);
    assert.equal(result.success, false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message).join("\n");
      assert.match(messages, /Duplicate dependency.id/);
    }
  });

  test("rejects duplicate dependency.name (different versions same package)", () => {
    const tampered = {
      ...validFixture,
      dependencies: [
        validFixture.dependencies[0],
        { ...validFixture.dependencies[0], id: "npm:zod@^4.0.0" },
      ],
    };
    const result = DepGovernanceContractSchema.safeParse(tampered);
    assert.equal(result.success, false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message).join("\n");
      assert.match(messages, /Duplicate dependency.name/);
    }
  });

  test("accepts valid fixture (positive control)", () => {
    assert.equal(DepGovernanceContractSchema.safeParse(validFixture).success, true);
  });
});

describe("§4.2 cross-contract L1 — every contract id exists in audit/registry/deps.json", () => {
  const L1_PATH = path.join(REPO_ROOT, "audit/registry/deps.json");

  test("loads L1 deps registry", () => {
    const raw = readFileSync(L1_PATH, "utf8");
    const doc = JSON.parse(raw) as { entries: Array<{ id: string }> };
    assert.ok(Array.isArray(doc.entries));
    assert.ok(doc.entries.length > 0);
  });

  test("every contract dependency.id appears in L1 deps.json (subset)", () => {
    const contract = loadRealContract();
    const raw = readFileSync(L1_PATH, "utf8");
    const l1 = JSON.parse(raw) as { entries: Array<{ id: string }> };
    const l1Ids = new Set(l1.entries.map((e) => e.id));

    const missing: string[] = [];
    for (const dep of contract.dependencies) {
      if (!l1Ids.has(dep.id)) missing.push(dep.id);
    }

    assert.equal(
      missing.length,
      0,
      `${missing.length} contract deps NOT found in L1 deps.json: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "…" : ""}. ` +
        "Either the YAML drifted (version bumped in package.json) or L1 builder needs to re-run.",
    );
  });
});

describe("§4.3 cross-contract domains.yaml — every entry.domain is declared", () => {
  const DOMAINS_PATH = path.join(
    REPO_ROOT,
    ".spec/00-canon/repository-registry/domains.yaml",
  );

  function loadDomainIds(): Set<string> {
    const raw = readFileSync(DOMAINS_PATH, "utf8");
    const doc = parseYaml(raw) as { entries: Array<{ id: string }> };
    return new Set(doc.entries.map((e) => e.id));
  }

  test("every contract dependency.domain matches a domains.yaml entry id", () => {
    const contract = loadRealContract();
    const declaredDomains = loadDomainIds();

    const unknown: string[] = [];
    for (const dep of contract.dependencies) {
      if (!declaredDomains.has(dep.domain)) {
        unknown.push(`${dep.id} → domain=${dep.domain}`);
      }
    }

    assert.equal(
      unknown.length,
      0,
      `${unknown.length} deps reference undeclared domains: ${unknown.slice(0, 5).join(", ")}${unknown.length > 5 ? "…" : ""}`,
    );
  });
});

describe("§4.4 cross-contract ownership.yaml — owner FK enforcement", () => {
  const OWNERSHIP_PATH = path.join(
    REPO_ROOT,
    ".spec/00-canon/repository-registry/ownership.yaml",
  );

  test("every contract dependency.owner appears as owner: in ownership.yaml entries", () => {
    const contract = loadRealContract();
    const raw = readFileSync(OWNERSHIP_PATH, "utf8");
    const doc = parseYaml(raw) as { entries: Array<{ owner: string }> };
    const declaredOwners = new Set(doc.entries.map((e) => e.owner));

    const unknown: string[] = [];
    for (const dep of contract.dependencies) {
      if (!declaredOwners.has(dep.owner)) {
        unknown.push(`${dep.id} → owner=${dep.owner}`);
      }
    }

    assert.equal(
      unknown.length,
      0,
      `${unknown.length} deps reference owners not declared in ownership.yaml: ${unknown.slice(0, 5).join(", ")}${unknown.length > 5 ? "…" : ""}. ` +
        "OwnerIdSchema regex is permissive — this test is the runtime FK.",
    );
  });
});

describe("§4.5 family enum coverage — every family declared SHOULD be used", () => {
  // Soft assertion: each family in FamilyIdSchema enum should be used by at least
  // 1 dep, OR be documented as reserved (V1 may have unused families intentionally).
  // This test surfaces dead enum values for V1.5 cleanup conversation, NOT a hard fail.
  const RESERVED_V1: ReadonlyArray<string> = [
    "vehicle",     // reserved — TecDoc-equivs not yet extracted as deps
    "payments",    // paybox/systempay are HTTP-only integrations (no SDK dep V1)
    "other",       // escape hatch only — no permanent residents per doctrine
  ];

  test("every non-reserved family in FamilyIdSchema is used by at least 1 dep", () => {
    const contract = loadRealContract();
    const usedFamilies = new Set(contract.dependencies.map((d) => d.family));
    const allFamilies = FamilyIdSchema.options;

    const unused = allFamilies.filter(
      (f) => !usedFamilies.has(f) && !RESERVED_V1.includes(f),
    );

    assert.equal(
      unused.length,
      0,
      `${unused.length} families declared but unused (and not reserved): ${unused.join(", ")}. ` +
        "Either add at least one V1 dep with this family, or document as reserved in RESERVED_V1 array.",
    );
  });
});

describe("§4.6 size warning — soft threshold for ratchet conversation", () => {
  const SOFT_THRESHOLD = 500;

  test(`dependencies.length < ${SOFT_THRESHOLD} (operational threshold, not schema limit)`, () => {
    const contract = loadRealContract();
    assert.ok(
      contract.dependencies.length < SOFT_THRESHOLD,
      `dep-governance.yaml has ${contract.dependencies.length} dependencies (soft threshold: < ${SOFT_THRESHOLD}). ` +
        "Soft threshold reached. Ratchet decision needed — bump threshold OR split " +
        "dep-governance.yaml into per-family files (canon doctrine warns against monolithic dumps). " +
        "Do NOT raise the Zod .max(2000) as a substitute.",
    );
  });
});

describe("§4.7 determinism — generator output is byte-identical across runs", () => {
  const { execSync } = require("node:child_process");
  const { createHash } = require("node:crypto");
  const SCHEMA_OUT = path.join(
    REPO_ROOT,
    ".spec/00-canon/_schema/dep-governance.schema.json",
  );

  test("two consecutive builds produce the same schema.json bytes", () => {
    execSync("npm run dep-governance:build", {
      cwd: REPO_ROOT,
      stdio: "pipe",
    });
    const first = readFileSync(SCHEMA_OUT);
    const firstSha = createHash("sha256").update(first).digest("hex");

    execSync("npm run dep-governance:build", {
      cwd: REPO_ROOT,
      stdio: "pipe",
    });
    const second = readFileSync(SCHEMA_OUT);
    const secondSha = createHash("sha256").update(second).digest("hex");

    assert.equal(
      firstSha,
      secondSha,
      `Determinism broken: ${firstSha.slice(0, 12)} ≠ ${secondSha.slice(0, 12)}. ` +
        "Mirror runtime-contract pattern.",
    );
  });
});

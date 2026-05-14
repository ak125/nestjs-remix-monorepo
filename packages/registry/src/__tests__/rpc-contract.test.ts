import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { load as parseYaml } from "js-yaml";
import {
  RpcContractSchema,
  type RpcContract,
} from "../canonical/rpc-contract";
import { AccessSurfaceSchema } from "../shared/access-surface";

// ──────────────────────────────────────────────────────────────────────────
// Tests for rpc.yaml — Repository Contract V1 (PR-R).
// Mirrors dep-governance-contract.test.ts pattern (PR-D #523).
//
// 7+ test cases:
//   §4.1  schema integrity (positive + negatives)
//   §4.2  cross-contract L1 rpc.json id match
//   §4.3  cross-contract domains.yaml
//   §4.4  cross-contract ownership.yaml owner FK
//   §4.5  accessSurface enum coverage (every value used ≥ 1 OR RESERVED)
//   §4.6  size warning soft threshold (rpcs.length < 100)
//   §4.7  determinism (build twice, byte-identical)
// ──────────────────────────────────────────────────────────────────────────

const REPO_ROOT = path.resolve(__dirname, "../../../..");
const YAML_PATH = path.join(
  REPO_ROOT,
  ".spec/00-canon/repository-registry/rpc.yaml",
);

function loadRealContract(): RpcContract {
  const raw = readFileSync(YAML_PATH, "utf8");
  const parsed = parseYaml(raw);
  return RpcContractSchema.parse(parsed);
}

// V1 MINIMAL fixture for negative-path tests.
const validFixture = {
  schemaVersion: "1.0.0",
  adr: "ADR-058",
  rpcs: [
    {
      id: "public.__gov_m1_table_sizes",
      name: "__gov_m1_table_sizes",
      domain: "D15",
      owner: "@ak125",
      status: "LIVE",
      accessSurface: ["backend", "service_role"],
      securityDefinerExpected: false,
    },
  ],
};

describe("§4.1 schema integrity — real rpc.yaml", () => {
  test("parses and validates", () => {
    const contract = loadRealContract();
    assert.equal(contract.schemaVersion, "1.0.0");
    assert.match(contract.adr, /^ADR-\d{3,}$/);
    assert.ok(contract.rpcs.length >= 1);
    assert.ok(contract.rpcs.length <= 2000);
  });

  test("every entry has the 6 required fields (id, name, domain, owner, status, accessSurface)", () => {
    const contract = loadRealContract();
    for (const rpc of contract.rpcs) {
      assert.ok(rpc.id);
      assert.ok(rpc.name);
      assert.ok(rpc.domain);
      assert.ok(rpc.owner);
      assert.ok(rpc.status);
      assert.ok(Array.isArray(rpc.accessSurface));
      assert.ok(rpc.accessSurface.length >= 1);
    }
  });
});

describe("§4.1 schema integrity — fixture-based negative paths", () => {
  test("rejects extra top-level field (.strict() at root)", () => {
    const tampered = { ...validFixture, extra: "smuggled" };
    assert.equal(RpcContractSchema.safeParse(tampered).success, false);
  });

  test("rejects extra field on rpc entry (.strict() at entry level)", () => {
    const tampered = {
      ...validFixture,
      rpcs: [{ ...validFixture.rpcs[0], language: "plpgsql" }],
    };
    const result = RpcContractSchema.safeParse(tampered);
    assert.equal(result.success, false);
    if (!result.success) {
      const msgs = result.error.issues.map((i) => i.message).join("\n");
      assert.match(msgs, /language|unrecognized|extra/i);
    }
  });

  test("rejects domain UNKNOWN (canon SoT must be explicit)", () => {
    const tampered = {
      ...validFixture,
      rpcs: [{ ...validFixture.rpcs[0], domain: "UNKNOWN" }],
    };
    assert.equal(RpcContractSchema.safeParse(tampered).success, false);
  });

  test("rejects owner not matching @org or @org/team", () => {
    const tampered = {
      ...validFixture,
      rpcs: [{ ...validFixture.rpcs[0], owner: "ak125" }],
    };
    assert.equal(RpcContractSchema.safeParse(tampered).success, false);
  });

  test("rejects id format not matching schema.name", () => {
    const tampered = {
      ...validFixture,
      rpcs: [{ ...validFixture.rpcs[0], id: "INVALID-ID" }],
    };
    assert.equal(RpcContractSchema.safeParse(tampered).success, false);
  });

  test("rejects id-name mismatch", () => {
    const tampered = {
      ...validFixture,
      rpcs: [
        {
          ...validFixture.rpcs[0],
          id: "public.other_rpc",
          name: "__gov_m1_table_sizes",
        },
      ],
    };
    const result = RpcContractSchema.safeParse(tampered);
    assert.equal(result.success, false);
    if (!result.success) {
      const msgs = result.error.issues.map((i) => i.message).join("\n");
      assert.match(msgs, /id-name mismatch/);
    }
  });

  test("rejects accessSurface empty array", () => {
    const tampered = {
      ...validFixture,
      rpcs: [{ ...validFixture.rpcs[0], accessSurface: [] }],
    };
    assert.equal(RpcContractSchema.safeParse(tampered).success, false);
  });

  test("rejects accessSurface duplicate value", () => {
    const tampered = {
      ...validFixture,
      rpcs: [
        {
          ...validFixture.rpcs[0],
          accessSurface: ["backend", "backend"],
        },
      ],
    };
    const result = RpcContractSchema.safeParse(tampered);
    assert.equal(result.success, false);
    if (!result.success) {
      const msgs = result.error.issues.map((i) => i.message).join("\n");
      assert.match(msgs, /duplicate accessSurface/);
    }
  });

  test("rejects accessSurface value not in enum", () => {
    const tampered = {
      ...validFixture,
      rpcs: [{ ...validFixture.rpcs[0], accessSurface: ["admin"] }],
    };
    assert.equal(RpcContractSchema.safeParse(tampered).success, false);
  });

  test("rejects duplicate rpc.id", () => {
    const tampered = {
      ...validFixture,
      rpcs: [validFixture.rpcs[0], validFixture.rpcs[0]],
    };
    const result = RpcContractSchema.safeParse(tampered);
    assert.equal(result.success, false);
    if (!result.success) {
      const msgs = result.error.issues.map((i) => i.message).join("\n");
      assert.match(msgs, /Duplicate rpc.id/);
    }
  });

  test("accepts valid fixture (positive control)", () => {
    assert.equal(RpcContractSchema.safeParse(validFixture).success, true);
  });
});

describe("§4.2 cross-contract L1 — every contract id exists in audit/registry/rpc.json", () => {
  const L1_PATH = path.join(REPO_ROOT, "audit/registry/rpc.json");

  test("loads L1 rpc registry", () => {
    const raw = readFileSync(L1_PATH, "utf8");
    const doc = JSON.parse(raw) as { entries: Array<{ id: string }> };
    assert.ok(Array.isArray(doc.entries));
    assert.ok(doc.entries.length > 0);
  });

  test("every contract rpc.id appears in L1 rpc.json (subset)", () => {
    const contract = loadRealContract();
    const raw = readFileSync(L1_PATH, "utf8");
    const l1 = JSON.parse(raw) as { entries: Array<{ id: string }> };
    // L1 stores ids with a `#sig:` suffix sometimes (overloaded fns) — strip
    // for the cross-check (we only care about schema.name being present).
    const l1Ids = new Set(l1.entries.map((e) => e.id.split("#")[0]));

    const missing: string[] = [];
    for (const rpc of contract.rpcs) {
      if (!l1Ids.has(rpc.id)) missing.push(rpc.id);
    }

    assert.equal(
      missing.length,
      0,
      `${missing.length} contract RPCs NOT found in L1 rpc.json: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "…" : ""}. ` +
        "Either the YAML drifted (RPC dropped from migrations) or L1 builder needs to re-run.",
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

  test("every contract rpc.domain matches a domains.yaml entry id", () => {
    const contract = loadRealContract();
    const declared = loadDomainIds();
    const unknown: string[] = [];
    for (const rpc of contract.rpcs) {
      if (!declared.has(rpc.domain)) unknown.push(`${rpc.id} → domain=${rpc.domain}`);
    }
    assert.equal(unknown.length, 0, `Undeclared domains: ${unknown.slice(0, 5).join(", ")}`);
  });
});

describe("§4.4 cross-contract ownership.yaml — owner FK enforcement", () => {
  const OWNERSHIP_PATH = path.join(
    REPO_ROOT,
    ".spec/00-canon/repository-registry/ownership.yaml",
  );

  test("every contract rpc.owner appears as owner: in ownership.yaml entries", () => {
    const contract = loadRealContract();
    const raw = readFileSync(OWNERSHIP_PATH, "utf8");
    const doc = parseYaml(raw) as { entries: Array<{ owner: string }> };
    const declared = new Set(doc.entries.map((e) => e.owner));

    const unknown: string[] = [];
    for (const rpc of contract.rpcs) {
      if (!declared.has(rpc.owner)) unknown.push(`${rpc.id} → owner=${rpc.owner}`);
    }
    assert.equal(
      unknown.length,
      0,
      `${unknown.length} RPCs reference owners not in ownership.yaml: ${unknown.slice(0, 5).join(", ")}`,
    );
  });
});

describe("§4.5 accessSurface enum coverage — every value used ≥ 1 OR RESERVED", () => {
  // Soft assertion: each surface in AccessSurfaceSchema should be used by ≥ 1 RPC,
  // OR documented as RESERVED (V1 may have unused surfaces intentionally).
  const RESERVED_V1: ReadonlyArray<string> = [
    "rpc",            // RPC-to-RPC calls — V2 (cross-RPC dependency graph)
    "anon",           // anonymous client — most RPCs require auth in V1 sample
    "edge_function",  // Edge Functions runtime — limited V1 use
    "worker",         // BullMQ worker process — RPCs called from workers — V2
    "frontend",       // direct frontend RPC calls — discouraged, prefer backend
    "authenticated",  // direct authenticated client — discouraged, prefer backend
  ];

  test("every non-reserved accessSurface value is used by ≥ 1 RPC", () => {
    const contract = loadRealContract();
    const used = new Set<string>();
    for (const rpc of contract.rpcs) {
      for (const s of rpc.accessSurface) used.add(s);
    }
    const all = AccessSurfaceSchema.options;
    const unused = all.filter((v) => !used.has(v) && !RESERVED_V1.includes(v));
    assert.equal(
      unused.length,
      0,
      `${unused.length} accessSurface values declared but unused (and not reserved): ${unused.join(", ")}. ` +
        "Either add at least one V1 RPC with this surface, or document as reserved in RESERVED_V1.",
    );
  });
});

describe("§4.6 size warning — soft threshold for ratchet conversation", () => {
  const SOFT_THRESHOLD = 100;

  test(`rpcs.length < ${SOFT_THRESHOLD} (operational threshold, not schema limit)`, () => {
    const contract = loadRealContract();
    assert.ok(
      contract.rpcs.length < SOFT_THRESHOLD,
      `rpc.yaml has ${contract.rpcs.length} RPCs (soft threshold: < ${SOFT_THRESHOLD}). ` +
        "Soft threshold reached. Ratchet decision needed — bump threshold OR split " +
        "rpc.yaml into per-domain files. Do NOT raise the Zod .max(2000) as a substitute.",
    );
  });
});

describe("§4.7 determinism — generator output is byte-identical across runs", () => {
  const { execSync } = require("node:child_process");
  const { createHash } = require("node:crypto");
  const SCHEMA_OUT = path.join(
    REPO_ROOT,
    ".spec/00-canon/_schema/rpc.schema.json",
  );

  test("two consecutive builds produce the same schema.json bytes", () => {
    execSync("npm run rpc-contract:build", {
      cwd: REPO_ROOT,
      stdio: "pipe",
    });
    const first = readFileSync(SCHEMA_OUT);
    const firstSha = createHash("sha256").update(first).digest("hex");

    execSync("npm run rpc-contract:build", {
      cwd: REPO_ROOT,
      stdio: "pipe",
    });
    const second = readFileSync(SCHEMA_OUT);
    const secondSha = createHash("sha256").update(second).digest("hex");

    assert.equal(
      firstSha,
      secondSha,
      `Determinism broken: ${firstSha.slice(0, 12)} ≠ ${secondSha.slice(0, 12)}.`,
    );
  });
});

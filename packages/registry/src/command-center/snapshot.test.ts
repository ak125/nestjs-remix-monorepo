import Ajv2020 from "ajv/dist/2020";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as schemas from "./snapshot";

const legacy = JSON.parse(
  readFileSync(
    new URL(
      "../../../../audit/registry/command-center-snapshot.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const numbers = [
  "direction",
  "governance",
  "strategy",
  "marketing",
  "brand",
  "content",
  "seo",
  "media",
  "wiki",
  "catalog",
  "diagnostic",
  "supplier",
  "sales",
  "support",
  "logistics",
  "pricing",
  "finance",
  "legal",
  "risk-audit",
  "product",
  "runtime",
  "data",
  "ia-agents",
  "people",
];
function response() {
  return {
    ...legacy,
    schema_version: "command-center.v2",
    departments: legacy.departments.map(
      (d: Record<string, unknown>, i: number) => ({
        ...d,
        business_number: numbers.indexOf(String(d.id)) + 1,
        accountable_owner: null,
        operating_mode: "hybrid",
        repo_domains: ["D8"],
        profile_ref: `audit/automecanik-departments-map.md#department-${d.id}`,
        health_score_current: 30,
        live_caps_applied: [],
      }),
    ),
    degraded: false,
    mode: "full",
    action_queue: [],
    department_reports: [],
    generated_at: "2026-10-10T00:00:00Z",
    git_sha: null,
    stale_status: "UNKNOWN",
    validation_status: "UNKNOWN",
    global_status: { level: "WARNING", verdict: "PARTIAL_READY", reasons: [] },
  };
}

test("v2 requires responsibility metadata and v1 projection removes only added fields", () => {
  assert.ok(schemas.CommandCenterResponseV2Schema, "v2 parser must exist");
  const parsed = schemas.CommandCenterResponseV2Schema.parse(response());
  const v1 = schemas.toCommandCenterV1(parsed);
  assert.equal(v1.departments.length, parsed.departments.length);
  assert.equal(v1.schema_version, "command-center.v1");
  assert.equal("operating_mode" in v1.departments[0], false);
  assert.deepEqual(v1.capabilities, parsed.capabilities);
  assert.equal(schemas.CommandCenterResponseSchema.safeParse(v1).success, true);
  const missing = response();
  delete missing.departments[0].business_number;
  assert.equal(
    schemas.CommandCenterResponseV2Schema.safeParse(missing).success,
    false,
  );
});

test("human permits empty domains, hybrid rejects them and out of range numbers", () => {
  assert.ok(schemas.CommandCenterResponseV2Schema);
  const r = response();
  r.departments[0].repo_domains = [];
  assert.equal(
    schemas.CommandCenterResponseV2Schema.safeParse(r).success,
    false,
  );
  r.departments[0].operating_mode = "human";
  assert.equal(
    schemas.CommandCenterResponseV2Schema.safeParse(r).success,
    true,
  );
  r.departments[0].business_number = 25;
  assert.equal(
    schemas.CommandCenterResponseV2Schema.safeParse(r).success,
    false,
  );
});

test("light and degraded permit redacted canon path but reject leaked detail", () => {
  const r = response();
  Object.assign(r, {
    mode: "light",
    source_truth: { canon_path: "", last_verified: null },
    departments: [],
    capabilities: [],
    chains: [],
    alerts: [],
    owner_actions: [],
    executive_kpis: [],
  });
  assert.ok(schemas.CommandCenterResponseV2Schema);
  assert.equal(
    schemas.CommandCenterResponseV2Schema.safeParse(r).success,
    true,
  );
  assert.equal(
    schemas.CommandCenterResponseSchema.safeParse({
      ...r,
      schema_version: "command-center.v1",
    }).success,
    true,
  );
  r.departments = response().departments;
  assert.equal(
    schemas.CommandCenterResponseV2Schema.safeParse(r).success,
    false,
  );
  r.departments = [];
  r.mode = "full";
  r.degraded = true;
  assert.equal(
    schemas.CommandCenterResponseV2Schema.safeParse(r).success,
    true,
  );
});

test("AJV and Zod agree on historical v1 and strict v2 snapshot metadata", () => {
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  const validate = ajv.compile(
    JSON.parse(
      readFileSync(
        new URL(
          "../../../../.spec/00-canon/ai-registry/command-center-snapshot.schema.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ),
  );
  const old = JSON.parse(
    readFileSync(
      new URL(
        "../../../../tests/registry/fixtures/command-center-l1-baseline.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ).data.snapshot;
  assert.equal(validate(old), true);
  assert.equal(
    schemas.CommandCenterSnapshotSchema.safeParse(old).success,
    true,
  );
  assert.equal(validate(legacy), true);
  assert.equal(
    schemas.CommandCenterSnapshotV2Schema.safeParse(legacy).success,
    true,
  );
  for (const mutate of [
    (s: any) => {
      delete s.departments[0].accountable_owner;
    },
    (s: any) => {
      s.departments[0].business_number = 25;
    },
    (s: any) => {
      s.departments[0].accountable_owner = "person@example.com";
    },
    (s: any) => {
      s.departments[0].unexpected = true;
    },
    (s: any) => {
      s.departments[0].operating_mode = "automatic";
    },
    (s: any) => {
      s.departments[0].operating_mode = "hybrid";
      s.departments[0].repo_domains = [];
    },
    (s: any) => {
      s.source_truth.canon_path = "";
    },
  ]) {
    const invalid = structuredClone(legacy);
    mutate(invalid);
    assert.equal(validate(invalid), false);
    assert.equal(
      schemas.CommandCenterSnapshotV2Schema.safeParse(invalid).success,
      false,
    );
  }
  const v1WithMetadata = { ...legacy, schema_version: "command-center.v1" };
  assert.equal(validate(v1WithMetadata), false);
  assert.equal(
    schemas.CommandCenterSnapshotSchema.safeParse(v1WithMetadata).success,
    false,
  );
});

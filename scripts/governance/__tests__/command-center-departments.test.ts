import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import yaml from "js-yaml";
import { CommandCenterSnapshotV2Schema } from "../../../packages/registry/src/command-center/snapshot";
const require = createRequire(import.meta.url);
const { buildSnapshot } = require("../build-command-center-snapshot.js");
const {
  checkDepartmentProfiles,
} = require("../validate-agent-operating-map.js");
const baseline = JSON.parse(
  readFileSync(
    "tests/registry/fixtures/command-center-l1-baseline.json",
    "utf8",
  ),
);
const base = baseline.data.operating_map;
test("historical L1 fixture retains its reviewed provenance and data", () => {
  assert.equal(
    baseline.provenance.revision,
    "c2dfa0699c9d08e549a107b53a37a4657646811a",
  );
  assert.equal(
    createHash("sha256").update(JSON.stringify(baseline.data)).digest("hex"),
    "57f08798b8eb2d9a60ed70cdef236a91367ccb2d647c6a3783916f7bed90f9a2",
  );
});
const canon = yaml.load(
  readFileSync(".spec/00-canon/ai-registry/agent-operating-map.yaml", "utf8"),
) as any;
const profiles = readFileSync("audit/automecanik-departments-map.md", "utf8");
const skills = JSON.parse(
  readFileSync(".spec/00-canon/ai-registry/skills.registry.json", "utf8"),
);
test("24 responsibilities preserve baseline fields except the approved People delta", () => {
  assert.equal(canon.departments.length, 24);
  assert.deepEqual(
    canon.departments
      .map((d: any) => d.business_number)
      .sort((a: number, b: number) => a - b),
    Array.from({ length: 24 }, (_, i) => i + 1),
  );
  const additions = canon.departments.filter(
    (d: any) => !base.departments.some((old: any) => old.id === d.id),
  );
  assert.deepEqual(additions.map((d: any) => d.id).sort(), [
    "direction",
    "legal",
    "product",
    "risk-audit",
  ]);
  for (const old of base.departments) {
    const next = canon.departments.find((d: any) => d.id === old.id);
    for (const key of Object.keys(old)) {
      if (old.id === "people" && ["label", "repo_domains"].includes(key))
        continue;
      assert.deepEqual(next[key], old[key], `${old.id}.${key}`);
    }
  }
  const people = canon.departments.find((d: any) => d.id === "people");
  assert.equal(people.label, "People, Formation & Doc");
  assert.deepEqual(people.repo_domains, ["D8"]);
  assert.deepEqual(people.capabilities, ["staff"]);
  assert.deepEqual(canon.declared_capabilities, base.declared_capabilities);
  assert.deepEqual(canon.department_handoffs, base.department_handoffs);
});
test("generated counts and unknown human scores preserve technical evidence", () => {
  const s = CommandCenterSnapshotV2Schema.parse(
    buildSnapshot(canon, existsSync, skills),
  );
  assert.equal(s.summary.departments_total, 24);
  assert.equal(s.summary.by_state.dormant, 5);
  assert.deepEqual(s.summary.by_priority, { P0: 8, P1: 7, P2: 2, P3: 3 });
  assert.equal(s.capabilities.length, 41);
  assert.equal(s.summary.capabilities_certified, 22);
  assert.equal(s.summary.capabilities_without_evidence, 4);
  assert.equal(s.chains.length, 10);
  assert.equal(s.summary.handoffs_incomplete, 9);
  for (const d of s.departments.filter((d) => d.operating_mode === "human")) {
    assert.equal(d.health_score_base, 30);
    assert.equal(d.certification, "UNKNOWN");
    assert.equal(d.priority, null);
    assert.equal(d.kpi_primary, null);
  }
});
test("profile references, unique IDs and business numbers are checked", () => {
  assert.equal(typeof checkDepartmentProfiles, "function");
  assert.deepEqual(checkDepartmentProfiles(canon.departments, profiles), []);
  for (const mutation of [
    (ds: any[]) => {
      ds[0].profile_ref = "https://example.com";
    },
    (ds: any[]) => {
      ds[0].profile_ref =
        "../audit/automecanik-departments-map.md#department-supplier";
    },
    (ds: any[]) => {
      ds[0].profile_ref =
        "audit/automecanik-departments-map.md#department-people";
    },
    (ds: any[]) => {
      ds[0].business_number = ds[1].business_number;
    },
    (ds: any[]) => {
      ds[0].id = ds[1].id;
    },
  ]) {
    const ds = structuredClone(canon.departments);
    mutation(ds);
    assert.ok(checkDepartmentProfiles(ds, profiles).length > 0);
  }
  assert.ok(checkDepartmentProfiles(canon.departments, "").length > 0);
});

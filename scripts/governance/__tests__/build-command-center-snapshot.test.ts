/**
 * Tests for scripts/governance/build-command-center-snapshot.js
 *
 * Run: tsx --test scripts/governance/__tests__/build-command-center-snapshot.test.ts
 *
 * Covers (plan §Engineering rigor — TDD):
 *   - certification ladder ORDER (BROKEN before CERTIFIED)
 *   - health-score cap matrix (P0+BROKEN→39, no-evidence→49, CERTIFIED→90)
 *   - golden snapshot from a fixture canon + determinism (build ×2 byte-identical)
 *   - AJV: output validates against command-center-snapshot.schema.json
 *   - Zero-drift: output also parses against the @repo/registry Zod schema
 *   - Integration: the committed snapshot satisfies both schemas
 */
import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { createRequire } from "node:module";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { CommandCenterSnapshotSchema } from "../../../packages/registry/src/command-center/snapshot";

const require = createRequire(import.meta.url);
const gen = require("../build-command-center-snapshot.js");
const { computeCertification, computeHealthScoreBase, buildSnapshot } = gen;

const ROOT = path.resolve(__dirname, "..", "..", "..");
const SCHEMA = JSON.parse(
  fs.readFileSync(path.join(ROOT, ".spec/00-canon/ai-registry/command-center-snapshot.schema.json"), "utf8"),
);

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(SCHEMA);

const present = (p: string) => p === "present/path" || p === "present/a" || p === "present/b";

// ── certification ladder ──
test("certification: live + verified script → CERTIFIED", () => {
  const v = computeCertification({ status: "live", evidence: { scripts: ["present/path"] } }, present);
  assert.equal(v.certification, "CERTIFIED");
});

test("certification: BROKEN is checked BEFORE CERTIFIED (a missing path wins over live)", () => {
  const v = computeCertification({ status: "live", evidence: { scripts: ["present/a", "missing/x"] } }, present);
  assert.equal(v.certification, "BROKEN");
  assert.match(v.reason, /^missing_path:/);
});

test("certification: partial → PARTIAL", () => {
  assert.equal(computeCertification({ status: "partial", evidence: { scripts: ["present/path"] } }, present).certification, "PARTIAL");
});

test("certification: live + tables-only → PARTIAL (liveness deferred to Phase 2)", () => {
  const v = computeCertification({ status: "live", evidence: { tables: ["t"] } }, present);
  assert.equal(v.certification, "PARTIAL");
  assert.equal(v.reason, "evidence_liveness_deferred_phase2");
});

test("certification: live + no evidence → PARTIAL (no_structured_evidence, never green)", () => {
  const v = computeCertification({ status: "live" }, present);
  assert.equal(v.certification, "PARTIAL");
  assert.equal(v.reason, "no_structured_evidence");
});

test("certification: dormant → UNKNOWN", () => {
  assert.equal(computeCertification({ status: "dormant" }, present).certification, "UNKNOWN");
});

// ── health-score cap matrix ──
test("health: P0 dept with a BROKEN cap is capped to ≤39", () => {
  const r = computeHealthScoreBase(
    { priority: "P0" },
    [{ certification: "CERTIFIED", has_evidence: true }, { certification: "BROKEN", has_evidence: true }],
  );
  assert.ok(r.base <= 39, `expected ≤39, got ${r.base}`);
  assert.ok(r.caps_applied.includes("p0_broken_max_39"));
  assert.equal(r.worst_certification, "BROKEN");
});

test("health: a no-evidence capability caps the dept to ≤49", () => {
  const r = computeHealthScoreBase(
    { priority: "P2" },
    [{ certification: "CERTIFIED", has_evidence: true }, { certification: "UNKNOWN", has_evidence: false }],
  );
  assert.ok(r.base <= 49, `expected ≤49, got ${r.base}`);
  assert.ok(r.caps_applied.includes("no_evidence_max_49"));
});

test("health: all-CERTIFIED dept scores 90, no caps", () => {
  const r = computeHealthScoreBase(
    { priority: "P1" },
    [{ certification: "CERTIFIED", has_evidence: true }, { certification: "CERTIFIED", has_evidence: true }],
  );
  assert.equal(r.base, 90);
  assert.deepEqual(r.caps_applied, []);
});

// ── golden fixture + determinism + schema cross-validation ──
const FIXTURE = {
  last_verified: "2026-06-04",
  departments: [
    { id: "supplier", label: "Achats", lead: "s-lead", priority: "P0", kpi_primary: "k", repo_domains: ["D11"], capabilities: ["live-cap", "broken-cap"], state: "partial" },
    { id: "seo", label: "SEO", lead: "g-lead", priority: "P1", kpi_primary: "k2", repo_domains: ["D3"], capabilities: ["partial-cap"], state: "partial" },
    { id: "support", label: "Support", lead: "n-lead", priority: "P2", repo_domains: ["D5"], capabilities: ["unknown-cap"], state: "dormant" },
  ],
  declared_capabilities: [
    { id: "live-cap", type: "module", owner: "supplier", status: "live", evidence: { scripts: ["present/a"] } },
    { id: "broken-cap", type: "module", owner: "supplier", status: "live", evidence: { scripts: ["missing/x"] } },
    { id: "partial-cap", type: "service", owner: "seo", status: "partial", evidence: { tables: ["t"] } },
    { id: "unknown-cap", type: "skill", owner: "support", status: "dormant" },
  ],
  department_handoffs: [
    { id: "supplier-to-seo", from: "supplier", to: "seo", contract_ref: "x.v1", contract_status: "planned", gate: "g", state: "PARTIAL" },
  ],
};

test("golden: buildSnapshot from fixture has expected shape + values", () => {
  const snap = buildSnapshot(FIXTURE, present);
  assert.equal(snap.schema_version, "command-center.v1");
  assert.equal(snap.summary.departments_total, 3);
  assert.equal(snap.summary.capabilities_total, 4);
  const broken = snap.capabilities.find((c: any) => c.id === "broken-cap");
  assert.equal(broken.certification, "BROKEN");
  const supplier = snap.departments.find((d: any) => d.id === "supplier");
  assert.ok(supplier.health_score_base <= 39); // P0 + BROKEN
  assert.equal(snap.alerts.some((a: any) => a.code === "BROKEN_EVIDENCE"), true);
  assert.equal(snap.alerts.length, snap.owner_actions.length); // 1:1
});

test("determinism: buildSnapshot ×2 is byte-identical", () => {
  const a = JSON.stringify(buildSnapshot(FIXTURE, present));
  const b = JSON.stringify(buildSnapshot(FIXTURE, present));
  assert.equal(a, b);
  assert.ok(!a.includes("generated_at") && !a.includes("1970-01-01") && !a.includes("git_sha"), "no wall-clock/git baked");
});

test("AJV + Zod: fixture snapshot validates against both contracts (zero drift)", () => {
  const snap = buildSnapshot(FIXTURE, present);
  const ok = validate(snap);
  assert.ok(ok, "AJV: " + JSON.stringify(validate.errors));
  CommandCenterSnapshotSchema.parse(snap); // throws on drift
});

test("AJV self-test: invalid snapshots are rejected", () => {
  const good = buildSnapshot(FIXTURE, present);
  // missing required `summary`
  const { summary, ...noSummary } = good;
  assert.equal(validate(noSummary), false, "should reject missing summary");
  // bad certification enum on a department
  const badEnum = JSON.parse(JSON.stringify(good));
  badEnum.departments[0].certification = "RUNNING";
  assert.equal(validate(badEnum), false, "should reject bad certification enum");
  // wall-clock leak (additionalProperties:false at root)
  const leak = JSON.parse(JSON.stringify(good));
  leak.generated_at = "2026-06-04T00:00:00.000Z";
  assert.equal(validate(leak), false, "should reject baked generated_at");
});

// ── skills.registry resolution (audit 2026-06-11 — fix du drop silencieux) ──
const SKILLS_REG = { skills: [{ name: "skill-cap", path: "present/b" }] };

test("resolution: a departments[].capabilities slug missing from declared_capabilities resolves via skills.registry (same declared shape → CERTIFIED)", () => {
  const canon = JSON.parse(JSON.stringify(FIXTURE));
  canon.departments[1].capabilities = ["partial-cap", "skill-cap"]; // seo
  const snap = buildSnapshot(canon, present, SKILLS_REG);
  const cap = snap.capabilities.find((c: any) => c.id === "skill-cap");
  assert.ok(cap, "synthesized capability present");
  assert.equal(cap.owner, "seo");
  assert.equal(cap.type, "skill");
  assert.equal(cap.certification, "CERTIFIED"); // live + verified path (LOCKED ladder)
  const seo = snap.departments.find((d: any) => d.id === "seo");
  assert.ok(seo.capabilities.includes("skill-cap"));
  assert.equal(snap.summary.capabilities_total, 5);
  assert.equal(snap.alerts.some((a: any) => a.code === "DROPPED_CAPABILITY"), false);
  assert.ok(validate(snap), "AJV: " + JSON.stringify(validate.errors));
  CommandCenterSnapshotSchema.parse(snap);
});

test("resolution: a registry path MISSING on disk becomes BROKEN (pessimism, never silent green)", () => {
  const canon = JSON.parse(JSON.stringify(FIXTURE));
  canon.departments[1].capabilities = ["partial-cap", "ghost-skill"];
  const snap = buildSnapshot(canon, present, { skills: [{ name: "ghost-skill", path: "missing/skill" }] });
  const cap = snap.capabilities.find((c: any) => c.id === "ghost-skill");
  assert.equal(cap.certification, "BROKEN");
  assert.equal(snap.alerts.some((a: any) => a.code === "BROKEN_EVIDENCE" && a.target_id === "ghost-skill"), true);
});

test("drop: an unresolvable slug raises DROPPED_CAPABILITY (error) — never a silent drop", () => {
  const canon = JSON.parse(JSON.stringify(FIXTURE));
  canon.departments[2].capabilities = ["unknown-cap", "nowhere-cap"]; // support
  const snap = buildSnapshot(canon, present, SKILLS_REG);
  const alert = snap.alerts.find((a: any) => a.code === "DROPPED_CAPABILITY");
  assert.ok(alert, "DROPPED_CAPABILITY alert emitted");
  assert.equal(alert.severity, "error");
  assert.equal(alert.target_id, "support:nowhere-cap");
  assert.ok(snap.owner_actions.some((o: any) => o.from_alert === "DROPPED_CAPABILITY" && o.target_id === "support:nowhere-cap"));
  assert.equal(snap.capabilities.some((c: any) => c.id === "nowhere-cap"), false);
  // Zod accepte le nouveau code ; l'enum du schéma AJV canon (.spec/00-canon, owner-only)
  // a son diff préparé dans audit/cc-wiring-owner-actions-2026-06-11.md.
  CommandCenterSnapshotSchema.parse(snap);
});

test("back-compat: buildSnapshot without a skills registry behaves like before (no synth, no crash)", () => {
  const snap = buildSnapshot(FIXTURE, present);
  assert.equal(snap.summary.capabilities_total, 4);
});

test("integration: the committed snapshot satisfies AJV + Zod", () => {
  const file = path.join(ROOT, "audit/registry/command-center-snapshot.json");
  if (!fs.existsSync(file)) return; // generated artifact may be absent in a fresh checkout
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.ok(validate(data), "AJV: " + JSON.stringify(validate.errors));
  CommandCenterSnapshotSchema.parse(data);
});

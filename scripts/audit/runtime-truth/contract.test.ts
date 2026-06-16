import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateResult,
  healthFromFindings,
  type RuntimeTruthResult,
  type RuntimeTruthFinding,
} from "./contract.ts";

const good: RuntimeTruthResult = {
  check_name: "pg-stable-write",
  generated_at: "2026-06-14T20:00:00.000Z",
  source_commit: "abc1234",
  coverage_status: "RECURRING",
  health_status: "PASS",
  findings: [],
  freshness: "live",
  evidence: { scanned: 275, violating: 0 },
};

test("validateResult: accepts a well-formed result", () => {
  const v = validateResult(good);
  assert.ok(v.ok);
});

test("validateResult: rejects missing field", () => {
  const { check_name: _omit, ...bad } = good;
  const v = validateResult(bad);
  assert.equal(v.ok, false);
  if (!v.ok) assert.ok(v.errors.some((e) => e.startsWith("check_name")));
});

test("validateResult: rejects unknown enum + extra key (strict)", () => {
  assert.equal(validateResult({ ...good, health_status: "GREEN" }).ok, false);
  assert.equal(validateResult({ ...good, surprise: 1 }).ok, false);
});

test("healthFromFindings: severity → health mapping", () => {
  const f = (severity: RuntimeTruthFinding["severity"]): RuntimeTruthFinding => ({
    id: "x",
    severity,
    title: "t",
    detail: {},
  });
  assert.equal(healthFromFindings([]), "PASS");
  assert.equal(healthFromFindings([f("low")]), "WARN");
  assert.equal(healthFromFindings([f("medium")]), "WARN");
  assert.equal(healthFromFindings([f("high")]), "FAIL");
  assert.equal(healthFromFindings([f("critical"), f("low")]), "FAIL");
});

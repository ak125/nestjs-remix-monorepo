// =============================================================================
// Tests for pr-dod-gate.mjs — pure evaluateDoD() logic.
// Run: node --test scripts/ci/pr-dod-gate.test.mjs
// =============================================================================
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { evaluateDoD, DOD_IDS } from "./pr-dod-gate.mjs";

function fullBody({ na7 = true } = {}) {
  return [
    "## Definition of Done — auto-évaluation",
    "- [x] **DoD1** Tests verts",
    "- [x] **DoD2** Ownership",
    "- [x] **DoD3** Rollback: revert PR",
    "- [x] **DoD4** Observabilité",
    "- [x] **DoD5** Drift zéro",
    "- [x] **DoD6** Docs",
    na7 ? "- [ ] **DoD7** Monitoring : N/A ce PR" : "- [x] **DoD7** Monitoring",
    "- [x] **DoD8** No TODO",
    "- [x] **DoD9** No silent skip",
  ].join("\n");
}

describe("evaluateDoD — checklist mode", () => {
  test("passes when all 9 checked or N/A", () => {
    const r = evaluateDoD(fullBody(), [], 0);
    assert.equal(r.mode, "checklist");
    assert.equal(r.pass, true);
  });

  test("N/A line counts as satisfied", () => {
    const r = evaluateDoD(fullBody({ na7: true }), [], 0);
    assert.equal(r.pass, true);
  });

  test("fails when a DoD line is missing", () => {
    const body = fullBody().split("\n").filter((l) => !l.includes("DoD5")).join("\n");
    const r = evaluateDoD(body, [], 0);
    assert.equal(r.pass, false);
    assert.ok(r.reasons.some((x) => x.includes("DoD5: missing")));
  });

  test("fails when a DoD line is unchecked and not N/A", () => {
    const body = fullBody({ na7: false }).replace(
      "- [x] **DoD3** Rollback: revert PR",
      "- [ ] **DoD3** Rollback",
    );
    const r = evaluateDoD(body, [], 0);
    assert.equal(r.pass, false);
    assert.ok(r.reasons.some((x) => x.includes("DoD3: present but unchecked")));
  });

  test("empty body fails with all 9 missing", () => {
    const r = evaluateDoD("", [], 0);
    assert.equal(r.pass, false);
    assert.equal(r.reasons.length, DOD_IDS.length);
  });

  test("DoD1 word boundary does not match DoD10-style noise", () => {
    // A line mentioning 'DoD10' must NOT satisfy DoD1.
    const body = fullBody().replace("- [x] **DoD1** Tests verts", "- [x] DoD10 unrelated");
    const r = evaluateDoD(body, [], 0);
    assert.equal(r.pass, false);
    assert.ok(r.reasons.some((x) => x.includes("DoD1: missing")));
  });
});

describe("evaluateDoD — escape hatch", () => {
  test("skip-justified passes with >= 2 approvals (ignores checklist)", () => {
    const r = evaluateDoD("no checklist here", ["dod-skip-justified"], 2);
    assert.equal(r.mode, "skip-justified");
    assert.equal(r.pass, true);
  });

  test("skip label fails with < 2 approvals", () => {
    const r = evaluateDoD("no checklist", ["dod-skip-justified"], 1);
    assert.equal(r.mode, "skip-needs-approvals");
    assert.equal(r.pass, false);
  });

  test("skip label with 0 approvals fails", () => {
    const r = evaluateDoD("", ["dod-skip-justified"], 0);
    assert.equal(r.pass, false);
  });
});

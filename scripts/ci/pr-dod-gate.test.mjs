// =============================================================================
// Tests for pr-dod-gate.mjs — pure evaluateDoD() logic.
// Run: node --test scripts/ci/pr-dod-gate.test.mjs
// =============================================================================
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  evaluateDoD,
  DOD_IDS,
  parseAdvisoryItems,
  readAssignees,
} from "./pr-dod-gate.mjs";

// GitHub state that satisfies DoD2 (assignee + 1 human approval).
const OWNED = { assignees: ["owner"] };

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
    const r = evaluateDoD(fullBody(), [], 1, OWNED);
    assert.equal(r.mode, "checklist");
    assert.equal(r.pass, true);
  });

  test("N/A line counts as satisfied", () => {
    const r = evaluateDoD(fullBody({ na7: true }), [], 1, OWNED);
    assert.equal(r.pass, true);
  });

  test("fails when a DoD line is missing", () => {
    const body = fullBody().split("\n").filter((l) => !l.includes("DoD5")).join("\n");
    const r = evaluateDoD(body, [], 1, OWNED);
    assert.equal(r.pass, false);
    assert.ok(r.reasons.some((x) => x.includes("DoD5: missing")));
  });

  test("fails when a DoD line is unchecked and not N/A", () => {
    const body = fullBody({ na7: false }).replace(
      "- [x] **DoD3** Rollback: revert PR",
      "- [ ] **DoD3** Rollback",
    );
    const r = evaluateDoD(body, [], 1, OWNED);
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
    const r = evaluateDoD(body, [], 1, OWNED);
    assert.equal(r.pass, false);
    assert.ok(r.reasons.some((x) => x.includes("DoD1: missing")));
  });
});

describe("evaluateDoD — checklist lines only", () => {
  test("accepts the vault template format and other list markers", () => {
    const body = fullBody()
      .replace("- [x] **DoD1** Tests verts", "- [x] DoD1 — Tests verts: CI green")
      .replace("- [x] **DoD8** No TODO", "* [X] DoD8 — No TODO unresolved: 0");
    assert.equal(evaluateDoD(body, [], 1, OWNED).pass, true);
  });

  test("a prose mention before the checklist line does not shadow it", () => {
    const body = "Surveillance : voir DoD7 plus bas.\n" + fullBody({ na7: false });
    assert.equal(evaluateDoD(body, [], 1, OWNED).pass, true);
  });

  test("a list item without a box counts only through N/A", () => {
    const na = fullBody().replace("- [x] **DoD4** Observabilité", "- DoD4 — N/A : aucun code runtime");
    assert.equal(evaluateDoD(na, [], 1, OWNED).pass, true);
    const bare = fullBody().replace("- [x] **DoD4** Observabilité", "- DoD4 — logger ajouté");
    const r = evaluateDoD(bare, [], 1, OWNED);
    assert.ok(r.reasons.some((x) => x.includes("DoD4: present but unchecked")));
  });

  test("the vault template pasted unchanged satisfies nothing", () => {
    const template = [
      "- [ ] DoD1 — Tests verts: CI green, no flaky, no .only/.skip added",
      "- [ ] DoD2 — Ownership: assignee + ≥1 human approval",
      "- [ ] DoD3 — Rollback: <plan link>, reversibility=<instant/staged/forward-only>",
      "- [ ] DoD4 — Observabilité: <log/metric/event log added or N/A>",
      "- [ ] DoD5 — Drift zéro: registry-fresh green, migrations atomic",
      '- [ ] DoD6 — Docs: <files updated or "no doc needed">',
      "- [ ] DoD7 — Monitoring: watcher=@<user>, window=T+<duration>, abort=<criteria>",
      "- [ ] DoD8 — No TODO unresolved: <count, all linked>",
      "- [ ] DoD9 — No silent skip: confirmed",
    ].join("\n");
    const r = evaluateDoD(template, [], 0, { assignees: [] });
    assert.deepEqual(r.reasons.map((x) => x.slice(0, 4)), DOD_IDS);
  });

  test("an N/A after a placeholder counts, one split by a placeholder does not", () => {
    const after = fullBody().replace("- [x] **DoD4** Observabilité", "- [ ] **DoD4** Observabilité: <détail> N/A");
    assert.equal(evaluateDoD(after, [], 1, OWNED).pass, true);
    const split = fullBody().replace("- [x] **DoD4** Observabilité", "- [ ] **DoD4** Observabilité: N/<x>A");
    const r = evaluateDoD(split, [], 1, OWNED);
    assert.ok(r.reasons.some((x) => x.startsWith("DoD4: present but unchecked")));
  });

  test("a prose N/A is not a checklist line", () => {
    const body = fullBody()
      .split("\n")
      .filter((l) => !l.includes("**DoD4**"))
      .concat("DoD4 N/A, rien de runtime.")
      .join("\n");
    const r = evaluateDoD(body, [], 1, OWNED);
    assert.equal(r.pass, false);
    assert.ok(r.reasons.some((x) => x.includes("DoD4: missing")));
  });
});

describe("evaluateDoD — DoD2 is GitHub state", () => {
  test("a ticked DoD2 box without assignee nor approval fails", () => {
    const r = evaluateDoD(fullBody(), [], 0, { assignees: [] });
    assert.equal(r.pass, false);
    const dod2 = r.reasons.find((x) => x.startsWith("DoD2:"));
    assert.ok(dod2.includes("no assignee"));
    assert.ok(dod2.includes("0 human approval(s)"));
    assert.ok(dod2.includes("box ticked without that GitHub state"));
  });

  test("an assignee without approval fails", () => {
    const r = evaluateDoD(fullBody(), [], 0, OWNED);
    assert.deepEqual(r.reasons.map((x) => x.slice(0, 5)), ["DoD2:"]);
  });

  test("unknown assignees fail instead of passing", () => {
    const r = evaluateDoD(fullBody(), [], 1);
    assert.ok(r.reasons.some((x) => x.includes("assignees unknown")));
  });

  test("N/A does not exempt DoD2", () => {
    const body = fullBody().replace("- [x] **DoD2** Ownership", "- [ ] **DoD2** Ownership : N/A");
    assert.equal(evaluateDoD(body, [], 0, { assignees: [] }).pass, false);
  });
});

describe("DOD_ADVISORY_ITEMS — phased rollout", () => {
  test("an advisory item is reported but does not block", () => {
    const r = evaluateDoD(fullBody(), [], 0, { assignees: [], advisoryItems: ["DoD2"] });
    assert.equal(r.pass, true);
    assert.equal(r.advisory.length, 1);
    assert.ok(r.advisory[0].startsWith("DoD2:"));
  });

  test("non-advisory items still block", () => {
    const body = fullBody().replace("- [x] **DoD3** Rollback: revert PR", "- [ ] **DoD3** Rollback");
    const r = evaluateDoD(body, [], 0, { assignees: [], advisoryItems: ["DoD2"] });
    assert.equal(r.pass, false);
    assert.deepEqual(r.reasons.map((x) => x.slice(0, 5)), ["DoD3:"]);
  });

  test("unset means every item blocks; unknown ids are rejected", () => {
    assert.deepEqual(parseAdvisoryItems(undefined), []);
    assert.deepEqual(parseAdvisoryItems(" DoD2 , DoD7 "), ["DoD2", "DoD7"]);
    assert.throws(() => parseAdvisoryItems("DoD2,DoD10"), /unknown id\(s\) DoD10/);
  });
});

describe("readAssignees", () => {
  test("reads logins from the event payload, undefined otherwise", () => {
    const dir = mkdtempSync(join(tmpdir(), "dod-gate-"));
    const event = join(dir, "event.json");
    writeFileSync(event, JSON.stringify({ pull_request: { assignees: [{ login: "a" }] } }));
    assert.deepEqual(readAssignees(event), ["a"]);
    writeFileSync(event, JSON.stringify({ pull_request: {} }));
    assert.equal(readAssignees(event), undefined);
    assert.equal(readAssignees(join(dir, "absent.json")), undefined);
    assert.equal(readAssignees(undefined), undefined);
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

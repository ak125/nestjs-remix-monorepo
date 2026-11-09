// =============================================================================
// Tests for pr-dod-gate.mjs — pure evaluateDoD() logic.
// Run: node --test scripts/ci/pr-dod-gate.test.mjs
// =============================================================================
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CANON_SYNC_BRANCH,
  evaluateDoD,
  DOD_IDS,
  headBindingRefusal,
  parseAdvisoryItems,
  readAssignees,
  readAuthor,
  readHead,
} from "./pr-dod-gate.mjs";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "pr-dod-gate.mjs");
const HEAD_A = "a".repeat(40);
const HEAD_B = "b".repeat(40);

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

  test("an unboxed bullet citing an id does not shadow its boxed line", () => {
    const body = ["Constat :", "  - DoD5 non coché ;", "  - DoD7 sans surveillant ;", "", fullBody()].join("\n");
    assert.equal(evaluateDoD(body, [], 1, OWNED).pass, true);
  });

  test("boxed lines that disagree fail instead of picking one", () => {
    const body = fullBody().concat("\n- [ ] **DoD5** Drift zéro");
    const r = evaluateDoD(body, [], 1, OWNED);
    assert.equal(r.pass, false);
    assert.ok(r.reasons.some((x) => x.startsWith("DoD5: 2 checklist lines disagree")));
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

describe("readAuthor", () => {
  test("reads the PR author login from the event payload, undefined otherwise", () => {
    const dir = mkdtempSync(join(tmpdir(), "dod-gate-"));
    const event = join(dir, "event.json");
    writeFileSync(event, JSON.stringify({ pull_request: { user: { login: "dependabot[bot]" } } }));
    assert.equal(readAuthor(event), "dependabot[bot]");
    writeFileSync(event, JSON.stringify({ pull_request: {} }));
    assert.equal(readAuthor(event), undefined);
    assert.equal(readAuthor(join(dir, "absent.json")), undefined);
    assert.equal(readAuthor(undefined), undefined);
  });
});

describe("evaluateDoD — Dependabot", () => {
  test("a Dependabot PR passes without a checklist", () => {
    const r = evaluateDoD("Bumps nodemailer from 8.0.11 to 10.1.7.", [], 0, { author: "dependabot[bot]" });
    assert.equal(r.mode, "dependabot");
    assert.equal(r.pass, true);
  });

  test("only the exact bot login is exempt", () => {
    for (const author of ["dependabot", "ak125", undefined]) {
      const r = evaluateDoD("Bumps nodemailer.", [], 0, { author });
      assert.equal(r.mode, "checklist", String(author));
      assert.equal(r.pass, false, String(author));
    }
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

describe("readHead", () => {
  test("reads sha and ref from the event payload, undefined otherwise", () => {
    const dir = mkdtempSync(join(tmpdir(), "dod-gate-"));
    const event = join(dir, "event.json");
    writeFileSync(event, JSON.stringify({ pull_request: { head: { sha: HEAD_A, ref: "x" } } }));
    assert.deepEqual(readHead(event), { sha: HEAD_A, ref: "x" });
    for (const pull_request of [{}, { head: { sha: HEAD_A } }, { head: { ref: "x" } }, { head: { sha: 1, ref: "x" } }]) {
      writeFileSync(event, JSON.stringify({ pull_request }));
      assert.equal(readHead(event), undefined);
    }
    assert.equal(readHead(join(dir, "absent.json")), undefined);
    assert.equal(readHead(undefined), undefined);
  });
});

describe("evaluateDoD — head binding", () => {
  const OTHER_BRANCH = { sha: HEAD_B, ref: "feature/x" };
  const CANON = { sha: HEAD_B, ref: CANON_SYNC_BRANCH };
  const bound = (sha) => `DoD-Head: ${sha}\n${fullBody()}`;
  const evaluate = (body, head, extra = {}) => evaluateDoD(body, [], 1, { ...OWNED, head, ...extra });

  test("a PR that declares nothing outside canon-sync is not concerned", () => {
    assert.equal(evaluate(fullBody(), OTHER_BRANCH).pass, true);
    assert.equal(evaluate(fullBody(), undefined).pass, true);
  });

  test("the format cited in prose or in a code block declares nothing", () => {
    for (const note of [
      "Le contrat exige `DoD-Head: <sha40>` sur sa ligne.",
      `\`\`\`\nDoD-Head: ${HEAD_A}\n\`\`\``,
      `<!-- DoD-Head: ${HEAD_A} -->`,
      `> DoD-Head: ${HEAD_A}`,
    ]) {
      assert.equal(evaluate(`${note}\n${fullBody()}`, OTHER_BRANCH).pass, true, note);
    }
  });

  test("a declared binding to the head passes, on any branch", () => {
    assert.equal(evaluate(bound(HEAD_B), OTHER_BRANCH).pass, true);
    assert.equal(evaluate(bound(HEAD_B), CANON).pass, true);
  });

  for (const [name, body] of [
    ["a stale binding", bound(HEAD_A)],
    ["a malformed binding", `DoD-Head: ${HEAD_B.slice(0, 12)}\n${fullBody()}`],
    ["a trailing word", `DoD-Head: ${HEAD_B} ok\n${fullBody()}`],
    ["two bindings, one right", `DoD-Head: ${HEAD_A}\nDoD-Head: ${HEAD_B}\n${fullBody()}`],
  ]) {
    test(`${name} is refused outside canon-sync too`, () => {
      const r = evaluate(body, OTHER_BRANCH);
      assert.equal(r.pass, false);
      assert.equal(r.mode, "head-binding");
      assert.match(r.reasons[0], new RegExp(`naming its head ${HEAD_B}`));
    });
  }

  test("a canon-sync PR needs the binding as soon as it certifies something", () => {
    assert.equal(evaluate(fullBody(), CANON).mode, "head-binding");
    const nothingTicked = fullBody().replace(/\[x\]/g, "[ ]").replace(" : N/A ce PR", "");
    assert.equal(evaluate(nothingTicked, CANON).mode, "checklist");
  });

  test("a stale binding cannot hide behind an advisory item", () => {
    const r = evaluateDoD(bound(HEAD_A), [], 0, { assignees: [], head: OTHER_BRANCH, advisoryItems: [...DOD_IDS] });
    assert.deepEqual([r.pass, r.mode], [false, "head-binding"]);
  });

  test("a stale binding cannot hide behind the skip label", () => {
    const r = evaluateDoD(bound(HEAD_A), ["dod-skip-justified"], 2, { head: OTHER_BRANCH });
    assert.deepEqual([r.pass, r.mode], [false, "head-binding"]);
  });

  test("a stale binding cannot hide behind the Dependabot exemption", () => {
    const r = evaluateDoD(bound(HEAD_A), [], 0, { author: "dependabot[bot]", head: OTHER_BRANCH });
    assert.deepEqual([r.pass, r.mode], [false, "head-binding"]);
  });

  test("the skip label and Dependabot keep working without a binding", () => {
    assert.equal(evaluateDoD("x", ["dod-skip-justified"], 2, { head: OTHER_BRANCH }).mode, "skip-justified");
    assert.equal(evaluateDoD("x", [], 0, { author: "dependabot[bot]", head: OTHER_BRANCH }).mode, "dependabot");
  });

  test("a declared binding with an unknown head fails closed", () => {
    assert.match(headBindingRefusal(`DoD-Head: ${HEAD_A}`, undefined), /head is unknown/);
    assert.match(headBindingRefusal(`DoD-Head: ${HEAD_A}`, { ref: "x" }), /head is unknown/);
  });

  test("line ends of the web editor do not break a binding", () => {
    assert.equal(headBindingRefusal(`note\r\nDoD-Head: ${HEAD_B}\r\nmore`, OTHER_BRANCH), null);
    assert.equal(headBindingRefusal(`note\u2028DoD-Head: ${HEAD_B}`, OTHER_BRANCH), null);
  });

  test("visibility follows the order of the whole body", () => {
    const open = `\`\`\`\nDoD-Head: ${HEAD_B}`;
    assert.equal(headBindingRefusal(`${open}\n\`\`\`\n${fullBody()}`, CANON) !== null, true);
    assert.equal(headBindingRefusal(`\`\`\`\nlog\n\`\`\`\nDoD-Head: ${HEAD_B}`, CANON), null);
  });

  test("a backtick in the info string means the line opens no fence", () => {
    assert.equal(headBindingRefusal(`\`\`\` a\`b\nDoD-Head: ${HEAD_B}`, OTHER_BRANCH), null);
    assert.notEqual(headBindingRefusal(`\`\`\` a\`b\n\`\`\`\nDoD-Head: ${HEAD_B}\n\`\`\`\n${fullBody()}`, CANON), null);
    assert.equal(headBindingRefusal(`~~~ a\`b\nDoD-Head: ${HEAD_A}\n~~~`, OTHER_BRANCH), null);
  });

  test("a binding collapsed under <details> is not a visible binding", () => {
    assert.notEqual(headBindingRefusal(`<details>\nDoD-Head: ${HEAD_B}\n</details>\n${fullBody()}`, CANON), null);
    assert.notEqual(headBindingRefusal(`<DETAILS open>\nDoD-Head: ${HEAD_B}\n${fullBody()}`, CANON), null);
    assert.equal(headBindingRefusal(`<details>x</details>\nDoD-Head: ${HEAD_B}\n${fullBody()}`, CANON), null);
  });

  test("a fence opened in the generated zone still hides the binding after it", () => {
    const zone = "<!-- canon-sync:generated:start -->\n```\nlog\n<!-- canon-sync:generated:end -->";
    assert.notEqual(headBindingRefusal(`${zone}\nDoD-Head: ${HEAD_B}\n${fullBody()}`, CANON), null);
  });

  for (const [name, shown] of [
    ["an unclosed comment in a code block", "```\n<!-- not a comment\n```"],
    ["an unclosed <details> in a code block", "~~~\n<details>\n~~~"],
    ["a comment marker in a fence info string", "``` <!--\nlog\n```"],
    ["a comment marker in inline code", "Le marqueur `<!--` reste du texte."],
    ["a <details> in inline code", "La balise `<details>` reste du texte."],
    ["a marker in a longer code span", "Exemple : `` a ` <!-- b ``."],
    ["a marker after a closed code span", "`x` puis `<details>`"],
  ]) {
    test(`${name} hides nothing after it`, () => {
      assert.match(headBindingRefusal(`${shown}\nDoD-Head: ${HEAD_A}\n${fullBody()}`, OTHER_BRANCH), /naming its head/, "stale");
      assert.equal(headBindingRefusal(`${shown}\nDoD-Head: ${HEAD_B}\n${fullBody()}`, CANON), null, "valid");
    });
  }

  test("a real comment or block still hides what follows, past a stray backtick", () => {
    assert.equal(headBindingRefusal(`Un seul \` puis <!-- caché\nDoD-Head: ${HEAD_A}`, OTHER_BRANCH), null);
    assert.equal(headBindingRefusal(`\`x\` puis <details>\nDoD-Head: ${HEAD_A}`, OTHER_BRANCH), null);
  });

  test("a fence inside a comment opens nothing", () => {
    assert.match(headBindingRefusal(`<!--\n\`\`\`\n-->\nDoD-Head: ${HEAD_A}`, OTHER_BRANCH), /naming its head/);
  });

  test("a fence right after a hidden block still opens", () => {
    assert.notEqual(headBindingRefusal(`<!-- c -->\`\`\`\nDoD-Head: ${HEAD_B}\n\`\`\`\n${fullBody()}`, CANON), null);
  });

  test("text around a hidden block stays on its line, and a closer ends the block", () => {
    assert.match(headBindingRefusal(`<!-- a -->DoD-Head: ${HEAD_A}`, OTHER_BRANCH), /naming its head/);
    assert.match(headBindingRefusal(`DoD-Head: ${HEAD_A}<!-- a -->`, OTHER_BRANCH), /naming its head/);
    assert.match(headBindingRefusal(`<!-- a\nb --> DoD\nDoD-Head: ${HEAD_A}`, OTHER_BRANCH), /naming its head/);
    assert.match(headBindingRefusal(`<details>\n</DETAILS>\nDoD-Head: ${HEAD_A}`, OTHER_BRANCH), /naming its head/);
    assert.match(headBindingRefusal(`<!-- a --> x <!-- b -->\nDoD-Head: ${HEAD_A}`, OTHER_BRANCH), /naming its head/);
    assert.equal(headBindingRefusal(`<!-- a --><!-- b\nDoD-Head: ${HEAD_A}`, OTHER_BRANCH), null);
  });
});

describe("command line — the event payload decides the head", () => {
  const ticked = (sha) => `DoD-Head: ${sha}\n${fullBody()}`;
  const event = (sha, ref, action = "synchronize") => ({
    action,
    pull_request: { head: { sha, ref }, assignees: [{ login: "ak125" }], user: { login: "ak125" } },
  });

  function gate(t, payload, env) {
    const dir = mkdtempSync(join(tmpdir(), "dod-gate-cli-"));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    const eventPath = join(dir, "event.json");
    if (payload !== null) writeFileSync(eventPath, typeof payload === "string" ? payload : JSON.stringify(payload));
    const run = spawnSync(process.execPath, [SCRIPT], {
      cwd: dir,
      encoding: "utf8",
      env: { PATH: process.env.PATH, GITHUB_EVENT_PATH: eventPath, PR_APPROVALS: "1", DOD_ADVISORY_ITEMS: "DoD2", ...env },
    });
    const reportPath = join(dir, "dod-gate-report.md");
    return { status: run.status, stderr: run.stderr, report: existsSync(reportPath) ? readFileSync(reportPath, "utf8") : null };
  }

  test("an external push on the automatic branch leaves the old certification refused", (t) => {
    const { status, stderr, report } = gate(t, event(HEAD_B, CANON_SYNC_BRANCH), { PR_BODY: ticked(HEAD_A) });
    assert.equal(status, 1);
    assert.match(stderr, /mode=head-binding pass=false/);
    assert.match(report, new RegExp(`naming its head ${HEAD_B}`));
    assert.match(report, /review this head/);
    assert.doesNotMatch(report, /dod-skip-justified/);
  });

  test("a body update that failed after the push is refused on the next event", (t) => {
    const { status } = gate(t, event(HEAD_B, CANON_SYNC_BRANCH, "edited"), { PR_BODY: fullBody() });
    assert.equal(status, 1);
  });

  test("an approval re-evaluates against the head of its own payload", (t) => {
    const review = { action: "submitted", ...event(HEAD_B, "feature/x") };
    assert.equal(gate(t, review, { PR_BODY: ticked(HEAD_A) }).status, 1);
    assert.equal(gate(t, review, { PR_BODY: ticked(HEAD_B) }).status, 0);
  });

  test("a binding renewed for the new head passes", (t) => {
    assert.equal(gate(t, event(HEAD_B, CANON_SYNC_BRANCH), { PR_BODY: ticked(HEAD_B) }).status, 0);
  });

  test("an unrelated PR passes as before", (t) => {
    assert.equal(gate(t, event(HEAD_B, "feature/x"), { PR_BODY: fullBody() }).status, 0);
  });

  for (const [name, payload] of [
    ["a missing event file", null],
    ["an unreadable event file", "{not json"],
    ["an event without a pull request", { action: "synchronize" }],
    ["an event without a head", { pull_request: { assignees: [] } }],
    ["a head that is not an object", { pull_request: { head: HEAD_B } }],
    ["a head without its sha", { pull_request: { head: { ref: CANON_SYNC_BRANCH } } }],
    ["a head without its branch", { pull_request: { head: { sha: HEAD_B } } }],
    ["a head with an empty branch", { pull_request: { head: { sha: HEAD_B, ref: "" } } }],
    ["a head with an empty sha", { pull_request: { head: { sha: "", ref: CANON_SYNC_BRANCH } } }],
    ["a head with a short sha", { pull_request: { head: { sha: HEAD_B.slice(0, 12), ref: "feature/x" } } }],
    ["a head with an upper-case sha", { pull_request: { head: { sha: HEAD_B.toUpperCase(), ref: "feature/x" } } }],
  ]) {
    test(`${name} fails closed with a report for the comment step`, (t) => {
      // An old certification with no binding, under the advisory DoD2 of the real workflow:
      // losing the identity of the PR must not make it pass as if it were another branch.
      const { status, stderr, report } = gate(t, payload, { PR_BODY: fullBody() });
      assert.equal(status, 1);
      assert.match(report, /FAIL/);
      assert.match(report, /head cannot be read/);
      assert.doesNotMatch(report, /PASS/);
      assert.doesNotMatch(stderr, /pass=true/);
    });
  }

  test("an unset event path fails closed like an unreadable one", (t) => {
    const { status, report } = gate(t, null, { PR_BODY: fullBody(), GITHUB_EVENT_PATH: undefined });
    assert.equal(status, 1);
    assert.match(report, /head cannot be read/);
  });

  test("the same body passes once the payload names an ordinary branch", (t) => {
    assert.equal(gate(t, event(HEAD_B, "feature/x"), { PR_BODY: fullBody() }).status, 0);
    assert.equal(gate(t, event(HEAD_B, CANON_SYNC_BRANCH), { PR_BODY: fullBody() }).status, 1);
  });

  test("pure calls without a head keep their previous result", () => {
    assert.equal(evaluateDoD(fullBody(), [], 1, { assignees: ["a"] }).pass, true);
  });
});

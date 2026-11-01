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
  evaluateReviewRecord,
  parseReviewRecords,
  DOD_IDS,
  DOD2_ON_PROOF,
  parseAdvisoryItems,
  readAssignees,
  readAuthor,
  readPullRequestRef,
  readReviewContext,
} from "./pr-dod-gate.mjs";

const HEAD = "4d473f6a2a80c4eaa3843974a179a9dece4b94f0";
const OLD_HEAD = "0fbf05e8bdaa36c2f1c0b8f7c2b4e1d9a3f6e5c7";
const BASE = "6ab7854c2adf15e3e588f8a73e4f9085ecaeee5d";
const PR = { headSha: HEAD, number: 7, repo: "o/r", mergeBase: BASE, files: ["docs/x.md"], comments: [], reviews: [] };
// State that satisfies DoD2 (ADR-120): an assignee and a record on the head.
const OWNED = { assignees: ["owner"], pr: PR };

function record({ level = "A", head = HEAD, base = BASE, procedure = "auto-review, par la session auteure", limites = "aucune revue indépendante" } = {}) {
  return [
    `  - [x] Revue niveau ${level} — tête ${head}, base ${base}`,
    `        procédure : ${procedure}`,
    "        périmètre : docs/x.md, sans exclusion",
    "        constats : 0 corrigé, 0 réfuté, 0 reporté",
    "        preuves : lint → 0 violation ; reprises : aucune",
    `        limites : ${limites}`,
  ].join("\n");
}

function fullBody({ na7 = true, review = record() } = {}) {
  return [
    "## Definition of Done — auto-évaluation",
    "- [x] **DoD1** Tests verts",
    "- [x] **DoD2** Ownership",
    review,
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
    assert.deepEqual(r.onProof, DOD2_ON_PROOF);
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
      "- [ ] DoD2 — Ownership: assignee + revue niveau <A|B|C> sur la tête <sha40> (enregistrement : <lien>)",
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

describe("evaluateDoD — DoD2 is an ADR-120 review record", () => {
  const dod2 = (r) => r.reasons.concat(r.advisory).find((x) => x.startsWith("DoD2:")) ?? "";

  test("an assignee and a record on the head satisfy DoD2, with no approval", () => {
    const r = evaluateDoD(fullBody(), [], 0, OWNED);
    assert.equal(r.pass, true);
    assert.equal(dod2(r), "");
  });

  test("approvals do not replace the record", () => {
    const r = evaluateDoD(fullBody({ review: "" }), [], 3, OWNED);
    assert.ok(dod2(r).includes("no review record"));
    assert.ok(dod2(r).includes("box ticked without that evidence"));
  });

  test("a record without assignee fails", () => {
    const r = evaluateDoD(fullBody(), [], 1, { assignees: [], pr: PR });
    assert.deepEqual(r.reasons.map((x) => x.slice(0, 5)), ["DoD2:"]);
    assert.ok(dod2(r).includes("no assignee"));
  });

  test("unknown assignees fail instead of passing", () => {
    const r = evaluateDoD(fullBody(), [], 1, { pr: PR });
    assert.ok(r.reasons.some((x) => x.includes("unverified: assignees unknown")));
  });

  test("N/A does not exempt DoD2", () => {
    const body = fullBody({ review: "" }).replace("- [x] **DoD2** Ownership", "- [ ] **DoD2** Ownership : N/A");
    assert.equal(evaluateDoD(body, [], 0, OWNED).pass, false);
  });

  test("unreadable data is reported unverified, never passed", () => {
    const r = evaluateDoD(fullBody(), [], 0, { assignees: ["owner"] });
    assert.equal(r.pass, false);
    for (const part of ["unverified: head SHA unknown", "unverified: merge-base unknown", "unverified: changed files unknown"]) {
      assert.ok(dod2(r).includes(part), part);
    }
  });
});

describe("evaluateReviewRecord — record bound to the head (D2, D4)", () => {
  test("a record naming another head is stale", () => {
    const { problems } = evaluateReviewRecord(record({ head: OLD_HEAD }), PR);
    assert.ok(problems.some((x) => x.startsWith(`no record names the head ${HEAD}`) && x.includes(OLD_HEAD)));
  });

  test("a short SHA does not name the head", () => {
    const { problems } = evaluateReviewRecord(record({ head: HEAD.slice(0, 9) }), PR);
    assert.ok(problems.some((x) => x.startsWith("no record names the head")));
  });

  test("the base must be the merge-base", () => {
    const { problems } = evaluateReviewRecord(record({ base: OLD_HEAD }), PR);
    assert.ok(problems.some((x) => x.includes(`base ${OLD_HEAD} is not the merge-base ${BASE}`)));
  });

  test("every field is required; a placeholder is not a value", () => {
    const body = record({ limites: "<non couvert>" }).split("\n").filter((l) => !l.includes("périmètre")).join("\n");
    const { problems } = evaluateReviewRecord(body, PR);
    assert.ok(problems.some((x) => x.endsWith("field(s) missing or placeholder: périmètre, limites")));
  });

  test("the procedure names who ran it", () => {
    const { problems } = evaluateReviewRecord(record({ procedure: "auto-review" }), PR);
    assert.ok(problems.some((x) => x.includes("procédure does not name who ran it")));
  });

  test("the rule template pasted unchanged is not a record", () => {
    assert.deepEqual(parseReviewRecords("- [x] Revue niveau <A|B|C> — tête <sha40>, base <sha40>"), []);
  });

  test("the DoD2 line points to the record but is not one, and its SHA must be the head", () => {
    const line = `- [x] DoD2 — Ownership: assignee + revue niveau A sur la tête ${OLD_HEAD} (enregistrement : ci-dessous)`;
    assert.deepEqual(parseReviewRecords(line), []);
    const { problems } = evaluateReviewRecord(`${line}\n${record()}`, PR);
    assert.deepEqual(problems, [`the DoD2 line names ${OLD_HEAD}, the head is ${HEAD}`]);
  });

  test("labels in bold and fields as list items are read", () => {
    const body = record().replace("procédure :", "- **Procédure** :").replace("limites :", "- limites :");
    assert.deepEqual(evaluateReviewRecord(body, PR), { problems: [], unverified: [] });
  });
});

describe("evaluateReviewRecord — level (D3)", () => {
  test("level A with code in the diff needs level B", () => {
    const { problems } = evaluateReviewRecord(record(), { ...PR, files: ["docs/x.md", "scripts/ci/x.mjs"] });
    assert.ok(problems.some((x) => x.includes("level A declared but the diff changes code (scripts/ci/x.mjs)")));
  });

  test("level A with files neither prose nor code is left to the evidence", () => {
    const { problems, unverified } = evaluateReviewRecord(record(), { ...PR, files: ["audit/x.json"] });
    assert.deepEqual(problems, []);
    assert.ok(unverified.some((x) => x.includes("neither prose nor code") && x.includes("audit/x.json")));
  });

  test("level B requires an independent review", () => {
    const files = { ...PR, files: ["scripts/ci/x.mjs"] };
    const self = evaluateReviewRecord(record({ level: "B" }), files);
    assert.ok(self.problems.some((x) => x.includes("level B requires an independent review")));
    const independent = evaluateReviewRecord(record({ level: "B", procedure: "revue indépendante, par un sous-agent sans contexte" }), files);
    assert.deepEqual(independent, { problems: [], unverified: [] });
  });

  describe("level C accord", () => {
    const body = record({ level: "C", procedure: "revue indépendante, par un sous-agent" });
    const ctx = { ...PR, author: "app-bot[bot]", files: ["backend/src/modules/payments/x.ts"] };

    test("an approval of the head by another account is an accord", () => {
      const reviews = [{ id: 1, login: "owner", state: "APPROVED", commitId: HEAD, body: "" }];
      assert.deepEqual(evaluateReviewRecord(body, { ...ctx, reviews }), { problems: [], unverified: [] });
    });

    test("a comment naming the head with « accord » by another account is an accord", () => {
      const comments = [{ id: 2, login: "owner", body: `Accord pour la fusion de ${HEAD}.` }];
      assert.deepEqual(evaluateReviewRecord(body, { ...ctx, comments }), { problems: [], unverified: [] });
    });

    test("an approval of an older head, or a dismissed one, is not", () => {
      const older = [{ id: 1, login: "owner", state: "APPROVED", commitId: OLD_HEAD, body: "" }];
      const dismissed = [
        { id: 1, login: "owner", state: "APPROVED", commitId: HEAD, body: "" },
        { id: 3, login: "owner", state: "DISMISSED", commitId: HEAD, body: "" },
      ];
      for (const reviews of [older, dismissed]) {
        const { problems } = evaluateReviewRecord(body, { ...ctx, reviews });
        assert.ok(problems.some((x) => x.includes("level C requires the domain owner's accord")));
      }
    });

    test("an accord typed by the author's account or a bot is not proof", () => {
      const own = { ...ctx, author: "owner", comments: [{ id: 2, login: "owner", body: `accord ${HEAD}` }] };
      assert.ok(evaluateReviewRecord(body, own).unverified.some((x) => x.includes("author's account only")));
      const bot = { ...ctx, comments: [{ id: 2, login: "app-bot[bot]", body: `accord ${HEAD}` }] };
      assert.ok(evaluateReviewRecord(body, bot).problems.some((x) => x.includes("level C requires")));
    });

    test("without reviews or comments the accord is unverified", () => {
      const { unverified } = evaluateReviewRecord(body, { ...ctx, reviews: undefined });
      assert.ok(unverified.some((x) => x.startsWith("level C accord not checked")));
    });
  });
});

describe("evaluateReviewRecord — record in a linked comment", () => {
  const link = "Enregistrement : https://github.com/o/r/pull/7#issuecomment-42";

  test("a record in a comment the body links is read", () => {
    const comments = [{ id: 42, login: "app-bot[bot]", body: record() }];
    assert.deepEqual(evaluateReviewRecord(link, { ...PR, comments }), { problems: [], unverified: [] });
  });

  test("a record in a comment the body does not link is ignored", () => {
    const comments = [{ id: 42, login: "app-bot[bot]", body: record() }];
    const { problems } = evaluateReviewRecord("Pas de lien.", { ...PR, comments });
    assert.ok(problems[0].startsWith("no review record"));
  });

  test("a link to a comment absent from this PR fails, an unreadable one is unverified", () => {
    assert.ok(evaluateReviewRecord(link, PR).problems.includes("linked issuecomment-42 not found on this PR"));
    const { problems, unverified } = evaluateReviewRecord(link, { ...PR, comments: undefined });
    assert.deepEqual(problems, []);
    assert.ok(unverified.includes("linked issuecomment-42 not read (no review context)"));
  });

  test("a comment of another PR is not this PR's record", () => {
    const other = "https://github.com/o/r/pull/8#issuecomment-42";
    const comments = [{ id: 42, login: "x", body: record() }];
    assert.ok(evaluateReviewRecord(other, { ...PR, comments }).problems[0].startsWith("no review record"));
  });
});

describe("DOD_ADVISORY_ITEMS — phased rollout", () => {
  test("an advisory item is reported but does not block", () => {
    const r = evaluateDoD(fullBody({ review: "" }), [], 0, { assignees: [], advisoryItems: ["DoD2"], pr: PR });
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

describe("readPullRequestRef", () => {
  test("reads head SHA, number and repository, undefined otherwise", () => {
    const dir = mkdtempSync(join(tmpdir(), "dod-gate-"));
    const event = join(dir, "event.json");
    writeFileSync(
      event,
      JSON.stringify({ pull_request: { number: 7, head: { sha: HEAD.toUpperCase() }, base: { repo: { full_name: "o/r" } } } }),
    );
    assert.deepEqual(readPullRequestRef(event), { headSha: HEAD, number: 7, repo: "o/r" });
    assert.deepEqual(readPullRequestRef(undefined), { headSha: undefined, number: undefined, repo: undefined });
  });
});

describe("readReviewContext", () => {
  test("keeps well-formed fields, drops the others", () => {
    const dir = mkdtempSync(join(tmpdir(), "dod-gate-"));
    const path = join(dir, "ctx.json");
    writeFileSync(path, JSON.stringify({ mergeBase: BASE, files: ["a.md"], comments: [], reviews: "x" }));
    assert.deepEqual(readReviewContext(path), { mergeBase: BASE, files: ["a.md"], comments: [], reviews: undefined });
    writeFileSync(path, "{not json");
    assert.deepEqual(readReviewContext(path), {});
    assert.deepEqual(readReviewContext(undefined), {});
  });
});

describe("evaluateDoD — Dependabot", () => {
  test("a Dependabot PR passes without a checklist", () => {
    const r = evaluateDoD("Bumps nodemailer from 8.0.11 to 10.1.7.", [], 0, { author: "dependabot[bot]" });
    assert.equal(r.mode, "dependabot");
    assert.equal(r.pass, true);
    assert.deepEqual(r.onProof, []);
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

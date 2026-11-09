#!/usr/bin/env node
// =============================================================================
// PR Definition-of-Done gate — body-based machine check.
// =============================================================================
// Consumed by .github/workflows/pr-dod-gate.yml. Enforces the canonical
// Engineering Definition of Done (vault rule rules-engineering-definition-of-done,
// PR #299) at the PR boundary: a PR must carry the DoD self-evaluation section
// with all 9 invariants (DoD1..DoD9) either checked `[x]` or explicitly marked
// `N/A`.
//
// Escape hatch (Patch 6): label `dod-skip-justified` bypasses the checklist, but
// ONLY with >= 2 human approvals (the audit-trail row in __governance_event_log
// is enforced separately by the workflow / reviewers).
//
// V1 scope (anti-bricolage): self-contained — does NOT read the vault
// planning-worktype.yml to enforce a per-work_type DoD subset (that would couple
// monorepo CI to the vault filesystem). Per-work_type enforcement is a documented
// follow-up. V1 requires all 9 lines present + satisfied.
//
// An item is read from its own list line only (`- [x] DoD3 …`). A sentence that
// merely cites an id ("voir DoD7") is not a box: reading the first mention let
// prose stand in for the checklist, in both directions. Boxed lines are the
// checklist; an unboxed bullet (`- DoD5 non coché`) counts only when the id has
// no boxed line, and lines that disagree fail rather than pick a winner.
//
// DoD2 is a GitHub state, not a self-assessment: the rule requires an assignee
// and >= 1 human approval. A ticked DoD2 box is never evidence on its own.
//
// Dependabot cannot write a self-evaluation, and the escape hatch needs two
// approvals: a blocking gate would hold every dependency bump. Its PRs pass on
// the author login from the event payload; GitHub logins cannot contain
// brackets, so `dependabot[bot]` is never a human account.
//
// Head binding (ADR-120 D4): a line reading exactly `DoD-Head: <40-hex SHA>`,
// alone, unquoted and outside comments, code blocks and <details>, ties the
// certification of the body to one head. Any visible line starting with
// `DoD-Head:` declares such a binding and must name the head of the event:
// neither an advisory item, the skip label nor the Dependabot exemption can hide
// a stale one. The line is required only where it is the contract, on the
// canon-sync branch as soon as the body certifies a DoD item; other PRs that do
// not declare it are not concerned. It proves that its author tied the
// declaration to this head, not that the declaration is true.
//
// Pure `evaluateDoD()` is exported for testing; `main()` reads env + writes the
// PR-comment report and sets the exit code.
//
// Env (set by the workflow):
//   PR_BODY            — full PR description markdown
//   PR_LABELS          — comma-separated label names
//   PR_APPROVALS       — integer count of APPROVED reviews
//   GITHUB_EVENT_PATH  — event payload; `pull_request.assignees` feeds DoD2,
//                        `pull_request.user.login` the Dependabot exemption,
//                        `pull_request.head` the head binding (required)
//   DOD_ADVISORY_ITEMS — optional, comma-separated DoD ids reported but not
//                        blocking (phased rollout). Unset = all 9 block.
// =============================================================================

import { readFileSync, writeFileSync } from "node:fs";

export const DOD_IDS = [
  "DoD1",
  "DoD2",
  "DoD3",
  "DoD4",
  "DoD5",
  "DoD6",
  "DoD7",
  "DoD8",
  "DoD9",
];

const SKIP_LABEL = "dod-skip-justified";
const SKIP_MIN_APPROVALS = 2;
const OWNERSHIP_ID = "DoD2";
const OWNERSHIP_MIN_APPROVALS = 1;
const DEPENDABOT_LOGIN = "dependabot[bot]";

export const CANON_SYNC_BRANCH = "canon-sync/auto";
const LINE_ENDS = /\r\n?|[\u2028\u2029]/g;
const HEAD_BINDING = /^DoD-Head: ([0-9a-f]{40})$/;
const HEAD_SHA = /^[0-9a-f]{40}$/;
const GENERATED_ZONE = /<!-- canon-sync:generated:start -->[\s\S]*?<!-- canon-sync:generated:end -->/g;
// An inline code span on the line, or the opening of a block GitHub does not show.
const SPAN_OR_HIDDEN_BLOCK = /(?<!`)(`+)(?!`).*?(?<!`)\1(?!`)|<!--|<details\b/gi;
// A backtick in the info string means the line opens no backtick fence (CommonMark).
const OPENING_FENCE = /^ {0,3}(?:(`{3,})[^`]*|(~{3,}).*)$/;
const CLOSING_FENCE = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;

// List item whose first token is the id, optionally boxed and bold:
// `- [x] DoD1 — …` (vault template), `- [x] **DoD1** …`, `- DoD4 — N/A : …`.
// `\b` keeps DoD1 != DoD10.
const checklistLine = (id) =>
  new RegExp(
    `^[ \\t]*[-*+][ \\t]+(?:\\[([ xX])\\][ \\t]*)?(?:\\*\\*|__)?${id}\\b.*$`,
    "gm",
  );
const isChecked = (m) => m[1] !== undefined && m[1] !== " ";
// An N/A inside a `<…>` placeholder is template text, not a declaration.
const isNotApplicable = (m) => m[0].split(/<[^>]*>/).some((part) => /\bN\/A\b/i.test(part));

/** Validates DOD_ADVISORY_ITEMS; an unknown id is an error, never ignored. */
export function parseAdvisoryItems(raw) {
  const ids = String(raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const unknown = ids.filter((id) => !DOD_IDS.includes(id));
  if (unknown.length > 0) {
    throw new Error(`DOD_ADVISORY_ITEMS: unknown id(s) ${unknown.join(", ")}`);
  }
  return ids;
}

/** One line without its hidden blocks. `closer` ends the block still open, and an unterminated block runs to the end of the body. */
function withoutHiddenBlocks(line, closer) {
  let shown = "";
  let at = 0;
  for (;;) {
    if (closer) {
      const end = line.toLowerCase().indexOf(closer, at);
      if (end === -1) return { shown, closer };
      at = end + closer.length;
    }
    SPAN_OR_HIDDEN_BLOCK.lastIndex = at;
    let token;
    do token = SPAN_OR_HIDDEN_BLOCK.exec(line);
    while (token?.[1]);
    if (!token) return { shown: shown + line.slice(at), closer: null };
    shown += line.slice(at, token.index);
    at = token.index + token[0].length;
    closer = token[0].startsWith("<!") ? "-->" : "</details>";
  }
}

/** Lines GitHub renders as text, in document order. One pass: a code block shows the hidden-block markers it contains as text. */
function visibleLines(text) {
  const visible = [];
  let fence = null;
  let closer = null;
  for (const line of text.split("\n")) {
    if (fence) {
      const closing = line.match(CLOSING_FENCE);
      if (closing && closing[1][0] === fence[0] && closing[1].length >= fence.length) fence = null;
      continue;
    }
    const fenceOnLine = closer ? null : line.match(OPENING_FENCE);
    if (fenceOnLine) {
      fence = fenceOnLine[1] ?? fenceOnLine[2];
      continue;
    }
    const scanned = withoutHiddenBlocks(line, closer);
    closer = scanned.closer;
    const opening = scanned.shown.match(OPENING_FENCE);
    if (opening) fence = opening[1] ?? opening[2];
    else visible.push(scanned.shown);
  }
  return visible;
}

/** Counted even when hidden: only the binding has to be visible. */
const certifiesDod = (text) =>
  DOD_IDS.some((id) => [...text.matchAll(checklistLine(id))].some((m) => isChecked(m) || isNotApplicable(m)));

/**
 * The one reading of the head-binding contract, shared with canon-sync-pr.mjs.
 * Returns why the body is not bound to `head` ({ sha, ref }), or null.
 */
export function headBindingRefusal(body, head) {
  const text = (body ?? "").replace(LINE_ENDS, "\n");
  // The script owns the generated zone: a binding there binds nothing, but its fences still count.
  const outsideGenerated = text.replace(GENERATED_ZONE, (zone) => zone.replace(/^DoD-Head:.*$/gm, ""));
  const declared = visibleLines(outsideGenerated).filter((line) => line.startsWith("DoD-Head:"));
  const required = head?.ref === CANON_SYNC_BRANCH && certifiesDod(text);
  if (declared.length === 0 && !required) return null;
  if (!head?.sha) return "declares a DoD head binding but its head is unknown (no event payload).";
  const bound = declared.length === 1 ? declared[0].match(HEAD_BINDING)?.[1] : undefined;
  if (bound === head.sha) return null;
  return `declares DoD state without exactly one "DoD-Head: <sha>" line naming its head ${head.sha}.`;
}

/**
 * Pure evaluation. Returns { pass, mode, reasons[], advisory[] }.
 *   mode: "head-binding" | "dependabot" | "checklist" | "skip-justified" | "skip-needs-approvals"
 *   reasons: blocking failures; advisory: failures on DOD_ADVISORY_ITEMS ids.
 *   assignees: logins from the event payload; undefined = unknown (DoD2 fails).
 *   author: PR author login from the event payload.
 *   head: { sha, ref } of the PR from the event payload.
 */
export function evaluateDoD(
  body,
  labels,
  approvals,
  { assignees, author, advisoryItems = [], head } = {},
) {
  // First on purpose: a stale binding is a false statement, no exemption covers it.
  const stale = headBindingRefusal(body, head);
  if (stale) {
    return { pass: false, mode: "head-binding", reasons: [`Head binding: this PR ${stale}`], advisory: [] };
  }
  if (author === DEPENDABOT_LOGIN) {
    return {
      pass: true,
      mode: "dependabot",
      reasons: [`Opened by ${DEPENDABOT_LOGIN}: no self-evaluation required.`],
      advisory: [],
    };
  }
  const labelSet = new Set((labels || []).map((l) => String(l).trim()));
  const reasons = [];

  if (labelSet.has(SKIP_LABEL)) {
    if ((approvals ?? 0) >= SKIP_MIN_APPROVALS) {
      return {
        pass: true,
        mode: "skip-justified",
        reasons: [
          `Escape hatch '${SKIP_LABEL}' active with ${approvals} approvals (>= ${SKIP_MIN_APPROVALS}). Ensure the __governance_event_log audit row + remediation issue exist.`,
        ],
        advisory: [],
      };
    }
    return {
      pass: false,
      mode: "skip-needs-approvals",
      reasons: [
        `Label '${SKIP_LABEL}' present but only ${approvals ?? 0} approval(s); requires >= ${SKIP_MIN_APPROVALS} distinct human approvals.`,
      ],
      advisory: [],
    };
  }

  const text = body || "";
  const advisorySet = new Set(advisoryItems);
  const advisory = [];
  const fail = (id, reason) =>
    (advisorySet.has(id) ? advisory : reasons).push(`${id}: ${reason}`);

  for (const id of DOD_IDS) {
    const lines = [...text.matchAll(checklistLine(id))];
    if (lines.length === 0) {
      fail(id, `missing from PR body DoD self-evaluation (no checklist line \`- [ ] ${id} …\`).`);
      continue;
    }
    const boxed = lines.filter((m) => m[1] !== undefined);
    const decisive = boxed.length > 0 ? boxed : lines;
    if (id === OWNERSHIP_ID) {
      const checked = decisive.some(isChecked);
      // GitHub state decides; the box (or an N/A) cannot replace it.
      const missing = [];
      if (assignees === undefined) missing.push("assignees unknown (no event payload)");
      else if (assignees.length === 0) missing.push("no assignee");
      if ((approvals ?? 0) < OWNERSHIP_MIN_APPROVALS) {
        missing.push(`${approvals ?? 0} human approval(s), requires >= ${OWNERSHIP_MIN_APPROVALS}`);
      }
      if (missing.length > 0) {
        fail(id, `${missing.join("; ")}${checked ? " — box ticked without that GitHub state" : ""}.`);
      }
      continue;
    }
    const satisfied = decisive.filter((m) => isChecked(m) || isNotApplicable(m)).length;
    if (satisfied === 0) {
      fail(id, "present but unchecked (no [x] and not marked N/A).");
    } else if (satisfied < decisive.length) {
      fail(id, `${decisive.length} checklist lines disagree (${satisfied} checked or N/A).`);
    }
  }

  return {
    pass: reasons.length === 0,
    mode: "checklist",
    reasons:
      reasons.length === 0
        ? [
            advisory.length === 0
              ? "All 9 DoD invariants checked or marked N/A."
              : `No blocking failure; ${advisory.length} advisory item(s) failing.`,
          ]
        : reasons,
    advisory,
  };
}

function readPullRequest(eventPath) {
  if (!eventPath) return undefined;
  try {
    return JSON.parse(readFileSync(eventPath, "utf8"))?.pull_request;
  } catch {
    return undefined;
  }
}

/**
 * The PR fields the gate uses, from one read of the event payload; a field is
 * undefined when absent or invalid. A head without a full SHA and a branch name
 * is no head: the branch decides which contract applies.
 */
export function readEvent(eventPath) {
  const pr = readPullRequest(eventPath);
  const { sha, ref } = pr?.head ?? {};
  const login = pr?.user?.login;
  return {
    assignees: Array.isArray(pr?.assignees) ? pr.assignees.map((a) => a.login) : undefined,
    author: typeof login === "string" ? login : undefined,
    head: typeof sha === "string" && HEAD_SHA.test(sha) && typeof ref === "string" && ref !== "" ? { sha, ref } : undefined,
  };
}

export const readAssignees = (eventPath) => readEvent(eventPath).assignees;
export const readAuthor = (eventPath) => readEvent(eventPath).author;
export const readHead = (eventPath) => readEvent(eventPath).head;

function renderReport(result) {
  const icon = result.pass ? "✅ PASS" : "❌ FAIL";
  const head = `### 🧾 Definition of Done gate — ${icon}\n\n_mode: \`${result.mode}\`_\n`;
  const advisory = result.advisory?.length
    ? `\n\n**Advisory (not blocking, \`DOD_ADVISORY_ITEMS\`):**\n${result.advisory.map((r) => `- ${r}`).join("\n")}`
    : "";
  const body = result.reasons.map((r) => `- ${r}`).join("\n") + advisory;
  const footer = result.pass
    ? ""
    : result.mode === "head-binding"
      ? "\n\n> Evidence recorded for another head does not apply here: review this head, then write one `DoD-Head:` line naming it. No label lifts this failure."
      : `\n\n> Add the DoD self-evaluation section to the PR body (template in vault \`rules-engineering-definition-of-done.md\`), or apply \`${SKIP_LABEL}\` with >= ${SKIP_MIN_APPROVALS} approvals.`;
  return `${head}\n${body}${footer}\n`;
}

/** Misconfiguration fails closed, with the report the comment step expects. */
function failClosed(message) {
  writeFileSync("dod-gate-report.md", `### 🧾 Definition of Done gate — ❌ FAIL\n\n- ${message}\n`, "utf8");
  process.stderr.write(`[pr-dod-gate] ${message}\n`);
  process.exit(1);
}

function main() {
  const body = process.env.PR_BODY ?? "";
  const labels = (process.env.PR_LABELS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const approvals = Number.parseInt(process.env.PR_APPROVALS ?? "0", 10) || 0;
  const { assignees, author, head } = readEvent(process.env.GITHUB_EVENT_PATH);
  let advisoryItems;
  try {
    advisoryItems = parseAdvisoryItems(process.env.DOD_ADVISORY_ITEMS);
  } catch (err) {
    failClosed(err.message);
  }
  // Before evaluating: without the head, the branch and its contract are unknown.
  if (!head) failClosed("The PR head cannot be read from the event payload (GITHUB_EVENT_PATH).");

  const result = evaluateDoD(body, labels, approvals, { assignees, author, advisoryItems, head });
  writeFileSync("dod-gate-report.md", renderReport(result), "utf8");
  process.stderr.write(
    `[pr-dod-gate] mode=${result.mode} pass=${result.pass} reasons=${result.reasons.length} advisory=${result.advisory.length}\n`,
  );
  process.exit(result.pass ? 0 : 1);
}

// Only run main when invoked directly (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

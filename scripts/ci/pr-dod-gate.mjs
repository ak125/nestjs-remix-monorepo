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
// prose stand in for the checklist, in both directions.
//
// DoD2 is a GitHub state, not a self-assessment: the rule requires an assignee
// and >= 1 human approval. A ticked DoD2 box is never evidence on its own.
//
// Pure `evaluateDoD()` is exported for testing; `main()` reads env + writes the
// PR-comment report and sets the exit code.
//
// Env (set by the workflow):
//   PR_BODY            — full PR description markdown
//   PR_LABELS          — comma-separated label names
//   PR_APPROVALS       — integer count of APPROVED reviews
//   GITHUB_EVENT_PATH  — event payload; `pull_request.assignees` feeds DoD2
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

// List item whose first token is the id, optionally boxed and bold:
// `- [x] DoD1 — …` (vault template), `- [x] **DoD1** …`, `- DoD4 — N/A : …`.
// `\b` keeps DoD1 != DoD10.
const checklistLine = (id) =>
  new RegExp(
    `^[ \\t]*[-*+][ \\t]+(?:\\[([ xX])\\][ \\t]*)?(?:\\*\\*|__)?${id}\\b.*$`,
    "m",
  );

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

/**
 * Pure evaluation. Returns { pass, mode, reasons[], advisory[] }.
 *   mode: "checklist" | "skip-justified" | "skip-needs-approvals"
 *   reasons: blocking failures; advisory: failures on DOD_ADVISORY_ITEMS ids.
 *   assignees: logins from the event payload; undefined = unknown (DoD2 fails).
 */
export function evaluateDoD(
  body,
  labels,
  approvals,
  { assignees, advisoryItems = [] } = {},
) {
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
    const m = text.match(checklistLine(id));
    if (!m) {
      fail(id, `missing from PR body DoD self-evaluation (no checklist line \`- [ ] ${id} …\`).`);
      continue;
    }
    const checked = m[1] !== undefined && m[1] !== " ";
    if (id === OWNERSHIP_ID) {
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
    // An N/A inside a `<…>` placeholder is template text, not a declaration.
    const notApplicable = /\bN\/A\b/i.test(m[0].replace(/<[^>]*>/g, ""));
    if (!checked && !notApplicable) {
      fail(id, "present but unchecked (no [x] and not marked N/A).");
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

/** Assignee logins from the Actions event payload; undefined when unreadable. */
export function readAssignees(eventPath) {
  if (!eventPath) return undefined;
  try {
    const event = JSON.parse(readFileSync(eventPath, "utf8"));
    const list = event?.pull_request?.assignees;
    return Array.isArray(list) ? list.map((a) => a.login) : undefined;
  } catch {
    return undefined;
  }
}

function renderReport(result) {
  const icon = result.pass ? "✅ PASS" : "❌ FAIL";
  const head = `### 🧾 Definition of Done gate — ${icon}\n\n_mode: \`${result.mode}\`_\n`;
  const advisory = result.advisory?.length
    ? `\n\n**Advisory (not blocking, \`DOD_ADVISORY_ITEMS\`):**\n${result.advisory.map((r) => `- ${r}`).join("\n")}`
    : "";
  const body = result.reasons.map((r) => `- ${r}`).join("\n") + advisory;
  const footer = result.pass
    ? ""
    : `\n\n> Add the DoD self-evaluation section to the PR body (template in vault \`rules-engineering-definition-of-done.md\`), or apply \`${SKIP_LABEL}\` with >= ${SKIP_MIN_APPROVALS} approvals.`;
  return `${head}\n${body}${footer}\n`;
}

function main() {
  const body = process.env.PR_BODY ?? "";
  const labels = (process.env.PR_LABELS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const approvals = Number.parseInt(process.env.PR_APPROVALS ?? "0", 10) || 0;
  const assignees = readAssignees(process.env.GITHUB_EVENT_PATH);
  let advisoryItems;
  try {
    advisoryItems = parseAdvisoryItems(process.env.DOD_ADVISORY_ITEMS);
  } catch (err) {
    // Misconfiguration fails closed, with the report the comment step expects.
    writeFileSync("dod-gate-report.md", `### 🧾 Definition of Done gate — ❌ FAIL\n\n- ${err.message}\n`, "utf8");
    process.stderr.write(`[pr-dod-gate] ${err.message}\n`);
    process.exit(1);
  }

  const result = evaluateDoD(body, labels, approvals, { assignees, advisoryItems });
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

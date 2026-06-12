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
// Pure `evaluateDoD()` is exported for testing; `main()` reads env + writes the
// PR-comment report and sets the exit code.
//
// Env (set by the workflow):
//   PR_BODY        — full PR description markdown
//   PR_LABELS      — comma-separated label names
//   PR_APPROVALS   — integer count of APPROVED reviews
// =============================================================================

import { writeFileSync } from "node:fs";

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

/**
 * Pure evaluation. Returns { pass, mode, reasons[] }.
 *   mode: "checklist" | "skip-justified" | "skip-needs-approvals"
 */
export function evaluateDoD(body, labels, approvals) {
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
      };
    }
    return {
      pass: false,
      mode: "skip-needs-approvals",
      reasons: [
        `Label '${SKIP_LABEL}' present but only ${approvals ?? 0} approval(s); requires >= ${SKIP_MIN_APPROVALS} distinct human approvals.`,
      ],
    };
  }

  const text = body || "";
  for (const id of DOD_IDS) {
    // Match the line mentioning this DoD id (word boundary so DoD1 != DoD10).
    const lineRe = new RegExp(`^.*\\b${id}\\b.*$`, "im");
    const m = text.match(lineRe);
    if (!m) {
      reasons.push(`${id}: missing from PR body DoD self-evaluation.`);
      continue;
    }
    const line = m[0];
    const checked = /\[x\]/i.test(line);
    const notApplicable = /\bN\/A\b/i.test(line);
    if (!checked && !notApplicable) {
      reasons.push(`${id}: present but unchecked (no [x] and not marked N/A).`);
    }
  }

  return {
    pass: reasons.length === 0,
    mode: "checklist",
    reasons:
      reasons.length === 0
        ? ["All 9 DoD invariants checked or marked N/A."]
        : reasons,
  };
}

function renderReport(result) {
  const icon = result.pass ? "✅ PASS" : "❌ FAIL";
  const head = `### 🧾 Definition of Done gate — ${icon}\n\n_mode: \`${result.mode}\`_\n`;
  const body = result.reasons.map((r) => `- ${r}`).join("\n");
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

  const result = evaluateDoD(body, labels, approvals);
  writeFileSync("dod-gate-report.md", renderReport(result), "utf8");
  process.stderr.write(
    `[pr-dod-gate] mode=${result.mode} pass=${result.pass} reasons=${result.reasons.length}\n`,
  );
  process.exit(result.pass ? 0 : 1);
}

// Only run main when invoked directly (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

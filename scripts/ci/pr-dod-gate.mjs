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
// DoD2 follows ADR-120 (rule v1.1.0): an assignee plus a review record bound to
// the head SHA, read from the body or from a comment of this PR that the body
// links. Approvals do not count. The gate checks what it can read: the record's
// fields, its head and base SHAs, the declared level against the changed files,
// an independent or human review for B and C, and for C an accord on the head
// by an account with write access other than the author. Review quality,
// effective independence, the handling of findings, STOP zones, domain
// ownership and the carry-over of a record are read on evidence: the report
// lists them on every run, with the accounts it counted. Data the gate cannot
// read is reported as unverified, never as a pass. A login proves the account,
// not the person. PR text is matched as data, never executed.
//
// Dependabot cannot write a self-evaluation, and the escape hatch needs two
// approvals: a blocking gate would hold every dependency bump. Its PRs pass on
// the author login from the event payload; GitHub logins cannot contain
// brackets, so `dependabot[bot]` is never a human account.
//
// Pure `evaluateDoD()` is exported for testing; `main()` reads env + writes the
// PR-comment report and sets the exit code.
//
// Env (set by the workflow):
//   PR_BODY            — full PR description markdown
//   PR_LABELS          — comma-separated label names
//   PR_APPROVALS       — integer count of APPROVED reviews
//   GITHUB_EVENT_PATH  — event payload; `pull_request.assignees` and
//                        `head.sha` feed DoD2, `pull_request.user.login` the
//                        Dependabot exemption and the level C accord
//   PR_REVIEW_CONTEXT  — optional, path of a JSON file collected by the
//                        workflow: { mergeBase, files, comments, reviews };
//                        comments and reviews carry login, association
//                        (author_association) and body, reviews also state
//                        and commitId. Missing or malformed data leaves the
//                        DoD2 checks it feeds unverified.
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
const DEPENDABOT_LOGIN = "dependabot[bot]";

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
const isNotApplicable = (m) => m[0].split(/<[^<>\n]*>/).some((part) => /\bN\/A\b/i.test(part));

// ADR-120 D2 record, rule template:
//   - [x] Revue niveau <A|B|C> — tête <sha40>, base <sha40>
//         procédure : <…>, par <session, agent ou compte>
//         constats : … / preuves : … / limites : …
// D2 also requires the scope read, hence `périmètre`. The block ends at a blank
// line, a heading or the next checkbox. DoD checklist lines only point to it.
const RECORD_ANCHOR = /\bRevue\s+niveau\s+(?:\*\*|__|`)?([ABC])\b(.*)$/i;
const DOD_LINE = /^[ \t]*[-*+][ \t]+(?:\[[ xX]\][ \t]*)?(?:\*\*|__)?DoD\d\b/;
const RECORD_FIELDS = ["procédure", "périmètre", "constats", "preuves", "limites"];
const FIELD_LINE =
  /^[ \t]*(?:[-*+][ \t]+)?(?:\*\*|__)?(proc[ée]dure|p[ée]rim[èe]tre|constats|preuves|limites)(?:\*\*|__)?[ \t]*:(.*)$/i;
const BLOCK_END = /^[ \t]*$|^[ \t]*#|^[ \t]*[-*+][ \t]+\[[ xX]\]/;
const COMMENT_LINK = /github\.com\/([\w.-]+\/[\w.-]+)\/pull\/(\d+)#(issuecomment|pullrequestreview)-(\d+)/gi;
// Level floor from paths (ADR-120 D3): prose, audit data and the projections
// regenerated by their script (all under audit/, plus REPO_MAP.md) may stay at
// A, code needs B at least. Other files (configuration, data, assets…) are not
// classified: at level A they stay unverified. GitHub lists 3000 files at most.
const PROSE_FILE = /\.(?:md|markdown)$/i;
const AUDIT_DATA = /^audit\/.*\.(?:json|ya?ml|csv)$/i;
const CODE_FILE = /\.(?:[cm]?[jt]sx?|py|sh|bash|sql|rs|go|rb|php)$|^\.github\/workflows\/|^\.husky\/|(?:^|\/)Dockerfile[^/]*$/i;
const FILES_API_CAP = 3000;
// B and C need a review outside the author's session: « revue indépendante »
// (D3) or « revue humaine » (D2), not negated within its clause.
const REVIEW_KIND = /ind[ée]pendante|humaine/giu;
const REVIEW_NEGATION = /(?<![\p{L}\p{N}])(?:pas|non|ni|sans|aucune?)(?![\p{L}\p{N}])/iu;
const BY = /(?<![\p{L}\p{N}])par(?![\p{L}\p{N}])(.*)$/iu;
// Level C accord: an approval of the head, or a line that starts with « Accord »
// and names the head. Quoted, negated or withdrawn lines do not count; the
// account needs write access and is not the author.
const ACCORD_LINE = /^[ \t]*(?:[-*+][ \t]+)?(?:\*\*|__)?accord(?![\p{L}\p{N}])/iu;
const ACCORD_NEGATION = /(?<![\p{L}\p{N}])(?:pas|non|aucune?|refus\p{L}*|retir\p{L}*)(?![\p{L}\p{N}])/iu;
const WRITE_ACCESS = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);
const DECISIVE = ["APPROVED", "CHANGES_REQUESTED", "DISMISSED"];

/** What the gate cannot establish for DoD2: listed on every checklist run. */
export const DOD2_ON_PROOF = [
  "review quality and, for levels B and C, effective independence (distinct session without the author's context, frozen SHA, no write during the review)",
  "handling of findings: a confirmed correctness, security or contract finding neither fixed nor refuted blocks DoD2",
  "level justification: STOP zones (level C) are not detected from paths, and files neither prose, audit data nor code are not classified",
  "domain owner of each changed path in ownership.yaml (not __unassigned__)",
  "carry-over (D4): a record from an earlier head counts only through a new record naming the new SHA, with an identical attributable diff; the gate does not compare diffs",
  "level C accord: the counted account is the domain owner of the changed paths, and its wording is an accord on this head (not conditional; comment edits are not tracked)",
  "identity: a login proves the account, not the person (Desktop sessions act under the owner's account)",
];

const PLACEHOLDER = /<[^<>\n]*>/;
const fieldKey = (name) => name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
// A `<…>` placeholder outside inline code leaves the whole value unfilled.
const isFilled = (value) =>
  typeof value === "string" && !PLACEHOLDER.test(value.replace(/`[^`\n]*`/g, "")) && /[\p{L}\p{N}]/u.test(value);
// Read on a bounded slice: a record line is short, and PR text is untrusted.
const shaAfter = (label, line) =>
  line.slice(0, 400).match(new RegExp(`${label}\\s*(?::\\s*)?[\`*]*([0-9a-f]{7,})`, "i"))?.[1].toLowerCase();
const code = (item) => `\`${String(item).replace(/`/g, "'")}\``;
const shortList = (items) => items.slice(0, 5).map(code).join(", ") + (items.length > 5 ? `, … (${items.length})` : "");
const unique = (items) => [...new Set(items)];
const nfc = (text) => String(text ?? "").normalize("NFC");

/** Review records of a markdown text: [{ level, head, base, fields }]. */
export function parseReviewRecords(text) {
  const lines = nfc(text).split(/\r?\n/);
  const records = [];
  lines.forEach((line, i) => {
    const anchor = DOD_LINE.test(line) ? null : line.match(RECORD_ANCHOR);
    if (!anchor) return;
    const fields = {};
    for (const next of lines.slice(i + 1)) {
      if (BLOCK_END.test(next)) break;
      const field = next.match(FIELD_LINE);
      if (field) fields[fieldKey(field[1])] = field[2].trim();
    }
    records.push({
      level: anchor[1].toUpperCase(),
      head: shaAfter("t[êe]te", anchor[2]),
      base: shaAfter("base", anchor[2]),
      fields,
    });
  });
  return records;
}

function checkLevelFloor(record, pr, at, out) {
  if (record.level !== "A") return;
  if (!Array.isArray(pr.files)) {
    out.unverified.push("changed files unknown (no review context): level A not checked");
    return;
  }
  if (pr.files.length >= FILES_API_CAP) {
    out.unverified.push(`changed files listed up to the API cap (${FILES_API_CAP}): level A not checked`);
    return;
  }
  const changedCode = pr.files.filter((f) => CODE_FILE.test(f));
  if (changedCode.length > 0) {
    out.problems.push(`record${at}: level A declared but the diff changes code (${shortList(changedCode)}): level B at least`);
    return;
  }
  const other = pr.files.filter((f) => !PROSE_FILE.test(f) && !AUDIT_DATA.test(f));
  if (other.length > 0) {
    out.unverified.push(
      `level A with ${other.length} file(s) neither prose, audit data nor code, to classify on evidence (${shortList(other)})`,
    );
  }
}

function checkAccord(pr, at, out) {
  if (!pr.headSha || !Array.isArray(pr.reviews) || !Array.isArray(pr.comments)) {
    out.unverified.push("level C accord not checked (head or review context unknown)");
    return;
  }
  const head = new RegExp(`(?<![0-9a-f])${pr.headSha}(?![0-9a-f])`);
  const namesHead = (body) =>
    nfc(body)
      .split(/\r?\n/)
      .some((line) => ACCORD_LINE.test(line) && !ACCORD_NEGATION.test(line) && head.test(line.toLowerCase()));
  // Latest decisive review per account, as GitHub counts them.
  const latest = new Map();
  for (const review of pr.reviews) {
    if (DECISIVE.includes(review.state)) latest.set(review.login, review);
  }
  const found = new Map();
  for (const review of latest.values()) {
    if (review.state === "APPROVED" && String(review.commitId).toLowerCase() === pr.headSha) {
      found.set(review.login, { association: review.association, how: "approval of the head" });
    }
  }
  const open = pr.reviews.filter((r) => !["CHANGES_REQUESTED", "DISMISSED"].includes(r.state));
  for (const c of [...pr.comments, ...open]) {
    if (!found.has(c.login) && namesHead(c.body)) found.set(c.login, { association: c.association, how: "« Accord » line naming the head" });
  }
  const accounts = [...found].filter(
    ([login]) => typeof login === "string" && !login.endsWith("[bot]") && latest.get(login)?.state !== "CHANGES_REQUESTED",
  );
  if (accounts.length > 0 && pr.author === undefined) {
    out.unverified.push("level C accord: PR author unknown, the accord's account cannot be told apart from it");
    return;
  }
  const others = accounts.filter(([login]) => login !== pr.author);
  const counted = others.filter(([, a]) => WRITE_ACCESS.has(a.association));
  const unknown = others.filter(([, a]) => a.association == null);
  if (counted.length > 0) {
    for (const [login, a] of counted) {
      out.notes.push(`level C accord counted from ${code(login)} (${a.association.toLowerCase()}, ${a.how})`);
    }
  } else if (unknown.length > 0) {
    out.unverified.push(`level C accord by ${shortList(unknown.map(([login]) => login))}: repository access unknown`);
  } else if (accounts.some(([login]) => login === pr.author)) {
    out.unverified.push(`level C accord recorded by the author's account only (${code(pr.author)}): it does not show that another person agreed`);
  } else {
    out.problems.push(
      `record${at}: level C requires the domain owner's accord on the head, recorded on the PR by another account with write access (approval of the head, or a comment line « Accord <sha40> »)`,
    );
  }
}

/** Checks of one record. Returns { problems[], unverified[], notes[] }. */
function checkRecord(record, pr) {
  const out = { problems: [], unverified: [], notes: [] };
  const at = record.source ? ` (${record.source})` : "";
  if (record.head?.length !== 40) out.problems.push(`record${at}: head SHA must be 40 hex characters`);
  if (record.base?.length !== 40) {
    out.problems.push(`record${at}: base SHA (merge-base, 40 hex characters) missing`);
  } else if (pr.mergeBase === undefined) {
    out.unverified.push("merge-base unknown (no review context): base not checked");
  } else if (record.base !== pr.mergeBase) {
    out.problems.push(`record${at}: base ${record.base} is not the merge-base ${pr.mergeBase}`);
  }
  const missing = RECORD_FIELDS.filter((name) => !isFilled(record.fields[fieldKey(name)]));
  if (missing.length > 0) out.problems.push(`record${at}: field(s) missing or placeholder: ${missing.join(", ")}`);
  const procedure = record.fields.procedure ?? "";
  if (isFilled(procedure) && !isFilled(procedure.match(BY)?.[1])) {
    out.problems.push(`record${at}: procédure does not name who ran it (« …, par <session, agent ou compte> »)`);
  }
  const outside = [...procedure.matchAll(REVIEW_KIND)].some(
    (m) => !REVIEW_NEGATION.test(procedure.slice(0, m.index).split(/[,;.]/).at(-1)),
  );
  if (record.level !== "A" && !outside) {
    out.problems.push(`record${at}: level ${record.level} requires an independent or human review on a frozen SHA (procédure)`);
  }
  checkLevelFloor(record, pr, at, out);
  if (record.level === "C") checkAccord(pr, at, out);
  return out;
}

/**
 * ADR-120 D2–D4 checks of the review record. Returns { problems[], unverified[], notes[] }.
 *   pr: { headSha, number, repo, author, mergeBase, files, comments, reviews };
 *   an undefined field is unknown and leaves its checks unverified.
 *   notes: what the gate counted and the evidence must confirm (accord accounts).
 * The level is the highest one declared on the head; one valid record at that
 * level satisfies DoD2, lower ones (an auto-review beside the review) are not checked.
 */
export function evaluateReviewRecord(body, pr = {}) {
  const text = nfc(body);
  const problems = [];
  const unverified = [];
  const notes = [];
  const records = parseReviewRecords(text);

  const links = [...text.matchAll(COMMENT_LINK)];
  if (links.length > 0 && (pr.repo === undefined || pr.number === undefined)) {
    unverified.push("linked comments not read: PR number or repository unknown");
  }
  const cited = unique(
    links
      .filter((m) => m[1].toLowerCase() === String(pr.repo).toLowerCase() && Number(m[2]) === pr.number)
      .map((m) => `${m[3].toLowerCase()}-${m[4]}`),
  );
  for (const ref of cited) {
    const [kind, id] = ref.split("-");
    const pool = kind === "issuecomment" ? pr.comments : pr.reviews;
    const found = Array.isArray(pool) ? pool.find((c) => String(c.id) === id) : undefined;
    if (!Array.isArray(pool)) unverified.push(`linked ${ref} not read (no review context)`);
    else if (!found) problems.push(`linked ${ref} not found on this PR`);
    else records.push(...parseReviewRecords(found.body).map((r) => ({ ...r, source: ref })));
  }

  if (pr.headSha) {
    for (const m of text.matchAll(checklistLine(OWNERSHIP_ID))) {
      const named = shaAfter("t[êe]te", m[0]);
      if (named && named !== pr.headSha) problems.push(`the DoD2 line names ${named}, the head is ${pr.headSha}`);
    }
  }

  if (records.length === 0) {
    if (unverified.length === 0) {
      problems.push("no review record (« Revue niveau <A|B|C> — tête <sha40>, base <sha40> » and its fields) in the body or in a comment it links");
    }
    return { problems: unique(problems), unverified: unique(unverified), notes };
  }
  let current = records;
  if (!pr.headSha) {
    unverified.push("head SHA unknown (no event payload)");
  } else {
    current = records.filter((r) => r.head === pr.headSha);
    const short = unique(records.map((r) => r.head).filter((h) => h && h.length < 40 && pr.headSha.startsWith(h)));
    if (current.length === 0 && short.length > 0) {
      problems.push(`record names ${short.join(", ")}, an abbreviation of the head: the record names the 40-character SHA ${pr.headSha}`);
    } else if (current.length === 0) {
      problems.push(
        `no record names the head ${pr.headSha} (records name: ${unique(records.map((r) => r.head ?? "no SHA")).join(", ")}); a push makes a record stale (ADR-120 D4)`,
      );
    }
  }
  if (current.length > 0) {
    const top = current.map((r) => r.level).sort().at(-1);
    const results = current.filter((r) => r.level === top).map((r) => checkRecord(r, pr));
    const valid = results.find((r) => r.problems.length === 0 && r.unverified.length === 0);
    for (const r of valid ? [valid] : results) {
      problems.push(...r.problems);
      unverified.push(...r.unverified);
      notes.push(...r.notes);
    }
  }
  return { problems: unique(problems), unverified: unique(unverified), notes: unique(notes) };
}

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
 * Pure evaluation. Returns { pass, mode, reasons[], advisory[], onProof[], notes[] }.
 *   mode: "dependabot" | "checklist" | "skip-justified" | "skip-needs-approvals"
 *   reasons: blocking failures; advisory: failures on DOD_ADVISORY_ITEMS ids;
 *   onProof: DoD2 checks left to the evidence (checklist mode only);
 *   notes: what DoD2 counted, to confirm on that evidence.
 *   approvals: APPROVED reviews, counted for the escape hatch only.
 *   assignees: logins from the event payload; undefined = unknown (DoD2 fails).
 *   author: PR author login from the event payload.
 *   pr: review context for DoD2, see evaluateReviewRecord().
 */
export function evaluateDoD(
  body,
  labels,
  approvals,
  { assignees, author, advisoryItems = [], pr = {} } = {},
) {
  if (author === DEPENDABOT_LOGIN) {
    return {
      pass: true,
      mode: "dependabot",
      reasons: [`Opened by ${DEPENDABOT_LOGIN}: no self-evaluation required.`],
      advisory: [],
      onProof: [],
      notes: [],
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
        onProof: [],
        notes: [],
      };
    }
    return {
      pass: false,
      mode: "skip-needs-approvals",
      reasons: [
        `Label '${SKIP_LABEL}' present but only ${approvals ?? 0} approval(s); requires >= ${SKIP_MIN_APPROVALS} distinct human approvals.`,
      ],
      advisory: [],
      onProof: [],
      notes: [],
    };
  }

  const text = body || "";
  const advisorySet = new Set(advisoryItems);
  const advisory = [];
  const notes = [];
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
      // Assignee and review record decide; the box (or an N/A) cannot replace them.
      const { problems, unverified, notes: counted } = evaluateReviewRecord(text, { ...pr, author });
      notes.push(...counted);
      if (assignees === undefined) unverified.unshift("assignees unknown (no event payload)");
      else if (assignees.length === 0) problems.unshift("no assignee");
      const missing = [...problems, ...unverified.map((u) => `unverified: ${u}`)];
      if (missing.length > 0) {
        fail(id, `${missing.join("; ")}${checked ? " — box ticked without that evidence" : ""}.`);
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
    onProof: DOD2_ON_PROOF,
    notes,
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

/** Assignee logins from the Actions event payload; undefined when unreadable. */
export function readAssignees(eventPath) {
  const list = readPullRequest(eventPath)?.assignees;
  return Array.isArray(list) ? list.map((a) => a.login) : undefined;
}

/** Head SHA, number and repository of the PR from the event payload; fields undefined when unreadable. */
export function readPullRequestRef(eventPath) {
  const pr = readPullRequest(eventPath);
  return {
    headSha: typeof pr?.head?.sha === "string" && /^[0-9a-f]{40}$/i.test(pr.head.sha) ? pr.head.sha.toLowerCase() : undefined,
    number: Number.isInteger(pr?.number) ? pr.number : undefined,
    repo: typeof pr?.base?.repo?.full_name === "string" ? pr.base.repo.full_name : undefined,
  };
}

/** Review context collected by the workflow; a field is undefined when absent or malformed. */
export function readReviewContext(path) {
  if (!path) return {};
  let raw;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return {};
  }
  // A list with one malformed element is unknown as a whole.
  const list = (value, ok) => (Array.isArray(value) && value.every(ok) ? value : undefined);
  const isObject = (item) => item !== null && typeof item === "object" && !Array.isArray(item);
  return {
    mergeBase: typeof raw?.mergeBase === "string" && /^[0-9a-f]{40}$/i.test(raw.mergeBase) ? raw.mergeBase.toLowerCase() : undefined,
    files: list(raw?.files, (f) => typeof f === "string"),
    comments: list(raw?.comments, isObject),
    reviews: list(raw?.reviews, isObject),
  };
}

/** PR author login from the Actions event payload; undefined when unreadable. */
export function readAuthor(eventPath) {
  const login = readPullRequest(eventPath)?.user?.login;
  return typeof login === "string" ? login : undefined;
}

function renderReport(result) {
  const icon = result.pass ? "✅ PASS" : "❌ FAIL";
  const head = `### 🧾 Definition of Done gate — ${icon}\n\n_mode: \`${result.mode}\`_\n`;
  const advisory = result.advisory?.length
    ? `\n\n**Advisory (not blocking, \`DOD_ADVISORY_ITEMS\`):**\n${result.advisory.map((r) => `- ${r}`).join("\n")}`
    : "";
  const onProof = result.onProof?.length
    ? `\n\n**DoD2, to examine on evidence (not checked by the gate):**\n${result.onProof.map((r) => `- ${r}`).join("\n")}`
    : "";
  const notes = result.notes?.length
    ? `\n\n**DoD2, counted by the gate (to confirm on evidence):**\n${result.notes.map((r) => `- ${r}`).join("\n")}`
    : "";
  const body = result.reasons.map((r) => `- ${r}`).join("\n") + advisory + notes + onProof;
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
  const author = readAuthor(process.env.GITHUB_EVENT_PATH);
  let advisoryItems;
  try {
    advisoryItems = parseAdvisoryItems(process.env.DOD_ADVISORY_ITEMS);
  } catch (err) {
    // Misconfiguration fails closed, with the report the comment step expects.
    writeFileSync("dod-gate-report.md", `### 🧾 Definition of Done gate — ❌ FAIL\n\n- ${err.message}\n`, "utf8");
    process.stderr.write(`[pr-dod-gate] ${err.message}\n`);
    process.exit(1);
  }

  const pr = {
    ...readPullRequestRef(process.env.GITHUB_EVENT_PATH),
    ...readReviewContext(process.env.PR_REVIEW_CONTEXT),
  };
  const result = evaluateDoD(body, labels, approvals, { assignees, author, advisoryItems, pr });
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

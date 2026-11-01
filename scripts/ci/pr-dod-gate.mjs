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
//                        files lists the new and the previous path of a
//                        renamed file; comments and reviews carry login,
//                        association (author_association) and body, reviews
//                        also state and commitId. Missing or malformed data
//                        leaves the DoD2 checks it feeds unverified.
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
const isNotApplicable = (m) => m[0].split(/<[^>]*>/).some((part) => /\bN\/A\b/i.test(part));

// ADR-120 D2 record, rule template:
//   - [x] Revue niveau <A|B|C> — tête <sha40>, base <sha40>
//         procédure : <…>, par <session, agent ou compte>
//         constats : … / preuves : … / limites : …
// D2 also requires the scope read, hence `périmètre`. The block ends at a blank
// line, a heading or the next checkbox. DoD checklist lines only point to it. The
// anchor opens its line: a field that cites « revue niveau B » opens no record.
const RECORD_ANCHOR =
  /^[ \t]*(?:[-*+][ \t]+)?(?:\[[ xX]\][ \t]*)?(?:\*\*|__)?Revue\s+niveau\s+(?:\*\*|__|`)?([ABC])\b(.*)$/i;
const DOD_LINE = /^[ \t]*[-*+][ \t]+(?:\[[ xX]\][ \t]*)?(?:\*\*|__)?DoD\d\b/;
const RECORD_FIELDS = ["procédure", "périmètre", "constats", "preuves", "limites"];
const FIELD_LINE =
  /^[ \t]*(?:[-*+][ \t]+)?(?:\*\*|__)?(proc[ée]dure|p[ée]rim[èe]tre|constats|preuves|limites)(?:\*\*|__)?[ \t]*:(.*)$/i;
const BLOCK_END = /^[ \t]*$|^[ \t]*#|^[ \t]*[-*+][ \t]+\[[ xX]\]/;
const COMMENT_LINK = /github\.com\/([\w.-]+\/[\w.-]+)\/pull\/(\d+)#(issuecomment|pullrequestreview)-(\d+)/gi;
// Level floor from paths (ADR-120 D3): prose, audit evidence and the projections
// regenerated by their script may stay at A (D3 lists projections), code needs B
// at least. Other files (configuration, guard inputs, assets…) are not classified:
// at level A they stay unverified. A renamed file counts under both paths. GitHub
// lists 3000 files at most; the cap counts both paths of a rename.
const PROSE_FILE = /\.(?:md|markdown)$/i;
// Markdown that code parses (agent frontmatter, canon mirrors read at runtime) is configuration.
const MARKDOWN_CONFIG = /(?:^|\/)\.claude\/(?:agents|canon-mirrors)\//;
// Evidence (`audit/content/**`) and generated projections: `audit/registry/*`
// (resync-pr.sh, but build-command-center-snapshot.js for the command-center
// snapshot), `audit/cleanup/*` and the seven inventories at the top of `audit/`
// (resync-pr.sh). The folders are matched, not each generator's output: a file
// written by hand there reads as a projection. Several are guard inputs and their
// freshness checks (registry-fresh, skills-canon-gate for the snapshot) are
// warn-only: that they were not edited by hand is left to the evidence. Other audit
// files are not listed: ratchet baselines, overlays and the TecDoc manifests of a
// fail-closed guard are guard inputs no script regenerates, beside dated snapshots.
const AUDIT_DATA =
  /^audit\/(?:content\/.+|(?:registry|cleanup)\/[^/]+|runtime-entrypoints|module-boundaries|dynamic-import-edges|cycle-map|duplicate-map|dead-code-candidates|db-usage-map)\.(?:json|ya?ml|csv)$/i;
const CODE_FILE = /\.(?:[cm]?[jt]sx?|py|sh|bash|sql|rs|go|rb|php)$|^\.github\/workflows\/|^\.husky\/|(?:^|\/)Dockerfile[^/]*$/i;
const FILES_API_CAP = 3000;
const isProse = (file) => PROSE_FILE.test(file) && !MARKDOWN_CONFIG.test(file);
// B and C need a review outside the author's session, declared as the template's
// first term: « revue indépendante » (D3) or « revue humaine » (D2), directly
// followed by « , par <qui> ». A negation or a status in between (« non
// réalisée », « à prévoir ») or before it is not that declaration.
const OUTSIDE_REVIEW =
  /^(?:\*\*|__|\*|_|`)?revue\s+(?:ind[ée]pendante|humaine)(?:\*\*|__|\*|_|`)?\s*[,;]?\s*par(?![\p{L}\p{N}])/iu;
const BY = /(?<![\p{L}\p{N}])par(?![\p{L}\p{N}])(.*)$/iu;
// Level C accord: an approval of the head, or a line that starts with « Accord »
// and names the head. Quoted lines, negated, questioning or reserved ones and those
// that withdraw do not count; the account needs write access and is not the author.
// A withdrawal by the same account cancels it, the order of comments not being
// tracked (the accord stays unverified): a line naming the head (in full or
// abbreviated) that withdraws, refuses or negates an accord, or, with or without a
// SHA, a line that starts with « Accord » and withdraws it, one that opens with « Pas
// d'accord » or « Désaccord », or a withdrawal of one's own accord (« je retire mon
// accord »). A SHA right after such a withdrawal scopes it: naming another head, it
// does not count. A SHA has a letter and a digit, which keeps comment ids and dates
// out. « D'accord » (agreed) is not an accord.
const LINE_START = String.raw`^[ \t]*(?:[-*+][ \t]+)?(?:\*\*|__)?`;
const ACCORD_LINE = new RegExp(`${LINE_START}accord(?![\\p{L}\\p{N}])`, "iu");
const ACCORD_WORD = /(?<![\p{L}\p{N}])(?<!(?<![\p{L}\p{N}])d['’])accord(?![\p{L}\p{N}])/iu;
const ACCORD_NEGATION = /(?<![\p{L}\p{N}])(?:pas|non|aucune?)(?![\p{L}\p{N}])|\?(?!\S)|(?<![\p{L}\p{N}])(?:sous[ \t]+r[ée]serve|[àa][ \t]+confirmer)(?![\p{L}\p{N}])/iu;
const WITHDRAW = String.raw`(?:refus\p{L}*|retir\p{L}*|retrait|annul\p{L}*|r[ée]voqu\p{L}*|r[ée]vocation|suspen\p{L}*|r[ée]tract\p{L}*|caduc\p{L}*|invalid\p{L}*|abandon\p{L}*)`;
const WITHDRAW_WORD = new RegExp(`(?<![\\p{L}\\p{N}])${WITHDRAW}(?![\\p{L}\\p{N}])`, "iu");
const NEGATED_ACCORD =
  /(?<![\p{L}\p{N}])(?:pas|plus|aucun|sans|non)[ \t]+(?:d['’]un[ \t]+|[dl]['’][ \t]*|(?:de|du|mon|son|notre|votre|un|cet)[ \t]+)?accord(?![\p{L}\p{N}])|(?<![\p{L}\p{N}])d[ée]saccord(?![\p{L}\p{N}])/iu;
const WITHDRAWAL_OPENING = new RegExp(`${LINE_START}(?:(?:pas|plus|aucun)[ \\t]+d['’][ \\t]*accord|d[ée]saccord)(?![\\p{L}\\p{N}])`, "iu");
const OWN_WITHDRAWAL = new RegExp(
  `(?<![\\p{L}\\p{N}])${WITHDRAW}[ \\t]+(?:(?:de|d['’])[ \\t]*)?(?:mon|ma|notre|cet|ce|l['’])[ \\t]*(?:accord|approbation|go|feu[ \\t]+vert)(?![\\p{L}\\p{N}])`,
  "iu",
);
const ATTACHED_SHA = /^(?:[ \t*_`(:,—–-]|(?:sur|pour|de|du|à|la|le|t[êe]te|commit)(?![\p{L}\p{N}]))*([0-9a-f]{7,40})(?![\p{L}\p{N}])/iu;
const SHA_TOKEN = /(?<![0-9a-f])(?=[0-9a-f]*\d)(?=[0-9a-f]*[a-f])[0-9a-f]{7,40}(?![0-9a-f])/gi;
const everyMatch = (pattern, line) => [...line.matchAll(new RegExp(pattern.source, `${pattern.flags}g`))];
const QUOTED = /^[ \t]*>/;
const WRITE_ACCESS = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);
const DECISIVE = ["APPROVED", "CHANGES_REQUESTED", "DISMISSED"];

/** What the gate cannot establish for DoD2: listed on every checklist run. */
export const DOD2_ON_PROOF = [
  "review quality and, for levels B and C, effective independence (distinct session without the author's context, frozen SHA, no write during the review)",
  "handling of findings: a confirmed correctness, security or contract finding neither fixed nor refuted blocks DoD2",
  "level justification: STOP zones (level C) are not detected from paths, files neither prose, audit evidence or projection nor code are not classified, and agent instructions (CLAUDE.md, AGENTS.md, rules, skills) count as prose",
  "projections at level A were regenerated by their script, not edited by hand: several are guard inputs and their freshness checks are warn-only",
  "domain owner of each changed path in ownership.yaml (not __unassigned__)",
  "carry-over (D4): a record from an earlier head counts only through a new record naming the new SHA, with an identical attributable diff; the gate does not compare diffs",
  "level C accord: the counted account is the domain owner of the changed paths, and its wording is an accord on this head (not conditional) that nothing withdraws: comment edits and other withdrawal wordings (a disagreement within a sentence that does not name the head, « accord levé ») are not tracked",
  "identity: a login proves the account, not the person (Desktop sessions act under the owner's account)",
];

const PLACEHOLDER = /<[^<>\n]*>/;
const fieldKey = (name) => name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const CODE_SPAN = /`[^`\n]*`/g;
// A `<…>` outside inline code leaves the value unfilled. In inline code, only the
// template's own placeholders (DoD2 line and record, in the vault rule and the PR
// template) do: as a whole span (a template wrapped in backticks) the value is
// unfilled, among other text (`git show <sha>`) the span is not content on its own.
// Any other `<…>` in code (an HTML or JSX tag, a generic type) is content.
const TEMPLATE_PLACEHOLDERS = new Set([
  "a|b|c", "sha40", "sha", "n", "lien", "qui", "owner", "domain", "github-user", "…", "...",
  "auto-review | revue indépendante | revue humaine", "session, agent ou compte",
  "diff base..tête, fichiers lus, exclusions", "commandes et résultats",
  "preuve, entrées inchangées", "non couvert",
]);
const isTemplatePlaceholder = (tag) => TEMPLATE_PLACEHOLDERS.has(tag.slice(1, -1).trim().replace(/\s+/g, " ").toLowerCase());
const holdsPlaceholder = (span) => (span.match(/<[^<>\n]*>/g) ?? []).some(isTemplatePlaceholder);
const PLACEHOLDER_SPAN = /^`\s*<[^<>\n]*>\s*`$/;
const isFilled = (value) =>
  typeof value === "string" &&
  !PLACEHOLDER.test(value.replace(CODE_SPAN, "")) &&
  !(value.match(CODE_SPAN) ?? []).some((span) => PLACEHOLDER_SPAN.test(span) && holdsPlaceholder(span)) &&
  /[\p{L}\p{N}]/u.test(value.replace(CODE_SPAN, (span) => (holdsPlaceholder(span) ? "" : span)));
// Read on a bounded slice: a record line is short, and PR text is untrusted.
const shaAfter = (label, line) =>
  line.slice(0, 400).match(new RegExp(`${label}\\s*(?::\\s*)?[\`*]*([0-9a-f]{7,})`, "i"))?.[1].toLowerCase();
// One line in a code span: a newline in a file name would end the span.
const code = (item) => `\`${String(item).replace(/`/g, "'").replace(/\s+/g, " ")}\``;
const shortList = (items) => items.slice(0, 5).map(code).join(", ") + (items.length > 5 ? `, … (${items.length})` : "");
const unique = (items) => [...new Set(items)];
const nfc = (text) => String(text ?? "").normalize("NFC");

/** Review records of a markdown text: [{ level, head, base, fields }]. */
export function parseReviewRecords(text) {
  const records = [];
  // One pass: a block ends at its end line or at the next anchor.
  let current;
  for (const line of nfc(text).split(/\r?\n/)) {
    const anchor = DOD_LINE.test(line) ? null : line.match(RECORD_ANCHOR);
    if (anchor) {
      current = { level: anchor[1].toUpperCase(), head: shaAfter("t[êe]te", anchor[2]), base: shaAfter("base", anchor[2]), fields: {} };
      records.push(current);
    } else if (current && BLOCK_END.test(line)) {
      current = undefined;
    } else if (current) {
      const field = line.match(FIELD_LINE);
      if (field) current.fields[fieldKey(field[1])] = field[2].trim();
    }
  }
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
  const other = pr.files.filter((f) => !isProse(f) && !AUDIT_DATA.test(f));
  if (other.length > 0) {
    out.unverified.push(
      `level A with ${other.length} file(s) neither prose, audit evidence or projection nor code, to classify on evidence (${shortList(other)})`,
    );
  }
}

function checkAccord(pr, at, out) {
  if (!pr.headSha || !Array.isArray(pr.reviews) || !Array.isArray(pr.comments)) {
    out.unverified.push("level C accord not checked (head or review context unknown)");
    return;
  }
  const head = new RegExp(`(?<![0-9a-f])${pr.headSha}(?![0-9a-f])`);
  const headLines = (body) =>
    nfc(body)
      .split(/\r?\n/)
      .filter((line) => !QUOTED.test(line) && head.test(line.toLowerCase()));
  const namesHead = (body) =>
    headLines(body).some((line) => ACCORD_LINE.test(line) && !ACCORD_NEGATION.test(line) && !WITHDRAW_WORD.test(line));
  const isHead = (sha) => /\d/.test(sha) && /[a-f]/i.test(sha) && pr.headSha.startsWith(sha.toLowerCase());
  const withdrawsLine = (line) => {
    if (QUOTED.test(line)) return false;
    const namesHeadSha = (line.match(SHA_TOKEN) ?? []).some(isHead);
    if (namesHeadSha && ((ACCORD_WORD.test(line) && WITHDRAW_WORD.test(line)) || NEGATED_ACCORD.test(line))) return true;
    const anchors = [OWN_WITHDRAWAL, WITHDRAWAL_OPENING];
    if (ACCORD_LINE.test(line) && WITHDRAW_WORD.test(line)) anchors.push(ACCORD_LINE, WITHDRAW_WORD);
    const matches = anchors.flatMap((pattern) => everyMatch(pattern, line));
    if (matches.length === 0) return false;
    const scopes = matches
      .map((m) => line.slice(m.index + m[0].length).match(ATTACHED_SHA)?.[1])
      .filter((sha) => sha && /\d/.test(sha) && /[a-f]/i.test(sha));
    return scopes.length === 0 || scopes.some(isHead);
  };
  const withdraws = (body) => nfc(body).split(/\r?\n/).some(withdrawsLine);
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
  const withdrawn = new Set([...pr.comments, ...pr.reviews].filter((c) => withdraws(c.body)).map((c) => c.login));
  const others = accounts.filter(([login]) => login !== pr.author);
  const eligible = others.filter(([, a]) => a.association == null || WRITE_ACCESS.has(a.association));
  const cancelled = eligible.filter(([login]) => withdrawn.has(login));
  const counted = eligible.filter(([login, a]) => a.association != null && !withdrawn.has(login));
  const unknown = eligible.filter(([login, a]) => a.association == null && !withdrawn.has(login));
  if (counted.length > 0) {
    for (const [login, a] of counted) {
      out.notes.push(`level C accord counted from ${code(login)} (${a.association.toLowerCase()}, ${a.how})`);
    }
  } else if (unknown.length > 0) {
    out.unverified.push(`level C accord by ${shortList(unknown.map(([login]) => login))}: repository access unknown`);
  } else if (cancelled.length > 0) {
    out.unverified.push(
      `level C accord by ${shortList(cancelled.map(([login]) => login))} also withdrawn or refused by the same account: the order of comments is not tracked (a withdrawal whose SHA, right after it, names another head does not count)`,
    );
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
  if (record.level !== "A" && !OUTSIDE_REVIEW.test(procedure)) {
    out.problems.push(
      `record${at}: level ${record.level} requires an independent or human review on a frozen SHA, declared first in the procédure (« revue indépendante, par <qui> » or « revue humaine, par <qui> »)`,
    );
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
      if (!named || named === pr.headSha) continue;
      problems.push(
        named.length < 40 && pr.headSha.startsWith(named)
          ? `the DoD2 line names ${named}, an abbreviation of the head: name the 40-character SHA ${pr.headSha}`
          : `the DoD2 line names ${named}, the head is ${pr.headSha}`,
      );
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
        `no record names the head ${pr.headSha} (records name: ${shortList(unique(records.map((r) => r.head ?? "no SHA")))}); a push makes a record stale (ADR-120 D4)`,
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

// The report becomes a PR comment, limited to 65536 characters.
const REPORT_CAP = 60000;
const LINE_CAP = 4000;

/**
 * Markdown report of a result below REPORT_CAP characters: past the cap, each line
 * is cut to LINE_CAP (at a « ; » in its last quarter when it can, never inside a
 * surrogate pair, closing an open code span), then the report at a line end.
 */
export function renderReport(result) {
  const full = renderFullReport(result);
  if (full.length <= REPORT_CAP) return full;
  let report = "";
  for (const line of full.split("\n")) {
    const at = line.lastIndexOf("; ", LINE_CAP);
    let end = at > (LINE_CAP * 3) / 4 ? at : LINE_CAP;
    if (/[\uD800-\uDBFF]/.test(line[end - 1] ?? "")) end -= 1;
    const cut = line.slice(0, end);
    const kept = line.length <= LINE_CAP ? line : `${cut}${(cut.match(/`/g) ?? []).length % 2 ? "`" : ""} … _(line cut)_`;
    if (report.length + kept.length + 1 > REPORT_CAP) break;
    report += `${kept}\n`;
  }
  return `${report}\n_Report truncated at ${REPORT_CAP} characters: the full report is in the job log._\n`;
}

function renderFullReport(result) {
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
  process.stdout.write(renderFullReport(result));
  process.stderr.write(
    `[pr-dod-gate] mode=${result.mode} pass=${result.pass} reasons=${result.reasons.length} advisory=${result.advisory.length}\n`,
  );
  process.exit(result.pass ? 0 : 1);
}

// Only run main when invoked directly (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

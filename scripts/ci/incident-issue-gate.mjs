#!/usr/bin/env node
// =============================================================================
// Incident issue gate — a closed incident must say what prevents its return.
// =============================================================================
// Rule (journal des principes, owner decision 138): one GitHub issue per
// incident, with three mandatory sections — what happened, why, and what
// prevents it from coming back. The issue may only stay closed when the third
// section carries a link to what now prevents the incident. When no automatic
// control is possible, the issue says so and stays open until the owner decides.
//
// Consumed by .github/workflows/incident-issue-gate.yml, which runs on the
// `issues` events closed / edited / labeled and on manual dispatch (sweep).
// The form that produces the sections is .github/ISSUE_TEMPLATE/incident.yml.
//
// What counts as "a link to what prevents the return", inside the third section:
//   - a pull request of THIS repository that is merged (`#123` or its URL);
//   - a file that exists on the checked-out default branch, cited by its
//     github.com blob/tree URL on `main` or on a commit SHA (a test, a rule);
//   - a workflow of this repository, cited by its /actions/workflows/ URL.
// An open pull request, an issue, a commit, a run or a link to another
// repository prevents nothing yet and is not accepted.
//
// The gate checks that a link is present and resolves. It does not judge
// whether the cited test really covers the incident: that stays a human review.
//
// "No control possible" path: the fourth section has its box ticked, the third
// section explains why, and the issue was closed by the owner. Closed by anyone
// else, it is reopened.
//
// The issue body is untrusted text (public repository). It is read from the
// API as JSON, never interpolated into a shell, and is only matched with
// linear regular expressions on a bounded length.
//
// Failure mode: when the API cannot be read, the script exits 1 without
// reopening anything. An outage is reported, never turned into a verdict.
//
// Pure `parseFiche()`, `extractRefs()` and `evaluate()` are exported for
// testing; `run()` takes an injectable API client; `main()` reads the env.
//
// Env (set by the workflow):
//   GH_TOKEN            — token with `issues: write`
//   GITHUB_REPOSITORY   — owner/name
//   OWNER_LOGIN         — login whose closure settles the "no control" case
//   ISSUE_NUMBER        — issue to check; empty = sweep every closed incident
//   INCIDENT_LABEL      — default `incident`
//   DRY_RUN             — `true` = report only, no reopen, no comment
// =============================================================================

import { existsSync } from "node:fs";
import { isAbsolute, join, normalize } from "node:path";

export const MARKER = "<!-- incident-issue-gate -->";
export const DEFAULT_LABEL = "incident";
const MAX_BODY = 65536;
const MAX_REFS = 20;
const MAX_HEADING = 200;

export const SECTIONS = {
  what: "Ce qui s'est passé",
  why: "Pourquoi",
  prevention: "Ce qui l'empêche de revenir",
  noControl: "Aucun contrôle possible",
};

function normalizeTitle(s) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const KEY_BY_TITLE = new Map(Object.entries(SECTIONS).map(([key, title]) => [normalizeTitle(title), key]));

// Drops HTML comments, and everything after a comment that is never closed: the
// strict reading, since GitHub hides that text when the comment opens a line.
function stripComments(text) {
  let out = "";
  let at = 0;
  for (;;) {
    const open = text.indexOf("<!--", at);
    if (open === -1) return out + text.slice(at);
    out += text.slice(at, open);
    const close = text.indexOf("-->", open + 2);
    if (close === -1) return out;
    at = close + 3;
  }
}

function stripNoise(text) {
  return stripComments(text)
    .replace(/^\s*_No response_\s*$/gim, "")
    .trim();
}

const PLACEHOLDER = /^(a completer|todo|tbd|a determiner|a renseigner)$/;

function isFilled(text) {
  if (text === undefined) return false;
  const clean = stripNoise(text);
  if (!/[\p{L}\p{N}]/u.test(clean)) return false;
  return !PLACEHOLDER.test(normalizeTitle(clean));
}

// Splits the body on Markdown headings. A known section runs until the next
// heading of the same or a higher level, so a sub-heading stays inside it and a
// later unrelated section does not leak into it.
export function parseFiche(body) {
  const lines = String(body ?? "").slice(0, MAX_BODY).split(/\r?\n/);
  const sections = {};
  let current = null;
  let level = 0;
  let fenced = false;
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    // A heading longer than MAX_HEADING is body text: the lazy match below is
    // quadratic on a long run of `#`, and the body is attacker-controlled.
    const heading = fenced || line.length > MAX_HEADING ? null : /^(#{1,6})[ \t]+(.+?)[ \t#]*$/.exec(line);
    if (heading) {
      const key = KEY_BY_TITLE.get(normalizeTitle(heading[2]));
      if (key) {
        current = key in sections ? null : key;
        level = heading[1].length;
        if (current) sections[current] = [];
        continue;
      }
      if (current && heading[1].length <= level) current = null;
    }
    if (current) sections[current].push(line);
  }
  const text = Object.fromEntries(Object.entries(sections).map(([k, v]) => [k, v.join("\n")]));
  return {
    what: text.what,
    why: text.why,
    prevention: text.prevention,
    noControlDeclared: /^\s*[-*]\s*\[[xX]\]/m.test(stripComments(text.noControl ?? "")),
  };
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// References found in a section, deduplicated, in order of appearance.
export function extractRefs(text, repo, selfNumber) {
  const refs = [];
  const seen = new Set();
  const add = (ref) => {
    const id = `${ref.kind}:${ref.number ?? ref.path ?? ref.file ?? ref.cite}`;
    if (seen.has(id) || refs.length >= MAX_REFS) return;
    seen.add(id);
    // `cite` is echoed in the gate's comment: no code-span break, mention or tag.
    refs.push({ ...ref, cite: ref.cite.replace(/[`<>@]/g, "").slice(0, 160) });
  };
  const base = `https?://github\\.com/${escapeRegExp(repo)}`;
  const source = stripNoise(String(text ?? ""));

  for (const m of source.matchAll(new RegExp(`${base}/pull/(\\d{1,9})`, "gi"))) {
    add({ kind: "pull", number: Number(m[1]), cite: `#${m[1]}` });
  }
  for (const m of source.matchAll(/(?<![\w/&#])#(\d{1,9})\b/g)) {
    add({ kind: "pull", number: Number(m[1]), cite: `#${m[1]}` });
  }
  for (const m of source.matchAll(new RegExp(`${base}/(?:blob|tree)/([^/\\s)\\]]+)/([^\\s)\\]#?]+)`, "gi"))) {
    add({ kind: "file", ref: m[1], path: m[2], cite: `${m[1]}/${m[2]}` });
  }
  for (const m of source.matchAll(new RegExp(`${base}/actions/workflows/([\\w.-]+\\.ya?ml)`, "gi"))) {
    add({ kind: "workflow", file: m[1], cite: `actions/workflows/${m[1]}` });
  }
  for (const m of source.matchAll(new RegExp(`${base}/(issues/\\d{1,9}|commit/[0-9a-f]{7,40}|actions/runs/\\d+)`, "gi"))) {
    add({ kind: "other", cite: m[1] });
  }
  return refs.filter((r) => !(r.kind === "pull" && r.number === selfNumber));
}

function safeRepoPath(raw) {
  let path;
  try {
    path = decodeURIComponent(raw);
  } catch {
    return null;
  }
  const clean = normalize(path);
  if (isAbsolute(clean) || clean.startsWith("..") || clean.includes("\0")) return null;
  return clean;
}

// A file reference holds when it is cited on `main` or on a commit SHA and the
// path exists in the checked-out default branch.
export function fileOnDefaultBranch(root) {
  return (ref) => {
    if (ref.kind === "workflow") return existsSync(join(root, ".github", "workflows", ref.file));
    if (!/^(main|[0-9a-f]{7,40})$/.test(ref.ref)) return false;
    const path = safeRepoPath(ref.path);
    return path !== null && existsSync(join(root, path));
  };
}

// `resolved` maps a pull number to "merged" | "open" | "closed" | "issue" | "absent".
export function evaluate({ issue, repo, ownerLogin, label = DEFAULT_LABEL, resolved = {}, fileExists = () => false }) {
  const labels = (issue.labels ?? []).map((l) => (typeof l === "string" ? l : l.name));
  if (issue.pull_request || !labels.includes(label)) return { action: "skip", reason: "pas une fiche d'incident" };
  if (issue.state !== "closed") return { action: "skip", reason: "fiche ouverte" };

  const fiche = parseFiche(issue.body);
  const missing = [];
  for (const key of ["what", "why", "prevention"]) {
    if (fiche[key] === undefined) missing.push(`la rubrique « ${SECTIONS[key]} » est absente`);
    else if (!isFilled(fiche[key])) missing.push(`la rubrique « ${SECTIONS[key]} » est vide`);
  }

  const refs = extractRefs(fiche.prevention, repo, issue.number);
  const rejected = [];
  let accepted = null;
  for (const ref of refs) {
    if (ref.kind === "pull") {
      const state = resolved[ref.number] ?? "absent";
      if (state === "merged") accepted ??= `PR ${ref.cite} fusionnée`;
      else rejected.push(`${ref.cite} (${{ open: "PR non fusionnée", closed: "PR fermée sans fusion", issue: "issue, pas une PR" }[state] ?? "introuvable"})`);
    } else if (ref.kind === "file" || ref.kind === "workflow") {
      if (fileExists(ref)) accepted ??= `\`${ref.cite}\` présent sur main`;
      else rejected.push(`\`${ref.cite}\` (absent de main, ou cité hors de main)`);
    } else {
      rejected.push(`\`${ref.cite}\` (ni PR fusionnée ni fichier)`);
    }
  }

  const closedBy = issue.closed_by?.login ?? "";
  if (fiche.noControlDeclared && !accepted) {
    if (closedBy !== ownerLogin) {
      missing.push(
        `la fiche déclare qu'aucun contrôle n'est possible : elle reste ouverte jusqu'à la décision de l'owner (fermée par \`${closedBy || "inconnu"}\`)`,
      );
    }
    if (missing.length === 0) return { action: "keep", reason: `aucun contrôle possible, fermeture décidée par l'owner (\`${ownerLogin}\`)` };
    return { action: "reopen", missing, rejected };
  }

  if (!accepted && fiche.prevention !== undefined && isFilled(fiche.prevention)) {
    missing.push(`la rubrique « ${SECTIONS.prevention} » ne porte aucun lien admis`);
  }
  if (missing.length === 0) return { action: "keep", reason: accepted };
  return { action: "reopen", missing, rejected };
}

export function renderComment(result, { ownerLogin, label = DEFAULT_LABEL, now = new Date() }) {
  const day = now.toISOString().slice(0, 10);
  if (result.action === "keep") {
    return `${MARKER}\nFermeture admise le ${day} : ${result.reason}.\n`;
  }
  const lines = [
    MARKER,
    `**Fiche rouverte le ${day} : elle ne dit pas encore ce qui empêche le retour de l'incident.**`,
    "",
    "Il manque :",
    ...result.missing.map((m) => `- ${m}`),
  ];
  if (result.rejected.length > 0) {
    lines.push("", "Liens lus et non admis :", ...result.rejected.map((r) => `- ${r}`));
  }
  lines.push(
    "",
    `Lien admis, dans la rubrique « ${SECTIONS.prevention} » : une PR fusionnée de ce dépôt, ou l'adresse d'un fichier présent sur \`main\` (test, règle, workflow).`,
    "",
    `Si aucun contrôle automatique n'est possible : cocher la case de la rubrique « ${SECTIONS.noControl} », expliquer pourquoi dans « ${SECTIONS.prevention} », et laisser la fiche ouverte. Seul l'owner (\`${ownerLogin}\`) la ferme.`,
    "",
    `Si ce n'est pas un incident (fausse alerte, doublon) : retirer le label \`${label}\`, puis fermer.`,
    "",
    "Dépôt public : aucun secret, aucun détail qui aiderait une attaque, aucune donnée de client.",
    "",
  );
  return lines.join("\n");
}

async function resolvePulls(api, refs) {
  const resolved = {};
  for (const ref of refs) {
    if (ref.kind !== "pull" || ref.number in resolved) continue;
    resolved[ref.number] = await api.pullState(ref.number);
  }
  return resolved;
}

// Checks one issue and acts on the verdict. Returns the verdict.
export async function checkIssue({ api, issue, repo, ownerLogin, label = DEFAULT_LABEL, fileExists, dryRun = false, now }) {
  const prevention = parseFiche(issue.body).prevention;
  const resolved = await resolvePulls(api, extractRefs(prevention, repo, issue.number));
  const result = evaluate({ issue, repo, ownerLogin, label, resolved, fileExists });
  if (result.action === "skip" || dryRun) return result;

  const previous = await api.findComment(issue.number, MARKER);
  if (result.action === "keep") {
    // Only settle a comment the gate wrote earlier; a clean closure stays silent.
    if (previous) await api.updateComment(previous.id, renderComment(result, { ownerLogin, label, now }));
    return result;
  }
  const body = renderComment(result, { ownerLogin, label, now });
  if (previous) await api.updateComment(previous.id, body);
  else await api.createComment(issue.number, body);
  await api.reopen(issue.number);
  return result;
}

export async function run({ api, repo, ownerLogin, label = DEFAULT_LABEL, issueNumber, fileExists, dryRun = false, now, log = console.log }) {
  // The list endpoint does not return `closed_by`: each issue is read on its own.
  const numbers = issueNumber ? [issueNumber] : await api.listClosedIncidents(label);
  const results = [];
  for (const number of numbers) {
    const issue = await api.getIssue(number);
    const result = await checkIssue({ api, issue, repo, ownerLogin, label, fileExists, dryRun, now });
    log(`#${issue.number} : ${result.action}${result.reason ? ` (${result.reason})` : ""}${result.missing ? ` — ${result.missing.join(" ; ")}` : ""}`);
    results.push({ number: issue.number, ...result });
  }
  return results;
}

export function githubApi({ token, repo, fetchImpl = fetch }) {
  const root = `https://api.github.com/repos/${repo}`;
  async function call(method, url, body) {
    const res = await fetchImpl(url, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        "user-agent": "incident-issue-gate",
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 404 && method === "GET") return null;
    if (!res.ok) throw new Error(`${method} ${url.replace(root, "")} : HTTP ${res.status}`);
    return res.status === 204 ? null : res.json();
  }
  async function pages(path) {
    const all = [];
    for (let page = 1; page <= 20; page += 1) {
      const batch = await call("GET", `${root}${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`);
      if (batch === null) throw new Error(`GET ${path} : HTTP 404`);
      all.push(...batch);
      if (batch.length < 100) break;
    }
    return all;
  }
  return {
    async getIssue(number) {
      const issue = await call("GET", `${root}/issues/${number}`);
      if (!issue) throw new Error(`issue #${number} introuvable`);
      return issue;
    },
    async listClosedIncidents(label) {
      const list = await pages(`/issues?state=closed&labels=${encodeURIComponent(label)}`);
      return list.filter((i) => !i.pull_request).map((i) => i.number);
    },
    async pullState(number) {
      const pull = await call("GET", `${root}/pulls/${number}`);
      if (pull) return pull.merged ? "merged" : pull.state;
      return (await call("GET", `${root}/issues/${number}`)) ? "issue" : "absent";
    },
    async findComment(number, marker) {
      const comments = await pages(`/issues/${number}/comments`);
      return comments.find((c) => typeof c.body === "string" && c.body.startsWith(marker)) ?? null;
    },
    createComment: (number, body) => call("POST", `${root}/issues/${number}/comments`, { body }),
    updateComment: (id, body) => call("PATCH", `${root}/issues/comments/${id}`, { body }),
    reopen: (number) => call("PATCH", `${root}/issues/${number}`, { state: "open", state_reason: "reopened" }),
  };
}

async function main() {
  const repo = process.env.GITHUB_REPOSITORY ?? "";
  const token = process.env.GH_TOKEN ?? "";
  const ownerLogin = process.env.OWNER_LOGIN ?? "";
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || !token || !ownerLogin) {
    console.error("::error::GITHUB_REPOSITORY, GH_TOKEN et OWNER_LOGIN sont requis.");
    process.exit(1);
  }
  const rawNumber = (process.env.ISSUE_NUMBER ?? "").trim();
  if (rawNumber && !/^\d{1,9}$/.test(rawNumber)) {
    console.error("::error::ISSUE_NUMBER doit être un entier.");
    process.exit(1);
  }
  try {
    const results = await run({
      api: githubApi({ token, repo }),
      repo,
      ownerLogin,
      label: process.env.INCIDENT_LABEL || DEFAULT_LABEL,
      issueNumber: rawNumber ? Number(rawNumber) : undefined,
      fileExists: fileOnDefaultBranch(process.cwd()),
      dryRun: process.env.DRY_RUN === "true",
    });
    const reopened = results.filter((r) => r.action === "reopen").length;
    console.log(`${results.length} fiche(s) lue(s), ${reopened} à rouvrir${process.env.DRY_RUN === "true" ? " (essai à blanc, rien n'est écrit)" : ""}.`);
  } catch (err) {
    // An unreadable API is an outage, not a verdict: nothing is reopened.
    console.error(`::error::Contrôle des fiches d'incident interrompu : ${err.message}`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}

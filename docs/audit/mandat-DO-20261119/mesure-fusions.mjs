#!/usr/bin/env node
// Mesure avant/après du mandat DO (complément n° 1, Marwane, 19 nov. 2026 14:25).
// Lecture seule : `gh api graphql` (requêtes de lecture), aucune écriture, aucun état local.
//
//   node docs/audit/mandat-DO-20261119/mesure-fusions.mjs --since 2026-11-12 --until 2026-11-18 \
//        [--repo ak125/nestjs-remix-monorepo] [--json sortie.json]
//
// Jours en heure de Paris (Europe/Paris), bornes incluses. Par jour :
//   1. pret_vers_fusion_h : délai « PR prête » → « fusionnée » des PR fusionnées ce jour,
//      médiane et 90e centile, en heures. « Prête » = dernière sortie du brouillon
//      (événement ready_for_review) ; à défaut, première approbation ; à défaut, création
//      (PR jamais brouillon).
//      Complément : creation_vers_fusion_h (création → fusion), car la sortie du brouillon et
//      l'approbation tombent souvent dans les minutes qui précèdent la fusion (relevé #2189).
//   2. en_attente_plus_24h : PR ouvertes à la fin du jour, non brouillon à cet instant, prêtes
//      depuis plus de 24 h (même définition de « prête », sans l'approbation).
//   3. maj_main_par_fusion : pour les PR fusionnées ce jour, nombre de mises à jour de la
//      branche avec main, divisé par le nombre de fusions. Mise à jour = commit de fusion
//      porté par la branche (≥ 2 parents : resync-pr.sh, « Update branch ») ou poussée forcée
//      (rebase). Les deux composantes sont aussi données à part.
// Limites assumées : un commit de fusion d'une autre branche que main compte comme mise à
// jour ; une PR de plus de 250 commits est tronquée (signalée dans `avertissements`).
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1]]] : acc), []),
);
const REPO = args.repo ?? "ak125/nestjs-remix-monorepo";
const [OWNER, NAME] = REPO.split("/");
const TZ = "Europe/Paris";
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
if (!DAY_RE.test(args.since ?? "") || !DAY_RE.test(args.until ?? "")) {
  console.error("usage : mesure-fusions.mjs --since AAAA-MM-JJ --until AAAA-MM-JJ [--repo o/n] [--json fichier]");
  process.exit(2);
}

// --- Dates en heure de Paris ------------------------------------------------------
const dayFmt = new Intl.DateTimeFormat("fr-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const parisDay = (iso) => dayFmt.format(new Date(iso));
function offsetMs(utcMs) {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "shortOffset" })
    .formatToParts(new Date(utcMs))
    .find((p) => p.type === "timeZoneName").value; // « GMT+1 »
  const m = name.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  return m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0)) * 60000 : 0;
}
function parisMidnightUtc(day) {
  const [y, mo, d] = day.split("-").map(Number);
  const guess = Date.UTC(y, mo - 1, d);
  return guess - offsetMs(guess);
}
function nextDay(day) {
  const [y, mo, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d + 1)).toISOString().slice(0, 10);
}
const DAYS = [];
for (let d = args.since; d <= args.until; d = nextDay(d)) DAYS.push(d);
const WINDOW_START = parisMidnightUtc(args.since);
const WINDOW_END = parisMidnightUtc(nextDay(args.until));
const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);

// --- Lecture GitHub (GraphQL, lecture seule) ----------------------------------------
const PR_FIELDS = `
  ... on PullRequest {
    number isDraft createdAt mergedAt closedAt author { login }
    timelineItems(first: 100, itemTypes: [READY_FOR_REVIEW_EVENT, CONVERT_TO_DRAFT_EVENT, PULL_REQUEST_REVIEW, HEAD_REF_FORCE_PUSHED_EVENT]) {
      filteredCount
      nodes {
        __typename
        ... on ReadyForReviewEvent { createdAt }
        ... on ConvertToDraftEvent { createdAt }
        ... on HeadRefForcePushedEvent { createdAt }
        ... on PullRequestReview { state submittedAt }
      }
    }
    commits(first: 250) { totalCount nodes { commit { parents { totalCount } } } }
  }`;

function gql(query, variables) {
  const flags = Object.entries(variables).flatMap(([k, v]) => (v == null ? [] : ["-F", `${k}=${v}`]));
  const out = execFileSync("gh", ["api", "graphql", "-f", `query=${query}`, ...flags], {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  return JSON.parse(out).data;
}

function search(q) {
  const query = `query($q: String!, $after: String) {
    search(query: $q, type: ISSUE, first: 50, after: $after) {
      issueCount pageInfo { hasNextPage endCursor } nodes { ${PR_FIELDS} }
    }
  }`;
  const prs = [];
  let after = null;
  for (;;) {
    const { search: s } = gql(query, { q, after });
    prs.push(...s.nodes);
    if (s.issueCount > 1000) throw new Error(`recherche trop large (${s.issueCount} > 1000) : réduire la fenêtre — ${q}`);
    if (!s.pageInfo.hasNextPage) break;
    after = s.pageInfo.endCursor;
  }
  return prs;
}

const created = `created:<=${isoDay(WINDOW_END)}`;
const fetched = new Map();
for (const q of [
  `repo:${REPO} is:pr is:open ${created}`,
  `repo:${REPO} is:pr is:closed closed:>=${isoDay(WINDOW_START - 86400000)} ${created}`,
]) {
  for (const pr of search(q)) fetched.set(pr.number, pr);
}

// --- Modèle par PR ------------------------------------------------------------------
const warnings = [];
function model(pr) {
  const t = (iso) => (iso ? Date.parse(iso) : null);
  const nodes = pr.timelineItems.nodes;
  if (pr.timelineItems.filteredCount > nodes.length) warnings.push(`#${pr.number} : chronologie tronquée (${pr.timelineItems.filteredCount})`);
  if (pr.commits.totalCount > pr.commits.nodes.length) warnings.push(`#${pr.number} : commits tronqués (${pr.commits.totalCount})`);
  const draftEvents = nodes
    .filter((n) => n.__typename === "ReadyForReviewEvent" || n.__typename === "ConvertToDraftEvent")
    .map((n) => ({ at: t(n.createdAt), draft: n.__typename === "ConvertToDraftEvent" }))
    .sort((a, b) => a.at - b.at);
  // État initial : déduit du premier événement, sinon de l'état courant.
  const initialDraft = draftEvents.length ? !draftEvents[0].draft : pr.mergedAt ? false : pr.isDraft;
  const transitions = [{ at: t(pr.createdAt), draft: initialDraft }, ...draftEvents];
  const stateAt = (ms) => transitions.filter((x) => x.at <= ms).at(-1) ?? null;
  // Dernière entrée en « non brouillon » au plus tard à ms
  const readySince = (ms) => {
    const cur = stateAt(ms);
    if (!cur || cur.draft) return null;
    let since = cur.at;
    for (let i = transitions.indexOf(cur); i > 0 && !transitions[i - 1].draft; i -= 1) since = transitions[i - 1].at;
    return since;
  };
  const firstApproval = nodes
    .filter((n) => n.__typename === "PullRequestReview" && n.state === "APPROVED" && n.submittedAt)
    .map((n) => t(n.submittedAt))
    .sort((a, b) => a - b)[0] ?? null;
  const lastReadyEvent = draftEvents.filter((e) => !e.draft).at(-1)?.at ?? null;
  const merged = t(pr.mergedAt);
  const ready = lastReadyEvent ?? firstApproval ?? t(pr.createdAt);
  const mergeCommits = pr.commits.nodes.filter((c) => c.commit.parents.totalCount >= 2).length;
  const forcePushes = nodes.filter((n) => n.__typename === "HeadRefForcePushedEvent").length;
  return {
    number: pr.number,
    author: pr.author?.login ?? null,
    created: t(pr.createdAt),
    closed: t(pr.closedAt),
    merged,
    readyToMergedH: merged ? Math.max(0, merged - ready) / 3600000 : null,
    createdToMergedH: merged ? (merged - t(pr.createdAt)) / 3600000 : null,
    readySince,
    mergeCommits,
    forcePushes,
  };
}
const prs = [...fetched.values()].map(model);

function quantile(sorted, q) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}
const round = (x, d = 1) => (x == null ? null : Math.round(x * 10 ** d) / 10 ** d);

const rows = DAYS.map((day) => {
  const end = parisMidnightUtc(nextDay(day));
  const mergedToday = prs.filter((p) => p.merged && parisDay(p.merged) === day);
  const delays = mergedToday.map((p) => p.readyToMergedH).sort((a, b) => a - b);
  const lifetimes = mergedToday.map((p) => p.createdToMergedH).sort((a, b) => a - b);
  const waiting = prs.filter((p) => {
    if (p.created > end) return false;
    if (p.closed && p.closed <= end) return false;
    const since = p.readySince(end);
    return since != null && end - since > 86400000;
  });
  const mc = mergedToday.reduce((s, p) => s + p.mergeCommits, 0);
  const fp = mergedToday.reduce((s, p) => s + p.forcePushes, 0);
  return {
    jour: day,
    fusions: mergedToday.length,
    pret_vers_fusion_h: { mediane: round(quantile(delays, 0.5)), p90: round(quantile(delays, 0.9)) },
    creation_vers_fusion_h: { mediane: round(quantile(lifetimes, 0.5)), p90: round(quantile(lifetimes, 0.9)) },
    en_attente_plus_24h: waiting.length,
    maj_main_par_fusion: mergedToday.length ? round((mc + fp) / mergedToday.length, 2) : null,
    maj_detail: { commits_de_fusion: mc, poussees_forcees: fp },
    pr_fusionnees: mergedToday.map((p) => p.number).sort((a, b) => a - b),
  };
});

const inWindow = prs.filter((p) => p.merged && p.merged >= WINDOW_START && p.merged < WINDOW_END);
const allDelays = inWindow.map((p) => p.readyToMergedH).sort((a, b) => a - b);
const allLifetimes = inWindow.map((p) => p.createdToMergedH).sort((a, b) => a - b);
const mergedWindow = rows.reduce((s, r) => s + r.fusions, 0);
const updatesWindow = rows.reduce((s, r) => s + r.maj_detail.commits_de_fusion + r.maj_detail.poussees_forcees, 0);
const result = {
  depot: REPO,
  fenetre: { du: args.since, au: args.until, fuseau: TZ },
  genere_le: new Date().toISOString(),
  total: {
    fusions: mergedWindow,
    pret_vers_fusion_h: { mediane: round(quantile(allDelays, 0.5)), p90: round(quantile(allDelays, 0.9)) },
    creation_vers_fusion_h: { mediane: round(quantile(allLifetimes, 0.5)), p90: round(quantile(allLifetimes, 0.9)) },
    maj_main_par_fusion: mergedWindow ? round(updatesWindow / mergedWindow, 2) : null,
  },
  jours: rows,
  avertissements: warnings,
};

if (args.json) writeFileSync(args.json, `${JSON.stringify(result, null, 2)}\n`);
const cell = (x) => (x == null ? "—" : String(x));
console.log(`# Mesure des fusions — ${REPO}, du ${args.since} au ${args.until} (${TZ})\n`);
console.log("| Jour | Fusions | Prête → fusionnée, médiane (h) | 90e centile (h) | Création → fusion, médiane (h) | 90e centile (h) | Ouvertes non brouillon, prêtes depuis > 24 h (fin du jour) | Mises à jour avec main par fusion | dont commits de fusion / poussées forcées |");
console.log("|---|---:|---:|---:|---:|---:|---:|---:|---|");
for (const r of rows) {
  console.log(
    `| ${r.jour} | ${r.fusions} | ${cell(r.pret_vers_fusion_h.mediane)} | ${cell(r.pret_vers_fusion_h.p90)} | ${cell(r.creation_vers_fusion_h.mediane)} | ${cell(r.creation_vers_fusion_h.p90)} | ${r.en_attente_plus_24h} | ${cell(r.maj_main_par_fusion)} | ${r.maj_detail.commits_de_fusion} / ${r.maj_detail.poussees_forcees} |`,
  );
}
const T = result.total;
console.log(`| **Fenêtre** | **${T.fusions}** | **${cell(T.pret_vers_fusion_h.mediane)}** | **${cell(T.pret_vers_fusion_h.p90)}** | **${cell(T.creation_vers_fusion_h.mediane)}** | **${cell(T.creation_vers_fusion_h.p90)}** | — | **${cell(T.maj_main_par_fusion)}** | |`);
if (warnings.length) console.log(`\nAvertissements : ${warnings.join(" ; ")}`);

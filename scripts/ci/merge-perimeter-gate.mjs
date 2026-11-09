#!/usr/bin/env node
// Porte de périmètre de fusion automatique (ADR-123, ADR-124 du vault).
//
//   node scripts/ci/merge-perimeter-gate.mjs <PR>                     évalue puis fusionne
//   node scripts/ci/merge-perimeter-gate.mjs <PR> --dry-run           évalue seulement
//   node scripts/ci/merge-perimeter-gate.mjs <PR> --dry-run --policy-file <f>
//
// La politique est lue sur `main` du vault et la classification sur la base de la PR :
// une PR ne peut donc ni s'autoriser ni se reclasser. Tout doute vaut refus. La fusion
// est épinglée à la tête nommée par l'enregistrement de revue (DoD2) : si `main` a bougé,
// la PR est refusée, à resynchroniser puis à faire réenregistrer. Code de sortie : 0 admise
// ou fusionnée, 1 refusée, 2 usage ou échec après l'acte.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const micromatch = require("micromatch");
const yaml = require("js-yaml");
const { findOwnershipMatch } = require("../registry/check-new-files.js");

const REPO = "ak125/nestjs-remix-monorepo";
const VAULT_REPO = "ak125/governance-vault";
const POLICY_PATH = "ledger/policies/merge-perimeter.v1.json";
const PAUSE_FILE = "/home/deploy/resync/merge-perimeter.pause";
const LOCK_FILE = "/home/deploy/resync/merge-perimeter.lock";

const RISK_ORDER = { low: 0, medium: 1, high: 2, critical: 3 };
const CONFIDENCE_ORDER = { low: 0, medium: 1, high: 2 };
const PASSING_CONCLUSIONS = new Set(["SUCCESS", "NEUTRAL", "SKIPPED"]);
const PROSE_FILE = /\.(?:md|markdown)$/i;

// Format DoD2 (ADR-120 D2) :
//   - [x] Revue niveau <A|B|C> — tête <sha40>, base <sha40>
//         procédure : <…>, par <session, agent ou compte>
const RECORD_LINE =
  /^[ \t]*[-*+][ \t]+\[[xX]\][ \t]*Revue\s+niveau\s+([ABC])\b.*?t[êe]te\s+`?([0-9a-f]{40})`?.*?base\s+`?([0-9a-f]{40})`?/i;
const PROCEDURE_LINE = /^[ \t]*(?:[-*+][ \t]+)?proc[ée]dure[ \t]*:(.*)$/i;
const OUTSIDE_REVIEW = /^\s*revue\s+(?:ind[ée]pendante|humaine)\s*(?:[,;]\s*)?par(?![\p{L}\p{N}])/iu;

const refusal = (code, detail) => ({ code, detail });
const matches = (path, globs) => micromatch.isMatch(path, globs, { dot: true });

/** Vérifie la forme de la politique, pour refuser au lieu d'évaluer à moitié. */
export function validatePolicy(policy) {
  const arrays = [
    "authorized_review_levels",
    "classification_exempt_paths",
    "generated_projections",
    "deny_paths",
    "deny_diff_patterns",
    "deny_head_branch_prefixes",
    "deny_title_patterns",
  ];
  const problems = arrays.filter((key) => !Array.isArray(policy?.[key])).map((key) => `${key} absent`);
  const c = policy?.classification;
  if (policy?.schema_version !== 1) problems.push("schema_version différent de 1");
  if (policy?.repo !== REPO) problems.push("repo différent du monorepo");
  if (policy?.base !== "main") problems.push("base différente de main");
  if (typeof c?.source_path !== "string") problems.push("classification.source_path absent");
  if (!Array.isArray(c?.allowed_domains)) problems.push("classification.allowed_domains absent");
  if (!(c?.max_risk in RISK_ORDER)) problems.push("classification.max_risk invalide");
  if (!(c?.min_source_confidence in CONFIDENCE_ORDER)) problems.push("classification.min_source_confidence invalide");
  return problems;
}

/** Une entrée de classification autorise-t-elle ce chemin ? Renvoie le refus, ou null. */
function classificationRefusal(path, entries, classification) {
  const entry = findOwnershipMatch(path, entries);
  if (!entry) return refusal("UNCLASSIFIED", path);
  const label = `${path} (${entry.domain}, ${entry.risk}, confiance ${entry.sourceConfidence})`;
  if (entry.owner === "__unassigned__" || entry.domain === "UNKNOWN") return refusal("UNCLASSIFIED", label);
  if (!classification.allowed_domains.includes(entry.domain)) return refusal("DOMAIN_REFUSED", label);
  if (!(RISK_ORDER[entry.risk] <= RISK_ORDER[classification.max_risk])) return refusal("RISK_TOO_HIGH", label);
  const confidence = CONFIDENCE_ORDER[entry.sourceConfidence];
  if (!(confidence >= CONFIDENCE_ORDER[classification.min_source_confidence])) {
    return refusal("CONFIDENCE_TOO_LOW", label);
  }
  return null;
}

/** Évalue chaque fichier du diff : `{filename, previous_filename?, patch?}`. */
export function evaluateFiles(policy, entries, files) {
  const refusals = [];
  const diffPatterns = policy.deny_diff_patterns.map((pattern) => new RegExp(pattern));
  for (const file of files) {
    const paths = [file.filename, file.previous_filename].filter(Boolean);
    const handwritten = paths.filter((path) => !matches(path, policy.generated_projections));
    if (handwritten.length === 0) continue;
    let refused = false;
    for (const path of handwritten) {
      let reason = matches(path, policy.deny_paths) ? refusal("DENY_PATH", path) : null;
      if (!reason && !matches(path, policy.classification_exempt_paths)) {
        reason = classificationRefusal(path, entries, policy.classification);
      }
      if (reason) {
        refusals.push(reason);
        refused = true;
      }
    }
    if (refused) continue;
    if (typeof file.patch !== "string") {
      // GitHub omet le patch des binaires et des très gros fichiers : contenu non vérifié.
      refusals.push(refusal("PATCH_UNAVAILABLE", file.filename));
      continue;
    }
    // L'API ne renvoie que les hunks, sans en-têtes de fichier : tout `+` ou `-` est un vrai changement.
    const changed = file.patch.split("\n").filter((line) => /^[+-]/.test(line));
    if (changed.some((line) => diffPatterns.some((pattern) => pattern.test(line)))) {
      refusals.push(refusal("DIFF_PATTERN", file.filename));
    }
  }
  return refusals;
}

/** Lit les enregistrements de revue du corps de la PR. */
export function parseReviewRecords(body) {
  const lines = String(body ?? "").split(/\r?\n/);
  const records = [];
  lines.forEach((line, index) => {
    const anchor = RECORD_LINE.exec(line);
    if (!anchor) return;
    let procedure = "";
    for (let i = index + 1; i < lines.length && lines[i].trim() !== "" && !/^\s*[-*+]\s+\[[ xX]\]/.test(lines[i]); i++) {
      const field = PROCEDURE_LINE.exec(lines[i]);
      if (field) procedure = field[1].trim();
    }
    records.push({ level: anchor[1].toUpperCase(), head: anchor[2], base: anchor[3], procedure });
  });
  return records;
}

/** Applique DoD2 sur la tête courante. Renvoie `{ refusals, level }`. */
export function evaluateReview(policy, body, head, files, base) {
  const records = parseReviewRecords(body);
  const atHead = records.filter((record) => record.head === head);
  if (atHead.length === 0) {
    return { refusals: [refusal(records.length ? "REVIEW_OTHER_HEAD" : "REVIEW_MISSING", head)], level: null };
  }
  const otherBase = atHead.find((record) => record.base !== base);
  if (otherBase) return { refusals: [refusal("REVIEW_OTHER_BASE", otherBase.base)], level: null };
  const refused = atHead.filter((record) => !policy.authorized_review_levels.includes(record.level));
  if (refused.length) return { refusals: [refusal("REVIEW_LEVEL_REFUSED", refused[0].level)], level: refused[0].level };
  const refusals = [];
  const level = atHead.some((record) => record.level === "B") ? "B" : "A";
  if (level === "B" && !atHead.some((record) => record.level === "B" && OUTSIDE_REVIEW.test(record.procedure))) {
    refusals.push(refusal("REVIEW_NOT_INDEPENDENT", "le niveau B exige une revue indépendante ou humaine"));
  }
  if (level === "A") {
    const code = files
      .flatMap((file) => [file.filename, file.previous_filename].filter(Boolean))
      .find((path) => !PROSE_FILE.test(path) && !matches(path, policy.generated_projections));
    if (code) refusals.push(refusal("REVIEW_LEVEL_TOO_LOW", code));
  }
  return { refusals, level };
}

function checkName(check) {
  return check.name ?? check.context ?? "(sans nom)";
}

function checkPasses(check) {
  if (check.__typename === "StatusContext" || check.context) return check.state === "SUCCESS";
  return check.status === "COMPLETED" && PASSING_CONCLUSIONS.has(check.conclusion);
}

/**
 * Le rollup conserve les anciennes exécutions d'un contrôle relancé : seule la dernière
 * compte. Une exécution sans date valide (en file d'attente) est tenue pour la plus récente.
 */
function latestChecks(checks) {
  const stamp = (check) => {
    const time = Date.parse(check.completedAt ?? check.startedAt);
    return time > 0 ? time : Infinity;
  };
  const latest = new Map();
  for (const check of checks) {
    const key = `${check.workflowName ?? ""}\0${checkName(check)}`;
    const current = latest.get(key);
    const newer = current && stamp(check) > stamp(current);
    const tieNotPassing = current && stamp(check) === stamp(current) && !checkPasses(check);
    if (!current || newer || tieNotPassing) latest.set(key, check);
  }
  return [...latest.values()];
}

/** Évalue l'état de la PR et de ses contrôles. */
export function evaluatePullRequest(policy, pr, requiredContexts) {
  const refusals = [];
  if (pr.state !== "OPEN") refusals.push(refusal("PR_NOT_OPEN", pr.state));
  if (pr.baseRefName !== policy.base) refusals.push(refusal("BASE_REFUSED", pr.baseRefName));
  if (pr.isCrossRepository) refusals.push(refusal("FORK_REFUSED", pr.headRefName));
  if (pr.isDraft) refusals.push(refusal("DRAFT", `#${pr.number}`));
  if (policy.deny_title_patterns.some((pattern) => new RegExp(pattern).test(pr.title))) {
    refusals.push(refusal("TITLE_REFUSED", pr.title));
  }
  if (policy.deny_head_branch_prefixes.some((prefix) => pr.headRefName.startsWith(prefix))) {
    refusals.push(refusal("BRANCH_REFUSED", pr.headRefName));
  }
  if (!(pr.assignees ?? []).some((assignee) => !assignee.login.endsWith("[bot]"))) {
    refusals.push(refusal("NO_HUMAN_ASSIGNEE", `#${pr.number}`));
  }
  if (pr.mergeStateStatus !== "CLEAN") refusals.push(refusal("MERGE_STATE_NOT_CLEAN", pr.mergeStateStatus));
  if (pr.behindBy !== 0) refusals.push(refusal("BEHIND_BASE", String(pr.behindBy)));
  const checks = latestChecks(pr.statusCheckRollup ?? []);
  if (checks.length === 0) refusals.push(refusal("CHECKS_ABSENT", "aucun contrôle sur la tête"));
  for (const check of checks) {
    if (!checkPasses(check)) refusals.push(refusal("CHECK_NOT_PASSING", checkName(check)));
  }
  const present = new Set(checks.map(checkName));
  for (const context of requiredContexts) {
    if (!present.has(context)) refusals.push(refusal("CHECK_REQUIRED_ABSENT", context));
  }
  return refusals;
}

function gh(...args) {
  return execFileSync("gh", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
}

function ghRaw(path) {
  return gh("api", "-H", "Accept: application/vnd.github.raw", path);
}

function readPolicy(policyFile) {
  if (policyFile) return { commit: `fichier local ${policyFile}`, policy: JSON.parse(readFileSync(policyFile, "utf8")) };
  const commit = gh("api", `repos/${VAULT_REPO}/commits/main`, "--jq", ".sha").trim();
  return { commit, policy: JSON.parse(ghRaw(`repos/${VAULT_REPO}/contents/${POLICY_PATH}?ref=${commit}`)) };
}

function readFiles(number, expected) {
  const files = [];
  for (let page = 1; ; page++) {
    const batch = JSON.parse(gh("api", `repos/${REPO}/pulls/${number}/files?per_page=100&page=${page}`));
    files.push(...batch);
    if (batch.length < 100) break;
  }
  if (files.length !== expected) throw new Error(`liste de fichiers incomplète (${files.length}/${expected})`);
  return files;
}

function evaluate(number, policyFile) {
  const { commit, policy } = readPolicy(policyFile);
  const problems = validatePolicy(policy);
  if (problems.length) return { commit, policy, refusals: problems.map((p) => refusal("POLICY_INVALID", p)) };
  const refusals = [];
  if (policy.status !== "active") refusals.push(refusal("POLICY_NOT_ACTIVE", String(policy.status)));
  if (existsSync(PAUSE_FILE)) refusals.push(refusal("PAUSED", PAUSE_FILE));
  const fields =
    "number,state,isDraft,title,body,headRefName,headRefOid,baseRefName,baseRefOid,isCrossRepository,assignees,mergeStateStatus,statusCheckRollup,changedFiles";
  const pr = JSON.parse(gh("pr", "view", String(number), "--repo", REPO, "--json", fields));
  const ownership = yaml.load(ghRaw(`repos/${REPO}/contents/${policy.classification.source_path}?ref=${pr.baseRefOid}`));
  if (!Array.isArray(ownership?.entries)) throw new Error("classification illisible");
  const required = JSON.parse(
    gh("api", `repos/${REPO}/branches/${policy.base}`, "--jq", ".protection.required_status_checks.contexts"),
  );
  if (!Array.isArray(required) || required.length === 0) throw new Error("contrôles requis illisibles");
  const files = readFiles(number, pr.changedFiles);
  // L'option `strict` de la protection n'est pas lisible par ce compte : on mesure le retard.
  pr.behindBy = JSON.parse(gh("api", `repos/${REPO}/compare/${pr.baseRefOid}...${pr.headRefOid}?per_page=1`, "--jq", ".behind_by"));
  const review = evaluateReview(policy, pr.body, pr.headRefOid, files, pr.baseRefOid);
  refusals.push(
    ...evaluatePullRequest(policy, pr, required),
    ...review.refusals,
    ...evaluateFiles(policy, ownership.entries, files),
  );
  return { commit, policy, pr, level: review.level, refusals };
}

function merge({ commit, policy, pr, level }) {
  const account = policy.executor?.account ?? "non renseigné";
  gh(
    "pr",
    "comment",
    String(pr.number),
    "--repo",
    REPO,
    "--body",
    `Fusion automatique (ADR-124) : politique \`${commit}\`, tête \`${pr.headRefOid}\`, revue niveau ${level}, compte prévu \`${account}\`.`,
  );
  execFileSync(
    "flock",
    ["-n", "-E", "75", LOCK_FILE, "gh", "pr", "merge", String(pr.number), "--repo", REPO, "--squash", "--match-head-commit", pr.headRefOid],
    { stdio: "inherit" },
  );
  gh("pr", "comment", String(pr.number), "--repo", REPO, "--body", `Fusion automatique terminée pour la tête \`${pr.headRefOid}\`.`);
}

function main(argv) {
  const usage = "usage : merge-perimeter-gate.mjs <PR> [--dry-run [--policy-file <fichier>]]";
  const dryRun = argv.includes("--dry-run");
  const fileFlag = argv.indexOf("--policy-file");
  const policyFile = fileFlag >= 0 ? argv[fileFlag + 1] : undefined;
  const expected = 1 + (dryRun ? 1 : 0) + (fileFlag >= 0 ? 2 : 0);
  if (!/^\d+$/.test(argv[0] ?? "") || argv.length !== expected || (fileFlag >= 0 && (!dryRun || !policyFile))) {
    console.error(usage);
    return 2;
  }
  let result;
  try {
    result = evaluate(Number(argv[0]), policyFile);
  } catch (error) {
    console.error(`REFUS EVALUATION_FAILED : ${error.message}`);
    return 1;
  }
  for (const { code, detail } of result.refusals) console.log(`REFUS ${code} : ${detail}`);
  if (result.refusals.length) return 1;
  if (dryRun) {
    console.log(`ADMISE (simulation) : tête ${result.pr.headRefOid}, revue niveau ${result.level}`);
    return 0;
  }
  try {
    merge(result);
  } catch (error) {
    console.error(`ÉCHEC après évaluation : ${error.message}`);
    return 2;
  }
  console.log(`FUSIONNÉE : tête ${result.pr.headRefOid}`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));

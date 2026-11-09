import assert from "node:assert/strict";
import { test } from "node:test";
import {
  evaluateFiles,
  evaluatePullRequest,
  evaluateReview,
  parseReviewRecords,
  validatePolicy,
} from "./merge-perimeter-gate.mjs";

const HEAD = "a".repeat(40);
const BASE = "b".repeat(40);

const policy = {
  schema_version: 1,
  status: "active",
  repo: "ak125/nestjs-remix-monorepo",
  base: "main",
  authorized_review_levels: ["A", "B"],
  classification: {
    source_path: ".spec/00-canon/repository-registry/ownership.yaml",
    allowed_domains: ["D10", "D12"],
    max_risk: "medium",
    min_source_confidence: "medium",
  },
  classification_exempt_paths: ["docs/**", "backend/tests/**"],
  generated_projections: ["audit/registry/*.json"],
  deny_paths: ["backend/supabase/migrations/**", "**/package.json"],
  deny_diff_patterns: ["noindex", "@(UseGuards|Public)\\b"],
  deny_head_branch_prefixes: ["dependabot/"],
  deny_title_patterns: ["NE PAS FUSIONNER"],
};

const entry = (glob, domain, risk = "medium", sourceConfidence = "high", owner = "@ak125") => ({
  glob,
  domain,
  risk,
  sourceConfidence,
  owner,
});
const entries = [
  entry("backend/src/modules/ok/**", "D10"),
  entry("backend/src/modules/ok/critical/**", "D10", "high"),
  entry("backend/src/modules/heuristic/**", "D12", "low", "low"),
  entry("backend/src/modules/payments/**", "D11", "critical"),
  entry("backend/src/modules/orphan/**", "D10", "low", "high", "__unassigned__"),
];

const file = (filename, patch = "@@ -1 +1 @@\n-old\n+new", extra = {}) => ({ filename, patch, ...extra });
const codes = (refusals) => refusals.map((refusal) => refusal.code);
const checkFiles = (...files) => codes(evaluateFiles(policy, entries, files));

test("un fichier d'un domaine autorisé passe", () => {
  assert.deepEqual(checkFiles(file("backend/src/modules/ok/a.ts")), []);
});

test("une zone STOP est refusée par son domaine", () => {
  assert.deepEqual(checkFiles(file("backend/src/modules/payments/a.ts")), ["DOMAIN_REFUSED"]);
});

test("le glob le plus long décide : le sous-dossier à risque élevé est refusé", () => {
  assert.deepEqual(checkFiles(file("backend/src/modules/ok/critical/a.ts")), ["RISK_TOO_HIGH"]);
});

test("une classification heuristique ne suffit pas", () => {
  assert.deepEqual(checkFiles(file("backend/src/modules/heuristic/a.ts")), ["CONFIDENCE_TOO_LOW"]);
});

test("un chemin sans classe ou sans propriétaire est refusé", () => {
  assert.deepEqual(checkFiles(file("frontend/app/x.ts")), ["UNCLASSIFIED"]);
  assert.deepEqual(checkFiles(file("backend/src/modules/orphan/a.ts")), ["UNCLASSIFIED"]);
});

test("un refus explicite prime sur la classification", () => {
  assert.deepEqual(checkFiles(file("backend/supabase/migrations/1.sql")), ["DENY_PATH"]);
  assert.deepEqual(checkFiles(file("backend/src/modules/ok/package.json")), ["DENY_PATH"]);
});

test("un renommage est évalué sur ses deux chemins", () => {
  const moved = file("backend/src/modules/ok/a.ts", "", { previous_filename: "backend/src/modules/payments/a.ts" });
  assert.deepEqual(checkFiles(moved), ["DOMAIN_REFUSED"]);
});

test("les documents sont dispensés de classification, pas des motifs de diff", () => {
  assert.deepEqual(checkFiles(file("docs/a.md")), []);
  assert.deepEqual(checkFiles(file("docs/a.md", "+noindex")), ["DIFF_PATTERN"]);
});

test("une ligne retirée compte comme une ligne ajoutée, pas le contexte", () => {
  assert.deepEqual(checkFiles(file("backend/src/modules/ok/a.ts", "-@UseGuards(X)")), ["DIFF_PATTERN"]);
  assert.deepEqual(checkFiles(file("backend/src/modules/ok/a.ts", " noindex")), []);
});

test("une ligne de hunk qui ressemble à un en-tête reste un changement", () => {
  assert.deepEqual(checkFiles(file("backend/src/modules/ok/a.ts", "+++ noindex")), ["DIFF_PATTERN"]);
  assert.deepEqual(checkFiles(file("backend/src/modules/ok/a.ts", "--- noindex")), ["DIFF_PATTERN"]);
});

test("un patch absent est refusé, sauf pour une projection générée", () => {
  assert.deepEqual(checkFiles({ filename: "backend/src/modules/ok/a.png" }), ["PATCH_UNAVAILABLE"]);
  assert.deepEqual(checkFiles({ filename: "audit/registry/files.json" }), []);
});

const record = (level, head = HEAD, procedure = "revue indépendante, par session X") =>
  `- [x] Revue niveau ${level} — tête ${head}, base ${BASE}\n      procédure : ${procedure}\n`;
const reviewCodes = (body, files = [file("backend/src/modules/ok/a.ts")]) =>
  codes(evaluateReview(policy, body, HEAD, files, BASE).refusals);

test("lit l'enregistrement DoD2", () => {
  assert.deepEqual(parseReviewRecords(record("B")), [
    { level: "B", head: HEAD, base: BASE, procedure: "revue indépendante, par session X" },
  ]);
});

test("une case non cochée n'est pas un enregistrement", () => {
  assert.deepEqual(parseReviewRecords(record("B").replace("[x]", "[ ]")), []);
});

test("revue de niveau B indépendante sur la tête : admise", () => {
  assert.deepEqual(reviewCodes(record("B")), []);
});

test("revue absente, sur une autre tête, ou de niveau C : refusée", () => {
  assert.deepEqual(reviewCodes("rien"), ["REVIEW_MISSING"]);
  assert.deepEqual(reviewCodes(record("B", "c".repeat(40))), ["REVIEW_OTHER_HEAD"]);
  assert.deepEqual(reviewCodes(record("C")), ["REVIEW_LEVEL_REFUSED"]);
});

test("revue écrite sur une autre base : refusée", () => {
  const other = record("B").replace(BASE, "d".repeat(40));
  assert.deepEqual(reviewCodes(other), ["REVIEW_OTHER_BASE"]);
});

test("une politique limitée au niveau A refuse le niveau B", () => {
  const onlyA = { ...policy, authorized_review_levels: ["A"] };
  const result = evaluateReview(onlyA, record("B"), HEAD, [file("docs/a.md")], BASE);
  assert.deepEqual(codes(result.refusals), ["REVIEW_LEVEL_REFUSED"]);
});

test("niveau C à côté d'un niveau B sur la même tête : refusée", () => {
  assert.deepEqual(reviewCodes(record("B") + "\n" + record("C")), ["REVIEW_LEVEL_REFUSED"]);
});

test("le niveau B en auto-revue, ou nié, est refusé", () => {
  assert.deepEqual(reviewCodes(record("B", HEAD, "auto-review, par session X")), ["REVIEW_NOT_INDEPENDENT"]);
  assert.deepEqual(reviewCodes(record("B", HEAD, "revue indépendante non réalisée, par personne")), [
    "REVIEW_NOT_INDEPENDENT",
  ]);
});

test("le niveau A ne couvre que la prose et les projections", () => {
  const prose = [file("docs/a.md"), { filename: "audit/registry/files.json" }];
  assert.deepEqual(reviewCodes(record("A", HEAD, "auto-review, par session X"), prose), []);
  assert.deepEqual(reviewCodes(record("A", HEAD, "auto-review, par session X")), ["REVIEW_LEVEL_TOO_LOW"]);
});

test("un code renommé en document n'est pas de la prose au niveau A", () => {
  const moved = [file("docs/a.md", "", { previous_filename: "backend/src/modules/ok/a.ts" })];
  assert.deepEqual(reviewCodes(record("A", HEAD, "auto-review, par session X"), moved), ["REVIEW_LEVEL_TOO_LOW"]);
});

const check = (name, conclusion = "SUCCESS") => ({ __typename: "CheckRun", name, status: "COMPLETED", conclusion });
const pr = (overrides = {}) => ({
  number: 1,
  state: "OPEN",
  isDraft: false,
  title: "fix: ok",
  headRefName: "fix/ok",
  baseRefName: "main",
  isCrossRepository: false,
  assignees: [{ login: "ak125" }],
  mergeStateStatus: "CLEAN",
  behindBy: 0,
  statusCheckRollup: [check("ci"), check("lint", "SKIPPED")],
  ...overrides,
});
const prCodes = (overrides, required = ["ci"]) => codes(evaluatePullRequest(policy, pr(overrides), required));

test("une PR conforme passe", () => {
  assert.deepEqual(prCodes({}), []);
});

test("brouillon, titre suspendu, branche exclue, fork, autre base : refusés", () => {
  assert.deepEqual(prCodes({ isDraft: true }), ["DRAFT"]);
  assert.deepEqual(prCodes({ title: "x NE PAS FUSIONNER" }), ["TITLE_REFUSED"]);
  assert.deepEqual(prCodes({ headRefName: "dependabot/npm" }), ["BRANCH_REFUSED"]);
  assert.deepEqual(prCodes({ isCrossRepository: true }), ["FORK_REFUSED"]);
  assert.deepEqual(prCodes({ baseRefName: "release" }), ["BASE_REFUSED"]);
});

test("sans assignee humain : refusée", () => {
  assert.deepEqual(prCodes({ assignees: [] }), ["NO_HUMAN_ASSIGNEE"]);
  assert.deepEqual(prCodes({ assignees: [{ login: "automecanik-agents[bot]" }] }), ["NO_HUMAN_ASSIGNEE"]);
});

test("état de fusion autre que CLEAN, y compris en retard sur main : refusée", () => {
  assert.deepEqual(prCodes({ mergeStateStatus: "BEHIND" }), ["MERGE_STATE_NOT_CLEAN"]);
  assert.deepEqual(prCodes({ mergeStateStatus: "UNSTABLE" }), ["MERGE_STATE_NOT_CLEAN"]);
});

test("une tête qui ne contient pas la base, ou un retard non mesuré : refusée", () => {
  assert.deepEqual(prCodes({ behindBy: 2 }), ["BEHIND_BASE"]);
  assert.deepEqual(prCodes({ behindBy: undefined }), ["BEHIND_BASE"]);
});

test("contrôle en échec, en cours, en attente d'approbation ou absent : refusée", () => {
  assert.deepEqual(prCodes({ statusCheckRollup: [check("ci"), check("x", "FAILURE")] }), ["CHECK_NOT_PASSING"]);
  assert.deepEqual(prCodes({ statusCheckRollup: [check("ci"), check("x", "ACTION_REQUIRED")] }), ["CHECK_NOT_PASSING"]);
  assert.deepEqual(prCodes({ statusCheckRollup: [check("ci"), { name: "x", status: "IN_PROGRESS" }] }), [
    "CHECK_NOT_PASSING",
  ]);
  assert.deepEqual(prCodes({ statusCheckRollup: [check("ci")] }, ["ci", "manquant"]), ["CHECK_REQUIRED_ABSENT"]);
  assert.deepEqual(prCodes({ statusCheckRollup: [] }, []), ["CHECKS_ABSENT"]);
});

test("un statut externe doit réussir", () => {
  assert.deepEqual(prCodes({ statusCheckRollup: [check("ci"), { context: "s", state: "PENDING" }] }), [
    "CHECK_NOT_PASSING",
  ]);
  assert.deepEqual(prCodes({ statusCheckRollup: [check("ci"), { context: "s", state: "SUCCESS" }] }), []);
});

test("une politique de forme invalide est signalée", () => {
  assert.deepEqual(validatePolicy(policy), []);
  assert.ok(validatePolicy({}).length > 0);
  assert.ok(validatePolicy({ ...policy, repo: "autre/depot" }).includes("repo différent du monorepo"));
  assert.ok(validatePolicy({ ...policy, deny_paths: undefined }).includes("deny_paths absent"));
});

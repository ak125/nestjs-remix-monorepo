import assert from "node:assert/strict";
import { test } from "node:test";
import {
  evaluateFiles,
  evaluatePullRequest,
  evaluateReview,
  parseReviewRecords,
  validatePolicy,
} from "./merge-perimeter-gate.mjs";
// Accès par espace de noms : un export absent fait échouer le seul test qui l'appelle.
import * as gate from "./merge-perimeter-gate.mjs";

const HEAD = "a".repeat(40);
const BASE = "b".repeat(40);

const policy = {
  schema_version: 1,
  status: "active",
  repo: "ak125/nestjs-remix-monorepo",
  base: "main",
  authorized_review_levels: ["A"],
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
  executor: { account: "automecanik-agents[bot]" },
  level_b: {
    status: "active",
    source_adr: "ADR-133",
    review_identities: ["automecanik-reviewer[bot]"],
    allowed_paths: ["**/*.md", "audit/**/*.md", "backend/tests/unit/**", "frontend/tests/unit/**"],
    test_paths: ["backend/tests/unit/**", "frontend/tests/unit/**"],
    test_file_globs: ["**/*.test.{ts,tsx,js,mjs}", "**/*.spec.{ts,tsx,js,mjs}"],
    allowed_test_file_statuses: ["added", "modified"],
    deny_paths: [".github/**", ".spec/00-canon/**", "packages/seo-role-contracts/**"],
    stop_zone_fragments: ["payment", "cart"],
    deny_added_line_patterns: ["\\.skip\\(", "\\.only\\("],
  },
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

test("revue de niveau B indépendante sur la tête, niveau B actif : admise", () => {
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

test("niveau B inactif ou absent de la politique : refusé (ADR-133)", () => {
  const inactive = { ...policy, level_b: { ...policy.level_b, status: "inactive" } };
  const absent = { ...policy, level_b: undefined };
  for (const p of [inactive, absent]) {
    const result = evaluateReview(p, record("B"), HEAD, [file("docs/a.md")], BASE);
    assert.deepEqual(codes(result.refusals), ["LEVEL_B_NOT_ACTIVE"]);
  }
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

test("seule la dernière exécution d'un contrôle relancé compte", () => {
  const run = (conclusion, completedAt) => ({ ...check("ci", conclusion), completedAt });
  const early = "2026-11-09T07:00:00Z";
  const late = "2026-11-09T08:00:00Z";
  assert.deepEqual(prCodes({ statusCheckRollup: [run("FAILURE", early), run("SUCCESS", late)] }), []);
  assert.deepEqual(prCodes({ statusCheckRollup: [run("FAILURE", late), run("SUCCESS", early)] }), ["CHECK_NOT_PASSING"]);
  assert.deepEqual(prCodes({ statusCheckRollup: [run("SUCCESS", late), run("FAILURE", late)] }), ["CHECK_NOT_PASSING"]);
});

test("une relance en cours ou en file d'attente l'emporte sur un ancien succès", () => {
  const done = { ...check("ci"), completedAt: "2026-11-09T07:00:00Z" };
  const running = { name: "ci", status: "IN_PROGRESS", startedAt: "2026-11-09T08:00:00Z" };
  const queued = { name: "ci", status: "QUEUED", startedAt: "0001-01-01T00:00:00Z" };
  assert.deepEqual(prCodes({ statusCheckRollup: [done, running] }), ["CHECK_NOT_PASSING"]);
  assert.deepEqual(prCodes({ statusCheckRollup: [queued, done] }), ["CHECK_NOT_PASSING"]);
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

// ---- Niveau B (ADR-133) : politique ----

test("le niveau B ne s'ouvre pas par authorized_review_levels", () => {
  assert.ok(validatePolicy({ ...policy, authorized_review_levels: ["A", "B"] }).length > 0);
  assert.ok(validatePolicy({ ...policy, authorized_review_levels: ["A", "C"] }).length > 0);
});

test("un bloc level_b mal formé est signalé", () => {
  const lb = (over) => ({ ...policy, level_b: { ...policy.level_b, ...over } });
  assert.ok(validatePolicy(lb({ status: "ouvert" })).length > 0);
  assert.ok(validatePolicy(lb({ review_identities: [] })).length > 0);
  assert.ok(validatePolicy(lb({ review_identities: ["ak125"] })).length > 0);
  assert.ok(validatePolicy(lb({ allowed_paths: undefined })).length > 0);
  assert.ok(validatePolicy(lb({ deny_added_line_patterns: undefined })).length > 0);
});

test("l'identité de revue ne peut pas être le compte exécutant", () => {
  const same = { ...policy, level_b: { ...policy.level_b, review_identities: ["automecanik-agents[bot]"] } };
  assert.ok(validatePolicy(same).length > 0);
});

// ---- Niveau B : liste fermée de fichiers ----

const lbFiles = (...files) => codes(gate.evaluateLevelBFiles(policy, files));
const added = (filename, patch = "@@ -0,0 +1 @@\n+it('x', () => {});") => file(filename, patch, { status: "added" });
const modified = (filename, patch = "@@ -1 +1 @@\n-  expect(1).toBe(1);\n+  expect(2).toBe(2);") =>
  file(filename, patch, { status: "modified" });

test("niveau B : Markdown, rapport d'audit et tests unitaires ajoutés ou modifiés passent", () => {
  assert.deepEqual(
    lbFiles(
      modified("docs/a.md"),
      added("audit/x/rapport.md", "+# Rapport"),
      added("backend/tests/unit/a.test.ts"),
      modified("frontend/tests/unit/b.test.tsx"),
    ),
    [],
  );
});

test("niveau B : un fichier hors de la liste fermée est refusé", () => {
  assert.deepEqual(lbFiles(modified("backend/src/modules/ok/a.ts")), ["LEVEL_B_PATH_REFUSED"]);
  assert.deepEqual(lbFiles(modified("backend/tests/e2e/a.test.ts")), ["LEVEL_B_PATH_REFUSED"]);
});

test("niveau B : un fichier source sous un dossier de tests unitaires est refusé", () => {
  assert.deepEqual(lbFiles(added("backend/tests/unit/fixtures/data.ts", "+export const x = 1;")), [
    "LEVEL_B_NOT_TEST_FILE",
  ]);
});

test("niveau B : chemins exclus dans tous les cas, même en Markdown", () => {
  assert.deepEqual(lbFiles(modified(".github/a.md")), ["LEVEL_B_DENY_PATH"]);
  assert.deepEqual(lbFiles(modified(".spec/00-canon/a.md")), ["LEVEL_B_DENY_PATH"]);
  assert.deepEqual(lbFiles(modified("packages/seo-role-contracts/README.md")), ["LEVEL_B_DENY_PATH"]);
});

test("niveau B : un test qui nomme une zone STOP est refusé", () => {
  assert.deepEqual(lbFiles(added("backend/tests/unit/payment-return.test.ts")), ["LEVEL_B_STOP_ZONE"]);
  assert.deepEqual(lbFiles(added("frontend/tests/unit/Cart.server.test.ts")), ["LEVEL_B_STOP_ZONE"]);
  assert.deepEqual(lbFiles(added("backend/tests/unit/payments/a.test.ts")), ["LEVEL_B_STOP_ZONE"]);
});

test("niveau B : un renommage est évalué sur ses deux chemins", () => {
  const moved = file("docs/a.md", "", { status: "renamed", previous_filename: "backend/src/modules/ok/a.ts" });
  assert.deepEqual(lbFiles(moved), ["LEVEL_B_PATH_REFUSED"]);
});

test("niveau B : suppression ou renommage d'un fichier de test refusé", () => {
  assert.deepEqual(lbFiles(file("backend/tests/unit/a.test.ts", "-it('x')", { status: "removed" })), ["TEST_REMOVED"]);
  const renamed = file("backend/tests/unit/b.test.ts", "", {
    status: "renamed",
    previous_filename: "backend/tests/unit/a.test.ts",
  });
  assert.deepEqual(lbFiles(renamed), ["TEST_REMOVED"]);
});

test("niveau B : un cas de test retiré d'un fichier modifié est refusé", () => {
  const patch = "@@ -1,3 +1 @@\n-it('a', () => {});\n-test('b', () => {});\n+it('a', () => {});";
  assert.deepEqual(lbFiles(modified("backend/tests/unit/a.test.ts", patch)), ["TEST_REMOVED"]);
  const retitled = "@@ -1 +1 @@\n-it('ancien titre', () => {});\n+it('nouveau titre', () => {});";
  assert.deepEqual(lbFiles(modified("backend/tests/unit/a.test.ts", retitled)), ["TEST_REMOVED"]);
});

test("niveau B : un test retiré et compensé par un autre ajouté est refusé (revue Codex)", () => {
  const swapped = "@@ -1 +1 @@\n-it('contrôle critique', () => assertSecurity());\n+it('factice', () => {});";
  assert.deepEqual(lbFiles(modified("backend/tests/unit/a.test.ts", swapped)), ["TEST_REMOVED"]);
  const table = "@@ -1,2 +1,2 @@\n-test.each([[1]])('important %s', (n) => expect(n).toBe(1));\n+test('autre', () => {});";
  assert.deepEqual(lbFiles(modified("backend/tests/unit/a.test.ts", table)), ["TEST_REMOVED"]);
  const block = "@@ -1 +1 @@\n-describe('bloc', () => {\n+describe('autre bloc', () => {";
  assert.deepEqual(lbFiles(modified("frontend/tests/unit/a.test.tsx", block)), ["TEST_REMOVED"]);
});

test("niveau B : déclaration retirée sous une forme indirecte : refusée (revue Codex, 2e passage)", () => {
  for (const line of [
    'const caseCritique = test("contrôle", () => {});',
    'suite.test("contrôle", () => {});',
    'test /* commentaire */ ("contrôle", () => {});',
  ]) {
    const patch = `@@ -1 +1 @@\n-${line}\n+expect(1).toBe(1);`;
    assert.deepEqual(lbFiles(modified("backend/tests/unit/a.test.ts", patch)), ["TEST_REMOVED"], line);
  }
  const helper = "@@ -1 +1 @@\n-  expect(result).toBe(1);\n+  expect(result).toBe(2);";
  assert.deepEqual(lbFiles(modified("backend/tests/unit/a.test.ts", helper)), []);
});

test("niveau B : corps d'un test modifié, titre inchangé : admis", () => {
  const body = "@@ -1 +1 @@\n-it('calcule', () => expect(f(1)).toBe(2));\n+it('calcule', () => expect(f(1)).toBe(3));";
  assert.deepEqual(lbFiles(modified("backend/tests/unit/a.test.ts", body)), []);
  const moved = "@@ -1,3 +1,3 @@\n-it('a', () => {});\n it('b', () => {});\n+it('a', () => {});";
  assert.deepEqual(lbFiles(modified("backend/tests/unit/a.test.ts", moved)), []);
});

test("niveau B : .skip( ou .only( ajouté est refusé, retiré est admis", () => {
  assert.deepEqual(lbFiles(added("backend/tests/unit/a.test.ts", "+it.skip('x', () => {});")), ["LEVEL_B_DIFF_PATTERN"]);
  assert.deepEqual(lbFiles(added("frontend/tests/unit/a.test.ts", "+describe.only('x', () => {});")), [
    "LEVEL_B_DIFF_PATTERN",
  ]);
  const unskip = "@@ -1 +1 @@\n-it.skip('x', () => {});\n+it('x', () => {});";
  assert.deepEqual(lbFiles(modified("backend/tests/unit/a.test.ts", unskip)), []);
});

test("niveau B : patch absent ou statut inconnu d'un test : refusé", () => {
  assert.deepEqual(lbFiles({ filename: "backend/tests/unit/a.test.ts", status: "added" }), ["PATCH_UNAVAILABLE"]);
  assert.deepEqual(lbFiles(file("backend/tests/unit/a.test.ts", "+it('x')", { status: "copied" })), ["TEST_REMOVED"]);
});

// ---- Niveau B : approbation par l'identité listée sur la tête exacte ----

const AUTHOR = "automecanik-agents[bot]";
const REVIEWER = "automecanik-reviewer[bot]";
const review = (login, state = "APPROVED", commit_id = HEAD, submitted_at = "2026-11-15T10:00:00Z") => ({
  user: { login, type: login.endsWith("[bot]") ? "Bot" : "User" },
  state,
  commit_id,
  submitted_at,
});
const approvalCodes = (reviews, author = AUTHOR, p = policy) =>
  codes(gate.evaluateApproval(p, { login: author }, reviews, HEAD));

test("approbation de l'identité listée sur la tête exacte : admise", () => {
  assert.deepEqual(approvalCodes([review(REVIEWER)]), []);
  assert.deepEqual(approvalCodes([review(REVIEWER, "COMMENTED", HEAD, "2026-11-15T11:00:00Z"), review(REVIEWER)]), []);
});

test("approbation absente : refusée", () => {
  assert.deepEqual(approvalCodes([]), ["APPROVAL_MISSING"]);
  assert.deepEqual(approvalCodes([review(REVIEWER, "COMMENTED")]), ["APPROVAL_MISSING"]);
});

test("approbation sur une autre tête : refusée", () => {
  assert.deepEqual(approvalCodes([review(REVIEWER, "APPROVED", "c".repeat(40))]), ["APPROVAL_OTHER_HEAD"]);
});

test("approbation par l'auteur : refusée", () => {
  assert.deepEqual(approvalCodes([review(REVIEWER)], REVIEWER), ["APPROVAL_BY_AUTHOR"]);
  assert.deepEqual(approvalCodes([review(AUTHOR)]), ["APPROVAL_BY_AUTHOR"]);
  // Forme de `gh pr view --json author` pour une App : `app/<slug>`.
  assert.deepEqual(approvalCodes([review(REVIEWER)], "app/automecanik-reviewer"), ["APPROVAL_BY_AUTHOR"]);
  assert.deepEqual(approvalCodes([review("automecanik-agents[bot]")], "app/automecanik-agents"), ["APPROVAL_BY_AUTHOR"]);
  assert.deepEqual(approvalCodes([review(REVIEWER)], "app/automecanik-agents"), []);
});

test("approbation par une identité non listée : refusée", () => {
  assert.deepEqual(approvalCodes([review("ak125")]), ["APPROVAL_UNLISTED_IDENTITY"]);
  assert.deepEqual(approvalCodes([review("autre-app[bot]")]), ["APPROVAL_UNLISTED_IDENTITY"]);
});

test("approbation retirée ou suivie d'une demande de changements : refusée", () => {
  const later = "2026-11-15T12:00:00Z";
  assert.deepEqual(approvalCodes([review(REVIEWER), review(REVIEWER, "CHANGES_REQUESTED", HEAD, later)]), [
    "APPROVAL_WITHDRAWN",
  ]);
  assert.deepEqual(approvalCodes([review(REVIEWER, "DISMISSED")]), ["APPROVAL_WITHDRAWN"]);
});

test("approbation sans niveau B actif : refusée", () => {
  const inactive = { ...policy, level_b: { ...policy.level_b, status: "inactive" } };
  assert.deepEqual(approvalCodes([review(REVIEWER)], AUTHOR, inactive), ["LEVEL_B_NOT_ACTIVE"]);
});

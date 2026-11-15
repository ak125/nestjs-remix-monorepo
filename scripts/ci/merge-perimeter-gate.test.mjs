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
// Fichier à la base et à la tête, reconstruit depuis un patch d'un seul tenant (la porte lit les deux par l'API).
const sides = (patch) => {
  const before = [];
  const after = [];
  for (const line of patch.split("\n")) {
    if (line.startsWith("@@") || line.startsWith("\\")) continue;
    if (!line.startsWith("+")) before.push(line.slice(1));
    if (!line.startsWith("-")) after.push(line.slice(1));
  }
  return { base_content: before.join("\n"), head_content: after.join("\n") };
};
const added = (filename, patch = "@@ -0,0 +1 @@\n+it('x', () => {});") =>
  file(filename, patch, { status: "added", head_content: sides(patch).head_content });
const modified = (filename, patch = "@@ -1 +1 @@\n-  expect(1).toBe(1);\n+  expect(2).toBe(2);") =>
  file(filename, patch, { status: "modified", ...sides(patch) });

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

test("niveau B : un Markdown ou un rapport d'audit qui nomme une zone STOP est refusé (revue Codex 9e passage)", () => {
  const withFragments = { ...policy, level_b: { ...policy.level_b, stop_zone_fragments: ["payment", "cart", "checkout", "seo", "production"] } };
  const evaluate = (...files) => codes(gate.evaluateLevelBFiles(withFragments, files));
  assert.deepEqual(evaluate(modified("docs/payment-guide.md")), ["LEVEL_B_STOP_ZONE"]);
  assert.deepEqual(evaluate(modified("audit/production.md")), ["LEVEL_B_STOP_ZONE"]);
  assert.deepEqual(evaluate(modified("docs/seo.md")), ["LEVEL_B_STOP_ZONE"]);
  const moved = file("docs/guide.md", "", { status: "renamed", previous_filename: "docs/checkout.md" });
  assert.deepEqual(evaluate(moved), ["LEVEL_B_STOP_ZONE"]);
  assert.deepEqual(evaluate(modified("docs/guide-agents.md")), []);
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

test("niveau B : test mis en commentaire : refusé (revue Codex, 3e passage)", () => {
  const t = "backend/tests/unit/a.test.ts";
  const block = '@@ -1 +1,3 @@\n-it("contrôle critique", () => assertSecurity());\n+/*\n+it("contrôle critique", () => assertSecurity());\n+*/';
  assert.deepEqual(lbFiles(modified(t, block)), ["TEST_REMOVED"]);
  const around = '@@ -1,2 +1,4 @@\n+/*\n it("contrôle critique", () => assertSecurity());\n+*/\n it("b", () => {});';
  assert.deepEqual(lbFiles(modified(t, around)), ["TEST_REMOVED"]);
  const line = '@@ -1 +1 @@\n-it("contrôle critique", () => assertSecurity());\n+// it("contrôle critique", () => assertSecurity());';
  assert.deepEqual(lbFiles(modified(t, line)), ["TEST_REMOVED"]);
  const inline = '@@ -1 +1 @@\n-it("contrôle critique", () => assertSecurity());\n+/* it("contrôle critique", () => assertSecurity()); */';
  assert.deepEqual(lbFiles(modified(t, inline)), ["TEST_REMOVED"]);
});

test("niveau B : commentaires et chaînes ordinaires d'un test : admis", () => {
  const t = "backend/tests/unit/a.test.ts";
  const globs = '@@ -1,2 +1,3 @@\n it("liste", () => {\n+  expect(list("src/**/*.ts")).toEqual([]); // vide\n });';
  assert.deepEqual(lbFiles(modified(t, globs)), []);
  const url = '@@ -1 +1 @@\n-it("appelle http://x", () => expect(f()).toBe(1));\n+it("appelle http://x", () => expect(f()).toBe(2));';
  assert.deepEqual(lbFiles(modified(t, url)), []);
  const dead = "@@ -1 +0,0 @@\n-// it('ancien test commenté', () => {});";
  assert.deepEqual(lbFiles(modified(t, dead)), []);
});

test("niveau B : JSDoc ajouté, contexte dans un commentaire existant : admis (analyse du fichier entier)", () => {
  const t = "frontend/tests/unit/a.test.ts";
  const jsdoc = '@@ -1 +1,5 @@\n+/**\n+ * Rôle du test.\n+ * @see doc\n+ */\n it("a", () => {});';
  assert.deepEqual(lbFiles(modified(t, jsdoc)), []);
  const inside = '@@ -1,4 +1,4 @@\n /**\n- * ancienne note\n+ * nouvelle note\n  */\n it("a", () => {});';
  assert.deepEqual(lbFiles(modified(t, inside)), []);
});

test("niveau B : test simulé dans une chaîne sur plusieurs lignes : refusé", () => {
  const t = "backend/tests/unit/a.test.ts";
  const fake = '@@ -1 +1,3 @@\n-it("contrôle critique", () => assertSecurity());\n+const s = `\n+it("contrôle critique", () => assertSecurity());\n+`;';
  assert.deepEqual(lbFiles(modified(t, fake)), ["TEST_REMOVED"]);
});

test("niveau B : désactivation sous une autre écriture que .skip( : refusée", () => {
  const t = "backend/tests/unit/a.test.ts";
  for (const form of ['it.skip ("a", () => {});', 'it["skip"]("a", () => {});', 'it.todo("a");', 'it.skipIf(true)("a", () => {});', 'describe . only ("a", () => {});']) {
    const callee = form.startsWith("describe") ? "describe" : "it";
    const patch = `@@ -1 +1 @@\n-${callee}("a", () => {});\n+${form}`;
    assert.deepEqual(lbFiles(modified(t, patch)), ["LEVEL_B_DIFF_PATTERN"], form);
  }
});

test("niveau B : contenu à la base ou à la tête absent, ou fichier non analysable : refusé", () => {
  const t = "backend/tests/unit/a.test.ts";
  const patch = "@@ -1 +1 @@\n-it('a', () => {});\n+it('a', () => { });";
  assert.deepEqual(lbFiles(file(t, patch, { status: "modified", head_content: "it('a', () => { });" })), ["PATCH_UNAVAILABLE"]);
  assert.deepEqual(lbFiles(file(t, patch, { status: "modified", base_content: "it('a', () => {});" })), ["PATCH_UNAVAILABLE"]);
  const broken = "@@ -1 +1 @@\n-it('a', () => {});\n+it('a', () => {";
  assert.deepEqual(lbFiles(modified(t, broken)), ["TEST_REMOVED"]);
});

test("niveau B : test placé sous condition, vidé ou ouvert par return; : refusé (revue Codex, 4e passage)", () => {
  const t = "backend/tests/unit/a.test.ts";
  const base = 'it("contrôle critique", () => {\n  assertSecurity();\n});';
  for (const head of [
    'if (false) it("contrôle critique", () => {\n  assertSecurity();\n});',
    'false && it("contrôle critique", () => {\n  assertSecurity();\n});',
    'for (const x of []) it("contrôle critique", () => {\n  assertSecurity();\n});',
    'it("contrôle critique", () => {\n});',
    'it("contrôle critique", () => {\n  return;\n  assertSecurity();\n});',
    'it("contrôle critique", function () {});',
  ]) {
    const patch = `@@ -1,3 +1,3 @@\n${base.split("\n").map((l) => `-${l}`).join("\n")}\n${head.split("\n").map((l) => `+${l}`).join("\n")}`;
    assert.deepEqual(lbFiles(modified(t, patch)), ["TEST_REMOVED"], head);
  }
});

test("niveau B : test enveloppé, vidé sans bloc ou nom de test redéfini : refusé (revue Codex, 5e passage)", () => {
  const t = "backend/tests/unit/a.test.ts";
  const base = 'it("contrôle critique", () => {\n  assertSecurity();\n});';
  for (const head of [
    // Enveloppe dont le rappel ne s'exécute jamais : la position du test change.
    'const registry = { test(_n, _cb) {} };\nregistry.test("leurre", () => {\n  it("contrôle critique", () => {\n    assertSecurity();\n  });\n});',
    'describe.each([])("leurre", () => {\n  it("contrôle critique", () => {\n    assertSecurity();\n  });\n});',
    'describe("groupe", () => {\n  it("contrôle critique", () => {\n    assertSecurity();\n  });\n});',
    // Rappel sans aucun appel, ou ouvert par un return sans appel.
    'it("contrôle critique", () => undefined);',
    'it("contrôle critique", () => void 0);',
    'it("contrôle critique", () => {\n  return undefined;\n});',
    'it("contrôle critique", () => {\n  const ok = true;\n});',
    'it("contrôle critique", noop);',
    'it("contrôle critique");',
    // Nom de test redéfini : la clé reste la même, le test ne s'exécute plus.
    'const it = (_n, _cb) => {};\nit("contrôle critique", () => {\n  assertSecurity();\n});',
    'import { it } from "./faux";\nit("contrôle critique", () => {\n  assertSecurity();\n});',
    'globalThis.it = () => {};\nit("contrôle critique", () => {\n  assertSecurity();\n});',
    'function wrap(it) {\n  it("contrôle critique", () => {\n    assertSecurity();\n  });\n}',
  ]) {
    const patch = `@@ -1,3 +1,3 @@\n${base.split("\n").map((l) => `-${l}`).join("\n")}\n${head.split("\n").map((l) => `+${l}`).join("\n")}`;
    assert.deepEqual(lbFiles(modified(t, patch)), ["TEST_REMOVED"], head);
  }
});

test("niveau B : nom de test redéfini sous toute forme, global modifié ou code mort : refusé (revue Codex 6e passage, revue de sécurité)", () => {
  const t = "backend/tests/unit/a.test.ts";
  const base = 'it("contrôle critique", () => {\n  assertSecurity();\n});';
  const call = 'it("contrôle critique", () => {\n  assertSecurity();\n});';
  for (const head of [
    `({ it } = { it: (_n, _cb) => {} });\n${call}`,
    `[it] = [() => {}];\n${call}`,
    `it ||= () => {};\n${call}`,
    `Object.defineProperty(globalThis, "it", { value: () => {} });\n${call}`,
    `Reflect.set(globalThis, "it", () => {});\n${call}`,
    `Object.assign(globalThis, { it: () => {} });\n${call}`,
    `const patch = { it: () => {} };\nObject.assign(globalThis, patch);\n${call}`,
    `const k = "i" + "t";\nglobalThis[k] = () => {};\n${call}`,
    `const g = globalThis;\ng.it = () => {};\n${call}`,
    `(globalThis as any).it = () => {};\n${call}`,
    `globalThis["it"] = () => {};\n${call}`,
    `vi.stubGlobal("it", () => {});\n${call}`,
    `vi.mock("vitest", () => ({ it: () => {} }));\n${call}`,
    `import { bench as it } from "vitest";\n${call}`,
    `import { it as check } from "vitest";\ncheck("contrôle critique", () => {\n  assertSecurity();\n});\n${call}`,
    `const t = test;\n${call}`,
    `const maybe = process.env.CI ? it : it.skip;\n${call}`,
    'it("contrôle critique", () => {\n  setup();\n  return;\n  assertSecurity();\n});',
    'it("contrôle critique", () => {\n  setup();\n  throw new Error("x");\n  assertSecurity();\n});',
    'it("contrôle critique", () => {\n  if (false) {\n    assertSecurity();\n  }\n});',
    'it("contrôle critique", () => {\n  if (!true) assertSecurity();\n});',
  ]) {
    const patch = `@@ -1,3 +1,3 @@\n${base.split("\n").map((l) => `-${l}`).join("\n")}\n${head.split("\n").map((l) => `+${l}`).join("\n")}`;
    assert.deepEqual(lbFiles(modified(t, patch)), ["TEST_REMOVED"], head);
  }
});

test("niveau B : référence existante prise comme crédit, code mort imbriqué, objet global ou code dynamique : refusé (revue Codex 7e passage, revue de sécurité)", () => {
  const t = "backend/tests/unit/a.test.ts";
  const call = 'it("contrôle critique", () => {\n  assertSecurity();\n});';
  const collision = `@@ -1,4 +1,4 @@\n-const original = it;\n+const it = (_name, _callback) => {};\n ${call.split("\n").join("\n ")}`;
  assert.deepEqual(lbFiles(modified(t, collision)), ["TEST_REMOVED"], "collision");
  const base = call;
  for (const head of [
    'it("contrôle critique", () => {\n  { return; }\n  assertSecurity();\n});',
    'it("contrôle critique", () => {\n  if (process.env.CI) return;\n  assertSecurity();\n});',
    'it("contrôle critique", () => {\n  if (false as const) assertSecurity();\n});',
    'it("contrôle critique", () => {\n  false && assertSecurity();\n});',
    'it("contrôle critique", () => {\n  1 === 2 ? assertSecurity() : null;\n});',
    'it("contrôle critique", () => {\n  while (true) { break; assertSecurity(); }\n});',
    'it("contrôle critique", () => {\n  done: { break done; assertSecurity(); }\n});',
    'it("contrôle critique", () => {\n  try { throw 0; assertSecurity(); } catch {}\n});',
    'it("contrôle critique", () => (null ?? assertSecurity()));',
    `const k = ["i", "t"].join("");\nReflect.set([globalThis][0], k, () => {});\n${call}`,
    `patchAll(globalThis);\n${call}`,
    `const deps = { globalThis };\n${call}`,
    `const k = ["i", "t"].join("");\nReflect.set(Function("return this")(), k, () => {});\n${call}`,
    `const k = ["i", "t"].join("");\nReflect.set((0, eval)("globalThis"), k, () => {});\n${call}`,
    `const k = ["i", "t"].join("");\nReflect.set((() => {}).constructor("return this")(), k, () => {});\n${call}`,
    `import vm from "node:vm";\nvm.runInThisContext("it = () => {}");\n${call}`,
    `const k = ["i", "t"].join("");\nReflect.set((function () { return this; })(), k, () => {});\n${call}`,
  ]) {
    const patch = `@@ -1,3 +1,3 @@\n${base.split("\n").map((l) => `-${l}`).join("\n")}\n${head.split("\n").map((l) => `+${l}`).join("\n")}`;
    assert.deepEqual(lbFiles(modified(t, patch)), ["TEST_REMOVED"], head);
  }
});

test("niveau B : appel seulement dans une fonction jamais appelée, récepteur de test non suivi : refusé (revue Codex 8e passage)", () => {
  const t = "backend/tests/unit/a.test.ts";
  const swap = (base, head) => `@@ -1,9 +1,9 @@\n${base.split("\n").map((l) => `-${l}`).join("\n")}\n${head.split("\n").map((l) => `+${l}`).join("\n")}`;
  const call = 'it("contrôle critique", () => {\n  assertSecurity();\n});';
  for (const head of [
    'it("contrôle critique", () => {\n  const jamais = () => assertSecurity();\n});',
    'it("contrôle critique", () => {\n  function jamais() { assertSecurity(); }\n});',
    'it("contrôle critique", () => () => assertSecurity());',
  ]) {
    assert.deepEqual(lbFiles(modified(t, swap(call, head))), ["TEST_REMOVED"], head);
  }
  const suite = (from) => `import * as suite from "${from}";\nsuite.test("contrôle critique", () => {\n  assertSecurity();\n});`;
  assert.deepEqual(lbFiles(modified(t, swap(suite("vitest"), suite("./faux.js")))), ["TEST_REMOVED"], "récepteur remplacé");
  assert.deepEqual(lbFiles(modified(t, swap(call, `const suite = { test() {} };\nsuite.test("contrôle critique", () => {\n  assertSecurity();\n});\n${call}`))), ["TEST_REMOVED"], "récepteur ajouté");
});

test("niveau B : méthode .test d'une expression régulière modifiée, boucle while (true) ou do … while (false) : admis (revue Codex 8e passage)", () => {
  const t = "backend/tests/unit/a.test.ts";
  for (const [before, after] of [
    ["  expect(/a/.test(value)).toBe(true);", "  expect(/a/.exec(value)).not.toBeNull();"],
    ["  const motif = /a/;\n  expect(motif.test(value)).toBe(true);", "  expect(value).toContain('a');"],
    ["  expect(1).toBe(1);", "  while (true) {\n    if (ready()) break;\n  }\n  expect(state()).toBe('prêt');"],
    ["  expect(1).toBe(1);", "  do {\n    step();\n  } while (false);\n  expect(state()).toBe('fait');"],
  ]) {
    const b = before.split("\n");
    const a = after.split("\n");
    const patch = `@@ -1,${b.length + 2} +1,${a.length + 2} @@\n it("a", () => {\n${b.map((l) => `-${l}`).join("\n")}\n${a.map((l) => `+${l}`).join("\n")}\n });`;
    assert.deepEqual(lbFiles(modified(t, patch)), [], after);
  }
});

test("niveau B : garde qui lève, condition sur une variable, retour dans un rappel imbriqué : admis", () => {
  const t = "backend/tests/unit/a.test.ts";
  for (const body of [
    '  const r = load();\n  if (!r) throw new Error("absent");\n  expect(r.id).toBe(1);',
    "  const r = load() ?? fallback();\n  r.ok && expect(r.id).toBe(1);",
    "  [1, 2].forEach((x) => {\n    if (!x) return;\n    expect(x).toBeGreaterThan(0);\n  });",
    "  for (const x of load()) {\n    if (!x) continue;\n    expect(x).toBeTruthy();\n  }",
  ]) {
    const patch = `@@ -1,3 +1,${2 + body.split("\n").length} @@\n it("a", () => {\n-  expect(1).toBe(1);\n${body.split("\n").map((l) => `+${l}`).join("\n")}\n });`;
    assert.deepEqual(lbFiles(modified(t, patch)), [], body);
  }
});

test("niveau B : clé calculée test, it ou describe dans un objet de données : admise ; passée à un appel qui modifie : refusée (revue Codex 9e passage)", () => {
  const t = "frontend/tests/unit/a.test.ts";
  const patchOf = (added) => `@@ -1,3 +1,${3 + added.split("\n").length} @@\n it("a", () => {\n   expect(1).toBe(1);\n });\n${added}`;
  for (const added of ['+const fixture = { ["test"]: 1 };', "+const fixture = { [`it`]: 1, ['describe']: 2 };"]) {
    assert.deepEqual(lbFiles(modified(t, patchOf(added))), [], added);
  }
  for (const added of [
    '+Object.assign(globalThis, { ["test"]: () => {} });',
    '+const o = {};\n+o["test"] = 1;',
    '+class C { ["test"]() {} }',
  ]) {
    assert.deepEqual(lbFiles(modified(t, patchOf(added))), ["TEST_REMOVED"], added);
  }
});

test("niveau B : alias d'un nom de test déjà présent à la base, appel aliasé retiré ou fichier modifié ailleurs : refusé (revue Codex 10e passage)", () => {
  const t = "backend/tests/unit/a.test.ts";
  const swap = (base, head) => `@@ -1,9 +1,9 @@\n${base.split("\n").map((l) => `-${l}`).join("\n")}\n${head.split("\n").map((l) => `+${l}`).join("\n")}`;
  const imported = 'import { test as check } from "vitest";';
  const call = 'check("contrôle critique", () => {\n  assertSecurity();\n});';
  assert.deepEqual(lbFiles(modified(t, swap(`${imported}\n${call}`, imported))), ["TEST_REMOVED"], "import aliasé, appel retiré");
  const bound = 'import { test } from "vitest";\nconst check = test;';
  assert.deepEqual(lbFiles(modified(t, swap(`${bound}\n${call}`, bound))), ["TEST_REMOVED"], "const check = test, appel retiré");
  const conditional = 'const describeIf = process.env.DB ? describe : describe.skip;\ndescribeIf("bloc", () => {\n  it("a", () => expect(1).toBe(1));\n});';
  const elsewhere = `@@ -1,4 +1,5 @@\n${conditional.split("\n").map((l) => ` ${l}`).join("\n")}\n+it("b", () => expect(2).toBe(2));`;
  assert.deepEqual(lbFiles(modified(t, elsewhere)), ["TEST_REMOVED"], "alias conditionnel présent à la base");
});

test("niveau B : méthode ou accesseur à clé calculée test, it ou describe dans un objet de données : admis (revue Codex 10e passage)", () => {
  const t = "frontend/tests/unit/a.test.ts";
  const patchOf = (added) => `@@ -1,3 +1,${3 + added.split("\n").length} @@\n it("a", () => {\n   expect(1).toBe(1);\n });\n${added}`;
  for (const added of ['+const fixture = { ["test"]() { return 1; } };', "+const fixture = { get ['it']() { return 1; }, set [`describe`](v) {} };"]) {
    assert.deepEqual(lbFiles(modified(t, patchOf(added))), [], added);
  }
});

test("niveau B : this d'une fonction dans un module (strict) : admis ; dans un script non strict : refusé", () => {
  const t = "frontend/tests/unit/a.test.tsx";
  const mock = "+HTMLDialogElement.prototype.showModal = function () {\n+  this.open = true;\n+};";
  const inModule = `@@ -1,4 +1,${4 + 3} @@\n import { it, expect } from "vitest";\n it("a", () => {\n   expect(1).toBe(1);\n });\n${mock}`;
  assert.deepEqual(lbFiles(modified(t, inModule)), []);
  const inScript = `@@ -1,3 +1,${3 + 3} @@\n it("a", () => {\n   expect(1).toBe(1);\n });\n${mock}`;
  assert.deepEqual(lbFiles(modified(t, inScript)), ["TEST_REMOVED"]);
});

test("niveau B : données nommées test, global modifié à clé littérale, regex .test : admis", () => {
  const t = "frontend/tests/unit/a.test.ts";
  for (const added of [
    "+const rows = [dept('test', 'P1'), { id: 'test', department: \"test\" }];",
    "+const config = { test: /x/, it: 1, describe: 'd' };\n+expect(config.test.source).toBe('x');",
    '+Object.defineProperty(window, "location", { value: { href: "/" } });',
    '+Object.assign(globalThis, { fetch: vi.fn() });',
    "+const { window } = dom;\n+expect(window.document.title).toBe('t');",
    '+vi.spyOn(window, "fetch");\n+expect(typeof window).toBe("object");',
    "+class Page { title() { return this.name; } }",
    "+expect(save).toHaveBeenCalledWith(expect.any(Function));\n+expect(save).toBeInstanceOf(Function);",
    '+const descriptor = Object.getOwnPropertyDescriptor(window, "sessionStorage");',
    "+const window = '30d';\n+const row = { window };",
    "+expect(/a/.test('a')).toBe(true);",
  ]) {
    const patch = `@@ -1,3 +1,${3 + added.split("\n").length} @@\n it("a", () => {\n   expect(1).toBe(1);\n });\n${added}`;
    assert.deepEqual(lbFiles(modified(t, patch)), [], added);
  }
});

test("niveau B : test déjà vide à la base, retour d'une promesse, import depuis vitest, corps changé dans un describe : admis", () => {
  const t = "backend/tests/unit/a.test.ts";
  const empty = '@@ -1,2 +1,3 @@\n it("vide", () => {});\n+it("nouveau", () => expect(1).toBe(1));';
  assert.deepEqual(lbFiles(modified(t, empty)), []);
  const promise = '@@ -1,3 +1,3 @@\n it("async", () => {\n-  return check(1);\n+  return check(2);\n });';
  assert.deepEqual(lbFiles(modified(t, promise)), []);
  const vitest =
    '@@ -1,4 +1,5 @@\n import { describe, it, expect } from "vitest";\n describe("groupe", () => {\n-  it("a", () => expect(1).toBe(1));\n+  it("a", () => expect(2).toBe(2));\n+  it("b", () => expect(3).toBe(3));\n });';
  assert.deepEqual(lbFiles(modified(t, vitest)), []);
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

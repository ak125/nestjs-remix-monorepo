// Tests de scripts/governance/validate-db-retention.js (mandat CA, 2026-11-18).
// Lancer : node --test scripts/governance/__tests__/validate-db-retention.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(here, "..", "validate-db-retention.js");
const FIX = path.join(here, "..", "__fixtures__");
const { validate, compileSchema, loadRules, loadInventory, RULES_PATH, REPO_ROOT } = require(SCRIPT);

const runCli = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8", env: process.env });
const codes = (errs) => new Set(errs.map((e) => e.code));

test("le fichier livré passe (code 0)", () => {
  const r = runCli();
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /conforme/);
});

test("les règles fausses échouent (code 1) avec les erreurs attendues", () => {
  const r = runCli("--rules", path.join(FIX, "db-retention.invalid.yaml"));
  assert.equal(r.status, 1, r.stdout);
  for (const c of ["SCHEMA", "FAMILY_DUP", "PROTECTED_MISSING", "PARTITION_RULE", "FAMILY_UNKNOWN"]) {
    assert.match(r.stderr, new RegExp(`\\[${c}\\]`), `${c} absent de :\n${r.stderr}`);
  }
});

test("l'inventaire faux échoue (code 1) avec les erreurs attendues", () => {
  const r = runCli("--inventory", path.join(FIX, "db-retention-inventory.invalid.json"));
  assert.equal(r.status, 1, r.stdout);
  for (const c of ["CLASS_SUM", "PARTITION_ONCE", "PARTITION_RULE", "FAMILY_UNKNOWN", "PROTECTED_CANDIDATE", "CANDIDATE_CLASS"]) {
    assert.match(r.stderr, new RegExp(`\\[${c}\\]`), `${c} absent de :\n${r.stderr}`);
  }
});

test("--self-test passe", () => {
  const r = runCli("--self-test");
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /règles fausses : PASS/);
  assert.match(r.stdout, /inventaire faux : PASS/);
});

test("fichier absent = échec de fonctionnement (code 2, ligne [FATAL])", () => {
  const r = runCli("--rules", path.join(FIX, "absent.yaml"));
  assert.equal(r.status, 2);
  assert.match(r.stderr, /^\[FATAL\]/);
});

test("« fixé » sans décideur est refusé", () => {
  const rules = loadRules(RULES_PATH);
  const inv = loadInventory(path.join(REPO_ROOT, rules.inventory));
  rules.families[0].status = "fixé";
  assert.ok(codes(validate(rules, inv, compileSchema())).has("SCHEMA"));
  rules.families[0].decided_by = "Marwane";
  rules.families[0].decided_on = "2026-11-20";
  assert.equal(validate(rules, inv, compileSchema()).length, 0);
});

test("une table pieces_media_img* ajoutée aux candidats est refusée", () => {
  const rules = loadRules(RULES_PATH);
  const inv = loadInventory(path.join(REPO_ROOT, rules.inventory));
  const pmi = inv.tables.find((t) => t.name.startsWith("pieces_media_img_"));
  assert.ok(pmi, "aucune copie pieces_media_img_* dans l'inventaire");
  inv.archive_candidates.push({ name: pmi.name });
  assert.ok(codes(validate(rules, inv, compileSchema())).has("PROTECTED_CANDIDATE"));
});

test("une table prévue par une décision, ou à retirer après tarissement, remise en candidate est refusée", () => {
  const rules = loadRules(RULES_PATH);
  const inv = loadInventory(path.join(REPO_ROOT, rules.inventory));
  for (const name of ["support_tickets", "__seo_gamme_conseil"]) {
    const row = inv.tables.find((t) => t.name === name);
    assert.ok(row?.decisions?.numbers?.length, `${name} : décision citée absente`);
    const copy = structuredClone(inv);
    copy.archive_candidates.push({ name });
    assert.ok(codes(validate(rules, copy, compileSchema())).has("CANDIDATE_CLASS"), name);
  }
});

test("une tranche comptée en plus comme table est refusée", () => {
  const rules = loadRules(RULES_PATH);
  const inv = loadInventory(path.join(REPO_ROOT, rules.inventory));
  inv.tables.push({ name: "__seo_cwv_raw_p20261118", kind: "table", class: "vivante", family: "journal" });
  inv.totals.tables_counted += 1;
  inv.totals.plain_tables += 1;
  inv.totals.by_class.vivante += 1;
  assert.ok(codes(validate(rules, inv, compileSchema())).has("PARTITION_ONCE"));
});

test("l'inventaire livré : somme des classes = 363 = 346 + 17, 355 tranches", () => {
  const rules = loadRules(RULES_PATH);
  const inv = loadInventory(path.join(REPO_ROOT, rules.inventory));
  const sum = Object.values(inv.totals.by_class).reduce((a, b) => a + b, 0);
  assert.equal(sum, 363);
  assert.equal(inv.tables.length, 363);
  assert.equal(inv.totals.plain_tables + inv.totals.partitioned_parents, 363);
  assert.equal(inv.partitions.reduce((s, p) => s + p.slices, 0), 355);
});

#!/usr/bin/env node
/**
 * scripts/governance/validate-db-retention.js
 *
 * Contrôle les règles de conservation des tables de massdoc
 * (config/db-retention/retention-rules.yaml) et l'inventaire daté qu'elles
 * citent (audit/massdoc-table-inventory-AAAA-MM-JJ.json). Mandat CA, 2026-11-18.
 *
 * Ce script lit deux fichiers du dépôt. Il ne touche pas à la base.
 *
 * Contrôles (code entre crochets dans la sortie) :
 *   [SCHEMA]               les règles respectent retention-rules.schema.json
 *                          (dont : « décidé » exige decided_by, decided_on et
 *                          decision_ref ; « proposé » n'a ni décideur ni date)
 *   [STATUS_GLOBAL]        le statut du fichier ne dit pas l'état de ses règles :
 *                          « proposé » si aucune n'est décidée, « décidé » si
 *                          toutes le sont, sinon « partiellement décidé »
 *   [FAMILY_DUP]           une famille déclarée deux fois
 *   [PROTECTED_MISSING]    la protection ^pieces_media_img a disparu des règles
 *   [INVENTORY]            inventaire absent ou illisible
 *   [CLASS_SUM]            la somme des classes ne fait pas le total mesuré,
 *                          ou ne correspond pas aux lignes de l'inventaire
 *   [PARTITION_ONCE]       une table partitionnée comptée plus d'une fois, ou
 *                          tranches et parents incohérents avec les totaux
 *   [PARTITION_RULE]       une table partitionnée sans règle, ou une règle
 *                          pour une table partitionnée absente de l'inventaire
 *   [FAMILY_UNKNOWN]       une table rangée dans une famille non déclarée
 *   [PROTECTED_CANDIDATE]  une table protégée parmi les candidats à l'archivage
 *   [CANDIDATE_CLASS]      un candidat qui n'est ni « morte » ni « copie datée »
 *                          (une table « prévue » par une décision n'est jamais candidate)
 *
 * Options :
 *   --rules <fichier>      autre fichier de règles (tests)
 *   --inventory <fichier>  autre inventaire que celui cité par les règles (tests)
 *   --self-test            vérifie que les fixtures fausses sont refusées
 *   --json                 imprime le rapport en JSON
 *
 * Codes de sortie (comme validate-agent-operating-map.js) :
 *   0  conforme
 *   1  au moins une erreur de contrôle
 *   2  échec de fonctionnement (fichier absent, YAML/JSON illisible, schéma
 *      non compilable), imprimé en une ligne [FATAL]. DEBUG=1 pour la pile.
 */

const fs = require("node:fs");
const path = require("node:path");

const yaml = require("js-yaml");
const Ajv2020 = require("ajv/dist/2020");
const addFormats = require("ajv-formats");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const RULES_PATH = path.join(REPO_ROOT, "config/db-retention/retention-rules.yaml");
const SCHEMA_PATH = path.join(REPO_ROOT, "config/db-retention/retention-rules.schema.json");
const FIXTURES = path.join(__dirname, "__fixtures__");

const EXIT_OK = 0;
const EXIT_VALIDATION = 1;
const EXIT_OP_ERROR = 2;

const REQUIRED_PROTECTION = "^pieces_media_img";
// « a_retirer_apres_tarissement » : table plus alimentée, retirée quand plus
// rien ne la lit (décision 32 pour __seo_gamme_conseil) ; jamais archivable.
const CLASSES = ["vivante", "prevue", "a_retirer_apres_tarissement", "copie_datee", "morte", "a_trancher"];
const ARCHIVABLE_CLASSES = new Set(["morte", "copie_datee"]);

class OpError extends Error {}

function readFile(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch (e) {
    throw new OpError(`lecture impossible : ${path.relative(REPO_ROOT, p)} (${e.code || e.message})`);
  }
}

function loadRules(p) {
  try {
    return yaml.load(readFile(p));
  } catch (e) {
    if (e instanceof OpError) throw e;
    throw new OpError(`YAML illisible : ${path.relative(REPO_ROOT, p)} (${e.message.split("\n")[0]})`);
  }
}

function compileSchema() {
  let schema;
  try {
    schema = JSON.parse(readFile(SCHEMA_PATH));
  } catch (e) {
    if (e instanceof OpError) throw e;
    throw new OpError(`schéma JSON illisible : ${e.message}`);
  }
  try {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    return ajv.compile(schema);
  } catch (e) {
    throw new OpError(`schéma non compilable : ${e.message}`);
  }
}

/** Retourne la liste des erreurs [{code, message}] ; vide = conforme. */
function validate(rules, inventory, validateSchema) {
  const errors = [];
  const err = (code, message) => errors.push({ code, message });

  // --- règles ---
  if (!validateSchema(rules)) {
    for (const e of validateSchema.errors) {
      err("SCHEMA", `${e.instancePath || "/"} ${e.message}`);
    }
  }
  const families = Array.isArray(rules?.families) ? rules.families : [];
  const familyIds = new Set();
  for (const f of families) {
    if (familyIds.has(f?.id)) err("FAMILY_DUP", `famille déclarée deux fois : ${f.id}`);
    familyIds.add(f?.id);
  }
  const protectedRx = [];
  for (const p of Array.isArray(rules?.protected) ? rules.protected : []) {
    try {
      protectedRx.push(new RegExp(p.pattern));
    } catch {
      /* déjà signalé par [SCHEMA] (format regex) */
    }
  }
  if (!(rules?.protected || []).some((p) => p?.pattern === REQUIRED_PROTECTION)) {
    err("PROTECTED_MISSING", `la protection ${REQUIRED_PROTECTION} doit rester dans protected`);
  }
  const isProtected = (n) => protectedRx.some((rx) => rx.test(n));

  // --- statut du fichier = état de ses règles (familles et partitions) ---
  const items = [...families, ...(Array.isArray(rules?.partitions) ? rules.partitions : [])];
  const decided = items.filter((x) => x?.status === "décidé").length;
  const expectedStatus =
    decided === 0 ? "proposé" : decided === items.length ? "décidé" : "partiellement décidé";
  if (items.length && rules?.status !== expectedStatus) {
    err(
      "STATUS_GLOBAL",
      `statut « ${rules?.status} » ; ${decided} règle(s) décidée(s) sur ${items.length} : attendu « ${expectedStatus} »`,
    );
  }

  // --- inventaire ---
  if (!inventory || typeof inventory !== "object") {
    err("INVENTORY", "inventaire absent ou vide");
    return errors;
  }
  const tables = Array.isArray(inventory.tables) ? inventory.tables : [];
  const totals = inventory.totals || {};
  const byClass = totals.by_class || {};

  const sumClasses = CLASSES.reduce((s, c) => s + (Number(byClass[c]) || 0), 0);
  const unknownClasses = Object.keys(byClass).filter((c) => !CLASSES.includes(c));
  if (unknownClasses.length) err("CLASS_SUM", `classe inconnue : ${unknownClasses.join(", ")}`);
  if (sumClasses !== totals.tables_counted) {
    err("CLASS_SUM", `somme des classes ${sumClasses} ≠ total mesuré ${totals.tables_counted}`);
  }
  if (tables.length !== totals.tables_counted) {
    err("CLASS_SUM", `${tables.length} lignes dans l'inventaire ≠ total mesuré ${totals.tables_counted}`);
  }
  for (const c of CLASSES) {
    const n = tables.filter((t) => t.class === c).length;
    if (n !== (Number(byClass[c]) || 0)) {
      err("CLASS_SUM", `classe ${c} : ${n} lignes ≠ ${byClass[c] || 0} annoncées`);
    }
  }
  const strayClass = tables.filter((t) => !CLASSES.includes(t.class)).map((t) => t.name);
  if (strayClass.length) err("CLASS_SUM", `lignes sans classe connue : ${strayClass.slice(0, 5).join(", ")}`);

  const names = new Map();
  for (const t of tables) names.set(t.name, (names.get(t.name) || 0) + 1);
  const dupTables = [...names].filter(([, n]) => n > 1).map(([k]) => k);
  if (dupTables.length) err("PARTITION_ONCE", `table comptée plusieurs fois : ${dupTables.join(", ")}`);

  // --- partitions comptées une fois, au parent ---
  const parts = Array.isArray(inventory.partitions) ? inventory.partitions : [];
  const parentSeen = new Map();
  for (const p of parts) parentSeen.set(p.parent, (parentSeen.get(p.parent) || 0) + 1);
  for (const [p, n] of parentSeen) if (n > 1) err("PARTITION_ONCE", `table partitionnée décrite ${n} fois : ${p}`);
  const partitionedRows = tables.filter((t) => t.kind !== "table");
  if (partitionedRows.length !== totals.partitioned_parents || parentSeen.size !== totals.partitioned_parents) {
    err(
      "PARTITION_ONCE",
      `parents partitionnés : ${partitionedRows.length} lignes, ${parentSeen.size} descriptions, ${totals.partitioned_parents} annoncés`,
    );
  }
  if ((totals.plain_tables || 0) + (totals.partitioned_parents || 0) !== totals.tables_counted) {
    err("PARTITION_ONCE", "tables simples + parents partitionnés ≠ total");
  }
  const slices = parts.reduce((s, p) => s + (Number(p.slices) || 0), 0);
  if (slices !== totals.partition_slices_not_counted) {
    err("PARTITION_ONCE", `somme des tranches ${slices} ≠ ${totals.partition_slices_not_counted} annoncées`);
  }
  for (const p of parts) {
    const row = tables.find((t) => t.name === p.parent);
    if (!row || row.kind === "table") err("PARTITION_ONCE", `${p.parent} décrite comme partitionnée sans ligne parent`);
    if (p.empty_slices > p.slices || p.future_slices > p.slices) {
      err("PARTITION_ONCE", `${p.parent} : tranches vides ou futures plus nombreuses que les tranches`);
    }
  }
  const sliceLike = tables.filter((t) => /_p\d{6,8}$|_default$/.test(t.name) && t.kind === "table").map((t) => t.name);
  if (sliceLike.length) err("PARTITION_ONCE", `tranches comptées comme tables : ${sliceLike.slice(0, 5).join(", ")}`);

  // --- une règle par table partitionnée ---
  const ruleParents = new Map();
  for (const r of Array.isArray(rules?.partitions) ? rules.partitions : []) {
    ruleParents.set(r?.parent, (ruleParents.get(r?.parent) || 0) + 1);
  }
  for (const p of parentSeen.keys()) {
    if (!ruleParents.has(p)) err("PARTITION_RULE", `aucune règle pour la table partitionnée ${p}`);
  }
  for (const [p, n] of ruleParents) {
    if (!parentSeen.has(p)) err("PARTITION_RULE", `règle pour ${p}, absente de l'inventaire`);
    if (n > 1) err("PARTITION_RULE", `règle déclarée ${n} fois pour ${p}`);
  }

  // --- familles ---
  const unknownFam = tables.filter((t) => !familyIds.has(t.family));
  for (const t of unknownFam.slice(0, 10)) err("FAMILY_UNKNOWN", `${t.name} : famille « ${t.family} » non déclarée`);
  if (unknownFam.length > 10) err("FAMILY_UNKNOWN", `… et ${unknownFam.length - 10} autres`);

  // --- candidats à l'archivage ---
  const byName = new Map(tables.map((t) => [t.name, t]));
  for (const c of Array.isArray(inventory.archive_candidates) ? inventory.archive_candidates : []) {
    const n = c?.name;
    if (isProtected(n) || new RegExp(REQUIRED_PROTECTION).test(n)) {
      err("PROTECTED_CANDIDATE", `${n} est protégée : jamais candidate`);
    }
    const row = byName.get(n);
    if (!row) err("CANDIDATE_CLASS", `${n} : candidat absent de l'inventaire`);
    else if (!ARCHIVABLE_CLASSES.has(row.class)) err("CANDIDATE_CLASS", `${n} : classe « ${row.class} », pas archivable`);
  }
  return errors;
}

function loadInventory(p) {
  try {
    return JSON.parse(readFile(p));
  } catch (e) {
    if (e instanceof OpError) throw e;
    throw new OpError(`inventaire JSON illisible : ${path.relative(REPO_ROOT, p)} (${e.message})`);
  }
}

function run({ rulesPath, inventoryPath }) {
  const validateSchema = compileSchema();
  const rules = loadRules(rulesPath);
  const invPath = inventoryPath || path.join(REPO_ROOT, String(rules?.inventory || ""));
  if (!inventoryPath && !rules?.inventory) throw new OpError("les règles ne citent aucun inventaire");
  const inventory = loadInventory(invPath);
  return { errors: validate(rules, inventory, validateSchema), rules, inventory, invPath };
}

function selfTest() {
  const validateSchema = compileSchema();
  const goodRules = loadRules(RULES_PATH);
  const goodInv = loadInventory(path.join(REPO_ROOT, goodRules.inventory));
  const cases = [
    {
      label: "règles fausses",
      rules: loadRules(path.join(FIXTURES, "db-retention.invalid.yaml")),
      inventory: goodInv,
      expected: ["SCHEMA", "FAMILY_DUP", "PROTECTED_MISSING", "PARTITION_RULE", "FAMILY_UNKNOWN", "STATUS_GLOBAL"],
    },
    {
      label: "inventaire faux",
      rules: goodRules,
      inventory: loadInventory(path.join(FIXTURES, "db-retention-inventory.invalid.json")),
      expected: ["CLASS_SUM", "PARTITION_ONCE", "PARTITION_RULE", "FAMILY_UNKNOWN", "PROTECTED_CANDIDATE", "CANDIDATE_CLASS"],
    },
  ];
  let ok = true;
  const base = validate(goodRules, goodInv, validateSchema);
  if (base.length) {
    ok = false;
    console.error(`self-test : FAIL — le fichier livré est refusé (${base.map((e) => e.code).join(", ")})`);
  }
  for (const c of cases) {
    const got = new Set(validate(c.rules, c.inventory, validateSchema).map((e) => e.code));
    const missing = c.expected.filter((x) => !got.has(x));
    if (missing.length) {
      ok = false;
      console.error(`self-test ${c.label} : FAIL — non détecté : ${missing.join(", ")} ; obtenu : ${[...got].join(", ")}`);
    } else {
      console.log(`self-test ${c.label} : PASS (${c.expected.join(", ")})`);
    }
  }
  return ok;
}

function main(argv) {
  const args = argv.slice(2);
  const opt = (name) => {
    const i = args.indexOf(name);
    return i >= 0 && args[i + 1] ? path.resolve(args[i + 1]) : null;
  };
  try {
    if (args.includes("--self-test")) {
      process.exit(selfTest() ? EXIT_OK : EXIT_VALIDATION);
    }
    const { errors, invPath } = run({ rulesPath: opt("--rules") || RULES_PATH, inventoryPath: opt("--inventory") });
    if (args.includes("--json")) {
      console.log(JSON.stringify({ ok: errors.length === 0, inventory: path.relative(REPO_ROOT, invPath), errors }, null, 2));
    } else if (errors.length) {
      for (const e of errors) console.error(`[${e.code}] ${e.message}`);
      console.error(`db-retention : ${errors.length} erreur(s)`);
    } else {
      console.log(`db-retention : conforme (${path.relative(REPO_ROOT, invPath)})`);
    }
    process.exit(errors.length ? EXIT_VALIDATION : EXIT_OK);
  } catch (e) {
    console.error(`[FATAL] ${e.message}`);
    if (process.env.DEBUG) console.error(e.stack);
    process.exit(EXIT_OP_ERROR);
  }
}

if (require.main === module) main(process.argv);

module.exports = { validate, compileSchema, loadRules, loadInventory, RULES_PATH, REPO_ROOT };

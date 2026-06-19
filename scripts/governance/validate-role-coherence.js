#!/usr/bin/env node
/**
 * scripts/governance/validate-role-coherence.js
 *
 * Role coherence validator (Phase 0 warn-only) — sibling of
 * validate-skills-frontmatter.js / validate-agent-operating-map.js.
 *
 * Cross-checks the three role sources for internal contradictions :
 *   A. `packages/seo-roles/src/canonical.ts` — enum RoleId (code SoT)
 *   B. `.spec/00-canon/db-governance/legacy-canon-map.md` — §1.1 série
 *      canonique, §2 table legacy→canon, §15 verdict final
 *   C. `.spec/00-canon/role-matrix.md` — sections `### Rn — …` (autorité #1
 *      d'après la hiérarchie déclarée dans legacy-canon-map §0)
 *
 * Checks :
 *   C1. §1.1 et §15 (verdict final) déclarent le même ensemble de rôles
 *   C2. aucun rôle à la fois dans la série canonique §1.1 ET marqué
 *       « hors matrice » dans la table §2
 *   C3. chaque rôle de §1.1 a une section `### Rn —` dans role-matrix.md
 *   C4. chaque membre de l'enum RoleId est classé : présent en §1.1 OU
 *       possède une ligne dédiée dans la table §2
 *
 * Self-contained : parse les sources texte directement — aucune dépendance
 * au build des packages (évite le footgun stale-dist). Fail-loud : exit 2
 * si un parse retourne un ensemble vide ou trop petit (no silent fallback).
 *
 * Flags :
 *   --strict     exit 1 if any error finding (default: warn-only, exit 0)
 *   --self-test  run embedded fixtures and assert C1/C2/C4 detection
 *   --json       print the JSON report to stdout
 *
 * Exit codes (aligned with sibling validators) :
 *   0  OK, or warn-only run (no --strict)
 *   1  validation errors found AND --strict (or self-test failure)
 *   2  operational failure (file absent, parse yields empty set)
 */
"use strict";

const fs = require("fs");
const path = require("path");

const MONOREPO_ROOT = path.resolve(__dirname, "..", "..");
const ENUM_PATH = path.join(
  MONOREPO_ROOT,
  "packages",
  "seo-roles",
  "src",
  "canonical.ts"
);
const CANON_MAP_PATH = path.join(
  MONOREPO_ROOT,
  ".spec",
  "00-canon",
  "db-governance",
  "legacy-canon-map.md"
);
const ROLE_MATRIX_PATH = path.join(
  MONOREPO_ROOT,
  ".spec",
  "00-canon",
  "role-matrix.md"
);

const MIN_ENUM_MEMBERS = 5;
const OFF_MATRIX_RE = /hors matrice/i;

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    strict: args.includes("--strict"),
    json: args.includes("--json"),
    selfTest: args.includes("--self-test"),
  };
}

/** Extract enum RoleId member values from canonical.ts source text. */
function parseEnumMembers(source) {
  const enumBlock = source.match(/export enum RoleId\s*\{([\s\S]*?)\}/);
  if (!enumBlock) return [];
  const members = [];
  const memberRe = /^\s*([A-Z0-9_]+)\s*=\s*"([A-Z0-9_]+)"/gm;
  let m;
  while ((m = memberRe.exec(enumBlock[1])) !== null) members.push(m[2]);
  return members;
}

/** Extract `- \`SYMBOL\` …` bullet symbols between a heading and the next one. */
function parseBulletSection(markdown, headingRe) {
  const lines = markdown.split("\n");
  const symbols = [];
  let inSection = false;
  for (const line of lines) {
    if (headingRe.test(line)) {
      inSection = true;
      continue;
    }
    if (inSection && /^#{1,3}\s/.test(line)) break;
    if (!inSection) continue;
    const m = line.match(/^-\s+`([A-Z0-9_]+)`/);
    if (m) symbols.push(m[1]);
  }
  return symbols;
}

/** Extract §2 table rows: first-cell symbol → full row text. */
function parseRoleNameTable(markdown) {
  const lines = markdown.split("\n");
  const rows = new Map();
  let inSection = false;
  for (const line of lines) {
    if (/^#\s+2\.\s+Table canonique — noms de roles/.test(line)) {
      inSection = true;
      continue;
    }
    if (inSection && /^#\s/.test(line)) break;
    if (!inSection) continue;
    const m = line.match(/^\|\s*`([A-Z0-9_]+)`\s*\|/);
    if (m) rows.set(m[1], line);
  }
  return rows;
}

/** Extract `### Rn — …` heading prefixes (R0..R9) from role-matrix.md. */
function parseMatrixSections(markdown) {
  const prefixes = new Set();
  const re = /^###\s+(R\d)\s+—/gm;
  let m;
  while ((m = re.exec(markdown)) !== null) prefixes.add(m[1]);
  return prefixes;
}

/**
 * Run the four coherence checks against parsed sources.
 * Returns { errors: [{check, message}] }.
 */
function runChecks({ enumMembers, serie11, verdict15, tableRows, matrixPrefixes }) {
  const errors = [];
  const set11 = new Set(serie11);
  const set15 = new Set(verdict15);

  // C1 — §1.1 vs §15 verdict final
  for (const role of set11) {
    if (!set15.has(role)) {
      errors.push({
        check: "C1_serie_vs_verdict",
        message: `"${role}" est dans la série canonique §1.1 mais absent du verdict final §15 — contradiction interne legacy-canon-map.md`,
      });
    }
  }
  for (const role of set15) {
    if (!set11.has(role)) {
      errors.push({
        check: "C1_serie_vs_verdict",
        message: `"${role}" est dans le verdict final §15 mais absent de la série canonique §1.1 — contradiction interne legacy-canon-map.md`,
      });
    }
  }

  // C2 — rôle canonique §1.1 marqué « hors matrice » dans la table §2
  for (const role of set11) {
    const row = tableRows.get(role);
    if (row && OFF_MATRIX_RE.test(row)) {
      errors.push({
        check: "C2_canonical_marked_off_matrix",
        message: `"${role}" est déclaré canonique en §1.1 MAIS marqué « hors matrice » dans la table §2 — double statut contradictoire`,
      });
    }
  }

  // C3 — chaque rôle canonique a une section dans role-matrix.md
  for (const role of set11) {
    const prefix = role.match(/^(R\d)/);
    if (prefix && !matrixPrefixes.has(prefix[1])) {
      errors.push({
        check: "C3_missing_matrix_section",
        message: `"${role}" est canonique en §1.1 mais role-matrix.md n'a aucune section "### ${prefix[1]} —"`,
      });
    }
  }

  // C4 — chaque membre enum est classé quelque part
  for (const member of enumMembers) {
    if (!set11.has(member) && !tableRows.has(member)) {
      errors.push({
        check: "C4_enum_member_unclassified",
        message: `RoleId.${member} (canonical.ts) n'est ni dans la série canonique §1.1 ni classé dans la table §2 — statut indéfini`,
      });
    }
  }

  return { errors };
}

function loadSources() {
  for (const [label, p] of [
    ["canonical.ts", ENUM_PATH],
    ["legacy-canon-map.md", CANON_MAP_PATH],
    ["role-matrix.md", ROLE_MATRIX_PATH],
  ]) {
    if (!fs.existsSync(p)) {
      throw Object.assign(new Error(`source absente : ${label} (${p})`), { fatal: true });
    }
  }
  const enumSource = fs.readFileSync(ENUM_PATH, "utf8");
  const canonMap = fs.readFileSync(CANON_MAP_PATH, "utf8");
  const roleMatrix = fs.readFileSync(ROLE_MATRIX_PATH, "utf8");

  const parsed = {
    enumMembers: parseEnumMembers(enumSource),
    serie11: parseBulletSection(canonMap, /^##\s+1\.1\s/),
    verdict15: parseBulletSection(canonMap, /^##\s+Matrice role canonique figee/),
    tableRows: parseRoleNameTable(canonMap),
    matrixPrefixes: parseMatrixSections(roleMatrix),
  };

  // Fail-loud — un parse vide signifie un format qui a dérivé, pas un repo sain.
  const guards = [
    [parsed.enumMembers.length >= MIN_ENUM_MEMBERS, `enum RoleId : ${parsed.enumMembers.length} membre(s) parsé(s) (< ${MIN_ENUM_MEMBERS})`],
    [parsed.serie11.length > 0, "série canonique §1.1 : 0 rôle parsé"],
    [parsed.verdict15.length > 0, "verdict final §15 : 0 rôle parsé"],
    [parsed.tableRows.size > 0, "table §2 : 0 ligne parsée"],
    [parsed.matrixPrefixes.size > 0, "role-matrix.md : 0 section ### Rn parsée"],
  ];
  for (const [ok, msg] of guards) {
    if (!ok) throw Object.assign(new Error(`parse fail-loud — ${msg}`), { fatal: true });
  }
  return parsed;
}

function selfTest() {
  const fixtureEnum = `export enum RoleId {
  R0_HOME = "R0_HOME",
  R1_ROUTER = "R1_ROUTER",
  R2_PRODUCT = "R2_PRODUCT",
  R6_SUPPORT = "R6_SUPPORT",
  GHOST_ROLE = "GHOST_ROLE",
}`;
  const fixtureMap = [
    "## 1.1 Serie canonique des roles metier",
    "- `R0_HOME` — Accueil",
    "- `R1_ROUTER` — Router",
    "- `R2_PRODUCT` — Produit",
    "- `R6_SUPPORT` — Support",
    "## 1.2 Autre",
    "# 2. Table canonique — noms de roles",
    "| `R6_SUPPORT` | hors matrice editoriale coeur | tolere local |",
    "# 3. Suite",
    "## Matrice role canonique figee",
    "- `R0_HOME`",
    "- `R1_ROUTER`",
    "- `R2_PRODUCT`",
    "## Couche gouvernance figee",
  ].join("\n");
  const fixtureMatrix = "### R0 — HOME\n### R1 — ROUTER\n### R2 — PRODUCT\n### R6 — GUIDE\n";

  const { errors } = runChecks({
    enumMembers: parseEnumMembers(fixtureEnum),
    serie11: parseBulletSection(fixtureMap, /^##\s+1\.1\s/),
    verdict15: parseBulletSection(fixtureMap, /^##\s+Matrice role canonique figee/),
    tableRows: parseRoleNameTable(fixtureMap),
    matrixPrefixes: parseMatrixSections(fixtureMatrix),
  });

  const got = new Set(errors.map((e) => e.check));
  const expected = ["C1_serie_vs_verdict", "C2_canonical_marked_off_matrix", "C4_enum_member_unclassified"];
  const missing = expected.filter((c) => !got.has(c));
  if (missing.length > 0) {
    process.stderr.write(`[SELF-TEST FAIL] checks non déclenchés sur fixture : ${missing.join(", ")}\n`);
    process.exit(1);
  }
  process.stdout.write(`[validate-role-coherence] self-test OK — ${errors.length} erreur(s) attendue(s) détectée(s) (${expected.join(", ")})\n`);
  process.exit(0);
}

function main() {
  const args = parseArgs();
  if (args.selfTest) return selfTest();

  const parsed = loadSources();
  const { errors } = runChecks(parsed);
  const ok = errors.length === 0;

  if (args.json) {
    process.stdout.write(
      JSON.stringify(
        {
          ok,
          schemaVersion: "1.0.0",
          generatedAt: new Date().toISOString(),
          enumMemberCount: parsed.enumMembers.length,
          serie11Count: parsed.serie11.length,
          verdict15Count: parsed.verdict15.length,
          errorCount: errors.length,
          errors,
        },
        null,
        2
      ) + "\n"
    );
  } else {
    process.stdout.write(
      `[validate-role-coherence] enum=${parsed.enumMembers.length} membres · §1.1=${parsed.serie11.length} rôles · §15=${parsed.verdict15.length} rôles · table §2=${parsed.tableRows.size} lignes\n`
    );
    for (const e of errors) {
      process.stdout.write(`  ✗ [${e.check}] ${e.message}\n`);
    }
    process.stdout.write(
      ok
        ? "\n[validate-role-coherence] OK — aucune incohérence détectée\n"
        : `\n[validate-role-coherence] ${errors.length} incohérence(s) détectée(s)${args.strict ? "" : " (warn-only — exit 0 ; utiliser --strict pour exit 1)"}\n`
    );
  }

  process.exit(ok ? 0 : args.strict ? 1 : 0);
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    process.stderr.write(`[FATAL] ${e.message}\n`);
    if (process.env.DEBUG) process.stderr.write(e.stack + "\n");
    process.exit(2);
  }
}

module.exports = {
  parseEnumMembers,
  parseBulletSection,
  parseRoleNameTable,
  parseMatrixSections,
  runChecks,
};

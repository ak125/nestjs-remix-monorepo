#!/usr/bin/env node
// =============================================================================
// Env-var drift ratchet — structural enforcement of "verify existing before
// inventing" for environment variables.
// =============================================================================
// WHY this exists (the incident this prevents):
//   CLAUDE.md §"Vérifier l'existant AVANT d'inventer" cites repeated incidents
//   where an agent invented an ENV var (GOOGLE_SA_CLIENT_EMAIL, GSC_PROPERTY_URL,
//   automecanik.fr) while the codebase already declared the canonical one
//   (GSC_CLIENT_EMAIL, GSC_SITE_URL, automecanik.com). That rule is BEHAVIORAL
//   and cannot be enforced on an agent's reasoning. This gate enforces the
//   OUTCOME instead: a `process.env.X` reference that is declared NOWHERE
//   (neither in backend/.env.example nor in the PREPROD Zod contract) fails CI.
//   Policing the artifact, not the reasoning — structural, not a nag.
//
// HOW it extends (not duplicates) existing governance:
//   This is the "drift detection + ratchet" Phase 2 announced in the docstring
//   of backend/src/contract/env-contract/preprod.schema.ts. The declared SoT is
//   reused as-is: backend/.env.example  ∪  the Zod schema object keys (parsed
//   from preprod.schema.ts — no TS import, so this CI gate stays decoupled from
//   backend compilation, same anti-coupling stance as pr-dod-gate.mjs).
//
// RATCHET semantics (no big-bang .strict() — that would break CI immediately,
//   ~dozens of undeclared vars exist today):
//   - undeclared   = used \ declared          (current drift surface)
//   - newDrift     = undeclared \ baseline    → EXIT 1 (a freshly-invented var)
//   - staleBaseline= baseline \ undeclared    → WARN (burn-down: now declared or
//                                                gone — run --update-baseline)
//   The baseline (env-var-drift-baseline.json) is the frozen allowlist of the
//   pre-existing drift. New code may only reference declared vars; the baseline
//   is meant to shrink over time, never grow.
//
// V1 scope (anti-bricolage, self-contained):
//   - Scans backend/src/**/*.ts(x) only (matches backend/.env.example scope).
//   - Detects static access: process.env.X, process.env['X'], and
//     `const { X } = process.env` destructuring. Dynamic access
//     (process.env[variable]) is NOT detectable → this is a LOWER BOUND, stated
//     explicitly here (no silent under-reporting).
//   - Pure functions are exported for the companion test (check-env-var-drift.test.mjs).
//
// Usage:
//   node scripts/ci/check-env-var-drift.mjs              # check (exit 1 on new drift)
//   node scripts/ci/check-env-var-drift.mjs --update-baseline
//   node --test scripts/ci/check-env-var-drift.test.mjs  # unit tests
//
// CI wiring (.github/workflows/*.yml) is an owner step — that path is Airlock-
// protected and the env-contract Phase 2 is governed (vault ADR). This file is
// the runnable foundation, ready to be wired.
// =============================================================================

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");

const PATHS = {
  envExample: join(REPO_ROOT, "backend", ".env.example"),
  schema: join(
    REPO_ROOT,
    "backend/src/contract/env-contract/preprod.schema.ts",
  ),
  backendSrc: join(REPO_ROOT, "backend", "src"),
  baseline: join(__dirname, "env-var-drift-baseline.json"),
};

const ENV_KEY = "[A-Z_][A-Z0-9_]*";

// --- Pure functions (exported for tests) -----------------------------------

/** Keys declared on the left of `=` in a .env.example file (comments ignored). */
export function parseEnvExampleKeys(content) {
  const keys = new Set();
  for (const line of content.split("\n")) {
    const m = line.match(new RegExp(`^(${ENV_KEY})=`));
    if (m) keys.add(m[1]);
  }
  return keys;
}

/** Object keys of the Zod schema (`KEY: z.…`) — parsed, not imported. */
export function parseSchemaKeys(content) {
  const keys = new Set();
  const re = new RegExp(`(${ENV_KEY})\\s*:\\s*z\\.`, "g");
  let m;
  while ((m = re.exec(content)) !== null) keys.add(m[1]);
  return keys;
}

/**
 * Env vars statically referenced in a source string:
 *   process.env.X | process.env['X'] | const { X, Y } = process.env
 */
export function extractUsedEnvVars(source) {
  const used = new Set();

  const dot = new RegExp(`process\\.env\\.(${ENV_KEY})`, "g");
  let m;
  while ((m = dot.exec(source)) !== null) used.add(m[1]);

  const bracket = new RegExp(
    `process\\.env\\[\\s*['"](${ENV_KEY})['"]\\s*\\]`,
    "g",
  );
  while ((m = bracket.exec(source)) !== null) used.add(m[1]);

  const destructure = /(?:const|let|var)\s*\{([^}]*)\}\s*=\s*process\.env\b/g;
  while ((m = destructure.exec(source)) !== null) {
    for (const part of m[1].split(",")) {
      const km = part.trim().match(new RegExp(`^(${ENV_KEY})`));
      if (km) used.add(km[1]);
    }
  }
  return used;
}

/**
 * @returns {{undeclared:string[], newDrift:string[], staleBaseline:string[]}}
 *   all sorted ascending.
 */
export function computeDrift({ usedVars, declaredVars, baseline }) {
  const baselineSet = new Set(baseline);
  const undeclared = [...usedVars].filter((v) => !declaredVars.has(v)).sort();
  const undeclaredSet = new Set(undeclared);
  return {
    undeclared,
    newDrift: undeclared.filter((v) => !baselineSet.has(v)),
    staleBaseline: [...baselineSet].filter((v) => !undeclaredSet.has(v)).sort(),
  };
}

// --- I/O helpers ------------------------------------------------------------

function listSourceFiles(dir) {
  const out = [];
  for (const ent of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!ent.isFile()) continue;
    const name = ent.name;
    if (!/\.(ts|tsx)$/.test(name)) continue;
    if (/\.(test|spec|d)\.(ts|tsx)$/.test(name)) continue;
    const full = join(ent.parentPath ?? ent.path, name);
    if (full.includes("/node_modules/") || full.includes("/dist/")) continue;
    out.push(full);
  }
  return out;
}

function collectUsedVars() {
  const used = new Set();
  for (const file of listSourceFiles(PATHS.backendSrc)) {
    for (const v of extractUsedEnvVars(readFileSync(file, "utf8"))) used.add(v);
  }
  return used;
}

function loadDeclaredVars() {
  const declared = parseEnvExampleKeys(readFileSync(PATHS.envExample, "utf8"));
  for (const k of parseSchemaKeys(readFileSync(PATHS.schema, "utf8"))) {
    declared.add(k);
  }
  return declared;
}

function loadBaseline() {
  try {
    const parsed = JSON.parse(readFileSync(PATHS.baseline, "utf8"));
    return Array.isArray(parsed.vars) ? parsed.vars : [];
  } catch {
    // Missing baseline is a hard error, not a silent empty-allowlist (which would
    // let ALL current drift count as "new" and fail noisily, or worse, be reset).
    throw new Error(
      `Baseline introuvable/illisible: ${PATHS.baseline}. ` +
        `Génère-le avec: node scripts/ci/check-env-var-drift.mjs --update-baseline`,
    );
  }
}

// --- Modes ------------------------------------------------------------------

function runCheck() {
  const declaredVars = loadDeclaredVars();
  const usedVars = collectUsedVars();
  const baseline = loadBaseline();
  const { undeclared, newDrift, staleBaseline } = computeDrift({
    usedVars,
    declaredVars,
    baseline,
  });

  if (staleBaseline.length > 0) {
    console.warn(
      `::warning::env-var baseline contient ${staleBaseline.length} entrée(s) périmée(s) ` +
        `(désormais déclarées ou supprimées). Burn-down : --update-baseline.`,
    );
    for (const v of staleBaseline) console.warn(`  · ${v}`);
  }

  if (newDrift.length > 0) {
    console.error(
      "::error::Nouvelle variable d'environnement non déclarée détectée " +
        "(convention inventée — voir CLAUDE.md §\"Vérifier l'existant AVANT d'inventer\").",
    );
    console.error("");
    for (const v of newDrift) console.error(`  ❌ process.env.${v}`);
    console.error("");
    console.error("Fix (dans l'ordre) :");
    console.error(
      "  1. grep la racine — la convention existe peut-être déjà " +
        "(ex. GSC_CLIENT_EMAIL, pas GOOGLE_SA_CLIENT_EMAIL).",
    );
    console.error("  2. sinon, déclare la var dans backend/.env.example.");
    console.error(
      "  3. SoT contrat runtime : backend/src/contract/env-contract/preprod.schema.ts",
    );
    process.exit(1);
  }

  console.log(
    `✓ env-var drift OK — ${usedVars.size} vars référencées, ` +
      `${undeclared.length} dans la baseline, 0 nouvelle dérive.`,
  );
  process.exit(0);
}

function runUpdateBaseline() {
  const declaredVars = loadDeclaredVars();
  const usedVars = collectUsedVars();
  const undeclared = [...usedVars].filter((v) => !declaredVars.has(v)).sort();
  const payload = {
    $comment:
      "Frozen allowlist of pre-existing undeclared env vars (drift surface). " +
      "Ratchet: this list may shrink, never grow. Regenerate with --update-baseline. " +
      "See scripts/ci/check-env-var-drift.mjs.",
    generatedFrom: "backend/src vs backend/.env.example ∪ preprod.schema.ts",
    count: undeclared.length,
    vars: undeclared,
  };
  writeFileSync(PATHS.baseline, JSON.stringify(payload, null, 2) + "\n");
  console.log(
    `✓ Baseline écrite : ${undeclared.length} var(s) → ${PATHS.baseline}`,
  );
  process.exit(0);
}

// --- Entrypoint -------------------------------------------------------------

function main() {
  const arg = process.argv[2];
  if (arg === "--update-baseline") return runUpdateBaseline();
  return runCheck();
}

// Only run when invoked directly (allows importing pure fns in the test file).
if (resolve(process.argv[1] ?? "") === resolve(fileURLToPath(import.meta.url))) {
  main();
}

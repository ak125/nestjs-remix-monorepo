#!/usr/bin/env node
// scripts/seo/check-url-immutability.mjs
//
// R-SEO-09 Phase 2 — URL Immutability Gate (AST canonical surface diff).
//
// ## Why
// Modifier silencieusement une URL canon (rename de route Remix, canonical
// link dans `meta`, sitemap entry, loader return canonical) casse instantanément
// le SEO acquis sur la page : 30j à 90j de requêtes désindexées par GSC, perte
// de positions stables, contenu orphelin. Cf. mémoires `feedback_no_url_changes_ever`
// + `seo-r2-thin-content-root-cause`.
//
// ## Phase 2 vs Phase 1
// Phase 1 (retiré dans cette PR) hard-block toute modification de route file
// par chemin pur, sans analyse de contenu. False positive sur 100% des codemods
// className-only (PR #602/#608/#620/#610 — 5 PRs successivement scopées
// components-only à cause de Phase 1).
//
// Phase 2 extrait la **canonical surface** AST via @typescript-eslint/parser
// pour chaque route file modifié, et compare base vs head :
//   - PASS si surface deep-equal (codemod-safe / JSX-restructure / formatting)
//   - HARD BLOCK si différence détectée
//   - OVERRIDE possible via label PR `r-seo-09-override` (ENV `R_SEO_09_OVERRIDE=1`)
//
// La canonical surface couvre : filename, default export name, `meta` return,
// `links` return, `handle` return, et le set des clés canonical-affecting du
// `loader` return (`canonical|canonicalUrl|url|seo|meta`). Voir
// `lib/canonical-surface-extractor.mjs` pour la spec complète.
//
// ## Scope MVP — Phase 2 (intentionnellement étroit)
// Hard-block sur changements détectés dans la canonical surface des routes :
//   - frontend/app/routes/**/*.tsx (Remix : filename = URL pattern)
//
// Warn-only (path-only, no AST diff) sur surface URL-adjacente :
//   - backend/src/modules/seo/**/*canonical*.ts (URL builders)
//   - backend/src/modules/seo/**/*seo-canonical*.ts
//   - backend/src/modules/seo/**/*sitemap*.ts
//   - backend/src/modules/seo/**/*redirect*.ts
//
// Phase 3 (follow-up) : extension AST aux services backend canonical.
//
// ## Modes
//   --pr     : exit 1 si HARD BLOCK détecté (CI default)
//   --audit  : print findings, exit 0 (dry-run mode pour observation)
//
// ## Variables
//   BASE_REF       : (default origin/main) — base à comparer
//   R_SEO_09_OVERRIDE : (set non-empty pour bypass — label r-seo-09-override)
//
// Référence canon : R-SEO-09 (governance-vault/ledger/rules/rules-seo-pagerole.md)

import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve, basename } from "node:path";
import { argv, env, exit, stderr, stdout } from "node:process";
import { fileURLToPath } from "node:url";
import { extractCanonicalSurface } from "./lib/canonical-surface-extractor.mjs";

const ROUTE_RE = /^frontend\/app\/routes\/.+\.tsx$/;
const WARN_RE = /^backend\/src\/modules\/seo\/.*(?:canonical|seo-canonical|sitemap|redirect).*\.ts$/;

function parseArgs(args) {
  const out = { mode: "pr", help: false };
  for (const a of args) {
    if (a === "--pr") out.mode = "pr";
    else if (a === "--audit") out.mode = "audit";
    else if (a === "-h" || a === "--help") out.help = true;
  }
  return out;
}

function printHelp() {
  stdout.write(`Usage: node scripts/seo/check-url-immutability.mjs [--pr | --audit]

R-SEO-09 Phase 2 URL Immutability Gate (AST canonical surface diff).

Modes:
  --pr      Exit 1 on hard-block findings (CI default).
  --audit   Print findings, exit 0 (observation mode).

Env vars:
  BASE_REF              Base ref to diff against (default: origin/main).
  R_SEO_09_OVERRIDE     Set non-empty to bypass hard-blocks
                        (mapped from PR label r-seo-09-override by workflow).

Exit codes:
  0   OK or override active.
  1   Hard block (--pr mode only).
  2   Internal error (bad base ref, parse failure, …).
`);
}

// Run git with positional args (no shell expansion). Returns stdout on success
// or null on non-zero exit. Critical for handling paths containing shell
// metacharacters (`$`, backticks, etc.) — common in Remix route filenames
// like `admin.gammes-seo.$pgId.tsx` where `$pgId` is a route param marker.
function tryRun(args) {
  const r = spawnSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (r.status !== 0) return null;
  return r.stdout;
}

function ensureBaseRef(baseRef) {
  // Try local resolve first ; fall back to fetching the underlying remote ref.
  if (tryRun(["rev-parse", "--verify", baseRef]) !== null) return;
  const local = baseRef.startsWith("origin/") ? baseRef.slice("origin/".length) : baseRef;
  tryRun(["fetch", "origin", local, "--quiet"]);
  if (tryRun(["rev-parse", "--verify", baseRef]) === null) {
    stderr.write(`::error:: BASE_REF '${baseRef}' not resolvable. Fetch failed or ref missing.\n`);
    exit(2);
  }
}

function listChangedFiles(baseRef) {
  // `git diff --name-status BASE...HEAD` — emits one line per changed file.
  // For renames (R100), `git diff` emits "R100\told\tnew" → emit both paths
  // marked respectively as DELETE-on-old / ADD-on-new so the AST diff catches
  // the filename change (canonical surface).
  const raw = tryRun(["diff", "--name-status", `${baseRef}...HEAD`]);
  if (raw === null) return [];
  const entries = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    const parts = line.split("\t");
    const status = parts[0];
    if (status.startsWith("R")) {
      // Rename: parts = [R100, oldPath, newPath]
      entries.push({ status: "D", path: parts[1] });
      entries.push({ status: "A", path: parts[2] });
    } else {
      entries.push({ status, path: parts[1] });
    }
  }
  return entries;
}

function readBaseVersion(baseRef, path) {
  return tryRun(["show", `${baseRef}:${path}`]);
}

function readHeadVersion(path) {
  const abs = resolve(path);
  if (!existsSync(abs)) return null;
  return readFileSync(abs, "utf8");
}

function safeExtract(source, filename) {
  if (source == null) return null;
  try {
    return extractCanonicalSurface(source, filename);
  } catch (err) {
    return { __parseError: err.message, filename };
  }
}

function diffSurfaces(base, head) {
  // Returns null if surfaces match, else a normalized human-readable diff.
  const a = JSON.stringify(base, null, 2);
  const b = JSON.stringify(head, null, 2);
  if (a === b) return null;
  return { base: a, head: b };
}

function formatBlock(entry) {
  const lines = [`  - [${entry.status}] ${entry.path}`];
  if (entry.diff?.base) lines.push("      base-surface:", indent(entry.diff.base, 8));
  if (entry.diff?.head) lines.push("      head-surface:", indent(entry.diff.head, 8));
  return lines.join("\n");
}

function indent(text, n) {
  const pad = " ".repeat(n);
  return text.split("\n").map((l) => pad + l).join("\n");
}

async function main() {
  const args = parseArgs(argv.slice(2));
  if (args.help) {
    printHelp();
    return 0;
  }

  const baseRef = env.BASE_REF || "origin/main";
  // Validate BASE_REF shape strictly before any use as a git argument.
  // git ref names are restricted to a known character class ; this
  // explicit allowlist prevents accidental shell-metacharacter exposure
  // (defence in depth — we already use spawnSync with arg arrays, no
  // shell, so injection is structurally impossible, but CodeQL flags
  // the env-to-spawn flow without static proof).
  if (!/^[A-Za-z0-9][A-Za-z0-9._\-/]{0,254}$/.test(baseRef) || baseRef.includes("..")) {
    stderr.write(`::error:: BASE_REF '${baseRef}' is not a valid git ref name.\n`);
    exit(2);
  }
  const overrideActive = Boolean(env.R_SEO_09_OVERRIDE && env.R_SEO_09_OVERRIDE !== "0" && env.R_SEO_09_OVERRIDE !== "false");

  ensureBaseRef(baseRef);

  const changed = listChangedFiles(baseRef);
  if (changed.length === 0) {
    stdout.write(`OK: no changes vs ${baseRef}\n`);
    return 0;
  }

  const hardBlocks = [];
  const warns = [];

  for (const entry of changed) {
    if (WARN_RE.test(entry.path)) {
      warns.push(entry);
      continue;
    }
    if (!ROUTE_RE.test(entry.path)) continue;

    const baseSource = entry.status === "A" ? null : readBaseVersion(baseRef, entry.path);
    const headSource = entry.status === "D" ? null : readHeadVersion(entry.path);

    const baseSurface = safeExtract(baseSource, basename(entry.path));
    const headSurface = safeExtract(headSource, basename(entry.path));

    if (baseSurface?.__parseError || headSurface?.__parseError) {
      hardBlocks.push({
        ...entry,
        diff: {
          base: baseSurface?.__parseError ? `parse error: ${baseSurface.__parseError}` : "",
          head: headSurface?.__parseError ? `parse error: ${headSurface.__parseError}` : "",
        },
      });
      continue;
    }

    const diff = diffSurfaces(baseSurface, headSurface);
    if (diff !== null) hardBlocks.push({ ...entry, diff });
  }

  if (warns.length > 0) {
    stdout.write(`::warning:: URL-adjacent surface touched (R-SEO-09 manual review needed):\n`);
    for (const w of warns) stdout.write(`  - [${w.status}] ${w.path}\n`);
    stdout.write("\n");
  }

  if (hardBlocks.length === 0) {
    if (warns.length === 0) stdout.write(`OK: no R-SEO-09 canonical surface touched vs ${baseRef}\n`);
    else stdout.write(`OK: R-SEO-09 canonical surface unchanged in routes (warn-only adjacent surface above).\n`);
    return 0;
  }

  if (overrideActive) {
    stdout.write(`::warning:: R-SEO-09 Phase 2 OVERRIDE active (R_SEO_09_OVERRIDE / r-seo-09-override label).\n`);
    stdout.write(`Canonical surface changes detected but pass-through approved by reviewer:\n`);
    for (const b of hardBlocks) stdout.write(formatBlock(b) + "\n");
    stdout.write("\n");
    return 0;
  }

  if (args.mode === "pr") {
    stderr.write(`::error:: HARD BLOCK — R-SEO-09 canonical surface modified in routes:\n`);
    for (const b of hardBlocks) stderr.write(formatBlock(b) + "\n");
    stderr.write("\n");
    stderr.write(`If this change is intentional and approved by the SEO owner, document\n`);
    stderr.write(`the trade-off in the PR body and add label \`r-seo-09-override\` to bypass.\n`);
    stderr.write(`\n`);
    stderr.write(`Reference: governance-vault rules-seo-pagerole.md (R-SEO-09 Phase 2)\n`);
    return 1;
  }

  // --audit mode : print + exit 0
  stdout.write(`::warning:: AUDIT MODE — would HARD BLOCK on:\n`);
  for (const b of hardBlocks) stdout.write(formatBlock(b) + "\n");
  stdout.write("\nRun with --pr to enforce.\n");
  return 0;
}

const isMain = fileURLToPath(import.meta.url) === resolve(argv[1] ?? "");
if (isMain) {
  main().then((code) => exit(code)).catch((err) => {
    stderr.write(`Internal error: ${err?.stack ?? err}\n`);
    exit(2);
  });
}

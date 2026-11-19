#!/usr/bin/env node
/**
 * Projections générées du Repository Control Plane : liste unique et contrôles
 * (mandat DO, 2026-11-19).
 *
 * Ces fichiers sont régénérés sur `main` par le workflow de régénération
 * (`registry-deps-self-heal.yml`, branche `chore/registry-self-heal`), plus dans
 * chaque PR. Une PR ordinaire n'en modifie aucun : ses contrôles les recalculent
 * depuis son propre arbre (`npm run registry:regenerate`).
 *
 * Lecteurs de la liste : `.husky/pre-commit`, les workflows de contrôle, le
 * workflow de régénération et le patch de `resync-pr.sh`. Ajouter une projection
 * se fait ici seulement.
 *
 *   node scripts/registry/generated-projections.js list
 *   node scripts/registry/generated-projections.js check --scope pr     [--base <ref>] [--warn]
 *   node scripts/registry/generated-projections.js check --scope staged [--base <ref>] [--warn]
 *   node scripts/registry/generated-projections.js check --scope bot    [--base <ref>]
 *   node scripts/registry/generated-projections.js check --scope worktree
 *
 * Portées :
 *   pr       : un fichier généré touché par la branche (diff merge-base...HEAD) doit
 *              être identique à celui de la base. Une branche peut donc reprendre la
 *              version de main, jamais en diverger.
 *   staged   : même règle, appliquée à l'index (hook pre-commit).
 *   bot      : la branche ne touche QUE des fichiers générés (PR de régénération).
 *   worktree : les modifications non commitées ne touchent QUE des fichiers générés
 *              (garde de portée du workflow de régénération, avant commit).
 *
 * Sorties : 0 = conforme ; 1 = écart (0 avec --warn, écart imprimé en avertissement) ;
 * 2 = usage ou base illisible (jamais masqué par --warn).
 */
'use strict';

const { execFileSync } = require('node:child_process');

const GENERATED_PROJECTIONS = Object.freeze([
  // Inventaire profond (npm run audit:inventory)
  'audit/cycle-map.json',
  'audit/db-usage-map.json',
  'audit/dead-code-candidates.json',
  'audit/duplicate-map.json',
  'audit/dynamic-import-edges.json',
  'audit/module-boundaries.json',
  'audit/runtime-entrypoints.json',
  // Registry L1 + L3 + carte LLM (npm run registry)
  'audit/registry/files.json',
  'audit/registry/runtime.json',
  'audit/registry/deps.json',
  'audit/registry/db.json',
  'audit/registry/rpc.json',
  'audit/registry/canonical.json',
  '.claude/knowledge/REPO_MAP.md',
  // Inventaire de nettoyage PR-8 (npm run audit:cleanup-candidates)
  'audit/cleanup/pr-8-controlled-cleanup-candidates.json',
  'audit/cleanup/pr-8-deletion-proof.md',
  // Inventaire de modernisation, déjà régénéré sur main avant ce mandat
  'audit/dependencies/dependency-modernization-inventory.json',
]);

const GENERATED_SET = new Set(GENERATED_PROJECTIONS);

function isGenerated(path) {
  return GENERATED_SET.has(path);
}

/** Sépare des chemins en { generated, other } (ordre conservé, sans doublon). */
function partition(paths) {
  const generated = [];
  const other = [];
  for (const p of [...new Set(paths.filter(Boolean))]) {
    (isGenerated(p) ? generated : other).push(p);
  }
  return { generated, other };
}

/**
 * Verdict pur. `touched` = chemins touchés ; `sameAsBase(path)` dit si le contenu
 * de la branche (ou de l'index) est identique à celui de la base.
 */
function evaluate(scope, touched, sameAsBase = () => false) {
  const { generated, other } = partition(touched);
  if (scope === 'pr' || scope === 'staged') {
    const diverging = generated.filter((p) => !sameAsBase(p));
    return { ok: diverging.length === 0, offending: diverging, generated, other };
  }
  if (scope === 'bot' || scope === 'worktree') {
    return { ok: other.length === 0, offending: other, generated, other };
  }
  throw new Error(`portée inconnue : ${scope}`);
}

function git(args, opts = {}) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });
}

function lines(text) {
  return text.split('\n').map((l) => l.trim()).filter(Boolean);
}

function blobAt(ref, path) {
  try {
    return git(['rev-parse', `${ref}:${path}`]).trim();
  } catch {
    return null; // absent à cette révision
  }
}

function indexBlob(path) {
  const out = git(['ls-files', '--stage', '--', path]).trim();
  return out ? out.split(/\s+/)[1] : null; // supprimé de l'index
}

function collect(scope, base) {
  if (scope === 'worktree') {
    // -z : chemins bruts, sans guillemets ; « XY chemin », un renommage ajoute l'ancien nom à part.
    const entries = git(['status', '--porcelain', '-z', '--untracked-files=all', '--no-renames']).split('\0');
    return { touched: entries.filter((e) => e.length > 3).map((e) => e.slice(3)), sameAsBase: () => false };
  }
  git(['rev-parse', '--verify', '--quiet', `${base}^{commit}`]);
  if (scope === 'staged') {
    const touched = lines(git(['diff', '--cached', '--name-only', '--no-renames']));
    return { touched, sameAsBase: (p) => indexBlob(p) === blobAt(base, p) };
  }
  const touched = lines(git(['diff', '--name-only', '--no-renames', `${base}...HEAD`]));
  return { touched, sameAsBase: (p) => blobAt('HEAD', p) === blobAt(base, p) };
}

const MESSAGES = {
  pr: 'fichiers générés modifiés par la branche (différents de la base)',
  staged: "fichiers générés indexés, différents de la base",
  bot: 'chemins non générés dans une PR de régénération',
  worktree: 'chemins non générés modifiés par la régénération',
};

const REMEDY = {
  pr: 'Reprendre la version de la base : git checkout <base> -- <fichiers>. main les régénère après fusion.',
  staged: 'Retirer de l\'index ou reprendre la version de la base : git checkout <base> -- <fichiers>.',
  bot: 'Une PR de régénération ne porte que des projections générées.',
  worktree: 'La régénération ne doit écrire que des projections générées : arrêt, rien n\'est commité.',
};

function parseArgs(argv) {
  const args = { cmd: argv[0], scope: null, base: 'origin/main', warn: false };
  for (let i = 1; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--scope') args.scope = argv[++i];
    else if (a === '--base') args.base = argv[++i];
    else if (a === '--warn') args.warn = true;
    else throw new Error(`argument inconnu : ${a}`);
  }
  return args;
}

function main(argv) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (e) {
    console.error(e.message);
    return 2;
  }
  if (args.cmd === 'list') {
    process.stdout.write(`${GENERATED_PROJECTIONS.join('\n')}\n`);
    return 0;
  }
  if (args.cmd !== 'check' || !MESSAGES[args.scope]) {
    console.error('usage : generated-projections.js list | check --scope pr|staged|bot|worktree [--base <ref>] [--warn]');
    return 2;
  }
  let verdict;
  try {
    const { touched, sameAsBase } = collect(args.scope, args.base);
    verdict = evaluate(args.scope, touched, sameAsBase);
  } catch (e) {
    console.error(`[generated-projections] base « ${args.base} » illisible ou git en échec : ${e.message.split('\n')[0]}`);
    return 2;
  }
  if (verdict.ok) {
    console.log(`[generated-projections] ${args.scope} : conforme (${verdict.generated.length} généré(s), ${verdict.other.length} autre(s)).`);
    return 0;
  }
  const level = args.warn ? 'AVERTISSEMENT' : 'ERREUR';
  console.error(`[generated-projections] ${level} — ${MESSAGES[args.scope]} :`);
  for (const p of verdict.offending) console.error(`  - ${p}`);
  console.error(`  ${REMEDY[args.scope]}`);
  return args.warn ? 0 : 1;
}

module.exports = { GENERATED_PROJECTIONS, isGenerated, partition, evaluate, parseArgs };

if (require.main === module) process.exit(main(process.argv.slice(2)));

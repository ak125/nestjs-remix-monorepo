#!/usr/bin/env node
// scripts/audit/bump-dependency-family.mjs
// Bump every member of a dependency family (defined in audit/dependencies/family-overlay.yaml)
// using npm-check-updates with a literal filter.
//
// Determinism guarantees:
//   - ncu version pinned via `npx -p npm-check-updates@<NCU_VERSION>` (no dynamic @latest of the tool itself,
//     per MEMORY feedback_ci_no_dynamic_latest_install).
//   - Member list comes from a versioned YAML overlay (the SoT), not from on-disk discovery.
//   - Wildcard expansion is bounded by package-lock.json (installed packages only).
//
// Usage:
//   node scripts/audit/bump-dependency-family.mjs --family <slug> --target latest|minor|patch [--dry-run]

import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { parse as parseYaml } from 'yaml';

// Bumping ncu itself is a deliberate, separate PR — never bundled with a family bump.
export const NCU_VERSION = '17.1.18';

export async function resolveMembers(familySlug, overlayPath) {
  const raw = await readFile(overlayPath, 'utf8');
  const overlay = parseYaml(raw);
  const family = overlay.families?.find((f) => f.family === familySlug);
  if (!family) {
    const known = (overlay.families || []).map((f) => f.family).join(', ');
    throw new Error(`Unknown family "${familySlug}". Known: ${known}`);
  }
  return family.members || [];
}

export function expandWildcards(members, lockfile) {
  const installed = new Set();
  for (const pkgPath of Object.keys(lockfile.packages || {})) {
    if (!pkgPath.startsWith('node_modules/')) continue;
    const name = pkgPath.replace(/^node_modules\//, '');
    if (name.includes('/node_modules/')) continue; // skip nested
    installed.add(name);
  }
  const out = new Set();
  for (const m of members) {
    if (m.endsWith('/*')) {
      const prefix = m.slice(0, -1); // "@scope/"
      for (const name of installed) {
        if (name.startsWith(prefix)) out.add(name);
      }
    } else if (m.includes('*')) {
      const re = new RegExp('^' + m.replace(/\*/g, '.*') + '$');
      for (const name of installed) if (re.test(name)) out.add(name);
    } else {
      out.add(m);
    }
  }
  return [...out];
}

export function buildNcuArgs({ members, target, dryRun }) {
  // ncu's default mode IS dry-run (reports upgrades without writing). The -u
  // flag is what applies them. There is no --dry-run flag in npm-check-updates.
  //
  // We intentionally do NOT pass --errorLevel 2 — it makes ncu exit 1 whenever
  // upgrades are available, which is the entire reason we run this tool.
  // Default --errorLevel 1 means exit 0 unless ncu itself errors.
  const args = ['--target', target, '--filter', members.join(','), '--deep'];
  if (!dryRun) args.push('-u');
  return args;
}

async function main() {
  const { values } = parseArgs({
    options: {
      family: { type: 'string' },
      target: { type: 'string', default: 'latest' },
      'dry-run': { type: 'boolean', default: false },
      overlay: { type: 'string', default: 'audit/dependencies/family-overlay.yaml' },
      lockfile: { type: 'string', default: 'package-lock.json' },
    },
  });
  if (!values.family) throw new Error('--family is required');
  if (!['latest', 'minor', 'patch'].includes(values.target)) {
    throw new Error(`--target must be latest|minor|patch (got ${values.target})`);
  }

  const members = await resolveMembers(values.family, values.overlay);
  const lockfile = JSON.parse(await readFile(values.lockfile, 'utf8'));
  const expanded = expandWildcards(members, lockfile);
  console.log(`Family:  ${values.family}`);
  console.log(`Target:  ${values.target}`);
  console.log(`Dry-run: ${values['dry-run']}`);
  console.log(`Members (${expanded.length}):`);
  for (const m of expanded) console.log(`  - ${m}`);

  if (expanded.length === 0) {
    console.error('::error::No members resolved — refusing to invoke ncu with empty filter.');
    process.exit(1);
  }

  const args = buildNcuArgs({
    members: expanded,
    target: values.target,
    dryRun: values['dry-run'],
  });

  console.log(`\nInvoking: npx -p npm-check-updates@${NCU_VERSION} ncu ${args.join(' ')}`);
  const result = spawnSync('npx', ['-p', `npm-check-updates@${NCU_VERSION}`, 'ncu', ...args], {
    stdio: 'inherit',
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    console.error(`::error::ncu exited with status ${result.status}`);
    process.exit(result.status ?? 1);
  }

  if (!values['dry-run']) {
    console.log('\nReconciling lockfile via `npm install --no-audit --no-fund` ...');
    const install = spawnSync('npm', ['install', '--no-audit', '--no-fund'], { stdio: 'inherit' });
    if (install.status !== 0) {
      console.error(`::error::npm install failed (status ${install.status})`);
      process.exit(install.status ?? 1);
    }
  }
}

// Only run main when invoked directly (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(`::error::${err.message}`);
    process.exit(1);
  });
}

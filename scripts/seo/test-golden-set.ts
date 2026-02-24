/**
 * Golden Set Test — Keyword Clusters
 *
 * Compares current build-keyword-clusters output against a saved baseline.
 * Exit 0 if identical, exit 1 if diff detected.
 *
 * Usage:
 *   npx tsx scripts/seo/test-golden-set.ts --baseline=.spec/tests/snapshots/keyword-clusters-baseline-2026-02-24.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

// ── Helpers ──

function log(msg: string): void {
  process.stderr.write(msg + '\n');
}

function logErr(msg: string): void {
  process.stderr.write('[ERROR] ' + msg + '\n');
}

// ── Types ──

interface ClusterEntry {
  pgAlias: string;
  pgId: number;
  status: string;
  keywordsProcessed: number;
  rolesCovered: string[];
  primaryKeyword: { text: string; volume: number; intent: string } | null;
  roleKeywords: Record<string, unknown> | null;
  intentDistribution: Record<string, number>;
  error: string | null;
}

interface DiffResult {
  added: string[];
  removed: string[];
  changed: Array<{
    pgAlias: string;
    field: string;
    baseline: unknown;
    current: unknown;
  }>;
}

// ── Main ──

function main(): void {
  const args = process.argv.slice(2);

  if (args.includes('--help')) {
    log(`
Usage: npx tsx scripts/seo/test-golden-set.ts [options]

Options:
  --baseline=<path>  Path to baseline JSON file (required)
  --help             Show this help

Examples:
  npx tsx scripts/seo/test-golden-set.ts --baseline=.spec/tests/snapshots/keyword-clusters-baseline-2026-02-24.json
`);
    process.exit(0);
  }

  // Parse --baseline arg
  const baselineArg = args.find((a) => a.startsWith('--baseline='));
  if (!baselineArg) {
    logErr('Missing --baseline= argument');
    process.exit(2);
  }

  const baselinePath = baselineArg.split('=')[1];
  const resolvedPath = path.resolve(baselinePath);

  if (!fs.existsSync(resolvedPath)) {
    logErr(`Baseline file not found: ${resolvedPath}`);
    process.exit(2);
  }

  // 1. Load baseline
  log(`Loading baseline: ${resolvedPath}`);
  const baseline: ClusterEntry[] = JSON.parse(
    fs.readFileSync(resolvedPath, 'utf-8'),
  );
  log(`Baseline: ${baseline.length} gammes`);

  // 2. Run build-keyword-clusters --all --output=json:stdout (dry-run)
  log('Running build-keyword-clusters --all --output=json:stdout ...');
  let currentJson: string;
  try {
    currentJson = execSync(
      'npx tsx scripts/seo/build-keyword-clusters.ts --all --output=json:stdout',
      {
        cwd: path.resolve(__dirname, '../..'),
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 60_000,
      },
    );
  } catch (err) {
    logErr(`build-keyword-clusters failed: ${(err as Error).message}`);
    process.exit(2);
  }

  let current: ClusterEntry[];
  try {
    current = JSON.parse(currentJson);
  } catch {
    logErr('Failed to parse build-keyword-clusters JSON output');
    logErr(currentJson.slice(0, 500));
    process.exit(2);
  }
  log(`Current: ${current.length} gammes`);

  // 3. Compare invariants
  const baselineMap = new Map(baseline.map((b) => [b.pgAlias, b]));
  const currentMap = new Map(current.map((c) => [c.pgAlias, c]));

  const diff: DiffResult = { added: [], removed: [], changed: [] };

  // Check removed (in baseline but not in current)
  for (const alias of baselineMap.keys()) {
    if (!currentMap.has(alias)) {
      diff.removed.push(alias);
    }
  }

  // Check added (in current but not in baseline)
  for (const alias of currentMap.keys()) {
    if (!baselineMap.has(alias)) {
      diff.added.push(alias);
    }
  }

  // Check changed (same alias, different values)
  for (const [alias, base] of baselineMap) {
    const curr = currentMap.get(alias);
    if (!curr) continue;

    // primary_keyword.text
    if (base.primaryKeyword?.text !== curr.primaryKeyword?.text) {
      diff.changed.push({
        pgAlias: alias,
        field: 'primaryKeyword.text',
        baseline: base.primaryKeyword?.text,
        current: curr.primaryKeyword?.text,
      });
    }

    // primary_keyword.volume
    if (base.primaryKeyword?.volume !== curr.primaryKeyword?.volume) {
      diff.changed.push({
        pgAlias: alias,
        field: 'primaryKeyword.volume',
        baseline: base.primaryKeyword?.volume,
        current: curr.primaryKeyword?.volume,
      });
    }

    // rolesCovered (sorted comparison)
    const baseRoles = [...(base.rolesCovered || [])].sort().join(',');
    const currRoles = [...(curr.rolesCovered || [])].sort().join(',');
    if (baseRoles !== currRoles) {
      diff.changed.push({
        pgAlias: alias,
        field: 'rolesCovered',
        baseline: base.rolesCovered,
        current: curr.rolesCovered,
      });
    }

    // variants count: current must be >= baseline
    const baseVariants = base.keywordsProcessed || 0;
    const currVariants = curr.keywordsProcessed || 0;
    if (currVariants < baseVariants) {
      diff.changed.push({
        pgAlias: alias,
        field: 'keywordsProcessed (decreased)',
        baseline: baseVariants,
        current: currVariants,
      });
    }
  }

  // 4. Report
  log('\n=== Golden Set Test Results ===\n');

  if (
    diff.added.length === 0 &&
    diff.removed.length === 0 &&
    diff.changed.length === 0
  ) {
    log('PASS: Baseline matches current output.');
    log(`  Gammes: ${baseline.length}`);
    log(
      `  Primary keywords: ${baseline.map((b) => b.primaryKeyword?.text).join(', ')}`,
    );
    process.exit(0);
  }

  log('DIFF DETECTED:\n');

  if (diff.added.length > 0) {
    log(`  Added (${diff.added.length}):`);
    for (const a of diff.added) log(`    + ${a}`);
  }

  if (diff.removed.length > 0) {
    log(`  Removed (${diff.removed.length}):`);
    for (const r of diff.removed) log(`    - ${r}`);
  }

  if (diff.changed.length > 0) {
    log(`  Changed (${diff.changed.length}):`);
    for (const c of diff.changed) {
      log(
        `    ~ ${c.pgAlias}.${c.field}: ${JSON.stringify(c.baseline)} → ${JSON.stringify(c.current)}`,
      );
    }
  }

  log('\nFAIL: Golden set baseline does not match.');
  process.exit(1);
}

main();

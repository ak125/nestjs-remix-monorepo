#!/usr/bin/env node
/**
 * Compare current audit counts against audit-reports/phase0-baseline.json.
 *
 * Runs all four deterministic audits (knip, madge, dependency-cruiser, ast-grep),
 * parses their outputs, and diffs against the committed baseline. Exits non-zero
 * when the delta on any metric exceeds its threshold (baseline.thresholds.*).
 *
 * Negative deltas (progress) always succeed. Positive deltas only fail when
 * above the threshold.
 *
 * Usage:
 *   node scripts/cleanup/audit-compare-baseline.js            # run, print, exit
 *   node scripts/cleanup/audit-compare-baseline.js --json     # machine-readable
 *   node scripts/cleanup/audit-compare-baseline.js --strict   # zero-tolerance
 *   node scripts/cleanup/audit-compare-baseline.js --refresh  # rewrite baseline
 *
 * --refresh re-runs the same audits and writes the result back into the
 * baseline JSON, preserving thresholds/notes/version and any sub-fields the
 * parsers don't extract (madge.backend_cycles, depcruise.modules_cruised,
 * etc.). captured_at and captured_on_commit are updated to today / HEAD.
 * Run this only after a maintainer merge that intentionally moves baselines.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const BASELINE_PATH = path.join(REPO_ROOT, 'audit-reports', 'phase0-baseline.json');

function die(msg, code = 2) {
  process.stderr.write(`[audit-compare] ERROR: ${msg}\n`);
  process.exit(code);
}

function loadBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) {
    die(`baseline not found: ${BASELINE_PATH}`);
  }
  try {
    return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf-8'));
  } catch (e) {
    die(`invalid JSON in baseline: ${e.message}`);
  }
}

function ensureDepsInstalled() {
  // The audits resolve imports against installed deps. Without node_modules
  // knip flags every import as "unlisted" and depcruise reports zero
  // violations because it can't traverse — both produce silently-wrong
  // numbers that would corrupt the baseline if written.
  const required = ['knip', 'madge', 'dependency-cruiser', '@ast-grep/cli'];
  const missing = required.filter(
    (pkg) => !fs.existsSync(path.join(REPO_ROOT, 'node_modules', pkg)),
  );
  if (missing.length) {
    die(
      `node_modules out of sync (missing: ${missing.join(', ')}).\n` +
        `Run \`npm ci\` first; the audits depend on installed packages to\n` +
        `resolve imports correctly. Refusing to run with broken environment.`,
    );
  }
}

function runSilent(cmd, opts = {}) {
  try {
    return execSync(cmd, {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
      ...opts,
    });
  } catch (e) {
    // many audits exit non-zero on findings — we still want the output
    return (e.stdout || '') + (e.stderr || '');
  }
}

function parseKnip() {
  const out = runSilent('npx knip --no-exit-code --no-progress --reporter compact 2>&1');
  const grab = (re) => {
    const m = out.match(re);
    return m ? parseInt(m[1], 10) : 0;
  };
  return {
    unused_files: grab(/^Unused files \((\d+)\)/m),
    unused_dependencies: grab(/^Unused dependencies \((\d+)\)/m),
    unused_dev_dependencies: grab(/^Unused devDependencies \((\d+)\)/m),
    unlisted_dependencies: grab(/^Unlisted dependencies \((\d+)\)/m),
    unlisted_binaries: grab(/^Unlisted binaries \((\d+)\)/m),
    unused_exports: grab(/^Unused exports \((\d+)\)/m),
    unused_types: grab(/^Unused exported types \((\d+)\)/m),
    duplicate_exports: grab(/^Duplicate exports \((\d+)\)/m),
  };
}

function parseMadge() {
  const out = runSilent(
    'npx madge --circular --extensions ts,tsx backend/src frontend/app 2>&1',
  );
  // madge prints "Found N circular dependencies!" or "No circular dependency found!"
  const m = out.match(/Found (\d+) circular dependenc/);
  return { cycles: m ? parseInt(m[1], 10) : 0 };
}

function parseDepcruise() {
  const out = runSilent(
    'npx depcruise --config .dependency-cruiser.cjs --output-type err-long backend/src frontend/app 2>&1',
  );
  // line shape: "x 148 dependency violations (0 errors, 148 warnings). 2101 modules, 8425 dependencies cruised."
  const m = out.match(/(\d+) dependency violations \((\d+) errors?, (\d+) warnings?\)/);
  return {
    violations: m ? parseInt(m[1], 10) : 0,
    errors: m ? parseInt(m[2], 10) : 0,
    warnings: m ? parseInt(m[3], 10) : 0,
  };
}

function parseAstGrep() {
  const out = runSilent('npx ast-grep scan --config sgconfig.yml 2>&1');
  const warnings = (out.match(/^warning\[/gm) || []).length;
  const errors = (out.match(/^error\[/gm) || []).length;
  return { warnings, errors };
}

function computeDelta(current, baseline, thresholds, strict) {
  const rows = [];
  let hasFailure = false;

  const check = (label, cur, base, thresholdKey) => {
    const delta = cur - base;
    const threshold = strict ? 0 : thresholds[thresholdKey] ?? 0;
    const over = delta > threshold;
    if (over) hasFailure = true;
    rows.push({
      metric: label,
      baseline: base,
      current: cur,
      delta,
      threshold,
      status: delta < 0 ? 'improved' : over ? 'REGRESSION' : 'ok',
    });
  };

  check('knip.unused_files', current.knip.unused_files, baseline.knip.unused_files, 'unused_files_delta');
  check('knip.unused_exports', current.knip.unused_exports, baseline.knip.unused_exports, 'unused_exports_delta');
  check('knip.unused_types', current.knip.unused_types, baseline.knip.unused_types, 'unused_types_delta');
  check('knip.unused_dependencies', current.knip.unused_dependencies, baseline.knip.unused_dependencies, 'unused_dependencies_delta');
  check('knip.duplicate_exports', current.knip.duplicate_exports, baseline.knip.duplicate_exports, 'duplicate_exports_delta');
  check('madge.cycles', current.madge.cycles, baseline.madge.cycles, 'cycles_delta');
  check('depcruise.violations', current.depcruise.violations, baseline.depcruise.violations, 'depcruise_violations_delta');
  check('depcruise.errors', current.depcruise.errors, baseline.depcruise.errors, 'depcruise_errors_delta');
  check('ast_grep.warnings', current.ast_grep.warnings, baseline.ast_grep.warnings, 'ast_grep_warnings_delta');
  check('ast_grep.errors', current.ast_grep.errors, baseline.ast_grep.errors, 'ast_grep_errors_delta');

  return { rows, hasFailure };
}

function renderTable(rows) {
  const header = ['Metric', 'Baseline', 'Current', 'Delta', 'Threshold', 'Status'];
  const lines = [header];
  for (const r of rows) {
    const deltaStr = r.delta > 0 ? `+${r.delta}` : `${r.delta}`;
    const thresholdStr = r.threshold === 0 ? '0' : `+${r.threshold}`;
    lines.push([r.metric, String(r.baseline), String(r.current), deltaStr, thresholdStr, r.status]);
  }
  const widths = header.map((_, i) => Math.max(...lines.map((l) => l[i].length)));
  const pad = (s, w) => s + ' '.repeat(w - s.length);
  const fmt = (l) => '  ' + l.map((c, i) => pad(c, widths[i])).join('  ');
  return [fmt(lines[0]), fmt(widths.map((w) => '-'.repeat(w))), ...lines.slice(1).map(fmt)].join('\n');
}

function refreshBaseline(baseline, current) {
  const today = new Date().toISOString().slice(0, 10);
  const commit = runSilent('git rev-parse --short HEAD').trim() || baseline.captured_on_commit;
  return {
    ...baseline,
    captured_at: today,
    captured_on_commit: commit,
    knip: { ...baseline.knip, ...current.knip },
    madge: { ...baseline.madge, ...current.madge },
    depcruise: { ...baseline.depcruise, ...current.depcruise },
    ast_grep: { ...baseline.ast_grep, ...current.ast_grep },
  };
}

function main() {
  const strict = process.argv.includes('--strict');
  const jsonOut = process.argv.includes('--json');
  const refresh = process.argv.includes('--refresh');

  const baseline = loadBaseline();
  ensureDepsInstalled();

  process.stderr.write('[audit-compare] running knip...\n');
  const knip = parseKnip();
  process.stderr.write('[audit-compare] running madge...\n');
  const madge = parseMadge();
  process.stderr.write('[audit-compare] running depcruise...\n');
  const depcruise = parseDepcruise();
  process.stderr.write('[audit-compare] running ast-grep...\n');
  const ast_grep = parseAstGrep();

  const current = { knip, madge, depcruise, ast_grep };

  if (refresh) {
    const refreshed = refreshBaseline(baseline, current);
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(refreshed, null, 2) + '\n');
    process.stdout.write(`[audit-compare] baseline refreshed at ${BASELINE_PATH}\n`);
    process.stdout.write(`  captured_at: ${baseline.captured_at} → ${refreshed.captured_at}\n`);
    process.stdout.write(`  captured_on_commit: ${baseline.captured_on_commit} → ${refreshed.captured_on_commit}\n`);
    for (const [section, vals] of Object.entries({ knip: current.knip, madge: current.madge, depcruise: current.depcruise, ast_grep: current.ast_grep })) {
      for (const [key, newVal] of Object.entries(vals)) {
        const oldVal = baseline[section] && baseline[section][key];
        if (oldVal !== newVal) {
          process.stdout.write(`  ${section}.${key}: ${oldVal} → ${newVal}\n`);
        }
      }
    }
    process.exit(0);
  }

  const { rows, hasFailure } = computeDelta(current, baseline, baseline.thresholds, strict);

  if (jsonOut) {
    process.stdout.write(JSON.stringify({ baseline_captured_at: baseline.captured_at, current, rows, failed: hasFailure }, null, 2) + '\n');
  } else {
    process.stdout.write('\n=== Audit Baseline Comparison ===\n');
    process.stdout.write(`Baseline captured: ${baseline.captured_at} (commit ${baseline.captured_on_commit || 'unknown'})\n`);
    process.stdout.write(`Mode: ${strict ? 'STRICT (zero tolerance)' : 'threshold-based'}\n\n`);
    process.stdout.write(renderTable(rows) + '\n\n');
    if (hasFailure) {
      process.stdout.write('REGRESSION detected. One or more metrics exceeded their threshold.\n');
      process.stdout.write('Either revert the offending change, or if the regression is intentional,\n');
      process.stdout.write('refresh the baseline via `npm run audit:baseline:refresh` (on a maintainer merge).\n');
    } else {
      process.stdout.write('All metrics within threshold. OK to merge.\n');
    }
  }

  process.exit(hasFailure ? 1 : 0);
}

main();

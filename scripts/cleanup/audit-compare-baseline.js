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
 * Exit 0: valid analyses within thresholds; 1: regression; 2: unavailable or
 * invalid evidence. Invalid evidence never produces metrics or refreshes.
 *
 * Madge runs through its API in a bounded child process, so the analysed graph
 * is checked: a root without any analysed file, or a file madge's parser
 * rejects, is invalid evidence. As in the baseline, the cycle graph only holds
 * imports madge resolves without a tsconfig; aliases (~/, @common/...) and
 * asset imports stay outside it and are counted on stderr.
 *
 * Knip reads the tsconfig paths, so a relative or ~/ import it cannot resolve
 * is a broken import: knip.unresolved_imports is compared like the other knip
 * counts, with a zero threshold in the baseline. It does not cover everything:
 * knip files an unresolved specifier shaped like a package name (@common/...)
 * under external dependencies, and it skips .json targets, foreign file
 * extensions and git-ignored relative paths. Those are not counted here.
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
const { spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const BASELINE_PATH = path.join(REPO_ROOT, 'audit-reports', 'phase0-baseline.json');

function die(msg) {
  throw new Error(msg);
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

function requireShape(condition, message) {
  if (!condition) die(`invalid report: ${message}`);
}

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isString = (value) => typeof value === 'string' && value.length > 0;
const isCount = (value) => Number.isSafeInteger(value) && value >= 0;

function parseKnip(report) {
  // Knip 6 JSON. Preserve the compact reporter's baseline units: affected
  // files per category, except duplicates, which counts duplicate groups.
  requireShape(isRecord(report) && Array.isArray(report.issues), 'knip.issues must be an array');
  const fields = {
    unused_files: 'files', unused_dependencies: 'dependencies',
    unused_dev_dependencies: 'devDependencies', unlisted_dependencies: 'unlisted',
    unlisted_binaries: 'binaries', unused_exports: 'exports',
    unused_types: 'types', duplicate_exports: 'duplicates',
    unresolved_imports: 'unresolved',
  };
  const counts = Object.fromEntries(Object.keys(fields).map((key) => [key, 0]));
  const files = new Set();
  for (const issue of report.issues) {
    requireShape(isRecord(issue) && isString(issue.file) && !files.has(issue.file), 'knip issue needs a unique file');
    files.add(issue.file);
    for (const [metric, field] of Object.entries(fields)) {
      const entries = issue[field];
      requireShape(Array.isArray(entries), `knip.${field} must be an array in ${issue.file}`);
      const symbols = field === 'duplicates' ? entries.flat() : entries;
      requireShape(symbols.every((item) => isRecord(item) && isString(item.name)), `knip.${field} has invalid symbols`);
      if (field === 'duplicates') {
        requireShape(entries.every((group) => Array.isArray(group) && group.length >= 2), 'knip duplicate group needs at least two symbols');
        counts[metric] += entries.length;
      } else {
        counts[metric] += entries.length > 0 ? 1 : 0;
      }
    }
  }
  return counts;
}

const MADGE_ROOTS = ['backend/src', 'frontend/app'];

// Madge's CLI prints a cycle-free graph when it analysed no file, and
// dependency-tree silently keeps a file its parser rejects with no dependencies
// (madge's "skipped" warnings only list unresolved imports). This worker runs
// the same analysis as `madge --extensions ts,tsx` and reports the evidence the
// parser below needs to refuse both cases.
const MADGE_WORKER = `
const path = require('path');
const [madgeDir, ...roots] = process.argv.slice(1);
const treeDir = path.dirname(require.resolve('dependency-tree', { paths: [madgeDir] }));
const precinct = require(require.resolve('precinct', { paths: [treeDir] }));
require(madgeDir)(roots, { baseDir: process.cwd(), fileExtensions: ['ts', 'tsx'] }).then((result) => {
  const graph = result.obj();
  const unparsable = [];
  // A rejected file has no dependencies: parse those again as dependency-tree does.
  for (const [file, deps] of Object.entries(graph)) {
    if (deps.length > 0) continue;
    try { precinct.paperwork(path.resolve(file), { includeCore: false }); }
    catch (error) { unparsable.push(file + ': ' + String(error.message).split('\\n')[0]); }
  }
  process.stdout.write(JSON.stringify({ files: Object.keys(graph), cycles: result.circular(),
    unparsable, unresolved: result.warnings().skipped }));
});
`;

function parseMadge(report) {
  requireShape(isRecord(report) && [report.files, report.unparsable, report.unresolved].every((list) =>
    Array.isArray(list) && list.every(isString)), 'madge needs files, unparsable and unresolved lists');
  const files = new Set(report.files);
  requireShape(Array.isArray(report.cycles) && report.cycles.every((cycle) => Array.isArray(cycle) &&
    cycle.length > 0 && cycle.every((file) => files.has(file))), 'madge cycles must list analysed files');
  for (const root of MADGE_ROOTS) {
    requireShape(report.files.some((file) => file.startsWith(`${root}/`)), `madge analysed no file under ${root}`);
  }
  requireShape(report.unparsable.length === 0,
    `madge could not parse ${report.unparsable.length} file(s): ${report.unparsable.slice(0, 5).join('; ')}`);
  return { cycles: report.cycles.length };
}

function parseDepcruise(report) {
  requireShape(isRecord(report) && Array.isArray(report.modules) && isRecord(report.summary), 'depcruise needs modules and summary');
  const summary = report.summary;
  requireShape(Array.isArray(summary.violations), 'depcruise.summary.violations must be an array');
  for (const key of ['error', 'warn', 'info', 'ignore', 'totalCruised', 'totalDependenciesCruised']) {
    requireShape(isCount(summary[key]), `depcruise.summary.${key} must be a non-negative integer`);
  }
  requireShape(summary.totalCruised > 0 && report.modules.length > 0, 'depcruise did not analyse any modules');
  requireShape(report.modules.every((entry) => isRecord(entry) && isString(entry.source) &&
    Array.isArray(entry.dependencies)), 'depcruise has invalid module records');
  const counts = { error: 0, warn: 0, info: 0, ignore: 0 };
  for (const violation of summary.violations) {
    requireShape(isRecord(violation) && isRecord(violation.rule) &&
      Object.hasOwn(counts, violation.rule.severity), 'depcruise violation has invalid severity');
    counts[violation.rule.severity]++;
  }
  for (const key of Object.keys(counts)) {
    requireShape(counts[key] === summary[key], `depcruise.summary.${key} disagrees with violations`);
  }
  // err-long excludes ignored violations from its total.
  return { violations: summary.error + summary.warn + summary.info, errors: summary.error, warnings: summary.warn };
}

function parseAstGrep(report) {
  requireShape(Array.isArray(report), 'ast-grep must return an array of diagnostics');
  const counts = { warnings: 0, errors: 0 };
  for (const diagnostic of report) {
    requireShape(isRecord(diagnostic) && isString(diagnostic.ruleId) && isString(diagnostic.file) &&
      ['warning', 'error', 'info', 'hint'].includes(diagnostic.severity), 'ast-grep diagnostic has invalid identity or severity');
    if (diagnostic.severity === 'warning') counts.warnings++;
    if (diagnostic.severity === 'error') counts.errors++;
  }
  return counts;
}

const AUDITS = {
  knip: {
    entry: 'knip/bin/knip.js',
    args: ['--no-exit-code', '--no-progress', '--reporter', 'json'],
    parse: parseKnip,
    exit: () => 0,
  },
  madge: {
    entry: 'madge',
    script: MADGE_WORKER,
    args: MADGE_ROOTS,
    parse: parseMadge,
    exit: () => 0,
    note: (report) => `${report.files.length} files analysed, ${report.unresolved.length} unresolved imports outside the cycle graph`,
  },
  // The JSON reporter exits 0 even with rule violations; the metrics gate below
  // decides regressions. A non-zero exit from this reporter is a tool failure.
  depcruise: {
    entry: 'dependency-cruiser/bin/dependency-cruise.mjs',
    args: ['--config', '.dependency-cruiser.cjs', '--output-type', 'json', 'backend/src', 'frontend/app'],
    parse: parseDepcruise,
    exit: () => 0,
  },
  ast_grep: {
    entry: `@ast-grep/cli/ast-grep${process.platform === 'win32' ? '.exe' : ''}`,
    native: true,
    args: ['scan', '--config', 'sgconfig.yml', '--json=compact'],
    parse: parseAstGrep,
    exit: (counts) => counts.errors > 0 ? 1 : 0,
  },
};

function runAudit(name, { root = REPO_ROOT, execute = spawnSync } = {}) {
  const audit = AUDITS[name];
  const entry = path.join(root, 'node_modules', audit.entry);
  // Invoke only installed tools, without a shell or npx's download fallback.
  const args = audit.native ? audit.args : [...(audit.script ? ['-e', audit.script] : []), entry, ...audit.args];
  const result = execute(audit.native ? entry : process.execPath, args, {
    cwd: root, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024, timeout: 180_000,
  });
  try {
    if (result.error) die(`process failed: ${result.error.message}`);
    if (result.signal || !Number.isInteger(result.status)) die(`process interrupted (${result.signal || 'no exit status'})`);
    if (![0, 1].includes(result.status)) die(`unexpected exit status ${result.status}`);
    const report = JSON.parse(result.stdout);
    const counts = audit.parse(report);
    if (result.status !== audit.exit(counts)) die(`exit status ${result.status} disagrees with the report`);
    if (audit.note) process.stderr.write(`[audit-compare] ${name}: ${audit.note(report)}\n`);
    return counts;
  } catch (error) {
    const detail = result.stderr?.trim().slice(0, 2000);
    die(`${name}: ${error.message}${detail ? `\n${detail}` : ''}`);
  }
}

function computeDelta(current, baseline, thresholds, strict) {
  const rows = [];
  let hasFailure = false;

  const check = (label, cur, base, thresholdKey) => {
    if (!isCount(cur) || !isCount(base)) die(`invalid count for ${label}`);
    if (!isRecord(thresholds) || (Object.hasOwn(thresholds, thresholdKey) && !isCount(thresholds[thresholdKey]))) {
      die(`invalid threshold for ${label}`);
    }
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
  check('knip.unresolved_imports', current.knip.unresolved_imports, baseline.knip.unresolved_imports, 'unresolved_imports_delta');
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
  const result = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf-8', timeout: 10_000 });
  if (result.error || result.signal || result.status !== 0 || !/^[a-f0-9]{7,40}\s*$/.test(result.stdout)) {
    die('cannot identify HEAD; baseline was not refreshed');
  }
  const commit = result.stdout.trim();
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
  const knip = runAudit('knip');
  process.stderr.write('[audit-compare] running madge...\n');
  const madge = runAudit('madge');
  process.stderr.write('[audit-compare] running depcruise...\n');
  const depcruise = runAudit('depcruise');
  process.stderr.write('[audit-compare] running ast-grep...\n');
  const ast_grep = runAudit('ast_grep');

  const current = { knip, madge, depcruise, ast_grep };

  if (refresh) {
    const { rows: deltaRows, hasFailure: hasRegression } = computeDelta(
      current,
      baseline,
      baseline.thresholds,
      false,
    );
    if (hasRegression) {
      const regressions = deltaRows.filter((r) => r.status === 'REGRESSION');
      process.stderr.write(
        `\n[audit-compare] WARNING: refresh proceeding despite ${regressions.length} metric regression(s) beyond threshold:\n`,
      );
      for (const r of regressions) {
        process.stderr.write(
          `    ${r.metric}: ${r.baseline} -> ${r.current} (delta +${r.delta}, threshold +${r.threshold})\n`,
        );
      }
      process.stderr.write(
        `    The new baseline will bank these regressions. Abort (Ctrl-C) and rerun without --refresh if unintentional.\n\n`,
      );
    }
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
    return 0;
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

  return hasFailure ? 1 : 0;
}

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch (error) {
    process.stderr.write(`[audit-compare] ERROR: ${error.message}\n`);
    if (process.argv.includes('--json')) {
      process.stdout.write(JSON.stringify({ failed: true, error: error.message }) + '\n');
    }
    process.exitCode = 2;
  }
}

module.exports = { runAudit, parseKnip, parseMadge, parseDepcruise, parseAstGrep, computeDelta };

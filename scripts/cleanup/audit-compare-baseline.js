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
 * The baseline records the tool versions that produced its counters. When the
 * installed audit tools differ from those versions, raw count comparison is
 * meaningless (a tool upgrade routinely shifts counts by reasons unrelated to
 * code quality). In that case the script aborts with a TOOL_VERSION_MISMATCH
 * exit and asks the maintainer to refresh the baseline.
 *
 * Usage:
 *   node scripts/cleanup/audit-compare-baseline.js              # run, print, exit
 *   node scripts/cleanup/audit-compare-baseline.js --json       # machine-readable
 *   node scripts/cleanup/audit-compare-baseline.js --strict     # zero-tolerance
 *   node scripts/cleanup/audit-compare-baseline.js --refresh    # rewrite baseline
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const BASELINE_PATH = path.join(REPO_ROOT, 'audit-reports', 'phase0-baseline.json');
const TRACKED_TOOLS = ['knip', 'madge', 'dependency-cruiser', '@ast-grep/cli'];

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

function readInstalledVersion(pkg) {
  // Read node_modules/<pkg>/package.json directly — works regardless of the
  // package's `exports` field, which can hide package.json from require().
  const pkgJsonPath = path.join(REPO_ROOT, 'node_modules', pkg, 'package.json');
  if (!fs.existsSync(pkgJsonPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8')).version || null;
  } catch {
    return null;
  }
}

function getInstalledToolVersions() {
  const out = {};
  for (const pkg of TRACKED_TOOLS) {
    out[pkg] = readInstalledVersion(pkg);
  }
  return out;
}

function compareToolVersions(baselineVersions, currentVersions) {
  // Returns array of mismatches: { tool, baseline, current }
  const mismatches = [];
  for (const pkg of TRACKED_TOOLS) {
    const base = baselineVersions ? baselineVersions[pkg] : null;
    const cur = currentVersions[pkg];
    if (base && cur && base !== cur) {
      mismatches.push({ tool: pkg, baseline: base, current: cur });
    }
  }
  return mismatches;
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
  const m = out.match(/Found (\d+) circular dependenc/);
  return { cycles: m ? parseInt(m[1], 10) : 0 };
}

function parseDepcruise() {
  const out = runSilent(
    'npx depcruise --config .dependency-cruiser.cjs --output-type err-long backend/src frontend/app 2>&1',
  );
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

function runAllAudits() {
  process.stderr.write('[audit-compare] running knip...\n');
  const knip = parseKnip();
  process.stderr.write('[audit-compare] running madge...\n');
  const madge = parseMadge();
  process.stderr.write('[audit-compare] running depcruise...\n');
  const depcruise = parseDepcruise();
  process.stderr.write('[audit-compare] running ast-grep...\n');
  const ast_grep = parseAstGrep();
  return { knip, madge, depcruise, ast_grep };
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

function renderVersionMismatch(mismatches) {
  const header = ['Tool', 'Baseline version', 'Installed version'];
  const lines = [header, ...mismatches.map((m) => [m.tool, m.baseline, m.current])];
  const widths = header.map((_, i) => Math.max(...lines.map((l) => l[i].length)));
  const pad = (s, w) => s + ' '.repeat(w - s.length);
  const fmt = (l) => '  ' + l.map((c, i) => pad(c, widths[i])).join('  ');
  return [fmt(lines[0]), fmt(widths.map((w) => '-'.repeat(w))), ...lines.slice(1).map(fmt)].join('\n');
}

function refresh(baseline) {
  // Recapture current counts and tool versions, preserve thresholds and notes.
  const current = runAllAudits();
  const toolVersions = getInstalledToolVersions();

  let commit = baseline.captured_on_commit;
  try {
    commit = execSync('git rev-parse --short HEAD', {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
    }).trim();
  } catch {
    // keep previous commit if git is unavailable (CI without checkout etc.)
  }

  const next = {
    version: 2,
    captured_at: new Date().toISOString().slice(0, 10),
    captured_on_commit: commit,
    tool_versions: toolVersions,
    thresholds: baseline.thresholds,
    knip: current.knip,
    madge: { cycles: current.madge.cycles },
    depcruise: {
      violations: current.depcruise.violations,
      errors: current.depcruise.errors,
      modules_cruised: baseline.depcruise && baseline.depcruise.modules_cruised,
      dependencies_cruised: baseline.depcruise && baseline.depcruise.dependencies_cruised,
    },
    ast_grep: current.ast_grep,
    notes: baseline.notes,
  };

  // Only keep modules_cruised / dependencies_cruised if previously recorded;
  // they are informational and not used by the gate.
  if (next.depcruise.modules_cruised === undefined) delete next.depcruise.modules_cruised;
  if (next.depcruise.dependencies_cruised === undefined) delete next.depcruise.dependencies_cruised;

  // madge.backend_cycles / frontend_cycles are not collected here; preserve if
  // they were in the previous baseline so manual edits aren't lost silently.
  if (baseline.madge && baseline.madge.backend_cycles !== undefined) {
    next.madge.backend_cycles = baseline.madge.backend_cycles;
  }
  if (baseline.madge && baseline.madge.frontend_cycles !== undefined) {
    next.madge.frontend_cycles = baseline.madge.frontend_cycles;
  }

  fs.writeFileSync(BASELINE_PATH, JSON.stringify(next, null, 2) + '\n');
  process.stdout.write('\n=== Audit Baseline Refresh ===\n');
  process.stdout.write(`Wrote: ${path.relative(REPO_ROOT, BASELINE_PATH)}\n`);
  process.stdout.write(`Captured on commit: ${commit}\n`);
  process.stdout.write(`Tool versions: ${TRACKED_TOOLS.map((t) => `${t}@${toolVersions[t] || '?'}`).join(', ')}\n`);
  process.stdout.write('Review the diff and commit it alongside the audit-tool bump.\n');
}

function main() {
  const strict = process.argv.includes('--strict');
  const jsonOut = process.argv.includes('--json');
  const refreshMode = process.argv.includes('--refresh');

  const baseline = loadBaseline();

  if (refreshMode) {
    refresh(baseline);
    process.exit(0);
  }

  const installedVersions = getInstalledToolVersions();
  const versionMismatches = compareToolVersions(baseline.tool_versions, installedVersions);

  if (versionMismatches.length > 0 && !jsonOut) {
    process.stdout.write('\n=== Audit Tool Version Mismatch ===\n');
    process.stdout.write(`Baseline captured: ${baseline.captured_at} (commit ${baseline.captured_on_commit || 'unknown'})\n\n`);
    process.stdout.write(renderVersionMismatch(versionMismatches) + '\n\n');
    process.stdout.write('TOOL_VERSION_MISMATCH: an audit tool has been upgraded since the baseline.\n');
    process.stdout.write('Raw counter comparison is unreliable across tool versions.\n');
    process.stdout.write('Refresh the baseline in this PR via `npm run audit:baseline:refresh`,\n');
    process.stdout.write('then commit the updated audit-reports/phase0-baseline.json.\n');
    process.exit(3);
  }

  const current = runAllAudits();
  const { rows, hasFailure } = computeDelta(current, baseline, baseline.thresholds, strict);

  if (jsonOut) {
    process.stdout.write(
      JSON.stringify(
        {
          baseline_captured_at: baseline.captured_at,
          baseline_tool_versions: baseline.tool_versions || null,
          installed_tool_versions: installedVersions,
          tool_version_mismatches: versionMismatches,
          current,
          rows,
          failed: hasFailure || versionMismatches.length > 0,
        },
        null,
        2,
      ) + '\n',
    );
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

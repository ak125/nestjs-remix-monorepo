const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { runAudit, parseKnip, parseMadge, parseDepcruise, parseAstGrep } = require('./audit-compare-baseline');

const source = fs.readFileSync(path.join(__dirname, 'audit-compare-baseline.js'), 'utf8');
const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, '../../audit-reports/phase0-baseline.json'), 'utf8'));
const emptyIssue = (file, values = {}) => ({ file, files: [], dependencies: [], devDependencies: [], unlisted: [], binaries: [], exports: [], types: [], duplicates: [], unresolved: [], ...values });
const depReport = (severities = []) => ({
  modules: [{ source: 'a.ts', dependencies: [] }],
  summary: {
    violations: severities.map((severity) => ({ rule: { name: 'fixture', severity } })),
    error: severities.filter((s) => s === 'error').length,
    warn: severities.filter((s) => s === 'warn').length,
    info: severities.filter((s) => s === 'info').length,
    ignore: severities.filter((s) => s === 'ignore').length,
    totalCruised: 1, totalDependenciesCruised: 0,
  },
});
const diagnostic = (severity) => ({ ruleId: 'fixture', file: 'a.ts', severity });
const madgeReport = (values = {}) => ({ files: ['backend/src/a.ts', 'backend/src/b.ts', 'frontend/app/c.ts'], cycles: [], unparsable: [], unresolved: [], ...values });
const reports = { knip: { issues: [] }, madge: madgeReport(), depcruise: depReport(), ast_grep: [] };
const success = (report, status = 0) => ({ status, stdout: JSON.stringify(report), stderr: '', signal: null });

// Exercise the actual CLI, including exit codes, --json and --refresh. Only the
// process and filesystem boundaries are replaced; no analyser or baseline write
// may escape this harness.
function cli({ args = [], results = {}, baselineValue = baseline, missingDeps = false, gitFailure = false } = {}) {
  const output = { stdout: '', stderr: '', writes: [], calls: [] };
  const fakeProcess = {
    argv: ['node', 'audit-compare-baseline.js', ...args],
    execPath: process.execPath, platform: process.platform,
    stdout: { write: (s) => { output.stdout += s; } },
    stderr: { write: (s) => { output.stderr += s; } },
  };
  const module = { exports: {} };
  const fakeRequire = (name) => {
    if (name === 'fs') return {
      existsSync: (p) => !missingDeps || !p.includes('node_modules'),
      readFileSync: () => JSON.stringify(baselineValue),
      writeFileSync: (p, data) => output.writes.push({ path: p, data }),
    };
    if (name === 'child_process') return { spawnSync: (command, argv, options) => {
      output.calls.push({ command, argv, options });
      if (command === 'git') return gitFailure ? { status: 128, stdout: '', stderr: 'not a repository' } : { status: 0, stdout: 'cf7992d04\n' };
      const entry = command === process.execPath ? argv[argv[0] === '-e' ? 2 : 0] : command;
      const name = entry.includes('dependency-cruiser') ? 'depcruise' : entry.includes('ast-grep') ? 'ast_grep' : entry.includes('madge') ? 'madge' : 'knip';
      return results[name] || success(reports[name]);
    } };
    return require(name);
  };
  fakeRequire.main = module;
  vm.runInNewContext(source, { require: fakeRequire, module, __dirname, process: fakeProcess });
  return { ...output, status: fakeProcess.exitCode };
}

for (const name of Object.keys(reports)) {
  test(`${name}: explicit empty JSON report is valid evidence`, () => {
    const counts = runAudit(name, { execute: () => success(reports[name]) });
    assert.ok(Object.values(counts).every((n) => n === 0));
  });
  const failures = {
    'crash without report': { status: 2, stdout: '', stderr: 'analyser crashed' },
    'exit 1 without report': { status: 1, stdout: '', stderr: 'invalid config' },
    'empty stdout with exit 0': { status: 0, stdout: '', stderr: '' },
    'truncated JSON': { status: 0, stdout: '{"issues":', stderr: '' },
    'wrong JSON schema': success({ unexpected: [] }),
    'null JSON': success(null),
    'JSON only on stderr': { status: 0, stdout: '', stderr: JSON.stringify(reports[name]) },
    'report followed by error text': { status: 0, stdout: JSON.stringify(reports[name]) + '\nfatal error', stderr: '' },
    'crash despite complete JSON': { ...success(reports[name]), status: 2 },
    'inconsistent exit 1 and clean report': { ...success(reports[name]), status: 1 },
    'killed after emitting report': { ...success(reports[name]), status: null, signal: 'SIGTERM' },
    'timeout after emitting report': { ...success(reports[name]), error: Object.assign(new Error('timed out'), { code: 'ETIMEDOUT' }) },
    'buffer overflow after emitting report': { ...success(reports[name]), error: Object.assign(new Error('buffer exceeded'), { code: 'ENOBUFS' }) },
    'executable missing': { status: null, stdout: '', error: Object.assign(new Error('not found'), { code: 'ENOENT' }) },
  };
  for (const [scenario, result] of Object.entries(failures)) {
    test(`${name}: ${scenario} never passes or refreshes`, () => {
      for (const args of [[], ['--strict'], ['--json'], ['--refresh']]) {
        const observed = cli({ args, results: { [name]: result } });
        assert.equal(observed.status, 2, JSON.stringify({ args, observed }));
        assert.equal(observed.writes.length, 0);
        assert.doesNotMatch(observed.stdout, /OK to merge|improved|baseline refreshed/);
        assert.match(observed.stderr, new RegExp(name));
        if (args.includes('--json')) {
          const json = JSON.parse(observed.stdout);
          assert.equal(json.failed, true);
          assert.equal(json.current, undefined);
          assert.equal(json.rows, undefined);
        }
      }
    });
  }
}

test('the original all-tools-crash regression exits 2, never zero metrics', () => {
  const results = Object.fromEntries(Object.keys(reports).map((name) => [name, { status: 2, stdout: '', stderr: 'crash' }]));
  const observed = cli({ args: ['--json'], results });
  assert.equal(observed.status, 2);
  assert.equal(JSON.parse(observed.stdout).current, undefined);
  assert.equal(observed.calls.length, 1, 'stop at first invalid analysis');
});

test('Knip preserves compact reporter units: files per category, duplicate groups', () => {
  const counts = parseKnip({ issues: [
    emptyIssue('a.ts', { exports: [{ name: 'a' }, { name: 'b' }], types: [{ name: 'A' }, { name: 'B' }], duplicates: [[{ name: 'a' }, { name: 'default' }], [{ name: 'b' }, { name: 'alias' }]], unresolved: [{ name: './gone' }, { name: './lost' }] }),
    emptyIssue('b.ts', { exports: [{ name: 'c' }], unresolved: [{ name: './gone' }] }),
    emptyIssue('unused.ts', { files: [{ name: 'unused.ts' }] }),
    emptyIssue('package.json', { dependencies: [{ name: 'dep-a' }, { name: 'dep-b' }], devDependencies: [{ name: 'dev' }], unlisted: [{ name: 'missing' }], binaries: [{ name: 'bin' }] }),
  ] });
  assert.deepEqual(counts, { unused_files: 1, unused_dependencies: 1, unused_dev_dependencies: 1, unlisted_dependencies: 1, unlisted_binaries: 1, unused_exports: 2, unused_types: 1, duplicate_exports: 2, unresolved_imports: 2 });
});

test('Knip missing category, malformed symbols, duplicate files and unknown shape are rejected', () => {
  for (const report of [
    { issues: [{ file: 'a.ts' }] },
    { issues: [emptyIssue('a.ts', { exports: [null] })] },
    { issues: [emptyIssue('a.ts', { duplicates: [{ name: 'not-a-group' }] })] },
    { issues: [emptyIssue('a.ts'), emptyIssue('a.ts')] },
    { files: [] },
  ]) assert.throws(() => parseKnip(report), /invalid report/);
});

test('Madge counts cycles of analysed files; unresolved imports stay outside the graph', () => {
  const report = madgeReport({ cycles: [['backend/src/a.ts', 'backend/src/b.ts'], ['frontend/app/c.ts']], unresolved: ['~/alias'] });
  assert.deepEqual(runAudit('madge', { execute: () => success(report) }), { cycles: 2 });
  assert.throws(() => runAudit('madge', { execute: () => success(report, 1) }), /disagrees/);
  for (const bad of [
    [['backend/src/a.ts', 'backend/src/b.ts']],
    madgeReport({ cycles: [[]] }),
    madgeReport({ cycles: [[null]] }),
    madgeReport({ cycles: [['backend/src/elsewhere.ts']] }),
    madgeReport({ files: undefined }),
    madgeReport({ unparsable: undefined }),
    madgeReport({ unresolved: [null] }),
  ]) assert.throws(() => parseMadge(bad), /invalid report/);
});

test('Madge without analysed files or with a file its parser rejects is invalid, never zero cycles', () => {
  const invalid = {
    'empty graph': [madgeReport({ files: [] }), /analysed no file under backend\/src/],
    'empty root': [madgeReport({ files: ['backend/src/a.ts'] }), /analysed no file under frontend\/app/],
    'unparsable file': [madgeReport({ unparsable: ['backend/src/b.ts: Expression expected.'] }), /could not parse 1 file\(s\): backend\/src\/b\.ts/],
  };
  for (const [scenario, [report, message]] of Object.entries(invalid)) {
    for (const args of [[], ['--strict'], ['--json'], ['--refresh']]) {
      const observed = cli({ args, results: { madge: success(report) } });
      assert.equal(observed.status, 2, scenario);
      assert.equal(observed.writes.length, 0, scenario);
      assert.match(observed.stderr, message, scenario);
      assert.doesNotMatch(observed.stdout, /OK to merge|improved|baseline refreshed/, scenario);
      if (args.includes('--json')) {
        const json = JSON.parse(observed.stdout);
        assert.equal(json.failed, true, scenario);
        assert.match(json.error, message, scenario);
        assert.equal(json.current, undefined, scenario);
      }
    }
  }
});

test('dependency-cruiser JSON uses exit 0 for findings; validates summaries and excludes ignored debt', () => {
  const report = depReport(['error', 'warn', 'warn', 'info', 'ignore']);
  assert.deepEqual(runAudit('depcruise', { execute: () => success(report) }), { violations: 4, errors: 1, warnings: 2 });
  assert.throws(() => runAudit('depcruise', { execute: () => success(report, 1) }), /disagrees/);
  for (const bad of [
    { ...report, summary: { ...report.summary, error: 0 } },
    { ...report, summary: { ...report.summary, warn: '2' } },
    { ...report, summary: { ...report.summary, totalCruised: 0 } },
    { ...report, modules: [] },
    { ...report, modules: [null] },
    { ...report, modules: [{}] },
    { ...report, summary: { ...report.summary, violations: [{}] } },
  ]) assert.throws(() => parseDepcruise(bad), /invalid report/);
});

test('ast-grep warning/error levels preserve counts and determine expected exit', () => {
  const report = [diagnostic('warning'), diagnostic('warning'), diagnostic('error'), diagnostic('info'), diagnostic('hint')];
  assert.deepEqual(runAudit('ast_grep', { execute: () => success(report, 1) }), { warnings: 2, errors: 1 });
  assert.throws(() => runAudit('ast_grep', { execute: () => success(report) }), /disagrees/);
  assert.deepEqual(runAudit('ast_grep', { execute: () => success([diagnostic('warning')]) }), { warnings: 1, errors: 0 });
  for (const bad of [[{}], [diagnostic('unknown')], [null]]) assert.throws(() => parseAstGrep(bad), /invalid report/);
});

test('valid evidence preserves comparison, strict mode and machine-readable success', () => {
  const observed = cli({ args: ['--json'] });
  assert.equal(observed.status, 0);
  const data = JSON.parse(observed.stdout);
  assert.equal(data.failed, false);
  assert.equal(data.rows.length, 11);
  assert.equal(data.current.madge.cycles, 0);
  assert.equal(observed.writes.length, 0);
  assert.equal(cli({ args: ['--strict'] }).status, 0);
});

test('valid findings remain subject to baseline thresholds; regressions exit 1', () => {
  const within = Array.from({ length: baseline.ast_grep.warnings + 1 }, () => diagnostic('warning'));
  assert.equal(cli({ results: { ast_grep: success(within) } }).status, 0);
  assert.equal(cli({ args: ['--strict'], results: { ast_grep: success(within) } }).status, 1);
  const over = [...within, ...Array.from({ length: baseline.thresholds.ast_grep_warnings_delta }, () => diagnostic('warning'))];
  const observed = cli({ args: ['--json'], results: { ast_grep: success(over) } });
  assert.equal(observed.status, 1);
  assert.equal(JSON.parse(observed.stdout).failed, true);
  assert.equal(observed.writes.length, 0);
});

test('one unresolved import above the baseline is a regression at threshold 0', () => {
  const broken = { issues: Array.from({ length: baseline.knip.unresolved_imports + 1 }, (_, i) => emptyIssue(`broken-${i}.ts`, { unresolved: [{ name: './missing' }] })) };
  const observed = cli({ args: ['--json'], results: { knip: success(broken) } });
  assert.equal(observed.status, 1);
  const row = JSON.parse(observed.stdout).rows.find((r) => r.metric === 'knip.unresolved_imports');
  assert.ok(row, 'knip.unresolved_imports is compared');
  assert.deepEqual([row.delta, row.threshold, row.status], [1, 0, 'REGRESSION']);
  assert.equal(observed.writes.length, 0);
});

test('a baseline without the unresolved import count is invalid evidence and never refreshes', () => {
  const without = structuredClone(baseline);
  delete without.knip.unresolved_imports;
  for (const args of [['--json'], ['--refresh']]) {
    const observed = cli({ args, baselineValue: without });
    assert.equal(observed.status, 2);
    assert.equal(observed.writes.length, 0);
  }
});

test('valid findings exit codes do not turn ordinary baseline debt into tool failures', () => {
  const observed = cli({ results: { madge: success(madgeReport({ cycles: [['backend/src/a.ts', 'backend/src/b.ts']], unresolved: ['~/alias'] })) } });
  assert.equal(observed.status, 0);
  assert.match(observed.stderr, /madge: 3 files analysed, 1 unresolved imports outside the cycle graph/);
  // A genuine new blocking rule finding is a regression (1), not unavailable evidence (2).
  assert.equal(cli({ results: { ast_grep: success([diagnostic('error')], 1) } }).status, 1);
});

test('refresh writes only after all four valid analyses and preserves baseline metadata', () => {
  const observed = cli({ args: ['--refresh'] });
  assert.equal(observed.status, 0);
  assert.equal(observed.calls.length, 5);
  assert.equal(observed.writes.length, 1);
  const refreshed = JSON.parse(observed.writes[0].data);
  assert.deepEqual(refreshed.thresholds, baseline.thresholds);
  assert.deepEqual(refreshed.notes, baseline.notes);
  assert.equal(refreshed.madge.backend_cycles, baseline.madge.backend_cycles);
  assert.equal(refreshed.knip.unused_files, 0);
  assert.equal(refreshed.captured_on_commit, 'cf7992d04');
});

test('invalid baseline counts or thresholds cannot make NaN compare green or refresh', () => {
  for (const value of [undefined, null, -1, '291']) {
    for (const key of ['count', 'threshold']) {
      const changed = structuredClone(baseline);
      if (key === 'count') changed.knip.unused_exports = value;
      else changed.thresholds.unused_exports_delta = value === undefined ? 'invalid' : value;
      for (const args of [['--json'], ['--refresh']]) {
        const observed = cli({ args, baselineValue: changed });
        assert.equal(observed.status, 2);
        assert.equal(observed.writes.length, 0);
      }
    }
  }
});

test('missing dependencies and failed HEAD lookup never refresh', () => {
  for (const options of [{ missingDeps: true }, { gitFailure: true }]) {
    const observed = cli({ args: ['--refresh'], ...options });
    assert.equal(observed.status, 2);
    assert.equal(observed.writes.length, 0);
  }
});

test('stderr is diagnostic evidence, not metric input; tools use bounded shell-free execution', () => {
  for (const name of Object.keys(reports)) {
    runAudit(name, { root: path.resolve('path with spaces'), execute: (command, args, options) => {
      assert.ok(path.isAbsolute(command));
      assert.ok(Array.isArray(args));
      assert.notEqual(options.shell, true);
      assert.ok(options.timeout > 0);
      assert.ok(options.maxBuffer > 0);
      return { ...success(reports[name]), stderr: 'warning[not-an-ast-finding]: diagnostic on stderr' };
    } });
  }
  const observed = cli({ results: { knip: { status: 2, stdout: '', stderr: 'configuration missing' } } });
  assert.match(observed.stderr, /configuration missing/);
});

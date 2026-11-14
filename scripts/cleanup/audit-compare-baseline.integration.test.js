const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { runAudit } = require('./audit-compare-baseline');

// Use the installed lockfile toolchain, never download tools in a test. The
// override supports running this test from a scratch directory on DEV.
const toolsRoot = process.env.AUDIT_TEST_TOOLS_ROOT || path.resolve(__dirname, '../..');

test('installed analysers: findings, clean reports, legacy count parity and broken configuration', { timeout: 120_000 }, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-comparator-contract-'));
  const write = (file, content) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content);
  };
  try {
    fs.symlinkSync(path.join(toolsRoot, 'node_modules'), path.join(root, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
    write('package.json', JSON.stringify({ name: 'audit-comparator-fixture', version: '1.0.0', private: true }));
    write('backend/src/a.ts', "import './b'; console.log('warning'); export const x = 1; export const y = 2; export default x;\n");
    write('backend/src/b.ts', "import './a';\n");
    write('frontend/app/entry.ts', "import './missing';\ndebugger;\n");
    write('unused.ts', 'export const unused = 1;\n');
    write('knip.json', JSON.stringify({ entry: ['backend/src/a.ts', 'frontend/app/entry.ts'], project: ['**/*.ts'], includeEntryExports: true }));
    write('.dependency-cruiser.cjs', "module.exports = { forbidden: [{ name: 'cycle', severity: 'warn', from: {}, to: { circular: true } }] };\n");
    write('sgconfig.yml', 'ruleDirs:\n  - rules\n');
    write('rules/log.yml', 'id: log\nlanguage: TypeScript\nseverity: warning\nrule:\n  pattern: console.log($$$ARGS)\n');
    write('rules/debug.yml', 'id: debug\nlanguage: TypeScript\nseverity: error\nrule:\n  pattern: debugger\n');

    const knip = runAudit('knip', { root });
    const legacy = spawnSync(process.execPath, [path.join(root, 'node_modules/knip/bin/knip.js'), '--no-exit-code', '--no-progress', '--reporter', 'compact'], { cwd: root, encoding: 'utf8', timeout: 30_000 });
    assert.equal(legacy.status, 0, legacy.stderr);
    const titles = { unused_files: 'Unused files', unused_dependencies: 'Unused dependencies', unused_dev_dependencies: 'Unused devDependencies', unlisted_dependencies: 'Unlisted dependencies', unlisted_binaries: 'Unlisted binaries', unused_exports: 'Unused exports', unused_types: 'Unused exported types', duplicate_exports: 'Duplicate exports', unresolved_imports: 'Unresolved imports' };
    for (const [metric, title] of Object.entries(titles)) {
      const match = legacy.stdout.match(new RegExp(`^${title} \\((\\d+)\\)`, 'm'));
      assert.equal(knip[metric], match ? Number(match[1]) : 0, `${metric}: legacy count drift`);
    }
    assert.ok(knip.unused_exports > 0);
    assert.equal(knip.unused_files, 1);
    assert.ok(knip.duplicate_exports > 0);
    assert.equal(knip.unresolved_imports, 1);
    assert.deepEqual(runAudit('madge', { root }), { cycles: 1 });
    assert.deepEqual(runAudit('depcruise', { root }), { violations: 1, warnings: 1, errors: 0 });
    assert.deepEqual(runAudit('ast_grep', { root }), { warnings: 1, errors: 1 });

    write('backend/src/a.ts', "console.info('clean');\n");
    write('frontend/app/entry.ts', "console.info('clean');\n");
    fs.unlinkSync(path.join(root, 'backend/src/b.ts'));
    fs.unlinkSync(path.join(root, 'unused.ts'));
    for (const name of ['knip', 'madge', 'depcruise', 'ast_grep']) {
      assert.ok(Object.values(runAudit(name, { root })).every((n) => n === 0), `${name}: valid clean report`);
    }

    write('knip.json', '{ invalid json');
    assert.throws(() => runAudit('knip', { root }), /knip:/);
    write('.dependency-cruiser.cjs', "throw new Error('broken dependency configuration');\n");
    assert.throws(() => runAudit('depcruise', { root }), /depcruise:/);
    write('sgconfig.yml', 'ruleDirs: [');
    assert.throws(() => runAudit('ast_grep', { root }), /ast_grep:/);
    // Neither a file madge's parser rejects nor a root without analysed files
    // may be read as a cycle-free graph.
    write('backend/src/a.ts', "import './b';\n");
    write('backend/src/b.ts', "import './a';\nexport const b = = ;\n");
    assert.throws(() => runAudit('madge', { root }), /madge: invalid report: madge could not parse 1 file\(s\): backend\/src\/b\.ts/);
    fs.unlinkSync(path.join(root, 'backend/src/b.ts'));
    write('frontend/app/README.md', 'no TypeScript here\n');
    fs.unlinkSync(path.join(root, 'frontend/app/entry.ts'));
    assert.throws(() => runAudit('madge', { root }), /madge: invalid report: madge analysed no file under frontend\/app/);
    fs.unlinkSync(path.join(root, 'backend/src/a.ts'));
    assert.throws(() => runAudit('madge', { root }), /madge: invalid report: madge analysed no file under backend\/src/);
    // A missing input directory must not be interpreted as a cycle-free graph.
    fs.renameSync(path.join(root, 'backend/src'), path.join(root, 'backend/moved'));
    assert.throws(() => runAudit('madge', { root }), /madge:/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('comparator CLI with installed analysers: madge cycles count, invalid madge evidence exits 2 without metrics or refresh', { timeout: 120_000 }, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-comparator-cli-'));
  const write = (file, content) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content);
  };
  const baselinePath = path.join(root, 'audit-reports/phase0-baseline.json');
  const comparator = path.join(root, 'scripts/cleanup/audit-compare-baseline.js');
  const run = (...args) => spawnSync(process.execPath, [comparator, ...args], { cwd: root, encoding: 'utf8', timeout: 60_000 });
  try {
    fs.symlinkSync(path.join(toolsRoot, 'node_modules'), path.join(root, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
    write('scripts/cleanup/audit-compare-baseline.js', fs.readFileSync(path.join(__dirname, 'audit-compare-baseline.js')));
    write('audit-reports/phase0-baseline.json', fs.readFileSync(path.join(__dirname, '../../audit-reports/phase0-baseline.json')));
    write('package.json', JSON.stringify({ name: 'audit-comparator-cli-fixture', version: '1.0.0', private: true }));
    write('knip.json', JSON.stringify({ entry: ['backend/src/a.ts', 'frontend/app/entry.ts'], project: ['**/*.ts'] }));
    write('.dependency-cruiser.cjs', 'module.exports = { forbidden: [] };\n');
    write('sgconfig.yml', 'ruleDirs:\n  - rules\n');
    write('rules/debug.yml', 'id: debug\nlanguage: TypeScript\nseverity: error\nrule:\n  pattern: debugger\n');
    write('backend/src/a.ts', "import { b } from './b';\nexport const a = (): number => b();\n");
    write('backend/src/b.ts', "import { a } from './a';\nexport const b = (): number => a();\n");
    write('frontend/app/entry.ts', "console.info('entry');\n");
    const baselineBytes = fs.readFileSync(baselinePath);

    const valid = run('--json');
    assert.equal(valid.status, 0, valid.stderr);
    assert.equal(JSON.parse(valid.stdout).current.madge.cycles, 1);
    assert.match(valid.stderr, /madge: 3 files analysed, 0 unresolved imports outside the cycle graph/);

    const invalid = {
      'unparsable file': [() => write('backend/src/b.ts', "import { a } from './a';\nexport const b = = ;\n"), /madge: invalid report: madge could not parse 1 file\(s\): backend\/src\/b\.ts/],
      'empty root': [() => { write('backend/src/b.ts', 'export const b = (): number => 1;\n'); fs.unlinkSync(path.join(root, 'frontend/app/entry.ts')); }, /madge: invalid report: madge analysed no file under frontend\/app/],
    };
    for (const [scenario, [mutate, message]] of Object.entries(invalid)) {
      mutate();
      const json = run('--json');
      assert.equal(json.status, 2, `${scenario}: ${json.stderr}`);
      const data = JSON.parse(json.stdout);
      assert.equal(data.failed, true, scenario);
      assert.match(data.error, message, scenario);
      assert.equal(data.current, undefined, scenario);
      const refresh = run('--refresh');
      assert.equal(refresh.status, 2, `${scenario}: ${refresh.stderr}`);
      assert.match(refresh.stderr, message, scenario);
      assert.doesNotMatch(refresh.stdout, /baseline refreshed/, scenario);
      assert.ok(fs.readFileSync(baselinePath).equals(baselineBytes), `${scenario}: baseline must stay byte-identical`);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

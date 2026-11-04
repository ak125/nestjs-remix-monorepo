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
    write('frontend/app/entry.ts', 'debugger;\n');
    write('unused.ts', 'export const unused = 1;\n');
    write('knip.json', JSON.stringify({ entry: ['backend/src/a.ts', 'frontend/app/entry.ts'], project: ['**/*.ts'], includeEntryExports: true }));
    write('.dependency-cruiser.cjs', "module.exports = { forbidden: [{ name: 'cycle', severity: 'warn', from: {}, to: { circular: true } }] };\n");
    write('sgconfig.yml', 'ruleDirs:\n  - rules\n');
    write('rules/log.yml', 'id: log\nlanguage: TypeScript\nseverity: warning\nrule:\n  pattern: console.log($$$ARGS)\n');
    write('rules/debug.yml', 'id: debug\nlanguage: TypeScript\nseverity: error\nrule:\n  pattern: debugger\n');

    const knip = runAudit('knip', { root });
    const legacy = spawnSync(process.execPath, [path.join(root, 'node_modules/knip/bin/knip.js'), '--no-exit-code', '--no-progress', '--reporter', 'compact'], { cwd: root, encoding: 'utf8', timeout: 30_000 });
    assert.equal(legacy.status, 0, legacy.stderr);
    const titles = { unused_files: 'Unused files', unused_dependencies: 'Unused dependencies', unused_dev_dependencies: 'Unused devDependencies', unlisted_dependencies: 'Unlisted dependencies', unlisted_binaries: 'Unlisted binaries', unused_exports: 'Unused exports', unused_types: 'Unused exported types', duplicate_exports: 'Duplicate exports' };
    for (const [metric, title] of Object.entries(titles)) {
      const match = legacy.stdout.match(new RegExp(`^${title} \\((\\d+)\\)`, 'm'));
      assert.equal(knip[metric], match ? Number(match[1]) : 0, `${metric}: legacy count drift`);
    }
    assert.ok(knip.unused_exports > 0);
    assert.equal(knip.unused_files, 1);
    assert.ok(knip.duplicate_exports > 0);
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
    // A missing input directory must not be interpreted as a cycle-free graph.
    fs.renameSync(path.join(root, 'backend/src'), path.join(root, 'backend/moved'));
    assert.throws(() => runAudit('madge', { root }), /madge:/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const YAML_PATH = path.join(
  ROOT,
  '.spec/00-canon/repository-registry/architecture.yaml',
);
const GENERATED_CJS = path.join(ROOT, '.dependency-cruiser.generated.cjs');
const GENERATED_SCHEMA = path.join(
  ROOT,
  '.spec/00-canon/_schema/architecture.schema.json',
);

function runGenerator(): { ok: boolean; stderr: string } {
  try {
    execSync('npm run architecture:build', { cwd: ROOT, stdio: 'pipe' });
    return { ok: true, stderr: '' };
  } catch (e: any) {
    return { ok: false, stderr: String(e.stderr ?? e.message) };
  }
}

describe('architecture artifact generator', () => {
  test('runs from a clean state and exits 0', () => {
    const r = runGenerator();
    assert.ok(r.ok, `expected exit 0, got stderr:\n${r.stderr}`);
  });

  test('emits .dependency-cruiser.generated.cjs with both expected rule names', () => {
    const content = readFileSync(GENERATED_CJS, 'utf8');
    assert.ok(content.includes('AUTO-GENERATED'));
    assert.ok(content.includes("name: 'frontend-not-to-backend-src'"));
    assert.ok(content.includes("name: 'backend-not-to-frontend'"));
  });

  test('emitted CJS is parseable as a JavaScript module', () => {
    delete require.cache[require.resolve(GENERATED_CJS)];
    const rules = require(GENERATED_CJS);
    assert.ok(Array.isArray(rules));
    assert.equal(rules.length, 2);
    // Locale-sorted: 'b' < 'f' so backend-not-to-frontend comes first
    assert.equal(rules[0].name, 'backend-not-to-frontend');
    assert.equal(rules[1].name, 'frontend-not-to-backend-src');
    assert.equal(rules[1].from.path, '^frontend/app/');
  });

  test('generated module exports an ARRAY ROOT (shape invariant)', () => {
    // Locks the export shape. If a future refactor changes the emitter to
    //   module.exports = { forbidden: [...] }
    // the spread `...generatedRules` in .dependency-cruiser.cjs would silently
    // produce an array containing the object instead of spreading rules.
    delete require.cache[require.resolve(GENERATED_CJS)];
    const rules = require(GENERATED_CJS);
    assert.ok(
      Array.isArray(rules),
      `generated artifact must export an ARRAY root (got ${typeof rules}).`,
    );
  });

  test('emitted rules are sorted by name (deterministic order)', () => {
    delete require.cache[require.resolve(GENERATED_CJS)];
    const rules = require(GENERATED_CJS) as Array<{ name: string }>;
    const names = rules.map((r) => r.name);
    const sorted = [...names].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    assert.deepEqual(names, sorted, 'emit order must be ASCII-sorted by rule name');
  });

  test('header carries Generated format version marker', () => {
    const content = readFileSync(GENERATED_CJS, 'utf8');
    assert.match(content, /Generated format version:\s+1/);
  });

  test('header carries Generated module format marker (cjs)', () => {
    const content = readFileSync(GENERATED_CJS, 'utf8');
    assert.match(content, /Generated module format:\s+cjs/);
  });

  test('generated CJS header SHA-256 matches the current YAML byte-exact', () => {
    const content = readFileSync(GENERATED_CJS, 'utf8');
    const yamlRaw = readFileSync(YAML_PATH, 'utf8');
    const expected = require('node:crypto')
      .createHash('sha256')
      .update(yamlRaw)
      .digest('hex');
    const match = content.match(/Source SHA-256:\s+([a-f0-9]{64})/);
    assert.ok(match, 'header must contain "Source SHA-256: <64-hex>"');
    assert.equal(
      match[1],
      expected,
      'header SHA-256 must equal the freshly computed hash of architecture.yaml',
    );
  });

  test('emits architecture.schema.json with ArchitectureContract reference', () => {
    const schema = JSON.parse(readFileSync(GENERATED_SCHEMA, 'utf8'));
    assert.ok(JSON.stringify(schema).includes('ArchitectureContract'));
  });

  test('output is deterministic — second run produces no diff on tracked artifact', () => {
    runGenerator();
    try {
      execSync(
        `git diff --exit-code -- "${GENERATED_CJS}"`,
        { cwd: ROOT, stdio: 'pipe' },
      );
    } catch (e: any) {
      assert.fail(
        `generator output not deterministic — diff detected on .dependency-cruiser.generated.cjs after second run:\n${String(e.stdout ?? e.stderr ?? '')}`,
      );
    }
  });

  test('generator writes ONLY to its 2 allowed targets, nothing else', () => {
    execSync('git checkout -- .dependency-cruiser.generated.cjs', { cwd: ROOT, stdio: 'pipe' });
    runGenerator(); // baseline regen
    runGenerator(); // second regen for diff snapshot
    const porcelain = execSync('git status --porcelain', { cwd: ROOT })
      .toString()
      .split('\n')
      .filter((l) => l.trim().length > 0)
      .map((l) => l.slice(3));

    const ALLOWED = new Set<string>([
      '.dependency-cruiser.generated.cjs',
      '.spec/00-canon/_schema/architecture.schema.json',
    ]);
    const violations = porcelain.filter((p) => !ALLOWED.has(p));
    assert.equal(
      violations.length,
      0,
      `generator wrote to disallowed targets: ${violations.join(', ')}. Allowed: ${[...ALLOWED].join(', ')}.`,
    );
  });

  test('generator never modifies .dependency-cruiser.cjs (defensive byte-equality)', () => {
    const inlineConfigPath = path.join(ROOT, '.dependency-cruiser.cjs');
    const before = readFileSync(inlineConfigPath, 'utf8');
    runGenerator();
    const after = readFileSync(inlineConfigPath, 'utf8');
    assert.equal(
      after,
      before,
      '.dependency-cruiser.cjs MUST remain untouched by the generator.',
    );
  });
});

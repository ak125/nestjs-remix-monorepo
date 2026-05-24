import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  resolveMembers,
  expandWildcards,
  buildNcuArgs,
  NCU_VERSION,
} from '../bump-dependency-family.mjs';

// Helper: write a synthetic overlay and return its path.
async function writeOverlay(content) {
  const dir = await mkdtemp(join(tmpdir(), 'bump-family-'));
  const path = join(dir, 'family-overlay.yaml');
  await writeFile(path, content, 'utf8');
  return path;
}

test('resolveMembers reads PR-9b members from the real overlay', async () => {
  const members = await resolveMembers(
    'tooling-typescript-eslint',
    './audit/dependencies/family-overlay.yaml',
  );
  assert.ok(members.includes('typescript'), 'must include typescript');
  assert.ok(members.includes('eslint'), 'must include eslint');
  assert.ok(
    members.includes('@typescript-eslint/parser') || members.some((m) => m.endsWith('/*')),
    'must include @typescript-eslint/* explicitly or via wildcard',
  );
});

test('resolveMembers throws on unknown family with a helpful list', async () => {
  await assert.rejects(
    () => resolveMembers('does-not-exist', './audit/dependencies/family-overlay.yaml'),
    /Unknown family.*Known:/,
  );
});

test('resolveMembers handles minimal synthetic overlay', async () => {
  const overlayPath = await writeOverlay(
    `families:\n  - family: synthetic\n    members:\n      - foo\n      - bar\n`,
  );
  const members = await resolveMembers('synthetic', overlayPath);
  assert.deepEqual(members, ['foo', 'bar']);
});

test('expandWildcards resolves @scope/* from lockfile', () => {
  const lockfile = {
    packages: {
      'node_modules/@typescript-eslint/parser': {},
      'node_modules/@typescript-eslint/eslint-plugin': {},
      'node_modules/@typescript-eslint/utils': {},
      'node_modules/eslint': {},
      'node_modules/typescript': {},
      // Nested deps must be ignored.
      'node_modules/eslint/node_modules/foo': {},
    },
  };
  const expanded = expandWildcards(['typescript', '@typescript-eslint/*'], lockfile);
  assert.deepEqual(expanded.sort(), [
    '@typescript-eslint/eslint-plugin',
    '@typescript-eslint/parser',
    '@typescript-eslint/utils',
    'typescript',
  ]);
});

test('expandWildcards handles eslint-plugin-* style wildcards', () => {
  const lockfile = {
    packages: {
      'node_modules/eslint-plugin-import': {},
      'node_modules/eslint-plugin-react': {},
      'node_modules/eslint-plugin-react-hooks': {},
      'node_modules/eslint': {},
    },
  };
  const expanded = expandWildcards(['eslint-plugin-*'], lockfile);
  assert.deepEqual(expanded.sort(), [
    'eslint-plugin-import',
    'eslint-plugin-react',
    'eslint-plugin-react-hooks',
  ]);
});

test('expandWildcards passes through literal names even when not in lockfile', () => {
  const expanded = expandWildcards(['some-pkg'], { packages: {} });
  assert.deepEqual(expanded, ['some-pkg']);
});

test('buildNcuArgs assembles deterministic argv for dry-run', () => {
  const args = buildNcuArgs({
    members: ['typescript', 'eslint'],
    target: 'latest',
    dryRun: true,
  });
  assert.deepEqual(args, [
    '--target', 'latest',
    '--filter', 'typescript,eslint',
    '--deep',
    '--errorLevel', '2',
    '--dry-run',
  ]);
});

test('buildNcuArgs uses -u (apply) when dryRun=false', () => {
  const args = buildNcuArgs({ members: ['x'], target: 'minor', dryRun: false });
  assert.ok(!args.includes('--dry-run'));
  assert.ok(args.includes('-u'));
  assert.ok(args.includes('--target') && args[args.indexOf('--target') + 1] === 'minor');
});

test('NCU_VERSION is pinned (no dynamic @latest)', () => {
  assert.match(NCU_VERSION, /^\d+\.\d+\.\d+$/, 'NCU_VERSION must be a literal semver, not "latest"');
});

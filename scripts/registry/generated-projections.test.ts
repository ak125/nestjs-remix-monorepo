/**
 * Tests de scripts/registry/generated-projections.js (mandat DO).
 * Lancer : npm run registry:test:generated-projections
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const mod = require('./generated-projections.js');
const SCRIPT = resolve(__dirname, 'generated-projections.js');
const REPO_ROOT = resolve(__dirname, '..', '..');

test('chaque projection listée est suivie par git (pas de nom périmé)', () => {
  const tracked = new Set(
    execFileSync('git', ['ls-files', '--', ...mod.GENERATED_PROJECTIONS], { cwd: REPO_ROOT, encoding: 'utf8' })
      .split('\n')
      .filter(Boolean),
  );
  for (const p of mod.GENERATED_PROJECTIONS) assert.ok(tracked.has(p), `${p} n'est pas suivi`);
});

test('la liste couvre les fichiers commités par registry:heal', () => {
  const pkg = require(join(REPO_ROOT, 'package.json'));
  const heal: string = pkg.scripts['registry:heal'];
  const added = heal.split('git add --')[1].split('&&')[0].trim().split(/\s+/);
  for (const p of added) assert.ok(mod.isGenerated(p), `${p} absent de la liste`);
});

test('partition sépare générés et autres, sans doublon', () => {
  const r = mod.partition(['audit/registry/rpc.json', 'backend/a.ts', 'audit/registry/rpc.json', '']);
  assert.deepEqual(r, { generated: ['audit/registry/rpc.json'], other: ['backend/a.ts'] });
});

test('portée pr : un généré identique à la base est admis, un généré divergent ne l’est pas', () => {
  const same = (p: string) => p === 'audit/registry/files.json';
  const r = mod.evaluate('pr', ['backend/a.ts', 'audit/registry/files.json', 'audit/registry/canonical.json'], same);
  assert.equal(r.ok, false);
  assert.deepEqual(r.offending, ['audit/registry/canonical.json']);
  assert.equal(mod.evaluate('pr', ['backend/a.ts']).ok, true);
});

test('portée bot : seuls des générés ; un chemin source est refusé', () => {
  assert.equal(mod.evaluate('bot', ['audit/registry/canonical.json', '.claude/knowledge/REPO_MAP.md']).ok, true);
  const r = mod.evaluate('bot', ['audit/registry/canonical.json', 'package.json']);
  assert.equal(r.ok, false);
  assert.deepEqual(r.offending, ['package.json']);
});

test('portée inconnue : exception', () => {
  assert.throws(() => mod.evaluate('nope', []));
});

// --- Intégration : vrai dépôt git jetable ---------------------------------------
function sh(cwd: string, ...args: string[]) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' });
}
function put(cwd: string, rel: string, content: string) {
  mkdirSync(dirname(join(cwd, rel)), { recursive: true });
  writeFileSync(join(cwd, rel), content);
}
function run(cwd: string, ...args: string[]) {
  return spawnSync('node', [SCRIPT, ...args], { cwd, encoding: 'utf8' });
}

test('CLI sur un dépôt jetable : pr, staged, bot, worktree, base illisible', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'gen-proj-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  sh(dir, 'init', '-q', '-b', 'main');
  sh(dir, 'config', 'user.email', 't@example.invalid');
  sh(dir, 'config', 'user.name', 'test');
  sh(dir, 'config', 'commit.gpgsign', 'false');
  put(dir, 'audit/registry/canonical.json', '{"v":1}\n');
  put(dir, 'backend/a.ts', 'export const a = 1;\n');
  sh(dir, 'add', '-A');
  sh(dir, 'commit', '-q', '-m', 'base');
  sh(dir, 'branch', 'base');

  // Branche ordinaire : source seulement → conforme
  sh(dir, 'checkout', '-q', '-b', 'feature');
  put(dir, 'backend/a.ts', 'export const a = 2;\n');
  sh(dir, 'commit', '-qam', 'source');
  assert.equal(run(dir, 'check', '--scope', 'pr', '--base', 'base').status, 0);

  // La branche régénère un fichier → écart (1), avertissement seul avec --warn (0)
  put(dir, 'audit/registry/canonical.json', '{"v":2}\n');
  sh(dir, 'add', 'audit/registry/canonical.json');
  const staged = run(dir, 'check', '--scope', 'staged', '--base', 'base');
  assert.equal(staged.status, 1);
  assert.match(staged.stderr, /audit\/registry\/canonical\.json/);
  assert.equal(run(dir, 'check', '--scope', 'staged', '--base', 'base', '--warn').status, 0);
  sh(dir, 'commit', '-qm', 'regen');
  assert.equal(run(dir, 'check', '--scope', 'pr', '--base', 'base').status, 1);
  // ... et la portée bot refuse la source mêlée aux générés
  assert.equal(run(dir, 'check', '--scope', 'bot', '--base', 'base').status, 1);

  // Reprendre la version de la base est admis (transition des PR ouvertes)
  sh(dir, 'checkout', '-q', 'base', '--', 'audit/registry/canonical.json');
  assert.equal(run(dir, 'check', '--scope', 'staged', '--base', 'base').status, 0);
  sh(dir, 'commit', '-qm', 'reprendre la base');
  assert.equal(run(dir, 'check', '--scope', 'pr', '--base', 'base').status, 0);

  // Branche du robot : générés seuls → conforme
  sh(dir, 'checkout', '-q', '-b', 'bot', 'base');
  put(dir, 'audit/registry/canonical.json', '{"v":3}\n');
  assert.equal(run(dir, 'check', '--scope', 'worktree').status, 0);
  put(dir, 'backend/b.ts', 'x\n');
  const wt = run(dir, 'check', '--scope', 'worktree');
  assert.equal(wt.status, 1);
  assert.match(wt.stderr, /backend\/b\.ts/);
  rmSync(join(dir, 'backend/b.ts'));
  sh(dir, 'commit', '-qam', 'heal');
  assert.equal(run(dir, 'check', '--scope', 'bot', '--base', 'base').status, 0);

  // Base illisible : 2, jamais masqué par --warn
  assert.equal(run(dir, 'check', '--scope', 'pr', '--base', 'absente', '--warn').status, 2);
  assert.equal(run(dir, 'check', '--scope', 'nope').status, 2);
  assert.equal(run(dir, 'list').stdout.split('\n').filter(Boolean).length, mod.GENERATED_PROJECTIONS.length);
});

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const DEPCRUISE_CJS = path.join(ROOT, '.dependency-cruiser.cjs');
const GENERATED_CJS = path.join(ROOT, '.dependency-cruiser.generated.cjs');

describe('dependency-cruiser refactor integrity', () => {
  test('main .dependency-cruiser.cjs requires the generated module', () => {
    const src = readFileSync(DEPCRUISE_CJS, 'utf8');
    assert.match(
      src,
      /require\(['"]\.\/\.dependency-cruiser\.generated\.cjs['"]\)/,
      'main config must require ./.dependency-cruiser.generated.cjs',
    );
  });

  test('main .dependency-cruiser.cjs spreads generated rules in forbidden[]', () => {
    const src = readFileSync(DEPCRUISE_CJS, 'utf8');
    assert.match(
      src,
      /\.\.\.generatedRules/,
      'forbidden[] must spread generatedRules (so emitted rules are honoured)',
    );
  });

  test('no orphan inline duplicates of the 2 generated rule names', () => {
    delete require.cache[require.resolve(DEPCRUISE_CJS)];
    const cfg = require(DEPCRUISE_CJS) as { forbidden: Array<{ name: string }> };
    const names = cfg.forbidden.map((r) => r.name);
    for (const expected of ['frontend-not-to-backend-src', 'backend-not-to-frontend']) {
      const occurrences = names.filter((n) => n === expected).length;
      assert.equal(
        occurrences,
        1,
        `${expected} should appear exactly once (from generated module). Found ${occurrences}.`,
      );
    }
  });

  test('total forbidden rule count is 9 (2 generated + 7 inline survivors)', () => {
    delete require.cache[require.resolve(DEPCRUISE_CJS)];
    const cfg = require(DEPCRUISE_CJS) as { forbidden: Array<{ name: string }> };
    assert.equal(cfg.forbidden.length, 9);
  });

  test('generated module path is correct and loadable', () => {
    delete require.cache[require.resolve(GENERATED_CJS)];
    const rules = require(GENERATED_CJS);
    assert.ok(Array.isArray(rules));
    assert.equal(rules.length, 2);
  });
});

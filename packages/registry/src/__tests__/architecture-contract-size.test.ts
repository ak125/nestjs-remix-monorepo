import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { load as parseYaml } from 'js-yaml';

const CONTRACT = path.resolve(
  __dirname,
  '../../../../.spec/00-canon/repository-registry/architecture.yaml',
);

describe('architecture contract size cap', () => {
  test('YAML source does not exceed 200 lines (V1 minimal cap)', () => {
    const lines = readFileSync(CONTRACT, 'utf8').split('\n').length;
    assert.ok(lines <= 200, `architecture.yaml has ${lines} lines, max 200 (V1)`);
  });

  test('boundaries ≤ 15 entries (chaos curve guard)', () => {
    const c = parseYaml(readFileSync(CONTRACT, 'utf8')) as any;
    assert.ok(
      c.boundaries.length <= 15,
      `boundaries has ${c.boundaries.length} entries; bump schemaVersion (semver minor) before exceeding 15.`,
    );
  });

  test('top-level keys are exactly the 4 V1 keys (no smuggled sections)', () => {
    const c = parseYaml(readFileSync(CONTRACT, 'utf8')) as Record<string, unknown>;
    const keys = Object.keys(c).sort();
    assert.deepEqual(
      keys,
      ['adr', 'boundaries', 'layers', 'schemaVersion'],
      `architecture.yaml MUST contain only schemaVersion/adr/layers/boundaries. Found: ${keys.join(', ')}. ` +
        'Other concerns belong in PR-3..PR-6 contract files.',
    );
  });
});

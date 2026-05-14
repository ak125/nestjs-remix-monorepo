import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { load as parseYaml } from 'js-yaml';

// Size invariants — bound the canon contract growth surface. These bounds
// double-protect what DbContractSchema already enforces (via max(20) on
// tables[]), and add file-LOC + top-level-key set checks that the Zod
// schema cannot express on its own.

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const YAML_PATH = path.join(
  REPO_ROOT,
  '.spec/00-canon/repository-registry/db.yaml',
);

const raw = readFileSync(YAML_PATH, 'utf8');
const doc = parseYaml(raw) as Record<string, unknown> & { tables: unknown[] };

describe('db.yaml — size invariants', () => {
  test('file is ≤ 300 LOC (anti-bloat budget for V1 minimal contract)', () => {
    const lines = raw.split('\n').length;
    assert.ok(
      lines <= 300,
      `db.yaml is ${lines} lines (budget: ≤ 300). Split additional rows into a follow-up PR + ADR.`,
    );
  });

  test('has tables[].length ≤ 20 (V1 scope cap)', () => {
    assert.ok(
      doc.tables.length <= 20,
      `db.yaml declares ${doc.tables.length} tables (cap: ≤ 20). Bump schemaVersion + open ADR before extending.`,
    );
  });

  test('has exactly 3 top-level keys (anti-smuggling — V1 minimal)', () => {
    assert.deepEqual(
      Object.keys(doc).sort(),
      ['adr', 'schemaVersion', 'tables'],
      'unexpected top-level keys — V1 minimal allows only { schemaVersion, adr, tables }',
    );
  });
});

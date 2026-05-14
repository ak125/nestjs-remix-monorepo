import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { load as parseYaml } from 'js-yaml';
import { DbContractSchema, type DbContract } from '../canonical/db-contract';

// ──────────────────────────────────────────────────────────────────────────
// Paths — db.yaml is loaded from the real canon location. These tests catch
// drift between the schema and the actual committed contract. For pure
// schema unit-tests (no YAML), see fixture-based cases below.
// ──────────────────────────────────────────────────────────────────────────
const REPO_ROOT = path.resolve(__dirname, '../../../..');
const YAML_PATH = path.join(
  REPO_ROOT,
  '.spec/00-canon/repository-registry/db.yaml',
);
const DOMAINS_YAML = path.join(
  REPO_ROOT,
  '.spec/00-canon/repository-registry/domains.yaml',
);

function loadRealContract(): DbContract {
  const raw = readFileSync(YAML_PATH, 'utf8');
  const parsed = parseYaml(raw);
  return DbContractSchema.parse(parsed);
}

function loadRealDomainIds(): Set<string> {
  // domains.yaml top-level shape: { schemaVersion, entries: [ { id, ... }, ... ] }
  // (see .spec/00-canon/repository-registry/domains.yaml — Layer 2 overlay).
  const raw = readFileSync(DOMAINS_YAML, 'utf8');
  const doc = parseYaml(raw) as { entries: Array<{ id: string }> };
  return new Set(doc.entries.map((e) => e.id));
}

// V1 MINIMAL fixture for negative-path tests. Mirrors architecture-contract
// pattern: the fixture is the well-formed baseline; tampered copies trigger
// the rejection paths.
const validFixture = {
  schemaVersion: '1.0.0',
  adr: 'ADR-058',
  tables: [
    {
      name: 'public.products',
      domain: 'D1',
      owner: '@org/team',
      criticality: 'critical',
      allowed_access_surfaces: ['backend', 'rpc'],
      forbidden_access_surfaces: ['frontend', 'anon'],
      notes: 'Example.',
    },
  ],
};

describe('DbContractSchema — round-trip on real db.yaml', () => {
  test('the committed db.yaml parses through DbContractSchema', () => {
    assert.doesNotThrow(() => loadRealContract());
  });

  test('the committed db.yaml has no duplicate table.name', () => {
    const c = loadRealContract();
    const names = c.tables.map((t) => t.name);
    assert.equal(new Set(names).size, names.length);
  });

  test('each table allowed/forbidden surface pair is disjoint', () => {
    const c = loadRealContract();
    for (const t of c.tables) {
      const overlap = t.allowed_access_surfaces.filter((s) =>
        t.forbidden_access_surfaces.includes(s),
      );
      assert.deepEqual(overlap, [], `overlap detected on "${t.name}": ${overlap.join(', ')}`);
    }
  });
});

describe('DbContractSchema — fixture-based negative paths', () => {
  test('accepts the well-formed fixture', () => {
    assert.doesNotThrow(() => DbContractSchema.parse(validFixture));
  });

  test('rejects unknown top-level fields (.strict() — V1 anti-dumping-ground)', () => {
    const bad = { ...validFixture, sneakyExtra: 42 };
    assert.throws(() => DbContractSchema.parse(bad));
  });

  test('rejects unknown per-table fields (.strict() — anti-smuggling)', () => {
    const bad = {
      ...validFixture,
      tables: [{ ...validFixture.tables[0], rlsEnabled: true }],
    };
    assert.throws(() => DbContractSchema.parse(bad));
  });
});

describe('DbContractSchema — cross-contract (ADR-062 §Cross-contract deps)', () => {
  test('every db.yaml table.domain exists in domains.yaml', () => {
    const c = loadRealContract();
    const known = loadRealDomainIds();
    for (const t of c.tables) {
      assert.ok(
        known.has(t.domain),
        `db.yaml references unknown domain "${t.domain}" on table "${t.name}" — add it to domains.yaml first`,
      );
    }
  });

  test('rejects UNKNOWN domain in db.yaml (canon SoT must be explicit)', () => {
    const bad = {
      ...validFixture,
      tables: [{ ...validFixture.tables[0], domain: 'UNKNOWN' }],
    };
    assert.throws(
      () => DbContractSchema.parse(bad),
      /UNKNOWN is forbidden in canon SoT/,
    );
  });
});

describe('DbContractSchema — anti-parallel-truth (ADR-062 Loi B)', () => {
  // db.yaml must NOT redeclare facts that live in another canon source:
  //   - rlsEnabled / row policies → migrations + audit/registry/db.json
  //   - deletePolicy             → delete-policy.yaml
  //   - rowCount / size metrics  → audit/registry/db.json
  // Two angles, on purpose:
  //   1. Structural-key visitor — catches any nested key matching the banned
  //      pattern at any depth, even if values would happen to be empty.
  //   2. Serialized body scan (excluding `notes`) — catches the pattern in
  //      structural string VALUES too (e.g. an enum literal sneaking in).
  // `notes` strings are stripped before the serialized scan to allow narrative
  // pointers ("service_role grant via DO block …") without false positives.
  const BANNED = /(rls[A-Z_]?enabled|deletePolicy|rowCount|policy)/i;

  test('committed contract has no banned facts as structural keys (any depth)', () => {
    const c = loadRealContract();
    const visitKeys = (node: unknown): string[] => {
      if (node === null || typeof node !== 'object') return [];
      const obj = node as Record<string, unknown>;
      return Object.keys(obj).flatMap((k) => [k, ...visitKeys(obj[k])]);
    };
    const offending = visitKeys(c).filter((k) => BANNED.test(k));
    assert.deepEqual(offending, [], `parallel-truth leak (keys): ${offending.join(', ')}`);
  });

  test('committed contract serialized body (notes stripped) contains no banned tokens', () => {
    const c = loadRealContract();
    const structural = {
      ...c,
      tables: c.tables.map(({ notes: _notes, ...rest }) => rest),
    };
    assert.ok(
      !BANNED.test(JSON.stringify(structural)),
      'parallel-truth leak in structural body — see test header for canon rationale',
    );
  });
});

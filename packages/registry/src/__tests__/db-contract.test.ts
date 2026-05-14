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

describe('DbContractSchema — field-level negative paths', () => {
  // Pin the regex semantics on each primitive sub-schema so future tightening
  // (e.g. forbidding `_` in owner names) cannot silently weaken the contract.
  // Mirrors the discipline already present in architecture-contract.test.ts.
  const mut = (patch: Partial<typeof validFixture.tables[0]>) => ({
    ...validFixture,
    tables: [{ ...validFixture.tables[0], ...patch }],
  });

  test('rejects schemaVersion outside semver X.Y.Z', () => {
    for (const v of ['v1', '1.0', '1.0.0-rc.1', '1.0.0.0', 'latest']) {
      assert.throws(
        () => DbContractSchema.parse({ ...validFixture, schemaVersion: v }),
        new RegExp('schemaVersion'),
        `expected "${v}" to be rejected`,
      );
    }
  });

  test('rejects adr that does not match ADR-NNN', () => {
    for (const a of ['ADR-58', 'adr-058', 'ADR058', 'ADR-', 'XX-001']) {
      assert.throws(
        () => DbContractSchema.parse({ ...validFixture, adr: a }),
        /adr/i,
        `expected "${a}" to be rejected`,
      );
    }
  });

  test('rejects owner missing @, uppercase, or with extra slashes', () => {
    for (const o of ['org/team', '@Org/Team', '@a/b/c', '@', 'no-prefix']) {
      assert.throws(
        () => DbContractSchema.parse(mut({ owner: o as never })),
        /owner/i,
        `expected "${o}" to be rejected`,
      );
    }
  });

  test('rejects table name without schema, with leading dot, or uppercase', () => {
    for (const n of ['products', '.products', 'public.', 'Public.products', 'public..products']) {
      assert.throws(
        () => DbContractSchema.parse(mut({ name: n })),
        /table name/i,
        `expected "${n}" to be rejected`,
      );
    }
  });

  test('rejects criticality outside the enum', () => {
    for (const c of ['low', 'medium', 'P0', '']) {
      assert.throws(
        () => DbContractSchema.parse(mut({ criticality: c as never })),
        `expected criticality "${c}" to be rejected`,
      );
    }
  });

  test('rejects empty allowed/forbidden surface arrays (min(1))', () => {
    assert.throws(() => DbContractSchema.parse(mut({ allowed_access_surfaces: [] as never })));
    assert.throws(() => DbContractSchema.parse(mut({ forbidden_access_surfaces: [] as never })));
  });

  test('rejects tables: [] (min(1)) and tables.length > 20 (max(20))', () => {
    assert.throws(() => DbContractSchema.parse({ ...validFixture, tables: [] }));
    const tooMany = Array.from({ length: 21 }, (_, i) => ({
      ...validFixture.tables[0],
      name: `public.t_${i}`,
    }));
    assert.throws(() => DbContractSchema.parse({ ...validFixture, tables: tooMany }));
  });

  test('rejects notes longer than 500 chars', () => {
    assert.throws(() => DbContractSchema.parse(mut({ notes: 'x'.repeat(501) })));
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
  //   - row security              → migrations (ADR-021)
  // Postgres ecosystem favors snake_case, so the regex must catch both
  // styles (rowCount + row_count, rlsEnabled + rls_enabled, etc.). The
  // sentinel test below pins positive hits so future edits stay honest.
  //
  // Two angles, on purpose:
  //   1. Structural-key visitor — catches any nested key matching the banned
  //      pattern at any depth, even if values would happen to be empty.
  //   2. Serialized body scan (excluding `notes`) — catches the pattern in
  //      structural string VALUES too (e.g. an enum literal sneaking in).
  // `notes` strings are stripped before the serialized scan to allow narrative
  // pointers ("service_role grant via DO block …") without false positives.
  const BANNED =
    /(rls[_A-Z]?enabled|delete[_A-Z]?policy|row[_A-Z]?count|polic(?:y|ies)|row[_A-Z]?security)/i;

  test('regex sentinel: BANNED catches both camelCase and snake_case spellings', () => {
    const positives = [
      'rlsEnabled', 'rls_enabled', 'RLS_enabled',
      'rowCount', 'row_count', 'ROW_COUNT',
      'deletePolicy', 'delete_policy',
      'policy', 'policies',
      'rowSecurity', 'row_security',
    ];
    const negatives = [
      'service_role', 'grant', 'updated_at', 'enabled_at', 'delete_button',
    ];
    for (const p of positives) {
      assert.ok(BANNED.test(p), `expected BANNED to match "${p}"`);
    }
    for (const n of negatives) {
      assert.ok(!BANNED.test(n), `expected BANNED NOT to match "${n}"`);
    }
  });

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

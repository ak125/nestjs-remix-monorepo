import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ArchitectureContractSchema } from '../canonical/architecture-contract';

// V1 MINIMAL fixture — 4 top-level fields only. Every other concern (runtime,
// ownership, ast-grep, db) lives in a dedicated contract file (PR-3..PR-6).
const validFixture = {
  schemaVersion: '1.0.0',
  adr: 'ADR-058',
  layers: [
    { id: 'frontend', rootGlobs: ['frontend/app/**'] },
    { id: 'backend', rootGlobs: ['backend/src/**'] },
  ],
  boundaries: [
    {
      id: 'frontend-backend-symmetry',
      rationale: 'ADR-058 §boundary-A — frontend and backend are independent build units.',
      emitDepcruise: [
        {
          name: 'frontend-not-to-backend-src',
          severity: 'error',
          comment: 'Generated from architecture.yaml#boundaries[frontend-backend-symmetry]',
          fromPath: '^frontend/app/',
          toPath: '^backend/src/',
        },
        {
          name: 'backend-not-to-frontend',
          severity: 'error',
          comment: 'Generated from architecture.yaml#boundaries[frontend-backend-symmetry]',
          fromPath: '^backend/src/',
          toPath: '^frontend/app/',
        },
      ],
    },
  ],
};

describe('ArchitectureContractSchema', () => {
  test('accepts a well-formed contract', () => {
    assert.doesNotThrow(() => ArchitectureContractSchema.parse(validFixture));
  });

  test('rejects schemaVersion outside semver', () => {
    assert.throws(
      () => ArchitectureContractSchema.parse({ ...validFixture, schemaVersion: 'v1' }),
      /schemaVersion/,
    );
  });

  test('rejects duplicate emitDepcruise rule names within a boundary', () => {
    const dup = { ...validFixture.boundaries[0].emitDepcruise[0] };
    const bad = {
      ...validFixture,
      boundaries: [{ ...validFixture.boundaries[0], emitDepcruise: [dup, dup] }],
    };
    assert.throws(() => ArchitectureContractSchema.parse(bad));
  });

  test('rejects unknown top-level fields (.strict() — V1 anti-dumping-ground guard)', () => {
    // The strongest V1 guarantee: ONLY 4 top-level fields. A smuggled
    // `ownershipBoundaries`, `documentedRuntimeFlows`, `runtimeEntrypoints`,
    // or `forbiddenAstgrepEdges` MUST be rejected — they belong in PR-3..PR-6.
    const bad = { ...validFixture, ownershipBoundaries: [{ domain: 'D15' }] };
    assert.throws(() => ArchitectureContractSchema.parse(bad));
  });

  test('rejects duplicate emitDepcruise rule names across boundaries', () => {
    const bad = {
      ...validFixture,
      boundaries: [
        validFixture.boundaries[0],
        { ...validFixture.boundaries[0], id: 'duplicate-boundary' },
      ],
    };
    assert.throws(() => ArchitectureContractSchema.parse(bad), /Duplicate emitDepcruise\.name/);
  });

  test('rejects emitDepcruise entries with unknown fields (V1 frozen surface)', () => {
    const bad = {
      ...validFixture,
      boundaries: [
        {
          ...validFixture.boundaries[0],
          emitDepcruise: [
            {
              name: 'sneaky-rule',
              severity: 'error',
              comment: 'attempt to smuggle extra depcruise fields',
              fromPath: '^x/',
              toPath: '^y/',
              dependencyTypes: ['npm'], // <-- not allowed in V1
            },
          ],
        },
      ],
    };
    assert.throws(() => ArchitectureContractSchema.parse(bad));
  });
});

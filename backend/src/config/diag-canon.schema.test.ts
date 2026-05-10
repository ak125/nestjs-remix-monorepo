import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  DiagCanon,
  DIAG_CANON_VERSION,
  checkDiagnosticRelation,
} from './diag-canon.schema';

const fixture = {
  version: DIAG_CANON_VERSION,
  generated_at: '2026-05-01T02:00:00Z',
  systems: ['freinage', 'filtration'],
  symptoms: {
    brake_noise_metallic: 'freinage',
    filter_clogged_diesel: 'filtration',
  },
};

describe('DiagCanon Zod (forme + cross-validation)', () => {
  it('parses a valid canon', () => {
    expect(() => DiagCanon.parse(fixture)).not.toThrow();
  });

  it('rejects unknown top-level keys (.strict)', () => {
    expect(() => DiagCanon.parse({ ...fixture, extra_field: 'x' })).toThrow();
  });

  it('rejects bad version (literal mismatch)', () => {
    expect(() => DiagCanon.parse({ ...fixture, version: '2.0.0' })).toThrow();
  });

  it('rejects symptom slug with uppercase', () => {
    expect(() =>
      DiagCanon.parse({ ...fixture, symptoms: { Brake: 'freinage' } }),
    ).toThrow();
  });

  it('rejects symptom mapped to unknown system (superRefine)', () => {
    expect(() =>
      DiagCanon.parse({
        ...fixture,
        // ghost_symptom is mapped to a system not in `systems[]`. Forme is OK
        // (slug pattern ok), but composite FK invariant is violated.
        symptoms: { ghost_symptom: 'unknown_system' },
      }),
    ).toThrow(/system_slug_unknown:unknown_system/);
  });
});

describe('checkDiagnosticRelation — parity with Python validator', () => {
  // The blockedReason strings emitted here must be byte-identical to those
  // emitted by `gate_diagnostic_relations_fk` in
  // `scripts/wiki/validate-gamme-diagnostic-relations.py`. Any drift is a
  // real bug — fix the side that is wrong (Python is canonical for now).
  const canon = DiagCanon.parse(fixture);

  it('accepts coherent relation', () => {
    expect(
      checkDiagnosticRelation(canon, {
        symptom_slug: 'brake_noise_metallic',
        system_slug: 'freinage',
      }),
    ).toEqual({ ok: true });
  });

  it('emits symptom_slug_unknown:<slug> exactly like Python', () => {
    expect(
      checkDiagnosticRelation(canon, {
        symptom_slug: 'unknown_symptom',
        system_slug: 'freinage',
      }),
    ).toEqual({
      ok: false,
      blockedReason: 'symptom_slug_unknown:unknown_symptom',
    });
  });

  it('emits system_slug_unknown:<slug> when symptom OK but system bogus', () => {
    expect(
      checkDiagnosticRelation(canon, {
        symptom_slug: 'brake_noise_metallic',
        system_slug: 'badsys',
      }),
    ).toEqual({
      ok: false,
      blockedReason: 'system_slug_unknown:badsys',
    });
  });

  it('emits symptom_system_mismatch:<sym>:<declared>:<canon>', () => {
    expect(
      checkDiagnosticRelation(canon, {
        symptom_slug: 'brake_noise_metallic',
        system_slug: 'filtration',
      }),
    ).toEqual({
      ok: false,
      blockedReason:
        'symptom_system_mismatch:brake_noise_metallic:filtration:freinage',
    });
  });
});

// Cross-source : parses the real wiki canon (drift detection layer 3).
// Skipped silently if the canon is not available locally — this lets the
// spec run on bootstrap (before Phase D wiki publish) and on CI runners
// that mock the layout via WIKI_REPO_PATH.
describe('cross-source: real wiki canon parses against Zod', () => {
  const wikiRepoPath =
    process.env.WIKI_REPO_PATH || '/opt/automecanik/automecanik-wiki';
  const canonFile = path.join(wikiRepoPath, 'exports/diag-canon.json');
  const exists = fs.existsSync(canonFile);
  const maybeIt = exists ? it : it.skip;

  maybeIt(`parses ${canonFile} against Zod canon (drift fail-fast)`, () => {
    const raw = fs.readFileSync(canonFile, 'utf-8');
    const data = JSON.parse(raw);
    const result = DiagCanon.safeParse(data);
    if (!result.success) {
      // eslint-disable-next-line no-console
      console.error('SHAPE DRIFT detected:');
      // eslint-disable-next-line no-console
      console.error(JSON.stringify(result.error.format(), null, 2));
    }
    expect(result.success).toBe(true);
  });
});

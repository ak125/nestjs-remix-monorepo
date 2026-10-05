import { buildDiagCanonJsonSchema } from './diag-canon-jsonschema';
import {
  DIAG_CANON_PREVIOUS_VERSION,
  DIAG_CANON_VERSION,
} from './diag-canon.schema';

describe('buildDiagCanonJsonSchema', () => {
  it('produces stable JSON Schema across calls (idempotence)', () => {
    const a = JSON.stringify(buildDiagCanonJsonSchema());
    const b = JSON.stringify(buildDiagCanonJsonSchema());
    expect(a).toBe(b);
  });

  it('emits one strict object branch per accepted canon version', () => {
    const schema = buildDiagCanonJsonSchema() as {
      oneOf?: Array<Record<string, unknown>>;
    };
    expect(schema.oneOf).toHaveLength(2);
    const byVersion = Object.fromEntries(
      (schema.oneOf ?? []).map((branch) => [
        (branch as { properties: { version: { const: string } } }).properties
          .version.const,
        branch,
      ]),
    );
    expect(Object.keys(byVersion).sort()).toEqual([
      DIAG_CANON_PREVIOUS_VERSION,
      DIAG_CANON_VERSION,
    ]);
    for (const branch of Object.values(byVersion)) {
      expect(branch).toHaveProperty('type', 'object');
      expect(branch).toHaveProperty('properties.systems');
      expect(branch).toHaveProperty('properties.symptoms');
      // additionalProperties: false (from .strict()) — drift detection layer 1
      expect(branch).toHaveProperty('additionalProperties', false);
    }
    expect(byVersion[DIAG_CANON_VERSION]).toHaveProperty('properties.causes');
    expect(byVersion[DIAG_CANON_VERSION].required).toContain('causes');
    expect(byVersion[DIAG_CANON_PREVIOUS_VERSION]).not.toHaveProperty(
      'properties.causes',
    );
  });
});

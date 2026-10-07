import { buildDiagCanonJsonSchema } from './diag-canon-jsonschema';
import { DIAG_CANON_VERSION } from './diag-canon.schema';

describe('buildDiagCanonJsonSchema', () => {
  it('produces stable JSON Schema across calls (idempotence)', () => {
    const a = JSON.stringify(buildDiagCanonJsonSchema());
    const b = JSON.stringify(buildDiagCanonJsonSchema());
    expect(a).toBe(b);
  });

  it('emits a valid JSON Schema object with required top-level shape', () => {
    const schema = buildDiagCanonJsonSchema() as Record<string, unknown>;
    expect(schema).not.toHaveProperty('oneOf');
    expect(schema).toHaveProperty('type', 'object');
    expect(schema).toHaveProperty(
      'properties.version.const',
      DIAG_CANON_VERSION,
    );
    expect(schema).toHaveProperty('properties.systems');
    expect(schema).toHaveProperty('properties.symptoms');
    expect(schema).toHaveProperty('properties.causes');
    expect(schema.required).toContain('causes');
    // additionalProperties: false (from .strict()) — drift detection layer 1
    expect(schema).toHaveProperty('additionalProperties', false);
  });
});

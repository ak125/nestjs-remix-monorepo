import { buildDiagCanonJsonSchema } from './diag-canon-jsonschema';

describe('buildDiagCanonJsonSchema', () => {
  it('produces stable JSON Schema across calls (idempotence)', () => {
    const a = JSON.stringify(buildDiagCanonJsonSchema());
    const b = JSON.stringify(buildDiagCanonJsonSchema());
    expect(a).toBe(b);
  });

  it('emits a valid JSON Schema object with required top-level shape', () => {
    const schema = buildDiagCanonJsonSchema() as Record<string, unknown>;
    expect(schema).toHaveProperty('type', 'object');
    expect(schema).toHaveProperty('properties.version');
    expect(schema).toHaveProperty('properties.systems');
    expect(schema).toHaveProperty('properties.symptoms');
    // additionalProperties: false (from .strict()) — drift detection layer 1
    expect(schema).toHaveProperty('additionalProperties', false);
  });
});

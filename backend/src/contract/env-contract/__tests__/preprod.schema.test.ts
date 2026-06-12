import { PreprodEnvContractSchema } from '../preprod.schema';

/**
 * Light governance test for the SEO_CWV_AGGREGATION_ENABLED flag (PR #803).
 *
 * Guards the invariant that the CWV RUM aggregation kill switch is DECLARED in
 * the PREPROD env-contract (not a silent DEV-only string), accepts the
 * documented literals, rejects typos, and stays `.optional()` so existing
 * `.env.preprod` files keep validating. Mirrors the READ_ONLY string-literal
 * pattern already covered by the schema.
 *
 * Lives under __tests__/ (gitleaks-allowlisted path) and uses only synthetic
 * placeholders built via `.repeat()` — no secret-shaped literals.
 */
const VALID_BASE = {
  NODE_ENV: 'preprod',
  SUPABASE_URL: 'https://mock.supabase.co',
  SUPABASE_ANON_KEY: 'a'.repeat(24),
  JWT_SECRET: 'x'.repeat(32),
  SESSION_SECRET: 'y'.repeat(32),
  READ_ONLY: 'true',
  REDIS_URL: 'redis://localhost:6379',
} as const;

describe('PreprodEnvContractSchema — SEO_CWV_AGGREGATION_ENABLED governance', () => {
  it('validates a base env WITHOUT the flag (optional → no parity break)', () => {
    expect(PreprodEnvContractSchema.safeParse(VALID_BASE).success).toBe(true);
  });

  it.each(['true', 'false', '1', '0'])(
    'accepts the documented literal %p',
    (value) => {
      const result = PreprodEnvContractSchema.safeParse({
        ...VALID_BASE,
        SEO_CWV_AGGREGATION_ENABLED: value,
      });
      expect(result.success).toBe(true);
    },
  );

  it('rejects a non-enum value (no silent typo)', () => {
    const result = PreprodEnvContractSchema.safeParse({
      ...VALID_BASE,
      SEO_CWV_AGGREGATION_ENABLED: 'banana',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) =>
          issue.path.includes('SEO_CWV_AGGREGATION_ENABLED'),
        ),
      ).toBe(true);
    }
  });

  it('declares the flag in the schema shape (not a silent runtime-only knob)', () => {
    expect(Object.keys(PreprodEnvContractSchema.shape)).toContain(
      'SEO_CWV_AGGREGATION_ENABLED',
    );
  });
});

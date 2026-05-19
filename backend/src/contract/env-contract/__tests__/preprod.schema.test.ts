import { PreprodEnvContractSchema } from '../preprod.schema';

const baseEnv = {
  NODE_ENV: 'preprod',
  SUPABASE_URL: 'https://cxpojprgwgubzjyqzmoq.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_pY14nFB7dZsSlEBQ4kdpxQ_4ka_FJqX',
  JWT_SECRET: 'x'.repeat(32),
  SESSION_SECRET: 'x'.repeat(32),
  READ_ONLY: 'true',
  REDIS_URL: 'redis://redis-preprod:6379',
};

describe('PreprodEnvContractSchema — SUPABASE_ANON_KEY publishable-shape regex', () => {
  it('accepts modern publishable key (sb_publishable_…)', () => {
    expect(PreprodEnvContractSchema.safeParse(baseEnv).success).toBe(true);
  });

  it('rejects legacy disabled JWT (eyJ… ~200c) — Supabase disabled it 2025', () => {
    const env = {
      ...baseEnv,
      SUPABASE_ANON_KEY:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' + 'a'.repeat(150),
    };
    const r = PreprodEnvContractSchema.safeParse(env);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => /publishable/i.test(i.message))).toBe(
        true,
      );
    }
  });

  it('rejects truncated/short publishable (right prefix but body <31c)', () => {
    const env = { ...baseEnv, SUPABASE_ANON_KEY: 'sb_publishable_short' };
    expect(PreprodEnvContractSchema.safeParse(env).success).toBe(false);
  });

  it('rejects oversized publishable (right prefix but body >31c — drift catch)', () => {
    const env = {
      ...baseEnv,
      // 32-char body — one char too many vs documented spec
      SUPABASE_ANON_KEY: 'sb_publishable_' + 'a'.repeat(32),
    };
    expect(PreprodEnvContractSchema.safeParse(env).success).toBe(false);
  });

  it('rejects body containing whitespace or invalid chars', () => {
    const env = {
      ...baseEnv,
      // 31 chars total but contains a space
      SUPABASE_ANON_KEY: 'sb_publishable_' + 'a'.repeat(15) + ' ' + 'b'.repeat(15),
    };
    expect(PreprodEnvContractSchema.safeParse(env).success).toBe(false);
  });

  it('rejects empty string', () => {
    const env = { ...baseEnv, SUPABASE_ANON_KEY: '' };
    expect(PreprodEnvContractSchema.safeParse(env).success).toBe(false);
  });

  it('rejects unrelated free-form string', () => {
    const env = {
      ...baseEnv,
      SUPABASE_ANON_KEY: 'some-random-token-without-prefix',
    };
    expect(PreprodEnvContractSchema.safeParse(env).success).toBe(false);
  });
});

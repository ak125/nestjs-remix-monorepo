/**
 * Regression test : ADR-028 Option D (preprod read-only hardening) MUST allow
 * boot without SUPABASE_SERVICE_ROLE_KEY / SESSION_SECRET / SYSTEMPAY_SITE_ID /
 * PAYBOX_SITE / PAYBOX_HMAC_KEY when READ_ONLY=true.
 *
 * Context : monorepo PRs #246/#248 (2026-04-30) shipped Option D, but the
 * EnvValidation kept the writeable baseline as REQUIRED → 9 consecutive failed
 * `🚀 Deploy` runs on main between 2026-04-30 and 2026-05-03 (run 25281072359
 * et al.), each crashing on the same `process.exit(1)` over 5 missing vars.
 *
 * This regression test pins the read-only baseline so a future refactor
 * cannot silently re-introduce the same coupling.
 */

import {
  getRequiredEnvVars,
  isReadOnlyMode,
} from '../../src/config/env-validation';

describe('EnvValidation — ADR-028 Option D read-only baseline', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('isReadOnlyMode is false by default', () => {
    delete process.env.READ_ONLY;
    expect(isReadOnlyMode()).toBe(false);
  });

  it('isReadOnlyMode is true when READ_ONLY=true', () => {
    process.env.READ_ONLY = 'true';
    expect(isReadOnlyMode()).toBe(true);
  });

  it('isReadOnlyMode is false for non-canonical truthy strings', () => {
    process.env.READ_ONLY = 'false';
    expect(isReadOnlyMode()).toBe(false);

    process.env.READ_ONLY = '1';
    expect(isReadOnlyMode()).toBe(false);

    process.env.READ_ONLY = 'yes';
    expect(isReadOnlyMode()).toBe(false);

    process.env.READ_ONLY = 'TRUE';
    expect(isReadOnlyMode()).toBe(false);
  });

  it('writeable baseline contains the 8 historical required vars', () => {
    const required = getRequiredEnvVars(false);
    expect(required).toEqual(
      expect.arrayContaining([
        'NODE_ENV',
        'SUPABASE_URL',
        'SUPABASE_SERVICE_ROLE_KEY',
        'REDIS_URL',
        'SESSION_SECRET',
        'SYSTEMPAY_SITE_ID',
        'PAYBOX_SITE',
        'PAYBOX_HMAC_KEY',
      ]),
    );
    expect(required).toHaveLength(8);
  });

  it('read-only baseline contains exactly NODE_ENV/SUPABASE_URL/SUPABASE_ANON_KEY/REDIS_URL', () => {
    const required = getRequiredEnvVars(true);
    expect(required).toEqual(
      expect.arrayContaining([
        'NODE_ENV',
        'SUPABASE_URL',
        'SUPABASE_ANON_KEY',
        'REDIS_URL',
      ]),
    );
    expect(required).toHaveLength(4);
  });

  it('read-only baseline EXCLUDES SUPABASE_SERVICE_ROLE_KEY (ADR-028 Option D)', () => {
    expect(getRequiredEnvVars(true)).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
  });

  it('read-only baseline EXCLUDES payment gateway secrets', () => {
    const required = getRequiredEnvVars(true);
    expect(required).not.toContain('PAYBOX_SITE');
    expect(required).not.toContain('PAYBOX_HMAC_KEY');
    expect(required).not.toContain('SYSTEMPAY_SITE_ID');
  });

  it('read-only baseline EXCLUDES SESSION_SECRET (preprod has no mutable session state)', () => {
    expect(getRequiredEnvVars(true)).not.toContain('SESSION_SECRET');
  });

  it('getRequiredEnvVars() with no arg follows current READ_ONLY env', () => {
    process.env.READ_ONLY = 'true';
    expect(getRequiredEnvVars()).toHaveLength(4);

    process.env.READ_ONLY = 'false';
    expect(getRequiredEnvVars()).toHaveLength(8);

    delete process.env.READ_ONLY;
    expect(getRequiredEnvVars()).toHaveLength(8);
  });
});

/**
 * Regression test : `getEffectiveSupabaseKey()` must return :
 *   - SERVICE_ROLE_KEY when set (priority)
 *   - ANON_KEY when SERVICE_ROLE_KEY absent and READ_ONLY=true (ADR-028 Option D)
 *   - "" otherwise
 *
 * Pins the read-only fallback so future refactors cannot silently re-introduce
 * the 2026-04-30 to 2026-05-03 deploy main outage where ~20+ services crashed
 * at NestJS module-load with `Error: supabaseKey is required.`.
 */

import { getEffectiveSupabaseKey } from '../../src/common/utils/supabase-key.util';

describe('getEffectiveSupabaseKey — ADR-028 Option D fallback', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_ANON_KEY;
    delete process.env.READ_ONLY;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('returns SERVICE_ROLE_KEY when set (writeable mode)', () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key-xyz';
    process.env.SUPABASE_ANON_KEY = 'anon-key-xyz';
    expect(getEffectiveSupabaseKey()).toBe('service-key-xyz');
  });

  it('returns SERVICE_ROLE_KEY in read-only mode if it happens to be set', () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key-xyz';
    process.env.SUPABASE_ANON_KEY = 'anon-key-xyz';
    process.env.READ_ONLY = 'true';
    expect(getEffectiveSupabaseKey()).toBe('service-key-xyz');
  });

  it('falls back to ANON_KEY when SERVICE_ROLE_KEY absent and READ_ONLY=true', () => {
    process.env.SUPABASE_ANON_KEY = 'anon-key-xyz';
    process.env.READ_ONLY = 'true';
    expect(getEffectiveSupabaseKey()).toBe('anon-key-xyz');
  });

  it('does NOT fall back to ANON_KEY in writeable mode (READ_ONLY undefined)', () => {
    process.env.SUPABASE_ANON_KEY = 'anon-key-xyz';
    expect(getEffectiveSupabaseKey()).toBe('');
  });

  it('does NOT fall back to ANON_KEY when READ_ONLY=false', () => {
    process.env.SUPABASE_ANON_KEY = 'anon-key-xyz';
    process.env.READ_ONLY = 'false';
    expect(getEffectiveSupabaseKey()).toBe('');
  });

  it('only matches canonical literal "true" (case-sensitive)', () => {
    process.env.SUPABASE_ANON_KEY = 'anon-key-xyz';

    process.env.READ_ONLY = 'TRUE';
    expect(getEffectiveSupabaseKey()).toBe('');

    process.env.READ_ONLY = '1';
    expect(getEffectiveSupabaseKey()).toBe('');

    process.env.READ_ONLY = 'yes';
    expect(getEffectiveSupabaseKey()).toBe('');
  });

  it('returns "" when nothing usable is set', () => {
    expect(getEffectiveSupabaseKey()).toBe('');
  });

  it('returns "" if READ_ONLY=true but ANON_KEY absent (misconfigured)', () => {
    process.env.READ_ONLY = 'true';
    expect(getEffectiveSupabaseKey()).toBe('');
  });

  it('treats empty SERVICE_ROLE_KEY same as absent', () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = '';
    process.env.SUPABASE_ANON_KEY = 'anon-key-xyz';
    process.env.READ_ONLY = 'true';
    expect(getEffectiveSupabaseKey()).toBe('anon-key-xyz');
  });
});

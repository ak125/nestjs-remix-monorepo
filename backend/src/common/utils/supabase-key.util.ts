/**
 * ADR-028 Option D — preprod read-only hardening
 *
 * Centralized key resolver for direct `createClient(url, key)` callers.
 *
 * Background : preprod intentionally omits `SUPABASE_SERVICE_ROLE_KEY` from
 * `.env.preprod` (cf. ci.yml :722). Services that instantiate a Supabase
 * client at NestJS module-load using `process.env.SUPABASE_SERVICE_ROLE_KEY`
 * directly crash with `Error: supabaseKey is required.` because supabase-js
 * v2 throws when called with an empty string.
 *
 * The canonical fix is to use this helper everywhere instead of touching
 * `process.env.SUPABASE_SERVICE_ROLE_KEY` directly. It returns :
 *   - SERVICE_ROLE_KEY  if present (writeable mode — full privilege)
 *   - ANON_KEY         if READ_ONLY=true and SERVICE_ROLE_KEY absent
 *                      (RLS protects writes per ADR-021)
 *   - empty string     if nothing usable found (caller decides what to do)
 *
 * The third case still lets supabase-js throw — that's the right thing to
 * do in a misconfigured environment, but tests / CI should never reach it
 * for a properly-deployed preprod or prod.
 *
 * Read-only callers : the returned ANON_KEY only allows operations RLS
 * permits. Mutation attempts will fail at the SQL boundary, which is the
 * intended ADR-028 Option D behaviour.
 *
 * If a future ADR re-enables writes in preprod (or moves to a different
 * privilege model), this helper is the single chokepoint to revisit.
 *
 * @see backend/src/config/env-validation.ts::isReadOnlyMode
 * @see backend/src/database/services/supabase-base.service.ts (companion
 *      class-based path with the same fallback)
 */

/**
 * Returns the right Supabase key for the current environment :
 * SERVICE_ROLE_KEY when available, ANON_KEY in read-only mode, or `""`.
 *
 * Use at every direct `createClient(url, KEY)` call site instead of
 * `process.env.SUPABASE_SERVICE_ROLE_KEY` or its `|| ''` variants.
 */
export function getEffectiveSupabaseKey(): string {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey) {
    return serviceKey;
  }

  // ADR-028 Option D — read-only mode falls back to ANON_KEY.
  // Use the canonical literal "true" (case-sensitive) — same convention as
  // env-validation.ts::isReadOnlyMode.
  if (process.env.READ_ONLY === 'true') {
    const anonKey = process.env.SUPABASE_ANON_KEY;
    if (anonKey) {
      return anonKey;
    }
  }

  return '';
}

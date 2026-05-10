/**
 * Environment Variables Validation
 *
 * Validates that all required environment variables are present
 * before the application starts. This prevents runtime errors
 * caused by missing configuration.
 *
 * Read-only mode (READ_ONLY=true) is supported per ADR-028 Option D
 * (preprod read-only hardening, monorepo PRs #246/#248, vault PR #123) :
 * the SERVICE_ROLE_KEY and payment gateway secrets are NOT required, since
 * the backend uses ANON_KEY + RLS and processes no real payments.
 *
 * @since 2026-01-16
 * @updated 2026-05-03 ADR-028 Option D read-only baseline (fix 3-day deploy main breakage)
 */

import { Logger } from '@nestjs/common';

const logger = new Logger('EnvValidation');

/**
 * Required environment variables in normal (writeable) mode.
 * The application will NOT start if any of these are missing — UNLESS
 * READ_ONLY=true (ADR-028 Option D), in which case the read-only baseline
 * below is used instead.
 */
const REQUIRED_ENV_VARS = [
  'NODE_ENV',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'REDIS_URL',
  'SESSION_SECRET',
  'SYSTEMPAY_SITE_ID',
  'PAYBOX_SITE',
  'PAYBOX_HMAC_KEY',
] as const;

/**
 * Required environment variables when READ_ONLY=true (ADR-028 Option D).
 *
 * In this mode the backend cannot mutate Supabase (uses ANON_KEY + RLS) — there
 * are no real payments and no need for SERVICE_ROLE_KEY or payment gateway
 * secrets. SESSION_SECRET is also not required because preprod has no mutable
 * server-side session state to protect (sessions are read-only or unused).
 *
 * If a future change re-enables writes in preprod, this list MUST be revisited
 * AND the ADR-028 Option D acceptance criteria re-evaluated.
 */
const REQUIRED_ENV_VARS_READ_ONLY = [
  'NODE_ENV',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'REDIS_URL',
] as const;

/**
 * Optional environment variables with their default values
 * Used for documentation purposes
 */
const OPTIONAL_ENV_VARS_WITH_DEFAULTS: Record<string, string> = {
  SUPABASE_ANON_KEY: '(uses service role)',
  ANALYTICS_ENABLED: 'true',
  ENABLE_RPC_V2: 'true',
  USE_UNIFIED_RPC: 'true',
  USE_RM_API: 'false',
  RAG_SERVICE_URL: 'http://disabled:8000',
  // RPC Safety Gate - Governance for Supabase RPC calls
  RPC_GATE_MODE: 'observe', // 'observe' | 'enforce' | 'disabled'
  RPC_GATE_ENFORCE_LEVEL: 'P0', // 'P0' | 'P1' | 'P2' | 'ALL'
  RPC_GATE_GOV_DIR: './governance/rpc', // Path relative to process.cwd()
  RPC_GATE_LOG_ALLOW: 'false', // Log ALLOW decisions (noisy)
  RPC_ADMIN_TOKEN: '(optional override token)',
  // Kill-switch DEV - Read-only isolation for development environment
  DEV_KILL_SWITCH: 'false', // 'true' | 'false' - Enable read-only mode in DEV
  DEV_SUPABASE_KEY: '(dev_readonly role key)', // Supabase key for dev_readonly PostgreSQL role
  // ADR-028 Option D — preprod read-only hardening (set in CI .env.preprod)
  READ_ONLY: 'false', // 'true' enables relaxed env validation + ANON_KEY fallback
};

/**
 * Returns true when the backend should boot in ADR-028 Option D read-only mode.
 * Only the canonical literal "true" enables it — defends against accidental
 * truthy values like "1" or "yes".
 */
export function isReadOnlyMode(): boolean {
  return process.env.READ_ONLY === 'true';
}

/**
 * Validates that all required environment variables are present.
 * Call this function at the very start of the application (before any imports).
 *
 * In READ_ONLY=true mode (ADR-028 Option D — preprod hardening), a relaxed
 * baseline is used : SERVICE_ROLE_KEY, SESSION_SECRET and payment gateway
 * secrets are not required.
 *
 * @throws {Error} If any required variable is missing (exits with code 1)
 */
export function validateRequiredEnvVars(): void {
  const readOnly = isReadOnlyMode();
  const requiredList: readonly string[] = readOnly
    ? REQUIRED_ENV_VARS_READ_ONLY
    : REQUIRED_ENV_VARS;

  const missing: string[] = [];

  for (const varName of requiredList) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    logger.error('');
    logger.error('═══════════════════════════════════════════════════════');
    logger.error('FATAL: Missing required environment variables');
    if (readOnly) {
      logger.error('(READ_ONLY=true mode — ADR-028 Option D baseline)');
    }
    logger.error('═══════════════════════════════════════════════════════');
    logger.error('');
    logger.error('The following variables must be set in your .env file:');
    logger.error('');

    for (const varName of missing) {
      logger.error(`  - ${varName}`);
    }

    logger.error('');
    logger.error('See backend/.env.example for a complete template.');
    logger.error('');
    logger.error('═══════════════════════════════════════════════════════');

    // Exit with error code to prevent app from starting
    process.exit(1);
  }

  // Log success in non-test environments
  if (process.env.NODE_ENV !== 'test') {
    if (readOnly) {
      logger.log('READ_ONLY=true (ADR-028 Option D) — relaxed env baseline OK');
    } else {
      logger.log('All required environment variables present');
    }

    // Log Kill-switch DEV status
    if (
      process.env.NODE_ENV !== 'production' &&
      process.env.DEV_KILL_SWITCH === 'true'
    ) {
      logger.log('Kill-switch DEV: ENABLED (read-only mode)');
      if (process.env.DEV_SUPABASE_KEY) {
        logger.log('   Using dev_readonly Supabase key');
      } else {
        console.warn(
          '   ⚠️ DEV_SUPABASE_KEY not set - falling back to service_role',
        );
      }
    }
  }
}

/**
 * Gets a list of all required environment variables.
 *
 * @param readOnly when true (or omitted with READ_ONLY=true env), returns the
 *                 ADR-028 Option D read-only baseline.
 */
export function getRequiredEnvVars(readOnly?: boolean): readonly string[] {
  const useReadOnly = readOnly ?? isReadOnlyMode();
  return useReadOnly ? REQUIRED_ENV_VARS_READ_ONLY : REQUIRED_ENV_VARS;
}

/**
 * Gets optional environment variables with their default values
 */
export function getOptionalEnvVarsWithDefaults(): Record<string, string> {
  return { ...OPTIONAL_ENV_VARS_WITH_DEFAULTS };
}

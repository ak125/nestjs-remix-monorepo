/**
 * Environment Variables Validation
 *
 * Validates that all required environment variables are present
 * before the application starts. This prevents runtime errors
 * caused by missing configuration.
 *
 * @since 2026-01-16
 */

/**
 * Required environment variables for production
 * The application will NOT start if any of these are missing
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
};

/**
 * Validates that all required environment variables are present.
 * Call this function at the very start of the application (before any imports).
 *
 * @throws {Error} If any required variable is missing (exits with code 1)
 */
export function validateRequiredEnvVars(): void {
  const missing: string[] = [];

  for (const varName of REQUIRED_ENV_VARS) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    console.error('');
    console.error('═══════════════════════════════════════════════════════');
    console.error('❌ FATAL: Missing required environment variables');
    console.error('═══════════════════════════════════════════════════════');
    console.error('');
    console.error('The following variables must be set in your .env file:');
    console.error('');

    for (const varName of missing) {
      console.error(`  • ${varName}`);
    }

    console.error('');
    console.error('See backend/.env.example for a complete template.');
    console.error('');
    console.error('═══════════════════════════════════════════════════════');

    // Exit with error code to prevent app from starting
    process.exit(1);
  }

  // Log success in non-test environments
  if (process.env.NODE_ENV !== 'test') {
    console.log('✅ All required environment variables present');

    // Log Kill-switch DEV status
    if (
      process.env.NODE_ENV !== 'production' &&
      process.env.DEV_KILL_SWITCH === 'true'
    ) {
      console.log('🔒 Kill-switch DEV: ENABLED (read-only mode)');
      if (process.env.DEV_SUPABASE_KEY) {
        console.log('   Using dev_readonly Supabase key');
      } else {
        console.warn(
          '   ⚠️ DEV_SUPABASE_KEY not set - falling back to service_role',
        );
      }
    }
  }
}

/**
 * Gets a list of all required environment variables
 * Useful for documentation and testing
 */
export function getRequiredEnvVars(): readonly string[] {
  return REQUIRED_ENV_VARS;
}

/**
 * Gets optional environment variables with their default values
 */
export function getOptionalEnvVarsWithDefaults(): Record<string, string> {
  return { ...OPTIONAL_ENV_VARS_WITH_DEFAULTS };
}

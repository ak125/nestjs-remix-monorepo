/**
 * Preflight env contract check — fail-fast CI before `docker compose up`.
 *
 * Pattern:
 *   1. The CI step has sourced the real `.env.preprod` via
 *      `set -a; . "$PREPROD_DIR/.env"; set +a` in a fresh subshell BEFORE
 *      invoking this script. `process.env` reflects exactly what will be
 *      injected into the preprod container.
 *   2. safeParse(process.env) against PreprodEnvContractSchema (SoT Zod).
 *   3. Exit 1 + structured GHA error log if validation fails.
 *
 * Premier pas vers Environment Contract Control Plane (cf. ADR follow-up).
 * SoT : backend/src/contract/env-contract/preprod.schema.ts.
 *
 * Usage: npx --no-install tsx scripts/ci/preflight-env-contract.ts
 */
import { PreprodEnvContractSchema } from '../../backend/src/contract/env-contract/index.ts';

const result = PreprodEnvContractSchema.safeParse(process.env);

if (!result.success) {
  console.error('::error::Preflight env contract violation — backend boot would crash.');
  console.error('');
  console.error('Issues détectées :');
  for (const issue of result.error.issues) {
    const path = issue.path.length > 0 ? String(issue.path[0]) : '(root)';
    console.error(`  ❌ ${path}: ${issue.message}`);
  }
  console.error('');
  console.error('SoT contrat : backend/src/contract/env-contract/preprod.schema.ts');
  console.error('Fix : compléter le heredoc .env.preprod du step "🧪 Deploy to PREPROD".');
  process.exit(1);
}

console.log('✓ Preflight env contract OK — PreprodEnvContractSchema validé');
process.exit(0);

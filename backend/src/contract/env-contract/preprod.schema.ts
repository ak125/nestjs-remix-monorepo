import { z } from 'zod';

/**
 * Source of Truth — env contract for PREPROD (ADR-028 Option D).
 *
 * Consumers:
 *   Phase 1 (active): scripts/ci/preflight-env-contract.ts
 *     Fail-fast CI before `docker compose up` — validates the `.env.preprod`
 *     heredoc-generated file matches the backend's runtime invariants.
 *   Phase 2 (deferred, ADR Environment Contract Control Plane):
 *     Backend env-validation.ts convergence + drift detection + ratchet.
 *
 * Required vars mirror `REQUIRED_ENV_VARS_READ_ONLY` in
 * `backend/src/config/env-validation.ts` (NODE_ENV, SUPABASE_URL,
 * SUPABASE_ANON_KEY, REDIS_URL, JWT_SECRET) plus SESSION_SECRET
 * (validated by main.ts:102 fail-fast in NODE_ENV=production, which is
 * what the preprod container actually runs as per docker-compose override)
 * plus READ_ONLY=true (ADR-028 Option D invariant).
 *
 * Design notes Phase 1 → Phase 2:
 *   - `.passthrough()` (Phase 1): tolerates supplementary vars (SEO_CHAIN_*_MODE,
 *     APP_URL, RAG_*, CRUX_API_KEY, GitHub-Actions injected vars, etc.).
 *     Phase 2: migrate to `.strict()` once drift cleanup is feasible
 *     (strict surfaces zombies / typos / dead secrets).
 *   - `NODE_ENV: z.enum(['preprod'])`: strict literal. Prevents NODE_ENV=banana
 *     from passing silently. The Docker image overrides this to 'production' at
 *     runtime (docker-compose.preprod.yml) — we validate the SHELL/env-file
 *     value here, not the runtime override.
 *   - `REDIS_URL`: regex instead of `.url()` — Zod's `.url()` parser is fragile
 *     for the `redis://` scheme; regex covers redis://, rediss://,
 *     redis://:pwd@host:port/db.
 *   - 32-char minimum for JWT_SECRET / SESSION_SECRET: matches main.ts:102
 *     enforcement and 2026 NIST guidance for HS256 keys.
 */
export const PreprodEnvContractSchema = z
  .object({
    NODE_ENV: z.enum(['preprod']),
    SUPABASE_URL: z.string().url(),
    // Modern Supabase publishable key. Documented format
    // (https://supabase.com/docs/guides/api-keys) :
    //   `sb_publishable_<22-char-random>_<8-char-checksum>`
    // Body length is exactly 31 chars after the prefix (22 + 1 separator + 8).
    // The legacy JWT anon (`eyJ…` ~200 chars) is disabled on project
    // cxpojprgwgubzjyqzmoq since 2025 (Supabase MCP get_publishable_keys
    // confirms legacy entry has disabled=true). Accepting the legacy shape
    // was the silent failure mode behind run 26104292014 — schema passed,
    // deploy succeeded, every RPC returned 'Invalid API key', caches poisoned
    // with empty payloads. Fixed structurally by PR #637 + this regex.
    //
    // Exact-length regex (not min) so Supabase format drift fails loud at
    // preflight instead of silently. If Supabase ever publishes a longer
    // key format, this is the canonical place to update.
    SUPABASE_ANON_KEY: z
      .string()
      .regex(
        /^sb_publishable_[A-Za-z0-9_-]{31}$/,
        'SUPABASE_ANON_KEY must be a Supabase modern publishable key (`sb_publishable_<22-char-random>_<8-char-checksum>`, 46c total). Legacy JWT (eyJ…) is disabled on project cxpojprgwgubzjyqzmoq — rotate via Supabase Dashboard → Project Settings → API → Publishable API keys, then `gh secret set SUPABASE_ANON_KEY`.',
      ),
    JWT_SECRET: z
      .string()
      .min(32, 'JWT_SECRET must be >= 32 chars (HS256 / NIST 2026 guidance)'),
    SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be >= 32 chars'),
    READ_ONLY: z.literal('true'),
    REDIS_URL: z
      .string()
      .regex(
        /^rediss?:\/\/.+/,
        'REDIS_URL must start with redis:// or rediss:// and have a host',
      ),
  })
  .passthrough();

export type PreprodEnvContract = z.infer<typeof PreprodEnvContractSchema>;

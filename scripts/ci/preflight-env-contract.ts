/**
 * Preflight env contract check — fail-fast CI before `docker compose up`.
 *
 * Two phases :
 *   Phase 1 — Static contract :
 *     `safeParse(process.env)` against PreprodEnvContractSchema (Zod SoT).
 *     Catches wrong shape, missing keys, length violations, prefix violations.
 *   Phase 2 — Live probe :
 *     `fetch HEAD ${SUPABASE_URL}/rest/v1/` with the secret as `apikey`.
 *     Catches right-shape-but-Supabase-disabled keys (rotation manquée,
 *     wrong-project value, key disabled server-side).
 *
 * Why both : the static schema can verify the prefix `sb_publishable_` but
 * cannot tell whether a given publishable key is *active* on the Supabase
 * project. A publishable can be rotated server-side ; the GH secret may
 * still hold an old (now-disabled) one with the same shape. Without the
 * live probe, that surfaces 5-10 min later as opaque "alternatives empty"
 * downstream of the deploy. With the live probe, it surfaces as
 * "HTTP 401 from PostgREST" immediately, before `docker compose up`.
 *
 * Premier pas vers Environment Contract Control Plane (cf. ADR follow-up).
 * SoT : backend/src/contract/env-contract/preprod.schema.ts.
 *
 * Usage: npx --no-install tsx scripts/ci/preflight-env-contract.ts
 */
import { PreprodEnvContractSchema } from "../../backend/src/contract/env-contract/index.ts";

const result = PreprodEnvContractSchema.safeParse(process.env);

if (!result.success) {
  console.error(
    "::error::Preflight env contract violation — backend boot would crash.",
  );
  console.error("");
  console.error("Issues détectées :");
  for (const issue of result.error.issues) {
    const path = issue.path.length > 0 ? String(issue.path[0]) : "(root)";
    console.error(`  ❌ ${path}: ${issue.message}`);
  }
  console.error("");
  console.error(
    "SoT contrat : backend/src/contract/env-contract/preprod.schema.ts",
  );
  console.error(
    'Fix : compléter le heredoc .env.preprod du step "🧪 Deploy to PREPROD".',
  );
  process.exit(1);
}

console.log("✓ Preflight env contract OK — PreprodEnvContractSchema validé");

// Phase 2 — Live probe : verify the key isn't disabled Supabase-side.
//
// `/auth/v1/settings` is the canonical discriminating endpoint :
//   - **valid active key (publishable or anon-JWT enabled)** → HTTP 200
//   - **disabled key** (e.g. rotated, project rotated)     → HTTP 401
//   - **wrong-project / typo / bidon shape**               → HTTP 401
//   - 5xx → upstream Supabase outage (also fail-fast — we don't retry)
//
// Why not `/rest/v1/` : PostgREST root requires an authenticated role beyond
// anon for the publishable key flow, so it 401's even on a valid key. The
// `/auth/v1/settings` endpoint is the cheapest one that actually validates
// the API key against Supabase's auth backend without needing RLS bypass.
//
// 5s timeout : Supabase regional latency is <300ms p99 ; anything > 5s is a
// deploy-blocking signal anyway.
async function livePreprobe(
  supabaseUrl: string,
  anonKey: string,
): Promise<void> {
  const probeUrl = new URL("/auth/v1/settings", supabaseUrl).toString();
  let probe: Response;
  try {
    probe = await fetch(probeUrl, {
      method: "GET",
      headers: { apikey: anonKey },
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      `::error::SUPABASE_ANON_KEY live-probe failed to reach ${probeUrl} (${msg}). Verify SUPABASE_URL host is reachable from the runner and not blocked by network policy.`,
    );
    process.exit(1);
  }

  if (probe.status === 401) {
    console.error(
      "::error::SUPABASE_ANON_KEY rejected by Supabase auth (HTTP 401 from /auth/v1/settings). The secret matches the publishable-key shape but the key is disabled server-side or belongs to a different Supabase project. Rotate via Supabase Dashboard → Project Settings → API → Publishable API keys, then `gh secret set SUPABASE_ANON_KEY -b '<new value>'`.",
    );
    process.exit(1);
  }

  if (probe.status >= 500) {
    console.error(
      `::error::SUPABASE_ANON_KEY live-probe got HTTP ${probe.status} from ${probeUrl}. Likely transient Supabase outage — check status.supabase.com before re-running.`,
    );
    process.exit(1);
  }

  if (probe.status !== 200) {
    console.error(
      `::error::SUPABASE_ANON_KEY live-probe got unexpected HTTP ${probe.status} from ${probeUrl}. Expected 200 for valid key.`,
    );
    process.exit(1);
  }

  console.log(
    `✓ Preflight live-probe OK — Supabase auth accepted SUPABASE_ANON_KEY (HTTP 200 /auth/v1/settings)`,
  );
}

livePreprobe(result.data.SUPABASE_URL, result.data.SUPABASE_ANON_KEY).then(
  () => process.exit(0),
  (err) => {
    console.error("::error::Unexpected preflight failure:", err);
    process.exit(1);
  },
);

/**
 * PR-E — CI invariant : every `applied` event in __seo_content_events MUST
 * link to a valid __seo_policy_evaluations row.
 *
 * SQL :
 *   SELECT count(*)
 *   FROM __seo_content_events e
 *   LEFT JOIN __seo_policy_evaluations p ON e.evaluation_id = p.evaluation_id
 *   WHERE e.event_kind = 'applied'
 *     AND e.source_kind != 'audit_bootstrap'  -- backfill PR-D pre-dates gateway
 *     AND p.evaluation_id IS NULL;
 *
 *   Expected : 0
 *
 * Exception : `source_kind='audit_bootstrap'` events come from the PR-D
 * backfill of historical PR-A2 audit rows ; they have no policy evaluation
 * because OPA didn't exist when those H1 writes happened. They're traceable
 * via source_metadata.audit_id, which is sufficient lineage for historical
 * data.
 *
 * For any `applied` event with source_kind ∈ {human_curated, human_validated_llm,
 * legacy_recovery, deterministic_builder, ...} — the RPC seo_apply_h1_write
 * guarantees by construction that evaluation_id is set in the same transaction.
 * If a row violates this, the invariant has been broken (manual SQL ?
 * bypass ?) and CI fails loud.
 *
 * Usage :
 *   pnpm tsx scripts/audit/check-seo-events-lineage.ts
 *   pnpm audit:seo-events-lineage
 *
 * Exit codes :
 *   0 — invariant holds
 *   1 — violation(s) found, CI fails
 */

import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({
  path: path.join(__dirname, '../../backend/.env'),
  quiet: true,
} as dotenv.DotenvConfigOptions);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  process.stderr.write('[FATAL] SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required\n');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function log(msg: string): void {
  process.stderr.write(msg + '\n');
}

async function main(): Promise<void> {
  log('▶ Checking SEO content events lineage invariant…');
  log(
    '  Rule : every applied event (source_kind ≠ audit_bootstrap) MUST link to a __seo_policy_evaluations row.',
  );

  // PostgREST doesn't expose a clean LEFT JOIN ; do the check in two queries.
  const { count: appliedTotal, error: countErr } = await supabase
    .from('__seo_content_events')
    .select('event_id', { count: 'exact', head: true })
    .eq('event_kind', 'applied')
    .neq('source_kind', 'audit_bootstrap');
  if (countErr) {
    throw new Error(`count applied failed: ${countErr.message}`);
  }
  log(`  ${appliedTotal ?? 0} applied events to validate (excl. audit_bootstrap)`);

  if (!appliedTotal || appliedTotal === 0) {
    log('✓ Invariant trivially holds (no applied events to check).');
    process.exit(0);
  }

  // Pull all evaluation_ids from applied events.
  const PAGE = 1000;
  const violations: Array<{ event_id: string; asset_id: string; created_at: string }> = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('__seo_content_events')
      .select('event_id, asset_id, evaluation_id, created_at')
      .eq('event_kind', 'applied')
      .neq('source_kind', 'audit_bootstrap')
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`pagination failed: ${error.message}`);
    const rows = (data ?? []) as Array<{
      event_id: string;
      asset_id: string;
      evaluation_id: string | null;
      created_at: string;
    }>;
    if (rows.length === 0) break;

    // Local first pass : null evaluation_id is an obvious violation.
    for (const r of rows) {
      if (!r.evaluation_id) {
        violations.push({
          event_id: r.event_id,
          asset_id: r.asset_id,
          created_at: r.created_at,
        });
      }
    }

    // Second pass : verify each non-null evaluation_id actually resolves
    // (RI is enforced by FK so this would only fail if the FK was dropped).
    const evalIds = rows
      .map((r) => r.evaluation_id)
      .filter((id): id is string => id !== null);
    if (evalIds.length > 0) {
      const { data: existing, error: existErr } = await supabase
        .from('__seo_policy_evaluations')
        .select('evaluation_id')
        .in('evaluation_id', evalIds);
      if (existErr) {
        throw new Error(`policy_evaluations lookup failed: ${existErr.message}`);
      }
      const existingSet = new Set(
        (existing ?? []).map((r) => (r as { evaluation_id: string }).evaluation_id),
      );
      for (const r of rows) {
        if (r.evaluation_id && !existingSet.has(r.evaluation_id)) {
          violations.push({
            event_id: r.event_id,
            asset_id: r.asset_id,
            created_at: r.created_at,
          });
        }
      }
    }

    if (rows.length < PAGE) break;
    from += PAGE;
  }

  if (violations.length === 0) {
    log('✓ Invariant holds : every applied event has a valid policy lineage.');
    process.exit(0);
  }

  log('');
  log('✗ Invariant VIOLATED — applied events without policy lineage :');
  for (const v of violations.slice(0, 25)) {
    log(`    event_id=${v.event_id} asset=${v.asset_id} created_at=${v.created_at}`);
  }
  if (violations.length > 25) log(`    … and ${violations.length - 25} more`);
  log('');
  log(
    'Cause possibles : INSERT direct dans __seo_content_events bypassant la RPC, ' +
      'OPA evaluation row drop manuel, FK désactivée. Investiguer immédiatement.',
  );
  process.exit(1);
}

main().catch((err: unknown) => {
  process.stderr.write(
    `[FATAL] ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
  );
  process.exit(1);
});

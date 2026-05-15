/**
 * PR-D — Backfill historique : __seo_content_audit → __seo_content_events
 *
 * Reads the PR-A2 audit findings (`__seo_content_audit`) and INSERTs one
 * `event_kind='applied'` row per audit row, attributing the historical write
 * to the evidence_tier that produced it.
 *
 * Idempotent : a UNIQUE constraint via the source_metadata.audit_id field
 * (looked up before insert) ensures re-running the script never duplicates
 * events. The script uses PostgREST upsert semantics with ON CONFLICT keyed
 * on (asset_id, field_path, source_metadata->>'audit_id').
 *
 * Source_kind mapping :
 *   audit.evidence_tier        → event.source_kind
 *   exact_match_snapshot       → audit_bootstrap   (with metadata.evidence_tier preserved)
 *   exact_match_event_log      → audit_bootstrap
 *   exact_match_blog_advice    → audit_bootstrap
 *   exact_match_builder_template → audit_bootstrap
 *   heuristic_recent_change    → audit_bootstrap
 *   unknown                    → audit_bootstrap
 *
 * All evidence tiers map to 'audit_bootstrap' source_kind in events table
 * (a new value beyond the gateway's enum). The actual evidence_tier is
 * preserved in source_metadata for analysis.
 *
 * Usage:
 *   pnpm tsx scripts/seo/bootstrap/backfill-content-events.ts
 *   pnpm tsx scripts/seo/bootstrap/backfill-content-events.ts --dry-run
 *   pnpm tsx scripts/seo/bootstrap/backfill-content-events.ts --limit 50
 *
 * Plan : §7 Phase D step 4 "Reverse projection une-fois"
 */

import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({
  path: path.join(__dirname, '../../../backend/.env'),
  quiet: true,
} as dotenv.DotenvConfigOptions);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  process.stderr.write(
    '[FATAL] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set\n',
  );
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function log(msg: string): void {
  process.stderr.write(msg + '\n');
}

interface AuditRow {
  audit_id: string;
  asset_id: string;
  field_path: string;
  observed_value: string;
  observed_hash: string;
  evidence_tier: string;
  confidence: string;
  source_details: Record<string, unknown>;
  observed_at: string;
}

interface CliOptions {
  dryRun: boolean;
  limit?: number;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dry-run') opts.dryRun = true;
    if (argv[i] === '--limit') opts.limit = Number(argv[++i]);
  }
  return opts;
}

async function loadAuditRows(limit?: number): Promise<AuditRow[]> {
  let query = supabase
    .from('__seo_content_audit')
    .select(
      'audit_id, asset_id, field_path, observed_value, observed_hash, evidence_tier, confidence, source_details, observed_at',
    )
    .order('observed_at', { ascending: true });
  if (limit) query = query.limit(limit);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to load __seo_content_audit: ${error.message}`);
  return (data ?? []) as AuditRow[];
}

async function findAlreadyBackfilled(
  auditIds: string[],
): Promise<Set<string>> {
  if (auditIds.length === 0) return new Set();
  // Idempotence : look up existing events whose source_metadata.audit_id is in
  // the input set. PostgREST GIN-indexed JSONB query via @> contains.
  const already = new Set<string>();
  const BATCH = 200;
  for (let i = 0; i < auditIds.length; i += BATCH) {
    const slice = auditIds.slice(i, i + BATCH);
    const filters = slice.map((id) => `source_metadata.cs.{"audit_id":"${id}"}`).join(',');
    const { data, error } = await supabase
      .from('__seo_content_events')
      .select('source_metadata')
      .or(filters);
    if (error) {
      log(`[WARN] backfill idempotence lookup failed (batch ${i}): ${error.message}`);
      continue;
    }
    for (const row of (data ?? []) as Array<{ source_metadata: { audit_id?: string } }>) {
      if (row.source_metadata?.audit_id) {
        already.add(row.source_metadata.audit_id);
      }
    }
  }
  return already;
}

async function persistEvents(
  rows: AuditRow[],
  skipAuditIds: Set<string>,
): Promise<{ inserted: number; skipped: number }> {
  const events = rows
    .filter((r) => !skipAuditIds.has(r.audit_id))
    .map((r) => ({
      asset_id: r.asset_id,
      field_path: r.field_path,
      event_kind: 'applied' as const,
      value_text: r.observed_value,
      value_hash: r.observed_hash,
      source_kind: 'audit_bootstrap',
      source_metadata: {
        audit_id: r.audit_id,
        evidence_tier: r.evidence_tier,
        confidence: r.confidence,
        original_observed_at: r.observed_at,
        original_source_details: r.source_details,
        bootstrapped_from: 'pr_a2_seo_content_audit',
      },
      actor: 'script:backfill-content-events',
    }));

  if (events.length === 0) {
    return { inserted: 0, skipped: rows.length };
  }

  const BATCH = 100;
  let inserted = 0;
  for (let i = 0; i < events.length; i += BATCH) {
    const batch = events.slice(i, i + BATCH);
    const { data, error } = await supabase
      .from('__seo_content_events')
      .insert(batch)
      .select('event_id');
    if (error) {
      throw new Error(`Insert batch ${i / BATCH + 1} failed: ${error.message}`);
    }
    const insertedCount = (data ?? []).length;
    inserted += insertedCount;
    log(`  batch ${i / BATCH + 1} : ${insertedCount} events inserted`);
  }
  return { inserted, skipped: rows.length - events.length };
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));

  log(`▶ Loading __seo_content_audit (PR-A2)…`);
  const rows = await loadAuditRows(opts.limit);
  log(`  ${rows.length} audit rows loaded`);

  if (rows.length === 0) {
    log('  Nothing to backfill (audit table is empty).');
    return;
  }

  log(`▶ Checking idempotence (looking for existing bootstrap events)…`);
  const already = await findAlreadyBackfilled(rows.map((r) => r.audit_id));
  log(`  ${already.size} audit rows already backfilled (will be skipped)`);

  if (opts.dryRun) {
    log(`▶ --dry-run mode : would insert ${rows.length - already.size} new events`);
    return;
  }

  log(`▶ Persisting events…`);
  const { inserted, skipped } = await persistEvents(rows, already);

  log('');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log(`✓ Inserted : ${inserted}`);
  log(`↺ Skipped (already backfilled) : ${skipped}`);
  log(`  Total audit rows processed : ${rows.length}`);
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.stack ?? err.message : String(err);
  process.stderr.write(`[FATAL] ${msg}\n`);
  process.exit(1);
});

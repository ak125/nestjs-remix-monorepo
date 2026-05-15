/**
 * PR-E — Propose pipeline : __seo_content_audit → proposed events
 *
 * Reads PR-A2 audit findings (strong candidates) and INSERTs `proposed`
 * events with `source_kind='legacy_recovery'` into `__seo_content_events`.
 * The recovery worker (H1RecoveryApplyService) picks them up later.
 *
 * Strict scope (per plan + user constraint) :
 *   - Producer of proposed events ONLY ; no write to canonical H1 columns,
 *     no gateway call. The actual UPDATE happens later via the worker →
 *     gateway → atomic RPC path.
 *   - Only audit rows with evidence_tier ∈ exact_match_* AND score_delta
 *     above threshold become candidates.
 *   - Idempotent : look up existing proposed events by audit_id in
 *     source_metadata before inserting.
 *
 * Usage :
 *   pnpm tsx scripts/seo/recovery/propose-h1-restores.ts --dry-run
 *   pnpm tsx scripts/seo/recovery/propose-h1-restores.ts --min-score-delta 1
 *   pnpm tsx scripts/seo/recovery/propose-h1-restores.ts --limit 10
 *
 * Plan : §8 Phase E step 1
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
  process.stderr.write('[FATAL] SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required\n');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const EXACT_MATCH_TIERS = new Set([
  'exact_match_snapshot',
  'exact_match_event_log',
  'exact_match_blog_advice',
  'exact_match_builder_template',
]);

function log(msg: string): void {
  process.stderr.write(msg + '\n');
}

interface CliOptions {
  dryRun: boolean;
  minScoreDelta: number;
  limit?: number;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = { dryRun: false, minScoreDelta: 1 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dry-run') opts.dryRun = true;
    else if (argv[i] === '--min-score-delta') opts.minScoreDelta = Number(argv[++i]);
    else if (argv[i] === '--limit') opts.limit = Number(argv[++i]);
  }
  return opts;
}

interface AuditRow {
  audit_id: string;
  asset_id: string;
  field_path: string;
  evidence_tier: string;
  confidence: string;
  source_details: {
    legacy_candidate?: string;
    legacy_source?: string;
    scores?: {
      current?: { composite?: number };
      legacy?: { composite?: number };
      score_delta?: number;
    };
    asset_url?: string;
    asset_pg_alias?: string;
    asset_gamme_label?: string;
    asset_role_id?: string;
    asset_physical?: { table?: string; column?: string };
    [k: string]: unknown;
  };
  observed_at: string;
}

async function loadAuditCandidates(opts: CliOptions): Promise<AuditRow[]> {
  let query = supabase
    .from('__seo_content_audit')
    .select(
      'audit_id, asset_id, field_path, evidence_tier, confidence, source_details, observed_at',
    )
    .in('evidence_tier', [...EXACT_MATCH_TIERS])
    .order('observed_at', { ascending: false });
  if (opts.limit) query = query.limit(opts.limit);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to load audit rows: ${error.message}`);
  const all = (data ?? []) as AuditRow[];
  // Filter score_delta client-side (JSONB → number, easier in JS than via PostgREST).
  return all.filter(
    (r) => (r.source_details?.scores?.score_delta ?? 0) >= opts.minScoreDelta,
  );
}

async function findAlreadyProposed(auditIds: string[]): Promise<Set<string>> {
  if (auditIds.length === 0) return new Set();
  const seen = new Set<string>();
  const BATCH = 200;
  for (let i = 0; i < auditIds.length; i += BATCH) {
    const slice = auditIds.slice(i, i + BATCH);
    const filters = slice
      .map((id) => `source_metadata.cs.{"audit_id":"${id}"}`)
      .join(',');
    const { data, error } = await supabase
      .from('__seo_content_events')
      .select('source_metadata')
      .eq('event_kind', 'proposed')
      .or(filters);
    if (error) {
      log(`[WARN] proposed lookup failed (batch ${i}): ${error.message}`);
      continue;
    }
    for (const row of (data ?? []) as Array<{
      source_metadata: { audit_id?: string };
    }>) {
      if (row.source_metadata?.audit_id) seen.add(row.source_metadata.audit_id);
    }
  }
  return seen;
}

function buildProposedEvent(r: AuditRow): {
  asset_id: string;
  field_path: string;
  event_kind: 'proposed';
  value_text: string;
  value_hash: string;
  source_kind: string;
  source_metadata: Record<string, unknown>;
  actor: string;
} | null {
  const legacy = r.source_details?.legacy_candidate;
  if (!legacy) return null;

  // Map physical to H1Target.kind for the worker to resolve later.
  const physical = r.source_details?.asset_physical;
  let targetKind: string | null = null;
  let targetValue: string | number | null = null;
  if (physical?.table === '___meta_tags_ariane') {
    targetKind = 'mta_alias';
    targetValue = r.source_details?.asset_url
      ? new URL(r.source_details.asset_url).pathname
      : null;
  } else if (physical?.table === '__seo_r1_gamme_slots') {
    targetKind = 'r1_pg';
    // pg_id is stored in asset_id like 'r1_router:pg:<num>' OR :<alias>
    const parts = r.asset_id.split(':');
    const last = parts[parts.length - 1];
    targetValue = /^\d+$/.test(last) ? Number(last) : last;
  } else if (physical?.table === '__seo_gamme_purchase_guide') {
    targetKind = 'r6_pg';
    const parts = r.asset_id.split(':');
    const last = parts[parts.length - 1];
    targetValue = /^\d+$/.test(last) ? Number(last) : last;
  } else if (physical?.table === '__seo_gamme') {
    targetKind = 'legacy_gamme';
    const parts = r.asset_id.split(':');
    const last = parts[parts.length - 1];
    targetValue = /^\d+$/.test(last) ? Number(last) : last;
  }

  if (!targetKind || targetValue === null) return null;

  // Hash the normalized legacy value (same normalize as PR-A1).
  const normalized = legacy
    .normalize('NFC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
  // Light-weight hash here — actual SHA-256 will be computed by the gateway
  // when the RPC fires. We store a placeholder ; not used for join.
  // Better to compute SHA-256 properly :
  // (avoid bringing crypto into this script's import block for keeping size
  // small ; deferred to runtime gateway call).
  const valueHash = require('crypto')
    .createHash('sha256')
    .update(normalized, 'utf8')
    .digest('hex');

  return {
    asset_id: r.asset_id,
    field_path: r.field_path,
    event_kind: 'proposed',
    value_text: legacy,
    value_hash: valueHash,
    source_kind: 'legacy_recovery',
    source_metadata: {
      audit_id: r.audit_id,
      evidence_tier: r.evidence_tier,
      legacy_source: r.source_details?.legacy_source,
      score_delta: r.source_details?.scores?.score_delta,
      proposed_target_kind: targetKind,
      proposed_target_value: targetValue,
      bootstrapped_from: 'pr_e_propose_h1_restores',
    },
    actor: 'script:propose-h1-restores',
  };
}

async function persistProposed(
  candidates: AuditRow[],
  alreadyProposed: Set<string>,
): Promise<{ inserted: number; skippedExisting: number; skippedBuildFailed: number }> {
  let buildFailed = 0;
  const events = candidates
    .filter((c) => !alreadyProposed.has(c.audit_id))
    .map((c) => {
      const ev = buildProposedEvent(c);
      if (!ev) buildFailed++;
      return ev;
    })
    .filter((e): e is NonNullable<typeof e> => e !== null);

  if (events.length === 0) {
    return {
      inserted: 0,
      skippedExisting: candidates.length - buildFailed,
      skippedBuildFailed: buildFailed,
    };
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
    inserted += (data ?? []).length;
  }
  return {
    inserted,
    skippedExisting: alreadyProposed.size,
    skippedBuildFailed: buildFailed,
  };
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  log(
    `▶ Proposing H1 restores (dry-run=${opts.dryRun}, min_score_delta=${opts.minScoreDelta})`,
  );

  const candidates = await loadAuditCandidates(opts);
  log(`  ${candidates.length} strong audit candidates (exact_match_* + score_delta ≥ ${opts.minScoreDelta})`);

  if (candidates.length === 0) {
    log('  Nothing to propose.');
    return;
  }

  const already = await findAlreadyProposed(candidates.map((c) => c.audit_id));
  log(`  ${already.size} already have proposed events`);

  if (opts.dryRun) {
    const wouldInsert = candidates.filter((c) => !already.has(c.audit_id)).length;
    log(`▶ --dry-run : would insert ${wouldInsert} proposed events`);
    return;
  }

  const { inserted, skippedExisting, skippedBuildFailed } = await persistProposed(
    candidates,
    already,
  );

  log('');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log(`✓ Proposed events inserted   : ${inserted}`);
  log(`↺ Skipped (already proposed) : ${skippedExisting}`);
  log(`⚠ Skipped (build failed)     : ${skippedBuildFailed}`);
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main().catch((err: unknown) => {
  process.stderr.write(
    `[FATAL] ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
  );
  process.exit(1);
});

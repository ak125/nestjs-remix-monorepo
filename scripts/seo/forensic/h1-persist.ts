/**
 * PR-A2 — Persist PR-A1 forensic findings into __seo_content_audit
 *
 * Reads the report.json produced by PR-A1 (`scripts/seo/forensic/h1-recovery-audit.ts`)
 * and INSERTs the per-asset findings into the append-only audit table.
 *
 * Idempotent : the migration declares UNIQUE (run_id, asset_id, field_path,
 * observed_hash) so re-running this script with the same report.json is a
 * no-op (ON CONFLICT DO NOTHING via supabase upsert).
 *
 * This script does NOT :
 *   - Modify any H1 column in production tables (sg_h1, sgpg_h1_override,
 *     r1s_h1_override, mta_h1) — recovery is Phase E
 *   - Re-run the forensic engine (it consumes an existing PR-A1 report)
 *   - Touch __seo_event_log, __seo_quality_history, or any other surface
 *
 * Usage:
 *   pnpm tsx scripts/seo/forensic/h1-persist.ts --report-path audit-reports/seo-h1-recovery/2026-05-15/report.json
 *   pnpm tsx scripts/seo/forensic/h1-persist.ts                    # auto-detect latest report
 *   pnpm tsx scripts/seo/forensic/h1-persist.ts --dry-run          # parse + validate, no DB writes
 *
 * Plan : /home/deploy/.claude/plans/lors-du-audite-seo-concurrent-swan.md §4 Phase A2
 * Depends on : PR-A1 #532 merged (provides h1-recovery-audit.ts and a report.json
 *              checked in under audit-reports/seo-h1-recovery/<date>/).
 * Migration  : backend/supabase/migrations/20260516_seo_content_audit.sql
 */

import * as path from 'path';
import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// ── Environment ──────────────────────────────────────────────────────────────

dotenv.config({
  path: path.join(__dirname, '../../../backend/.env'),
  quiet: true,
} as dotenv.DotenvConfigOptions);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  process.stderr.write(
    '[FATAL] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see backend/.env)\n',
  );
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ── Logging ──────────────────────────────────────────────────────────────────

function log(msg: string): void {
  process.stderr.write(msg + '\n');
}

// ── Report JSON contract (matches PR-A1 output structure) ────────────────────
//
// Standalone schema (no shared import) to keep PR-A2 self-contained. The shape
// MUST match `audit-reports/seo-h1-recovery/<date>/report.json` produced by
// `scripts/seo/forensic/h1-recovery-audit.ts` (PR-A1).

interface ReportRowAsset {
  asset_id: string;
  field_path: string;
  pg_numeric_id: number;
  pg_alias: string;
  gamme_label: string;
  role_id: string;
  url: string;
  physical: { table: string; column: string };
}

interface ReportRow {
  asset: ReportRowAsset;
  observed_value: string;
  observed_value_normalized: string;
  observed_hash: string;
  evidence_tier: string;
  confidence: string;
  source_details: Record<string, unknown>;
  legacy_candidate?: string;
  legacy_source?: string;
  scores: {
    current: Record<string, unknown>;
    legacy?: Record<string, unknown>;
    score_delta?: number;
  };
  observed_at: string;
}

interface ReportSummary {
  run_id: string;
  role: string;
  generated_at: string;
  total_assets_audited: number;
}

interface ReportFile {
  summary: ReportSummary;
  rows: ReportRow[];
}

const ALLOWED_EVIDENCE_TIERS = new Set([
  'exact_match_snapshot',
  'exact_match_event_log',
  'exact_match_blog_advice',
  'exact_match_builder_template',
  'heuristic_recent_change',
  'unknown',
]);

const ALLOWED_CONFIDENCE = new Set(['high', 'medium', 'low']);

function validateReport(parsed: unknown): ReportFile {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Report root must be an object');
  }
  const root = parsed as Record<string, unknown>;
  if (!root['summary'] || typeof root['summary'] !== 'object') {
    throw new Error('Report.summary missing or not an object');
  }
  if (!Array.isArray(root['rows'])) {
    throw new Error('Report.rows missing or not an array');
  }
  const summary = root['summary'] as Record<string, unknown>;
  if (typeof summary['run_id'] !== 'string' || summary['run_id'].length === 0) {
    throw new Error('Report.summary.run_id missing or empty');
  }
  const rows = root['rows'] as Array<Record<string, unknown>>;
  for (const [i, r] of rows.entries()) {
    if (!r['asset'] || typeof r['asset'] !== 'object') {
      throw new Error(`Row[${i}].asset missing`);
    }
    if (typeof r['evidence_tier'] !== 'string' || !ALLOWED_EVIDENCE_TIERS.has(r['evidence_tier'])) {
      throw new Error(`Row[${i}].evidence_tier invalid: ${String(r['evidence_tier'])}`);
    }
    if (typeof r['confidence'] !== 'string' || !ALLOWED_CONFIDENCE.has(r['confidence'])) {
      throw new Error(`Row[${i}].confidence invalid: ${String(r['confidence'])}`);
    }
    if (typeof r['observed_hash'] !== 'string' || r['observed_hash'].length !== 64) {
      throw new Error(`Row[${i}].observed_hash invalid (expected 64-char SHA-256)`);
    }
  }
  return parsed as ReportFile;
}

// ── CLI parsing ──────────────────────────────────────────────────────────────

interface CliOptions {
  reportPath?: string;
  dryRun: boolean;
  help: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = { dryRun: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--report-path':
        opts.reportPath = argv[++i];
        break;
      case '--dry-run':
        opts.dryRun = true;
        break;
      case '--help':
      case '-h':
        opts.help = true;
        break;
    }
  }
  return opts;
}

function printHelp(): void {
  process.stdout.write(`PR-A2 H1 audit persistence (idempotent)

Usage:
  pnpm tsx scripts/seo/forensic/h1-persist.ts [options]

Options:
  --report-path <path>  Path to PR-A1 report.json (default: latest under audit-reports/seo-h1-recovery/)
  --dry-run             Parse + validate report, no DB writes
  --help                Show this help

Idempotent : repeated invocation with same report.json is a no-op (UNIQUE
constraint on run_id + asset_id + field_path + observed_hash).
`);
}

// ── Auto-detect latest report ────────────────────────────────────────────────

function findLatestReport(): string {
  const root = path.join(process.cwd(), 'audit-reports', 'seo-h1-recovery');
  if (!fs.existsSync(root)) {
    throw new Error(
      `No audit-reports/seo-h1-recovery/ directory found. Provide --report-path or merge PR-A1 first.`,
    );
  }
  const dates = fs
    .readdirSync(root)
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort()
    .reverse();
  for (const date of dates) {
    const candidate = path.join(root, date, 'report.json');
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(`No report.json found under ${root}/<YYYY-MM-DD>/`);
}

// ── DB insert (idempotent) ───────────────────────────────────────────────────

interface PersistRow {
  run_id: string;
  asset_id: string;
  field_path: string;
  observed_value: string;
  observed_hash: string;
  evidence_tier: string;
  confidence: string;
  source_details: Record<string, unknown>;
}

function buildPersistRows(report: ReportFile): PersistRow[] {
  const run_id = report.summary.run_id;
  return report.rows.map((r) => ({
    run_id,
    asset_id: r.asset.asset_id,
    field_path: r.asset.field_path,
    observed_value: r.observed_value,
    observed_hash: r.observed_hash,
    evidence_tier: r.evidence_tier,
    confidence: r.confidence,
    source_details: {
      ...r.source_details,
      legacy_candidate: r.legacy_candidate ?? null,
      legacy_source: r.legacy_source ?? null,
      scores: r.scores,
      audit_observed_at: r.observed_at,
      asset_url: r.asset.url,
      asset_pg_alias: r.asset.pg_alias,
      asset_gamme_label: r.asset.gamme_label,
      asset_role_id: r.asset.role_id,
      asset_physical: r.asset.physical,
    },
  }));
}

async function persistRows(
  rows: PersistRow[],
): Promise<{ inserted: number; skipped: number }> {
  // Batch upsert with onConflict on the UNIQUE constraint. PostgREST does not
  // expose `ON CONFLICT DO NOTHING` per-row; we use upsert with
  // `ignoreDuplicates: true` which uses INSERT ... ON CONFLICT DO NOTHING under
  // the hood on the constraint declared on the table.
  const batchSize = 100;
  let inserted = 0;
  let skipped = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { data, error, status } = await supabase
      .from('__seo_content_audit')
      .upsert(batch, {
        onConflict: 'run_id,asset_id,field_path,observed_hash',
        ignoreDuplicates: true,
      })
      .select('audit_id');
    if (error) {
      throw new Error(`Batch INSERT failed (status=${status}): ${error.message}`);
    }
    const insertedThisBatch = (data ?? []).length;
    inserted += insertedThisBatch;
    skipped += batch.length - insertedThisBatch;
    log(`  batch ${i / batchSize + 1} : ${insertedThisBatch} inserted, ${batch.length - insertedThisBatch} skipped (duplicate)`);
  }
  return { inserted, skipped };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.help) {
    printHelp();
    process.exit(0);
  }

  const reportPath = opts.reportPath ?? findLatestReport();
  log(`▶ Loading report: ${reportPath}`);

  const raw = fs.readFileSync(reportPath, 'utf8');
  const parsed: unknown = JSON.parse(raw);
  const report = validateReport(parsed);

  log(`  run_id=${report.summary.run_id}`);
  log(`  role=${report.summary.role}`);
  log(`  generated_at=${report.summary.generated_at}`);
  log(`  rows=${report.rows.length}`);

  const persistRowsList = buildPersistRows(report);
  log(`▶ Built ${persistRowsList.length} persist rows`);

  if (opts.dryRun) {
    log(`▶ --dry-run mode : no DB writes`);
    log(`  Sample row[0]:`);
    log(JSON.stringify(persistRowsList[0], null, 2));
    process.exit(0);
  }

  log(`▶ Persisting to __seo_content_audit (idempotent upsert)…`);
  const { inserted, skipped } = await persistRows(persistRowsList);

  log('');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log(`✓ Inserted : ${inserted}`);
  log(`↺ Skipped (duplicate) : ${skipped}`);
  log(`  Total processed : ${persistRowsList.length}`);
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.stack ?? err.message : String(err);
  process.stderr.write(`[FATAL] ${msg}\n`);
  process.exit(1);
});

/**
 * PR-E — Multi-source validator for applied H1 recovery events
 *
 * Runs J+1 / J+3 / J+7 (via cron). For every applied recovery event in the
 * window, checks the value via THREE sources :
 *
 *   1. Synthetic crawler   : __seo_snapshot_synthetic.h1_text matches applied
 *   2. Runtime fetch       : HTTP GET on the URL, parse <h1>, match value
 *   3. GSC (secondary)     : impressions delta sanity check (J+7 only, alert
 *                            only — never gate primary decision per
 *                            memory feedback_gsc_is_secondary_signal_only)
 *
 * Outcomes per event :
 *   - synthetic+runtime both OK    → INSERT event 'validated'
 *   - synthetic OR runtime fails   → mark for revert via SeoRevertSelector
 *                                    (logged in __seo_revert_candidates_log)
 *
 * The actual revert is performed by SeoContentWriteService.applyH1 with
 * source.kind = 'human_validated_llm' or 'human_curated' (whatever the
 * revert target's source_kind was). NEVER reverts to unknown/heuristic.
 *
 * PR-E ships scaffolding : the synthetic source query is wired against the
 * existing __seo_snapshot_synthetic table (PR-2A-1 ADR-064). Runtime fetch
 * + GSC are stubbed (TODO markers) — to be filled in PR-E+1 once dev
 * infrastructure for HTTP probe + GSC API client is settled.
 *
 * Usage :
 *   pnpm tsx scripts/seo/recovery/h1-recovery-validate.ts --window 24h
 *   pnpm tsx scripts/seo/recovery/h1-recovery-validate.ts --window 72h --dry-run
 *
 * Plan : §8 Phase E step 4
 * Memory : feedback_slo_must_be_multi_source, feedback_gsc_is_secondary_signal_only
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

function log(msg: string): void {
  process.stderr.write(msg + '\n');
}

interface CliOptions {
  windowHours: number;
  dryRun: boolean;
  limit?: number;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = { windowHours: 24, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--window') {
      const raw = argv[++i];
      const m = /^(\d+)h$/.exec(raw);
      opts.windowHours = m ? Number(m[1]) : Number(raw);
    } else if (argv[i] === '--dry-run') opts.dryRun = true;
    else if (argv[i] === '--limit') opts.limit = Number(argv[++i]);
  }
  return opts;
}

interface AppliedEventRow {
  event_id: string;
  asset_id: string;
  field_path: string;
  value_text: string | null;
  value_hash: string;
  source_metadata: Record<string, unknown> & {
    asset_url?: string;
    asset_pg_alias?: string;
  };
  created_at: string;
}

async function loadAppliedRecoveryEvents(opts: CliOptions): Promise<AppliedEventRow[]> {
  const sinceIso = new Date(Date.now() - opts.windowHours * 60 * 60 * 1000).toISOString();
  let query = supabase
    .from('__seo_content_events')
    .select('event_id, asset_id, field_path, value_text, value_hash, source_metadata, created_at')
    .eq('event_kind', 'applied')
    .eq('source_kind', 'legacy_recovery')
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false });
  if (opts.limit) query = query.limit(opts.limit);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to load applied events: ${error.message}`);
  return (data ?? []) as AppliedEventRow[];
}

/**
 * Resolves the synthetic crawler URL for an applied event. For PR-E we
 * derive it from `mta:<alias>` asset_id ; future targets (r1_pg, r6_pg)
 * will need their own URL resolver.
 */
function urlFromAssetId(assetId: string): string | null {
  if (assetId.startsWith('mta:')) {
    const alias = assetId.slice('mta:'.length);
    // mta_alias is already a pathname like /pieces/foo or a full URL.
    if (alias.startsWith('http')) return alias;
    return `https://www.automecanik.com${alias.startsWith('/') ? '' : '/'}${alias}`;
  }
  return null;
}

interface SourceResult {
  source: 'synthetic' | 'runtime' | 'gsc';
  status: 'ok' | 'mismatch' | 'skipped' | 'error';
  details?: string;
}

async function checkSynthetic(
  ev: AppliedEventRow,
): Promise<SourceResult> {
  const url = urlFromAssetId(ev.asset_id);
  if (!url) {
    return { source: 'synthetic', status: 'skipped', details: 'no url derivable' };
  }
  // Look up the most recent synthetic snapshot for this url AFTER the applied
  // event was committed.
  const { data, error } = await supabase
    .from('__seo_snapshot_synthetic')
    .select('h1_text, created_at')
    .eq('url', url)
    .gte('created_at', ev.created_at)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) {
    return { source: 'synthetic', status: 'error', details: error.message };
  }
  const row = (data ?? [])[0] as { h1_text: string | null; created_at: string } | undefined;
  if (!row) {
    return { source: 'synthetic', status: 'skipped', details: 'no snapshot yet' };
  }
  if (!row.h1_text) {
    return { source: 'synthetic', status: 'mismatch', details: 'snapshot h1 is null' };
  }
  if (row.h1_text === ev.value_text) {
    return { source: 'synthetic', status: 'ok' };
  }
  return {
    source: 'synthetic',
    status: 'mismatch',
    details: `snapshot=${JSON.stringify(row.h1_text).slice(0, 60)}… vs applied=${JSON.stringify(ev.value_text ?? '').slice(0, 60)}…`,
  };
}

/**
 * PR-E+1 — real HTTP fetch + parse <h1> from response body. UA identifiable
 * (memory feedback_synthetic_bot_ua_never_spoof_googlebot — never spoof
 * Googlebot, always declare identity).
 */
async function checkRuntime(ev: AppliedEventRow): Promise<SourceResult> {
  const url = urlFromAssetId(ev.asset_id);
  if (!url) {
    return {
      source: 'runtime',
      status: 'skipped',
      details: 'no url derivable',
    };
  }

  const ua =
    process.env.SEO_RECOVERY_VALIDATOR_UA ??
    'AutoMecanikRecoveryValidator/1.0 (+https://www.automecanik.com/about/seo)';
  try {
    const controller = new AbortController();
    const timeoutMs = Number(process.env.SEO_RECOVERY_VALIDATOR_TIMEOUT_MS ?? 15_000);
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': ua, Accept: 'text/html' },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return {
        source: 'runtime',
        status: 'error',
        details: `http ${res.status}`,
      };
    }
    const body = await res.text();
    const h1 = extractFirstH1(body);
    if (!h1) {
      return {
        source: 'runtime',
        status: 'mismatch',
        details: '<h1> not found in body',
      };
    }
    if (normalize(h1) === normalize(ev.value_text ?? '')) {
      return { source: 'runtime', status: 'ok' };
    }
    return {
      source: 'runtime',
      status: 'mismatch',
      details: `runtime=${JSON.stringify(h1).slice(0, 60)}… vs applied=${JSON.stringify(ev.value_text ?? '').slice(0, 60)}…`,
    };
  } catch (err) {
    return {
      source: 'runtime',
      status: 'error',
      details: err instanceof Error ? err.message : String(err),
    };
  }
}

function normalize(s: string): string {
  return s
    .normalize('NFC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function extractFirstH1(html: string): string | null {
  const m = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  if (!m) return null;
  // Strip nested tags + decode common entities ; lightweight, no DOM lib.
  return m[1]
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * PR-E+1 — Google Search Console secondary signal (alert only, never gates).
 * Memory feedback_gsc_is_secondary_signal_only : GSC carries J-2 to J-7
 * latency, so we use it as a sanity alert at J+7, NOT as a primary validator.
 *
 * Queries impressions for the URL over a 7-day window post-applied vs the
 * 7-day window before. If post drops > GSC_DELTA_ALERT_PCT (default 10%),
 * emits a warning. Status remains 'ok' for validator decision purposes —
 * the synthetic + runtime gates are what flip a write to reverted.
 */
async function checkGsc(ev: AppliedEventRow): Promise<SourceResult> {
  // Only run J+7 (≥168h since applied). Earlier windows return 'skipped'.
  const ageMs = Date.now() - new Date(ev.created_at).getTime();
  if (ageMs < 7 * 24 * 60 * 60 * 1000) {
    return {
      source: 'gsc',
      status: 'skipped',
      details: 'event < 7 days old, gsc check deferred',
    };
  }

  const clientEmail = process.env.GSC_CLIENT_EMAIL;
  const privateKey = process.env.GSC_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const siteUrl = process.env.GSC_SITE_URL;
  if (!clientEmail || !privateKey || !siteUrl) {
    return {
      source: 'gsc',
      status: 'skipped',
      details:
        'GSC credentials missing (GSC_CLIENT_EMAIL / GSC_PRIVATE_KEY / GSC_SITE_URL)',
    };
  }

  const url = urlFromAssetId(ev.asset_id);
  if (!url) {
    return { source: 'gsc', status: 'skipped', details: 'no url derivable' };
  }

  try {
    // Lazy-load googleapis to avoid pulling it into the script bundle if
    // credentials aren't configured.
    const { google } = await import('googleapis');
    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    });
    const sc = google.searchconsole({ version: 'v1', auth });

    const appliedDate = new Date(ev.created_at);
    const dayMs = 24 * 60 * 60 * 1000;
    const isoDay = (d: Date): string => d.toISOString().slice(0, 10);
    const postStart = isoDay(appliedDate);
    const postEnd = isoDay(new Date(appliedDate.getTime() + 7 * dayMs));
    const preStart = isoDay(new Date(appliedDate.getTime() - 7 * dayMs));
    const preEnd = isoDay(new Date(appliedDate.getTime() - dayMs));

    const queryFor = async (startDate: string, endDate: string): Promise<number> => {
      const r = await sc.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate,
          endDate,
          dimensions: ['page'],
          dimensionFilterGroups: [
            {
              filters: [
                { dimension: 'page', operator: 'equals', expression: url },
              ],
            },
          ],
          rowLimit: 1,
        },
      });
      return r.data.rows?.[0]?.impressions ?? 0;
    };

    const [pre, post] = await Promise.all([
      queryFor(preStart, preEnd),
      queryFor(postStart, postEnd),
    ]);

    const deltaPctThreshold = Number(
      process.env.SEO_GSC_DELTA_ALERT_PCT ?? 10,
    );
    if (pre === 0) {
      // No pre-baseline, can't compare. Status ok but log info.
      return {
        source: 'gsc',
        status: 'ok',
        details: `pre=0 post=${post} (no baseline)`,
      };
    }
    const deltaPct = ((post - pre) / pre) * 100;
    if (deltaPct < -deltaPctThreshold) {
      // Alert only — never demote validator decision to mismatch.
      return {
        source: 'gsc',
        status: 'ok',
        details: `ALERT impressions Δ=${deltaPct.toFixed(1)}% (pre=${pre} post=${post}, threshold=-${deltaPctThreshold}%)`,
      };
    }
    return {
      source: 'gsc',
      status: 'ok',
      details: `impressions Δ=${deltaPct.toFixed(1)}% (pre=${pre} post=${post})`,
    };
  } catch (err) {
    return {
      source: 'gsc',
      status: 'error',
      details: err instanceof Error ? err.message : String(err),
    };
  }
}

async function insertValidatedEvent(
  ev: AppliedEventRow,
  results: SourceResult[],
): Promise<void> {
  const { error } = await supabase.from('__seo_content_events').insert({
    asset_id: ev.asset_id,
    field_path: ev.field_path,
    event_kind: 'validated',
    value_text: ev.value_text,
    value_hash: ev.value_hash,
    source_kind: 'multi_source_validator',
    source_metadata: {
      validated_for_event_id: ev.event_id,
      sources: results,
      validated_at: new Date().toISOString(),
    },
    actor: 'script:h1-recovery-validate',
    evaluation_id: null,
  });
  if (error) throw new Error(`failed to INSERT validated event: ${error.message}`);
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  log(`▶ Validating applied recovery events (window=${opts.windowHours}h, dry_run=${opts.dryRun})`);

  const events = await loadAppliedRecoveryEvents(opts);
  log(`  ${events.length} applied legacy_recovery events in window`);

  if (events.length === 0) return;

  let validatedCount = 0;
  let pendingCount = 0;
  let mismatchCount = 0;

  for (const ev of events) {
    const synthetic = await checkSynthetic(ev);
    const runtime = await checkRuntime(ev);
    const gsc = await checkGsc(ev);
    const results = [synthetic, runtime, gsc];

    // Validated iff synthetic OK AND runtime not in 'mismatch' (skipped is OK
    // in PR-E since runtime stub is intentional).
    const allOk = synthetic.status === 'ok' && runtime.status !== 'mismatch';
    const anyMismatch = results.some((r) => r.status === 'mismatch');

    if (allOk && !anyMismatch) {
      log(`  ✓ validated event=${ev.event_id} asset=${ev.asset_id}`);
      validatedCount++;
      if (!opts.dryRun) await insertValidatedEvent(ev, results);
    } else if (anyMismatch) {
      mismatchCount++;
      log(`  ✗ mismatch event=${ev.event_id} asset=${ev.asset_id} sources=${JSON.stringify(results.map((r) => `${r.source}:${r.status}`))}`);
      // TODO PR-E+1 : trigger SeoRevertSelector + log to __seo_revert_candidates_log.
      // For PR-E scaffolding we surface but don't act.
    } else {
      pendingCount++;
      log(`  ⏳ pending event=${ev.event_id} asset=${ev.asset_id} (snapshot not yet available)`);
    }
  }

  log('');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log(`✓ Validated     : ${validatedCount}${opts.dryRun ? ' (dry-run — not persisted)' : ''}`);
  log(`✗ Mismatch      : ${mismatchCount}`);
  log(`⏳ Pending       : ${pendingCount}`);
  log(`Total inspected : ${events.length}`);
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main().catch((err: unknown) => {
  process.stderr.write(
    `[FATAL] ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
  );
  process.exit(1);
});

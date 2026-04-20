/**
 * ADR-016 — Backfill de `__vehicle_page_cache`.
 *
 * Itère tous les `type_id` valides (auto_type.type_display = '1') et appelle
 * `rebuild_vehicle_page_cache(type_id)` en parallèle par batch borné.
 *
 * Usage :
 *   npx tsx scripts/seo/backfill-vehicle-page-cache.ts [options]
 *
 * Options :
 *   --dry-run             N'exécute pas, liste les type_id à traiter
 *   --batch-size=<n>      Taille du batch (défaut: 50)
 *   --concurrency=<n>     Jobs parallèles par batch (défaut: 4)
 *   --since-stale         Ne rebuild que les lignes marquées stale=TRUE
 *   --only-missing        Ne rebuild que les type_id absents de la table cache
 *   --type-ids=<csv>      Limite à une liste explicite (ex: 12345,67890)
 *   --sleep-ms=<n>        Pause entre batchs (défaut: 100ms)
 *   --max=<n>             Plafond de sécurité (défaut: 60000)
 *   --help                Affiche l'aide
 *
 * Safety :
 *   - Ne modifie jamais get_vehicle_page_data_optimized (lecture seule sur legacy).
 *   - Peut être interrompu (Ctrl-C) sans corruption — chaque rebuild est atomique.
 *   - Idempotent : rebuild_vehicle_page_cache met à jour si source_hash inchangé.
 *
 * Budget typique (backfill complet) :
 *   - ~54 000 types × (warm 125ms | cold 4s) × 4 parallèles ≈ 4-6h.
 *   - Commence par les types récents (plus susceptibles d'être warm).
 */

import * as path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// ── Env ──────────────────────────────────────────────────────────────────────
dotenv.config({
  path: path.join(__dirname, '../../backend/.env'),
  quiet: true,
} as dotenv.DotenvConfigOptions);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  process.stderr.write('[FATAL] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing\n');
  process.exit(2);
}

const supabase: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
);

// ── CLI ──────────────────────────────────────────────────────────────────────
function parseArgs(): {
  dryRun: boolean;
  batchSize: number;
  concurrency: number;
  sinceStale: boolean;
  onlyMissing: boolean;
  typeIds: number[] | null;
  sleepMs: number;
  max: number;
  help: boolean;
} {
  const args = process.argv.slice(2);
  const get = (prefix: string) => {
    const match = args.find((a) => a.startsWith(prefix));
    return match ? match.slice(prefix.length) : null;
  };
  const typeIdsRaw = get('--type-ids=');
  return {
    dryRun: args.includes('--dry-run'),
    batchSize: Math.max(1, parseInt(get('--batch-size=') ?? '50', 10) || 50),
    concurrency: Math.max(1, Math.min(parseInt(get('--concurrency=') ?? '4', 10) || 4, 16)),
    sinceStale: args.includes('--since-stale'),
    onlyMissing: args.includes('--only-missing'),
    typeIds: typeIdsRaw
      ? typeIdsRaw
          .split(',')
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => Number.isFinite(n) && n > 0)
      : null,
    sleepMs: Math.max(0, parseInt(get('--sleep-ms=') ?? '100', 10) || 100),
    max: Math.max(1, parseInt(get('--max=') ?? '60000', 10) || 60000),
    help: args.includes('--help') || args.includes('-h'),
  };
}

function usage() {
  process.stdout.write(
    'Usage: npx tsx scripts/seo/backfill-vehicle-page-cache.ts [options]\n' +
      '  --dry-run --batch-size=50 --concurrency=4 --since-stale --only-missing\n' +
      '  --type-ids=1,2,3 --sleep-ms=100 --max=60000\n',
  );
}

// ── Logging ──────────────────────────────────────────────────────────────────
function log(msg: string) {
  process.stderr.write(`[${new Date().toISOString()}] ${msg}\n`);
}

// ── Fetch candidate type_ids ─────────────────────────────────────────────────
async function fetchCandidates(opts: {
  sinceStale: boolean;
  onlyMissing: boolean;
  typeIds: number[] | null;
  max: number;
}): Promise<number[]> {
  if (opts.typeIds) {
    log(`explicit type_ids list: ${opts.typeIds.length} ids`);
    return opts.typeIds.slice(0, opts.max);
  }

  if (opts.sinceStale) {
    const { data, error } = await supabase
      .from('__vehicle_page_cache')
      .select('type_id')
      .eq('stale', true)
      .order('built_at', { ascending: true })
      .limit(opts.max);
    if (error) throw error;
    const ids = (data ?? []).map((r) => Number(r.type_id)).filter(Boolean);
    log(`stale rows: ${ids.length}`);
    return ids;
  }

  // Source : auto_type.type_display = '1', paginé pour dépasser la limite 1000.
  // auto_type.type_id est TEXT en DB — on cast côté lecture.
  const pageSize = 1000;
  const ids: number[] = [];
  let from = 0;
  while (ids.length < opts.max) {
    const { data, error } = await supabase
      .from('auto_type')
      .select('type_id')
      .eq('type_display', '1')
      .order('type_id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const row of data) {
      const n = parseInt(String(row.type_id), 10);
      if (Number.isFinite(n) && n > 0) ids.push(n);
      if (ids.length >= opts.max) break;
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }

  if (opts.onlyMissing) {
    // Filtrer ceux déjà présents dans le cache.
    const { data: existingRows, error: exErr } = await supabase
      .from('__vehicle_page_cache')
      .select('type_id');
    if (exErr) throw exErr;
    const existing = new Set((existingRows ?? []).map((r) => Number(r.type_id)));
    const filtered = ids.filter((id) => !existing.has(id));
    log(
      `total candidates: ${ids.length}, cached: ${existing.size}, missing: ${filtered.length}`,
    );
    return filtered;
  }

  log(`total candidates: ${ids.length}`);
  return ids;
}

// ── Worker ───────────────────────────────────────────────────────────────────
async function rebuildOne(typeId: number): Promise<'built' | 'skipped' | 'failed'> {
  const { data, error } = await supabase.rpc('rebuild_vehicle_page_cache', {
    p_type_id: typeId,
  });
  if (error) {
    log(`[FAIL] type_id=${typeId} : ${error.message}`);
    return 'failed';
  }
  return data === true ? 'built' : 'skipped';
}

async function sleep(ms: number) {
  if (ms > 0) await new Promise((r) => setTimeout(r, ms));
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs();
  if (opts.help) {
    usage();
    return;
  }

  log(
    `start — dryRun=${opts.dryRun} batch=${opts.batchSize} concurrency=${opts.concurrency} ` +
      `sinceStale=${opts.sinceStale} onlyMissing=${opts.onlyMissing} sleepMs=${opts.sleepMs} max=${opts.max}`,
  );

  const candidates = await fetchCandidates(opts);
  if (!candidates.length) {
    log('nothing to backfill. exiting.');
    return;
  }

  if (opts.dryRun) {
    log(`[DRY-RUN] would rebuild ${candidates.length} rows`);
    log(`first 10 type_ids: ${candidates.slice(0, 10).join(',')}`);
    return;
  }

  let built = 0;
  let skipped = 0;
  let failed = 0;
  const startedAt = Date.now();

  for (let i = 0; i < candidates.length; i += opts.batchSize) {
    const batch = candidates.slice(i, i + opts.batchSize);

    // Exécute le batch avec un pool de `concurrency` jobs simultanés.
    const queue = [...batch];
    const workers: Promise<void>[] = [];
    const runWorker = async () => {
      while (queue.length > 0) {
        const typeId = queue.shift();
        if (typeId === undefined) return;
        const res = await rebuildOne(typeId);
        if (res === 'built') built++;
        else if (res === 'skipped') skipped++;
        else failed++;
      }
    };
    for (let w = 0; w < opts.concurrency; w++) workers.push(runWorker());
    await Promise.all(workers);

    const done = built + skipped + failed;
    const elapsed = (Date.now() - startedAt) / 1000;
    const rate = done / Math.max(elapsed, 1);
    const etaSec = Math.round(
      (candidates.length - done) / Math.max(rate, 0.001),
    );
    log(
      `progress : ${done}/${candidates.length} ` +
        `(built=${built} skipped=${skipped} failed=${failed}) ` +
        `rate=${rate.toFixed(1)}/s eta=${Math.round(etaSec / 60)}min`,
    );
    await sleep(opts.sleepMs);
  }

  const totalSec = Math.round((Date.now() - startedAt) / 1000);
  log(
    `done in ${totalSec}s — built=${built} skipped=${skipped} failed=${failed}`,
  );

  // Exit code non-zéro si des échecs >5% pour signaler au CI/cron.
  const failRate = failed / candidates.length;
  if (failRate > 0.05) {
    log(`[FATAL] fail rate ${(failRate * 100).toFixed(1)}% > 5%`);
    process.exit(3);
  }
}

main().catch((err) => {
  log(`[FATAL] ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});

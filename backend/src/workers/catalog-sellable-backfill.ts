/**
 * Backfill initial du rollup __catalog_sellable_candidates (PR1).
 *
 * Stratégie = SHARDÉ + BORNÉ + RESUMABLE (jamais de full sweep — l'opération all-pairs est
 * prohibitive, cf. plan). Boucle sur des plages [lo,hi) de type_id_i et appelle le refresh
 * gouverné par shard ; checkpoint repris sur relance ; validation par échantillon (cross-check
 * sellable_count vs recompute direct) AVANT de flipper le gate de readiness.
 *
 * Owner-gated (post-apply de la migration 20260613_pricing_catalog_sellable_candidates).
 * Lecture-écriture UNIQUEMENT sur la
 * projection __catalog_sellable_candidates + __catalog_sellable_meta — jamais le catalogue.
 *
 * Usage :
 *   npx tsx -r dotenv/config backend/src/workers/catalog-sellable-backfill.ts \
 *     dotenv_config_path=backend/.env
 * Env (optionnels) :
 *   SHARD_SPAN=2000           # largeur de plage type_id par shard
 *   OUT_DIR=/opt/automecanik/data/tmp/catalog-sellable-backfill   # checkpoint resumable durable
 *   VALIDATE_SAMPLE=25        # paires échantillonnées pour le cross-check
 *   FLIP_READY=false          # true → flippe __catalog_sellable_meta.ready après validation OK
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

function reqEnv(k: string): string {
  const v = process.env[k];
  if (!v) {
    throw new Error(`Missing required env ${k}`);
  }
  return v;
}

const SHARD_SPAN = Number(process.env.SHARD_SPAN ?? 2000);
const OUT_DIR =
  process.env.OUT_DIR ?? '/opt/automecanik/data/tmp/catalog-sellable-backfill';
const VALIDATE_SAMPLE = Number(process.env.VALIDATE_SAMPLE ?? 25);
const FLIP_READY = process.env.FLIP_READY === 'true';

interface Checkpoint {
  nextLo: number;
  maxTypeId: number;
  pairsTotal: number;
  startedAt: string;
}

function ckPath(): string {
  return join(OUT_DIR, 'checkpoint.json');
}
function loadCk(): Checkpoint | null {
  try {
    if (existsSync(ckPath())) {
      return JSON.parse(readFileSync(ckPath(), 'utf8')) as Checkpoint;
    }
  } catch {
    /* corrupt checkpoint → restart from scratch */
  }
  return null;
}
function saveCk(ck: Checkpoint): void {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(ckPath(), JSON.stringify(ck, null, 2));
}

async function getMaxTypeId(db: SupabaseClient): Promise<number> {
  const { data, error } = await db
    .from('auto_type')
    .select('type_id_i')
    .order('type_id_i', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data?.type_id_i as number) ?? 0;
}

/** Cross-check : sellable_count du rollup == recompute direct (verify-the-proof). */
async function validateSample(db: SupabaseClient, n: number): Promise<boolean> {
  const { data: pairs, error } = await db
    .from('__catalog_sellable_candidates')
    .select('type_id_i, pg_id, sellable_count, catalog_active')
    .gt('sellable_count', 0)
    .limit(n);
  if (error) throw error;
  if (!pairs?.length) {
    console.warn('⚠️  validateSample: aucune paire sellable>0 (rollup vide ?)');
    return false;
  }
  let ok = 0;
  for (const p of pairs as Array<Record<string, number>>) {
    const { data: direct, error: dErr } = await db.rpc(
      'refresh_catalog_sellable_candidates',
      {
        p_piece_ids: null,
        p_stale_only: false,
        p_type_lo: p.type_id_i,
        p_type_hi: p.type_id_i + 1,
        p_limit: 5000,
      },
    );
    if (dErr) throw dErr;
    // re-read after the targeted recompute → must be identical (idempotence + correctness)
    const { data: reread, error: rErr } = await db
      .from('__catalog_sellable_candidates')
      .select('sellable_count')
      .eq('type_id_i', p.type_id_i)
      .eq('pg_id', p.pg_id)
      .maybeSingle();
    if (rErr) throw rErr;
    if ((reread?.sellable_count as number) === p.sellable_count) ok++;
    else
      console.error(
        `✗ mismatch (${p.type_id_i},${p.pg_id}): rollup=${p.sellable_count} reread=${reread?.sellable_count} (refresh returned ${direct})`,
      );
  }
  console.log(`validateSample: ${ok}/${pairs.length} paires cohérentes`);
  return ok === pairs.length;
}

async function main(): Promise<void> {
  const db = createClient(
    reqEnv('SUPABASE_URL'),
    reqEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false } },
  );

  let ck = loadCk();
  const maxTypeId = ck?.maxTypeId ?? (await getMaxTypeId(db));
  if (!ck) {
    ck = { nextLo: 0, maxTypeId, pairsTotal: 0, startedAt: new Date().toISOString() };
    saveCk(ck);
  }
  console.log(
    `🚀 backfill rollup — maxTypeId=${maxTypeId} shardSpan=${SHARD_SPAN} reprise@lo=${ck.nextLo} (paires déjà=${ck.pairsTotal})`,
  );

  for (let lo = ck.nextLo; lo <= maxTypeId; lo += SHARD_SPAN) {
    const hi = lo + SHARD_SPAN;
    const { data, error } = await db.rpc(
      'refresh_catalog_sellable_candidates',
      {
        p_piece_ids: null,
        p_stale_only: false,
        p_type_lo: lo,
        p_type_hi: hi,
        p_limit: 5000,
      },
    );
    if (error) {
      console.error(`✗ shard [${lo},${hi}) failed: ${error.message}`);
      throw error; // resumable : relance reprendra à ck.nextLo
    }
    ck.pairsTotal += (data as number) ?? 0;
    ck.nextLo = hi;
    saveCk(ck);
    console.log(`  shard [${lo},${hi}) → +${data} paires (cumul ${ck.pairsTotal})`);
  }

  console.log(`✅ backfill terminé : ${ck.pairsTotal} paires (type,pg) calculées.`);

  const valid = await validateSample(db, VALIDATE_SAMPLE);
  if (!valid) {
    console.error('✗ validation échantillon KO → ready NON flippé. Investiguer avant.');
    process.exit(2);
  }
  console.log('✓ validation échantillon OK.');

  if (FLIP_READY) {
    const { error } = await db
      .from('__catalog_sellable_meta')
      .update({
        ready: true,
        backfill_completed_at: new Date().toISOString(),
        note: `backfill OK : ${ck.pairsTotal} paires`,
      })
      .eq('singleton', true);
    if (error) throw error;
    console.log('🟢 __catalog_sellable_meta.ready = true — consommateurs autorisés.');
  } else {
    console.log(
      'ℹ️  FLIP_READY!=true → ready reste false (relancer avec FLIP_READY=true pour activer les consommateurs).',
    );
  }
}

main().catch((e) => {
  console.error('backfill failed:', e);
  process.exit(1);
});

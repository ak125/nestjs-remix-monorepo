/**
 * Generic supplier-brand price loader → pieces_price. SAFE BY DEFAULT (dry-run).
 *
 * Loads a prepared feed (ref, ean, gros_ht, achat_ht, marge_finale_pct, vente_ht,
 * vente_ttc) into pieces_price for ONE brand, brand-scoped: matches each feed ref
 * to a catalog piece of that brand (pieces.piece_pm_id = BRAND_PM_ID) and INSERTs a
 * pieces_price row (pri_pm_id=brand, pri_type='0'). New-brand load = pure INSERT,
 * no overwrite. See .claude/knowledge/ops/supplier-brand-price-load-procedure.md.
 *
 * Env (required): BRAND_PM_ID, FEED_PATH, SOURCE_TAG. Optional: EXCLUDE_REFS (csv),
 * DISPO (pri_dispo, default null = no stock promise), COMMIT_CONFIRM=true (else dry-run).
 *
 * Rollback: DELETE FROM pieces_price WHERE pri_pm_id='<BRAND_PM_ID>' AND pricing_updated_source='<SOURCE_TAG>';
 *
 * Run: BRAND_PM_ID=3410 FEED_PATH=/opt/automecanik/data/tecdoc/<feed>.csv SOURCE_TAG=NK_FEED_2026-06 \
 *      node -r dotenv/config dist/workers/supplier-price-commit.js dotenv_config_path=.env
 *      (add COMMIT_CONFIRM=true to actually write)
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const BRAND = req('BRAND_PM_ID');
const FEED = req('FEED_PATH');
const SOURCE = req('SOURCE_TAG');
const DISPO = process.env.DISPO ?? null;
const COMMIT = process.env.COMMIT_CONFIRM === 'true';
const EXCLUDE = new Set(
  (process.env.EXCLUDE_REFS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
);

function req(k: string): string {
  const v = process.env[k];
  if (!v) throw new Error(`missing required env ${k}`);
  return v;
}
const num = (s: string) => {
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};
const chunk = <T>(a: T[], n: number): T[][] => {
  const o: T[][] = [];
  for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n));
  return o;
};

type FR = {
  ref: string;
  ean: string;
  gros: number | null;
  achat: number;
  marge: number | null;
  vente: number | null;
  ttc: number | null;
  poids: string;
  label: string;
};

async function main(): Promise<void> {
  const sb = createClient(
    req('SUPABASE_URL'),
    req('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false } },
  );

  const lines = readFileSync(FEED, 'utf8').split('\n');
  const h = lines[0].split(',');
  const ix = (k: string) => h.indexOf(k);
  const F = {
    ref: ix('ref'),
    ean: ix('ean'),
    gros: ix('gros_ht'),
    achat: ix('achat_ht'),
    marge: ix('marge_finale_pct'),
    vente: ix('vente_ht'),
    ttc: ix('vente_ttc'),
    poids: ix('poids'),
    label: ix('label'),
  };
  const feed: FR[] = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',');
    if (!c[F.ref] || EXCLUDE.has(c[F.ref])) continue;
    const achat = num(c[F.achat]);
    const vente = num(c[F.vente]);
    if (!(achat && achat > 0)) continue;
    if (vente != null && vente < achat) continue; // invariant: never sell at loss
    feed.push({
      ref: c[F.ref],
      ean: c[F.ean] ?? '',
      gros: num(c[F.gros]),
      achat,
      marge: num(c[F.marge]),
      vente,
      ttc: num(c[F.ttc]),
      poids: c[F.poids] ?? '',
      label: c[F.label] ?? '',
    });
  }
  console.log(`brand=${BRAND} feed=${feed.length} rows (achat>0, vente≥achat, excl ${EXCLUDE.size})`);

  // ref → brand piece_id (scoped to piece_pm_id = BRAND)
  const refToPiece = new Map<string, string>();
  for (const part of chunk(feed, 400)) {
    const { data, error } = await sb
      .from('pieces')
      .select('piece_id, piece_ref')
      .eq('piece_pm_id', BRAND)
      .in('piece_ref', part.map((r) => r.ref))
      .limit(5000);
    if (error) throw new Error(`pieces: ${error.message}`);
    for (const d of data ?? [])
      if (!refToPiece.has(d.piece_ref)) refToPiece.set(d.piece_ref, d.piece_id);
  }
  const matched = feed.filter((r) => refToPiece.has(r.ref));
  console.log(`matched brand pieces: ${matched.length} | unmatched: ${feed.length - matched.length}`);

  // already-priced for this brand (overwrite guard)
  let already = 0;
  for (const part of chunk(matched.map((r) => refToPiece.get(r.ref)!), 400)) {
    const { data } = await sb
      .from('pieces_price')
      .select('pri_piece_id')
      .eq('pri_pm_id', BRAND)
      .in('pri_piece_id', part);
    already += (data ?? []).length;
  }
  console.log(`brand pieces already priced (overwrite if >0): ${already}`);

  const row = (r: FR) => ({
    pri_piece_id: refToPiece.get(r.ref)!,
    pri_piece_id_i: Number(refToPiece.get(r.ref)!) || null,
    pri_pm_id: BRAND,
    pri_type: '0',
    pri_ean: r.ean || null,
    pri_ref: r.ref,
    pri_des: r.label || null,
    pri_gros_ht_n: r.gros,
    pri_gros_ht: r.gros != null ? String(r.gros) : null,
    pri_achat_ht_n: r.achat,
    pri_achat_ht: String(r.achat),
    pri_marge_n: r.marge,
    pri_marge: r.marge != null ? String(r.marge) : null,
    pri_vente_ht_n: r.vente,
    pri_vente_ht: r.vente != null ? String(r.vente) : null,
    pri_vente_ttc_n: r.ttc,
    pri_vente_ttc: r.ttc != null ? String(r.ttc) : null,
    pri_poids: r.poids || null,
    pri_dispo: DISPO,
    pricing_state: 'ACTIVE',
    pricing_updated_source: SOURCE,
  });

  console.log('--- SAMPLE row ---');
  console.log(JSON.stringify(matched.slice(0, 1).map(row), null, 2));
  console.log(
    `--- ROLLBACK ---\nDELETE FROM pieces_price WHERE pri_pm_id='${BRAND}' AND pricing_updated_source='${SOURCE}';`,
  );

  if (!COMMIT) {
    console.log(`\nDRY-RUN — would insert ${matched.length} rows. NO WRITE. Set COMMIT_CONFIRM=true.`);
    process.exit(0);
  }
  if (already > 0)
    throw new Error(`refusing: ${already} brand pieces already priced (this loader is INSERT-only; use an UPDATE path)`);

  let inserted = 0;
  for (const part of chunk(matched, 500)) {
    const { error } = await sb.from('pieces_price').insert(part.map(row));
    if (error) throw new Error(`insert: ${error.message}`);
    inserted += part.length;
    console.log(`inserted ${inserted}/${matched.length}`);
  }
  console.log(`COMMIT DONE: ${inserted} prices inserted (brand ${BRAND}, source ${SOURCE}).`);
  process.exit(0);
}

main().catch((e) => {
  console.error('supplier-price-commit failed:', e);
  process.exit(1);
});

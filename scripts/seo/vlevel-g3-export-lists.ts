/**
 * vlevel-g3-export-lists.ts — EXPORT READ-ONLY des listes de décision G3 (V-Level).
 *
 * STRICT READ-ONLY : uniquement `.select()`. Aucun insert/update/delete/rpc-write,
 * aucune migration, aucun recalcul, aucun changement runtime. N'APPLIQUE rien :
 * produit seulement des fichiers de décision pour l'owner.
 *
 * Sortie (audit/, préfixe gamme = couvert par l'overlay ownership) :
 *   - <prefix>-roots_review_owner.csv        (V5 sur modèle root → REVIEW_OWNER)
 *   - <prefix>-union_add_candidates.csv      (candidats union → ADD_CANDIDATE)
 *   - <prefix>-v5_full_classification.csv    (581 V5 actuels : KEEP/REVIEW_OWNER/ORPHAN/REMOVE_CANDIDATE)
 *   - <prefix>-review-lists.json             (équivalent JSON consolidé)
 *
 * Usage : SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/seo/vlevel-g3-export-lists.ts [pg_id]
 * Réf : audit/vlevel-g3-dry-run-plaquette-de-frein-2026-06-06.md (dry-run).
 */
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

const PG_ID = Number(process.argv[2] || 402);
const GAMME = 'plaquette-de-frein';
const PREFIX = `audit/vlevel-g3-dry-run-${GAMME}`;

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// READ-ONLY helper : select paginé (contourne le cap 1000 lignes de supabase-js).
async function selectAll<T = any>(
  table: string,
  columns: string,
  apply: (q: any) => any = (q) => q,
): Promise<T[]> {
  const out: T[] = [];
  let from = 0;
  const size = 1000;
  for (;;) {
    const { data, error } = await apply(
      supabase.from(table).select(columns).range(from, from + size - 1),
    );
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    out.push(...(data as T[]));
    if (data.length < size) break;
    from += size;
  }
  return out;
}

async function selectIn<T = any>(
  table: string,
  columns: string,
  col: string,
  values: string[],
  apply: (q: any) => any = (q) => q,
): Promise<T[]> {
  const out: T[] = [];
  const uniq = [...new Set(values)];
  for (let i = 0; i < uniq.length; i += 200) {
    const batch = uniq.slice(i, i + 200);
    const { data, error } = await apply(
      supabase.from(table).select(columns).in(col, batch),
    );
    if (error) throw new Error(`${table}.in(${col}): ${error.message}`);
    out.push(...((data || []) as T[]));
  }
  return out;
}

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const COLS = [
  'pg_id', 'gamme', 'current_keyword_id', 'current_keyword', 'current_v_level',
  'type_id', 'marque', 'modele', 'modele_id', 'modele_parent', 'type_name',
  'type_fuel', 'relation', 'simulated_action', 'reason', 'source_type_id',
  'source_v_level', 'source_keyword', 'risk',
];
const toCsv = (rows: Record<string, unknown>[]) =>
  [COLS.join(','), ...rows.map((r) => COLS.map((c) => csvCell(r[c])).join(','))].join('\n') + '\n';

async function main() {
  console.log(`[g3-export] READ-ONLY export for pg_id=${PG_ID} (${GAMME})`);

  // 1. Keywords V5 actuels + classés (V2/V3/V4) de la gamme.
  const v5kw = await selectAll<any>('__seo_keywords', 'id, keyword, v_level, type_id, model, energy',
    (q) => q.eq('pg_id', PG_ID).eq('v_level', 'V5'));
  const clsKw = await selectAll<any>('__seo_keywords', 'id, keyword, v_level, type_id, model',
    (q) => q.eq('pg_id', PG_ID).in('v_level', ['V2', 'V3', 'V4']));
  const allTypeIdsInGamme = new Set<string>(
    await selectAll<any>('__seo_keywords', 'type_id', (q) => q.eq('pg_id', PG_ID).not('type_id', 'is', null))
      .then((rows) => rows.map((r) => String(r.type_id))));

  // 2. auto_type pour les type_ids V5 + classés.
  const v5TypeIds = v5kw.map((k) => String(k.type_id)).filter(Boolean);
  const clsTypeIds = clsKw.map((k) => String(k.type_id)).filter(Boolean);
  const typeRows = await selectIn<any>('auto_type',
    'type_id, type_modele_id, type_name, type_fuel, type_display',
    'type_id', [...v5TypeIds, ...clsTypeIds]);
  const typeById = new Map(typeRows.map((t) => [String(t.type_id), t]));

  // 3. classified modele_ids → parents → siblings ; + children.
  const classifiedModeleIds = new Set<string>();
  const sourceByModele = new Map<string, any>(); // modele_id → un keyword classé représentatif
  for (const k of clsKw) {
    const t = typeById.get(String(k.type_id));
    if (t?.type_modele_id) {
      const mid = String(t.type_modele_id);
      classifiedModeleIds.add(mid);
      if (!sourceByModele.has(mid)) sourceByModele.set(mid, k);
    }
  }
  const classModeleRows = await selectIn<any>('auto_modele',
    'modele_id, modele_parent, modele_name, modele_marque_id', 'modele_id', [...classifiedModeleIds]);
  const parents = new Set<number>();
  for (const m of classModeleRows) if (Number(m.modele_parent) !== 0) parents.add(Number(m.modele_parent));

  const siblingRows = await selectIn<any>('auto_modele',
    'modele_id, modele_parent, modele_name, modele_marque_id', 'modele_parent', [...parents].map(String));
  const childRows = await selectIn<any>('auto_modele',
    'modele_id, modele_parent, modele_name, modele_marque_id', 'modele_parent', [...classifiedModeleIds]);

  // relation map (union models) + parent->classified-source for attribution.
  const relByModele = new Map<string, 'sibling' | 'child'>();
  const sourceModeleByUnion = new Map<string, string>(); // union modele → a classified source modele
  const parentToClassified = new Map<number, string>();
  for (const m of classModeleRows) parentToClassified.set(Number(m.modele_parent), String(m.modele_id));
  for (const m of siblingRows) {
    const id = String(m.modele_id);
    if (classifiedModeleIds.has(id)) continue;
    relByModele.set(id, 'sibling');
    const src = parentToClassified.get(Number(m.modele_parent));
    if (src) sourceModeleByUnion.set(id, src);
  }
  for (const m of childRows) {
    const id = String(m.modele_id);
    if (classifiedModeleIds.has(id)) continue;
    relByModele.set(id, 'child');
    sourceModeleByUnion.set(id, String(m.modele_parent)); // parent = classified modele
  }

  // 4. modele + marque lookups (V5 models + union models).
  const allModeleIds = new Set<string>([
    ...v5kw.map((k) => typeById.get(String(k.type_id))?.type_modele_id).filter(Boolean).map(String),
    ...relByModele.keys(),
    ...classifiedModeleIds,
  ]);
  const modeleRows = await selectIn<any>('auto_modele',
    'modele_id, modele_parent, modele_name, modele_marque_id', 'modele_id', [...allModeleIds]);
  const modeleById = new Map(modeleRows.map((m) => [String(m.modele_id), m]));
  const marqueRows = await selectIn<any>('auto_marque', 'marque_id, marque_name', 'marque_id',
    modeleRows.map((m) => String(m.modele_marque_id)).filter(Boolean));
  const marqueById = new Map(marqueRows.map((mk) => [String(mk.marque_id), mk.marque_name]));
  const marqueOf = (mid?: string) => mid ? marqueById.get(String(modeleById.get(mid)?.modele_marque_id)) ?? '' : '';

  // ── LISTE 1+3 : classification des V5 actuels ──
  const fullRows: Record<string, unknown>[] = [];
  for (const k of v5kw) {
    const t = typeById.get(String(k.type_id));
    const mid = t?.type_modele_id ? String(t.type_modele_id) : '';
    const m = mid ? modeleById.get(mid) : undefined;
    let action: string, reason: string, risk: string, relation = '';
    if (!t || !m) { action = 'REVIEW_OWNER'; reason = 'type_id non joignable / orphan'; risk = 'data-quality'; }
    else if (Number(m.modele_parent) === 0) { action = 'REVIEW_OWNER'; reason = 'V5 sur modele root (pas de sibling meme-parent)'; risk = 'rule-nonconformant'; }
    else if (relByModele.has(mid)) { action = 'KEEP'; relation = relByModele.get(mid)!; reason = `conforme union (${relation})`; risk = 'low'; }
    else if (classifiedModeleIds.has(mid)) { action = 'REVIEW_OWNER'; reason = 'meme modele qu un vehicule cherche (autre motorisation) - ambiguite regle V5'; risk = 'rule-ambiguity'; }
    else { action = 'REMOVE_CANDIDATE'; reason = 'ni sibling ni enfant ni meme-modele d un vehicule classe'; risk = 'review'; }
    fullRows.push({
      pg_id: PG_ID, gamme: GAMME, current_keyword_id: k.id, current_keyword: k.keyword, current_v_level: 'V5',
      type_id: k.type_id, marque: marqueOf(mid), modele: m?.modele_name ?? k.model, modele_id: mid,
      modele_parent: m?.modele_parent ?? '', type_name: t?.type_name ?? '', type_fuel: t?.type_fuel ?? '',
      relation, simulated_action: action, reason, source_type_id: '', source_v_level: '', source_keyword: '', risk,
    });
  }
  const rootRows = fullRows.filter((r) => r.reason === 'V5 sur modele root (pas de sibling meme-parent)');

  // ── LISTE 2 : candidats union (ADD_CANDIDATE) ──
  const unionModeleIds = [...relByModele.keys()];
  const candTypeRows = await selectIn<any>('auto_type',
    'type_id, type_modele_id, type_name, type_fuel, type_display', 'type_modele_id', unionModeleIds,
    (q) => q.eq('type_display', '1'));
  const candRows: Record<string, unknown>[] = [];
  const seenCand = new Set<string>();
  for (const t of candTypeRows) {
    const tid = String(t.type_id);
    if (allTypeIdsInGamme.has(tid) || seenCand.has(tid)) continue; // skip si deja un niveau dans la gamme
    seenCand.add(tid);
    const mid = String(t.type_modele_id);
    const m = modeleById.get(mid);
    const rel = relByModele.get(mid) ?? '';
    const srcMid = sourceModeleByUnion.get(mid);
    const srcKw = srcMid ? sourceByModele.get(srcMid) : undefined;
    candRows.push({
      pg_id: PG_ID, gamme: GAMME, current_keyword_id: '', current_keyword: '', current_v_level: '',
      type_id: tid, marque: marqueOf(mid), modele: m?.modele_name ?? '', modele_id: mid,
      modele_parent: m?.modele_parent ?? '', type_name: t.type_name ?? '', type_fuel: t.type_fuel ?? '',
      relation: rel, simulated_action: 'ADD_CANDIDATE',
      reason: rel === 'child' ? 'enfant d un vehicule cherche, sans demande propre' : 'sibling meme-parent, sans demande propre',
      source_type_id: srcKw?.type_id ?? '', source_v_level: srcKw?.v_level ?? '', source_keyword: srcKw?.keyword ?? '',
      risk: rel === 'child' ? 'thin-content-R8' : 'low',
    });
  }

  // ── écriture (read-only DB ; écriture fichiers seulement) ──
  const root = path.resolve(__dirname, '../..');
  const write = (name: string, content: string) => {
    const p = path.join(root, name);
    fs.writeFileSync(p, content);
    return p;
  };
  write(`${PREFIX}-roots_review_owner.csv`, toCsv(rootRows));
  write(`${PREFIX}-union_add_candidates.csv`, toCsv(candRows));
  write(`${PREFIX}-v5_full_classification.csv`, toCsv(fullRows));
  const counts = {
    full: fullRows.length, roots: rootRows.length, candidates: candRows.length,
    keep: fullRows.filter((r) => r.simulated_action === 'KEEP').length,
    review_owner: fullRows.filter((r) => r.simulated_action === 'REVIEW_OWNER').length,
    remove_candidate: fullRows.filter((r) => r.simulated_action === 'REMOVE_CANDIDATE').length,
  };
  write(`${PREFIX}-review-lists.json`, JSON.stringify({
    pg_id: PG_ID, gamme: GAMME, generated_at: process.env.G3_DATE || 'manual', mutation_applied: false,
    counts, columns: COLS,
    roots_review_owner: rootRows, union_add_candidates: candRows, v5_full_classification: fullRows,
  }, null, 2) + '\n');

  console.log(`[g3-export] DONE (read-only). counts=${JSON.stringify(counts)}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

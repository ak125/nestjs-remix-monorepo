/**
 * vlevel-v3-pipeline.ts — Mécanique de DÉCISION V3 (READ-ONLY + DRY-RUN only).
 *
 * Automatise la PROCÉDURE (preuve + contrôle), JAMAIS la décision métier ni la mutation.
 * Pipeline : investigation/scoring -> decision-pack -> (owner review) -> validate -> dry-run.
 * L'apply RÉEL est volontairement NON IMPLÉMENTÉ (stub owner-gated qui n'écrit jamais en DB).
 *
 * Sous-commandes :
 *   decision-pack       --pg-id <id>       -> génère audit/vlevel-v3-decision-pack-<gamme>-<date>.{md,csv,json}
 *   decontaminate-pack  --pg-id <id>       -> déclasse la pollution cross-gamme : decision-pack + package SQL gardé
 *   reelection-pack     --pg-id <id>       -> réélit V2/V3/V4 (miroir canonique @repo/seo-roles) : decision-pack + SQL gardé
 *   validate-pack  --file <pack.csv>       -> contrôles d'intégrité avant tout apply
 *   apply-pack     --file <pack.csv> --dry-run  -> before/after + UPDATE/rollback SQL (ZÉRO écriture)
 *   apply-pack     --file <pack.csv> --apply --owner-approved -> REFUSÉ (owner-gated, hors périmètre)
 *
 * STRICT : uniquement .select() (lecture). Aucun insert/update/delete/rpc-write, aucun recalcul v_level.
 * Réf : audit/vlevel-v3-decision-pack-2026-06-06.md + audit/vlevel-investigation/web-evidence.json.
 */
import * as fs from 'fs';
import * as path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
// invariants V-Level canoniques (SoT) — mirrorés par reelection-pack, JAMAIS réinventés.
import { VLEVEL_V2_CAP, vLevelGroupKey, modelMatchKey } from '@repo/seo-roles';

const ROOT = process.cwd();
const AUDIT_DIR = path.join(ROOT, 'audit'); // sortie runtime (decision-packs), non versionnée par défaut
// Seed de preuves web = CONFIG du script -> vit sous scripts/seo/ (alimenté manuellement, jamais scraping auto)
const SEED_FILE = path.join(ROOT, 'scripts', 'seo', 'vlevel-v3-web-evidence.json');
const DATE = process.env.PACK_DATE || '2026-06-06'; // déterministe (Date.now indisponible / non reproductible)
// Terme distinctif par gamme (anti re-contamination cross-gamme). Freinage : la pièce (partagent « frein »).
// Filtration : le médium (partagent « filtre »). Termes validés ≥95% match (sauf habitacle, voir runbook
// `.claude/knowledge/ops/vlevel-v3-gamme-procedure.md`). Convergence vers @repo/seo-roles GAMME_PART_TERMS = suivi.
const GAMME_PARTS: Record<number, RegExp> = {
  // FREINAGE
  402: /plaquette/i,
  82: /disque/i,
  124: /cable|câble/i,
  // FILTRATION (validé 2026-06-07 : huile 99.8% · carburant 99.9% · air 100% · boîte 100% · habitacle|pollen 90%)
  7: /huile/i,
  424: /habitacle|pollen/i,
  9: /carburant|gasoil|gazole/i,
  8: /\bair\b/i,
  416: /bo[iî]te/i,
};

// ---- env (réutilise backend/.env si vars absentes ; pas de DATABASE_URL dans ce repo) ----
function loadEnv(): void {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const envPath = path.join(ROOT, 'backend', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*(SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)\s*=\s*(.+)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

function sb(): SupabaseClient {
  loadEnv();
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// pagination offset : PostgREST cape les réponses à `max-rows` (1000) côté serveur — .range(0,N) NE
// contourne PAS ce cap. Paginer par pages de 1000. `orderByUniqueKey` DOIT être une colonne UNIQUE
// (idéalement la PK) : un order non-unique rend l'offset pagination instable (saut/duplication aux
// frontières de page). Sinon perte silencieuse de lignes.
async function selectAllEq<T = any>(s: SupabaseClient, table: string, cols: string, col: string, value: any, orderByUniqueKey: string): Promise<T[]> {
  const out: T[] = [];
  const PAGE = 1000;
  for (let off = 0; ; off += PAGE) {
    const { data, error } = await s.from(table).select(cols).eq(col, value).order(orderByUniqueKey, { ascending: true }).range(off, off + PAGE - 1);
    if (error) throw new Error(`${table}.range(${off}): ${error.message}`);
    const batch = (data || []) as T[];
    out.push(...batch);
    if (batch.length < PAGE) break;
  }
  return out;
}

async function selectIn<T = any>(s: SupabaseClient, table: string, cols: string, col: string, values: string[]): Promise<T[]> {
  const out: T[] = [];
  const uniq = [...new Set(values.filter((v) => v != null && v !== ''))];
  for (let i = 0; i < uniq.length; i += 200) {
    const { data, error } = await s.from(table).select(cols).in(col, uniq.slice(i, i + 200));
    if (error) throw new Error(`${table}.in(${col}): ${error.message}`);
    out.push(...((data || []) as T[]));
  }
  return out;
}

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const flag = (name: string): boolean => process.argv.includes(name);

const ENERGY_RE = /(\bdci\b|\bhdi\b|tdci|cdti|\btdi\b|\bdti\b|bluehdi|\btce\b|\bvti\b|\bthp\b|essence|diesel|\bgpl\b|16v|\bgti\b|\d[.,\-]\d)/i;
const SPORT_RE = /(\bgti\b|\brs\b|\bgt\b|sport|\bvts\b|\bgsi\b|cupra|\bst\b|\bs16\b|\brc\b)/i;
const DIESEL_RE = /(dci|hdi|tdci|cdti|tdi|dti|bluehdi|multijet|jtd|\bd\b|sdi)/i;
const slugDisp = (alias?: string): string | null => (alias ? (alias.match(/^(\d-\d)/)?.[1] ?? null) : null);

function median<T>(arr: T[], key: (x: T) => number): T | null {
  if (!arr.length) return null;
  const sorted = [...arr].sort((a, b) => key(a) - key(b));
  return sorted[Math.floor((sorted.length - 1) / 2)];
}

type Champ = {
  id: any; keyword: string; volume: number; type_id: string | null; v_level: string;
};

async function decisionPack(pgId: number): Promise<void> {
  const s = sb();
  const seed = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
  const partRe = GAMME_PARTS[pgId];

  const gammeRow = (await selectIn<any>(s, 'pieces_gamme', 'pg_id,pg_alias', 'pg_id', [String(pgId)]))[0];
  const gamme = gammeRow?.pg_alias ?? `pg-${pgId}`;

  // 1. champions V2/V3 vehicle
  const { data: kws, error } = await s
    .from('__seo_keywords')
    .select('id,keyword,volume,type_id,v_level,energy')
    .eq('pg_id', pgId).eq('type', 'vehicle').in('v_level', ['V2', 'V3']).range(0, 4999);
  if (error) throw new Error(`__seo_keywords: ${error.message}`);

  // dedup per (type_id) best level+vol ; keep null type_id rows individually
  const lvlRank = (v: string) => (v === 'V2' ? 2 : 3);
  const byTid = new Map<string, Champ>();
  const nulls: Champ[] = [];
  for (const k of (kws as any[])) {
    if (k.type_id == null) { nulls.push(k); continue; }
    const key = String(k.type_id);
    const prev = byTid.get(key);
    if (!prev || lvlRank(k.v_level) < lvlRank(prev.v_level) || (k.v_level === prev.v_level && k.volume > prev.volume))
      byTid.set(key, k);
  }
  const champs = [...byTid.values(), ...nulls];

  // résolution des champions type_id NULL via seed data-driven (keyword -> {modele_id,type_id,...})
  // -> pas de parsing fragile, curé manuellement (investigation web), reproductible.
  const nrSeed: Record<string, any> = seed.null_resolution_by_keyword || {};
  const nrOf = (c: Champ) => (c.type_id ? null : nrSeed[c.keyword] || null);
  const nrTypeIds = champs.map((c) => nrOf(c)?.type_id).filter(Boolean).map(String);
  const nrModeleIds = champs.map((c) => nrOf(c)?.modele_id).filter(Boolean).map(String);

  // 2. resolve type_id -> type -> modele -> marque (champions + résolutions NULL du seed)
  const tids = [...new Set([...(champs.map((c) => c.type_id).filter(Boolean) as string[]), ...nrTypeIds])];
  const types = await selectIn<any>(s, 'auto_type', 'type_id,type_modele_id,type_name,type_fuel,type_display,type_alias,type_power_ps', 'type_id', tids);
  const typeMap = new Map(types.map((t) => [String(t.type_id), t]));
  const modeleIds = [...new Set([...types.map((t) => String(t.type_modele_id)).filter((x) => x && x !== 'null'), ...nrModeleIds])];
  const modeles = await selectIn<any>(s, 'auto_modele', 'modele_id,modele_name,modele_alias,modele_marque_id', 'modele_id', modeleIds);
  const modMap = new Map(modeles.map((m) => [String(m.modele_id), m]));
  const marqueIds = [...new Set(modeles.map((m) => String(m.modele_marque_id)))];
  const marques = await selectIn<any>(s, 'auto_marque', 'marque_id,marque_alias,marque_name', 'marque_id', marqueIds);
  const mqMap = new Map(marques.map((m) => [String(m.marque_id), m]));

  // 3. diesels per modele (median fallback)
  const diesels = await selectIn<any>(s, 'auto_type', 'type_id,type_modele_id,type_alias,type_power_ps,type_fuel,type_display', 'type_modele_id', modeleIds);
  const dieselByMod = new Map<string, any[]>();
  for (const d of diesels) {
    if (d.type_display !== '1' || !DIESEL_RE.test(d.type_alias || '') || !/diesel/i.test(d.type_fuel || '')) continue;
    const arr = dieselByMod.get(String(d.type_modele_id)) || [];
    arr.push(d); dieselByMod.set(String(d.type_modele_id), arr);
  }
  const medianDiesel = (modId: string) => {
    const ds = dieselByMod.get(modId) || [];
    if (!ds.length) return null;
    // most common displacement, then median power
    const byDisp = new Map<string, any[]>();
    for (const d of ds) { const k = slugDisp(d.type_alias) || 'x'; (byDisp.get(k) || byDisp.set(k, []).get(k)!).push(d); }
    const main = [...byDisp.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))[0][1];
    return median(main, (d) => Number(d.type_power_ps) || 0);
  };

  const url = (alias: string, mAlias: string, mId: string, mqAlias: string, mqId: string, tid: string) =>
    `/pieces/${gamme}-${pgId}/${mqAlias}-${mqId}/${mAlias}-${mId}/${alias}-${tid}.html`;

  const rows = champs.map((c) => {
    const t = c.type_id ? typeMap.get(String(c.type_id)) : null;
    const m = t ? modMap.get(String(t.type_modele_id)) : null;
    const mq = m ? mqMap.get(String(m.modele_marque_id)) : null;
    const renderable = t && t.type_display === '1' && m && mq;
    const curUrl = renderable ? url(t.type_alias, m.modele_alias, m.modele_id, mq.marque_alias, mq.marque_id, String(c.type_id)) : '';
    const offGamme = partRe && !partRe.test(c.keyword);

    let recId = '', recUrl = '', recLabel = '', source = '', conf = 0, v3type = '', decision = '', reason = '', risk = '';

    // explicit-keyword seed (308 gti, clio 3 1.5 dci…)
    const ek = seed.explicit_keyword?.[c.keyword];
    if (seed.defer_catalog_gap?.includes(c.keyword)) {
      decision = 'DEFER_CATALOG_GAP'; reason = 'modèle/véhicule introuvable au catalogue'; risk = 'page inexistante';
    } else if (c.type_id && seed.defer_submodel_remap?.[String(c.type_id)]) {
      decision = 'DEFER_REMAP'; reason = seed.defer_submodel_remap[String(c.type_id)]; risk = 'mauvais sous-modèle';
    } else if (c.type_id && !renderable) {
      decision = 'DEFER_REMAP'; reason = 'orphan / non rendable (type_id absent auto_type ou type_display!=1)'; risk = 'page non rendable';
    } else if (!c.type_id) {
      const nr = nrOf(c);
      if (nr) {
        const rt = typeMap.get(String(nr.type_id));
        const rm = rt ? modMap.get(String(rt.type_modele_id)) : modMap.get(String(nr.modele_id));
        const rmq = rm ? mqMap.get(String(rm.modele_marque_id)) : null;
        recId = String(nr.type_id); recLabel = nr.label || ''; conf = nr.confidence || 0; source = nr.source || 'seed';
        v3type = 'DIESEL_DEFAULT_RESOLVED_NULL';
        if (rt && rt.type_display === '1' && rm && rmq) recUrl = url(rt.type_alias, rm.modele_alias, rm.modele_id, rmq.marque_alias, rmq.marque_id, recId);
        decision = conf >= 78 && recUrl ? 'APPROVE_CANDIDATE' : 'REVIEW_OWNER';
        reason = 'type_id NULL résolu via seed (investigation web curée)';
      } else {
        decision = 'REVIEW_OWNER'; reason = 'type_id NULL — investigation requise (voir resolution-queue)'; risk = 'non mappé';
      }
    } else if (ek) {
      recId = ek.type_id; v3type = ek.v3_type; conf = ek.confidence; source = 'web(explicit)'; reason = ek.reason;
      recUrl = renderable && t.type_alias ? url(t.type_alias, m.modele_alias, m.modele_id, mq.marque_alias, mq.marque_id, recId) : curUrl;
      decision = ek.owner_hint === 'APPROVE_DISTINCT' ? 'APPROVE_DISTINCT_CANDIDATE' : 'REVIEW_OWNER';
    } else if (SPORT_RE.test(c.keyword) && !DIESEL_RE.test(c.keyword)) {
      v3type = 'EXPLICIT_PETROL_PERFORMANCE'; recId = String(c.type_id); recUrl = curUrl; conf = 70;
      decision = 'APPROVE_DISTINCT_CANDIDATE'; reason = 'version sportive essence explicite -> V3 distinct';
    } else if (ENERGY_RE.test(c.keyword)) {
      // énergie explicite (ex. 1.5 dci, 1.6 hdi) -> garder le véhicule explicite
      v3type = DIESEL_RE.test(c.keyword) ? 'DIESEL_EXPLICIT' : 'PETROL_EXPLICIT';
      recId = String(c.type_id); recUrl = curUrl; conf = 60;
      decision = v3type === 'PETROL_EXPLICIT' ? 'APPROVE_DISTINCT_CANDIDATE' : 'APPROVE_CANDIDATE';
      reason = 'motorisation explicite dans le keyword';
    } else {
      // modèle-seul -> DIESEL PAR DÉFAUT
      v3type = 'DIESEL_DEFAULT';
      if (seed.review_keyword?.[c.keyword]) { decision = 'REVIEW_OWNER'; reason = seed.review_keyword[c.keyword]; }
      const web = seed.diesel_default_by_modele?.[String(t.type_modele_id)];
      const md = medianDiesel(String(t.type_modele_id));
      if (web) {
        recId = web.type_id; recLabel = web.label; conf = web.confidence; source = web.source;
        if (!decision) decision = conf >= 78 ? 'APPROVE_CANDIDATE' : 'REVIEW_OWNER';
      } else if (md) {
        recId = String(md.type_id); recLabel = `${md.type_alias} ${md.type_power_ps}ch (médiane)`; conf = 55; source = 'median_db';
        if (!decision) decision = 'REVIEW_OWNER';
        reason = reason || 'fallback médiane DB (puissance non web-confirmée)';
      } else {
        recId = String(c.type_id); recUrl = curUrl; conf = 40; source = 'no_diesel';
        if (!decision) decision = 'REVIEW_OWNER';
        reason = reason || 'modèle sans diesel (city-car) -> essence conservée';
      }
      if (recId && !recUrl) {
        // build recommended URL: need recommended type's alias -> fetch lazily via diesel list
        const recT = (dieselByMod.get(String(t.type_modele_id)) || []).find((d) => String(d.type_id) === recId)
          || (recId === String(c.type_id) ? t : null);
        recUrl = recT && recT.type_alias ? url(recT.type_alias, m.modele_alias, m.modele_id, mq.marque_alias, mq.marque_id, recId) : '';
      }
    }

    // garde-fou GLOBAL cross-gamme : un keyword d'une autre pièce ne peut jamais être APPROVE
    if (offGamme && /^APPROVE/.test(decision)) {
      decision = 'REVIEW_OWNER';
      reason = (reason ? reason + ' ; ' : '') + 'keyword appartient à une autre gamme (cross-gamme)';
    }
    if (offGamme && !risk) risk = 'cross-gamme (keyword autre pièce)';

    return {
      keyword: c.keyword, pg_id: pgId, gamme, volume: c.volume,
      current_type_id: c.type_id ?? '', current_url: curUrl,
      recommended_type_id: recId, recommended_url: recUrl, recommended_label: recLabel,
      decision_source: source, confidence: conf, owner_decision: decision, v3_type: v3type,
      reason, risk,
    };
  });

  rows.sort((a, b) => b.volume - a.volume || a.keyword.localeCompare(b.keyword));

  const base = path.join(AUDIT_DIR, `vlevel-v3-decision-pack-${gamme}-${DATE}`);
  // CSV
  const cols = ['keyword', 'pg_id', 'gamme', 'volume', 'current_type_id', 'current_url', 'recommended_type_id', 'recommended_url', 'decision_source', 'confidence', 'owner_decision', 'v3_type', 'reason', 'risk'];
  const csv = [cols.join(';'), ...rows.map((r) => cols.map((c) => String((r as any)[c] ?? '').replace(/;/g, ',')).join(';'))].join('\n');
  fs.writeFileSync(`${base}.csv`, csv + '\n');
  fs.writeFileSync(`${base}.json`, JSON.stringify({ pg_id: pgId, gamme, generated: DATE, mutation: false, rows }, null, 2));
  // MD summary
  const counts = rows.reduce((a, r) => ((a[r.owner_decision] = (a[r.owner_decision] || 0) + 1), a), {} as Record<string, number>);
  const md = [
    `# Decision-pack V3 (PROPOSITION auto) — ${gamme} (pg ${pgId}) · ${DATE}`,
    '',
    '> READ-ONLY. Le script PROPOSE `owner_decision` (suffixe _CANDIDATE), il ne valide pas à la place du owner.',
    '> Aucune mutation. Éditer la colonne `owner_decision` (APPROVE/APPROVE_DISTINCT/REVIEW/DEFER/REJECT) puis validate-pack.',
    '',
    `Lignes : ${rows.length}. Répartition : ${Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(' · ')}`,
    '',
    '| keyword | vol | current | recommended | conf | owner_decision |',
    '|---|---|---|---|---|---|',
    ...rows.map((r) => `| ${r.keyword} | ${r.volume} | ${r.current_type_id || 'NULL'} | ${r.recommended_type_id || '—'} ${r.recommended_label ? '('+r.recommended_label+')' : ''} | ${r.confidence} | ${r.owner_decision} |`),
  ].join('\n');
  fs.writeFileSync(`${base}.md`, md + '\n');
  console.log(`✅ decision-pack généré (READ-ONLY): ${base}.{md,csv,json}\n   ${rows.length} lignes — ${Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(' · ')}`);
}

// ---- helpers génériques modèle-seul ----
const ROMAN: Record<string, string> = { '1': 'i', '2': 'ii', '3': 'iii', '4': 'iv', '5': 'v', '6': 'vi', '7': 'vii' };
// génération détectée dans le keyword (ex. "clio 2" -> ii). Détection générique, pas de hardcode.
function kwGen(kw: string): string | null {
  const m = kw.toLowerCase().match(/\b(clio|megane|m[eé]gane|sc[eé]nic|golf|polo|astra|corsa|laguna|twingo|kangoo|punto|fiesta|focus)\s+([1-7])\b/);
  return m ? ROMAN[m[2]] : null;
}
// génération romaine présente dans le nom modèle (ex. "CLIO III" -> iii)
function modGen(name: string): string | null {
  const m = (name || '').toLowerCase().match(/\b(vii|vi|iv|iii|ii|v|i)\b/);
  return m ? m[1] : null;
}
const piecesUrl = (gamme: string, pg: number, mqA: string, mqId: any, mA: string, mId: any, tA: string, tid: any) =>
  `/pieces/${gamme}-${pg}/${mqA}-${mqId}/${mA}-${mId}/${tA}-${tid}.html`;

// generics-pack : re-cible TOUS les génériques modèle-seul (V2/V3/V4) des modèles seed-confirmés
// vers leur diesel par défaut. mismatch génération texte/modèle -> REMAP_REVIEW (hors apply).
async function genericsPack(pgId: number): Promise<void> {
  const s = sb();
  const seed = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
  const reps: Record<string, any> = seed.diesel_default_by_modele || {};
  const gamme = (await selectIn<any>(s, 'pieces_gamme', 'pg_id,pg_alias', 'pg_id', [String(pgId)]))[0]?.pg_alias || `pg-${pgId}`;
  const TOKEN = /(dci|hdi|tdci|cdti|tdi|dti|bluehdi|tce|vti|thp|essence|diesel|gpl|16v|gti|\brs\b|sport|\d[.,\-]\d)/i;

  const { data: kws, error } = await s.from('__seo_keywords')
    .select('keyword,v_level,type_id,volume').eq('pg_id', pgId).eq('type', 'vehicle').in('v_level', ['V2', 'V3', 'V4']).range(0, 9999);
  if (error) throw new Error(`__seo_keywords: ${error.message}`);
  // gamme-term-aware : ne re-cible que les keywords de CETTE gamme (terme propre) — exclut la pollution
  // cross-gamme / REVIEW (ex. « frein 207 » dans plaquette). No-op sur une gamme propre (tous matchent son terme).
  const ownRe = GAMME_PARTS[pgId];
  const generics = (kws as any[]).filter((k) => k.type_id != null && !TOKEN.test(k.keyword) && (!ownRe || ownRe.test(k.keyword)));

  const curTids = generics.map((k) => String(k.type_id));
  const repTids = Object.values(reps).map((r: any) => String(r.type_id));
  const types = await selectIn<any>(s, 'auto_type', 'type_id,type_modele_id,type_alias,type_display', 'type_id', [...new Set([...curTids, ...repTids])]);
  const typeMap = new Map(types.map((t) => [String(t.type_id), t]));
  const modeleIds = [...new Set(types.map((t) => String(t.type_modele_id)).filter((x) => x && x !== 'null'))];
  const modeles = await selectIn<any>(s, 'auto_modele', 'modele_id,modele_name,modele_alias,modele_marque_id', 'modele_id', modeleIds);
  const modMap = new Map(modeles.map((m) => [String(m.modele_id), m]));
  const marques = await selectIn<any>(s, 'auto_marque', 'marque_id,marque_alias', 'marque_id', [...new Set(modeles.map((m) => String(m.modele_marque_id)))]);
  const mqMap = new Map(marques.map((m) => [String(m.marque_id), m]));

  const rows = generics.map((k) => {
    const t = typeMap.get(String(k.type_id)); if (!t) return null;
    const modId = String(t.type_modele_id); const rep = reps[modId]; if (!rep) return null; // modèles seed-confirmés seulement
    const m = modMap.get(modId); const mq = m ? mqMap.get(String(m.modele_marque_id)) : null;
    const rt = typeMap.get(String(rep.type_id)); const rm = rt ? modMap.get(String(rt.type_modele_id)) : null; const rmq = rm ? mqMap.get(String(rm.modele_marque_id)) : null;
    const newUrl = rt && rt.type_display === '1' && rm && rmq ? piecesUrl(gamme, pgId, rmq.marque_alias, rmq.marque_id, rm.modele_alias, rm.modele_id, rt.type_alias, rep.type_id) : '';
    const kg = kwGen(k.keyword); const mg = modGen(m?.modele_name || '');
    let decision: string, reason: string;
    if (kg && mg && kg !== mg) { decision = 'REMAP_REVIEW'; reason = `texte génération ${kg.toUpperCase()} != modèle mappé ${m?.modele_name} (contamination) -> remap manuel, hors règle diesel`; }
    else if (String(k.type_id) !== String(rep.type_id)) { decision = 'APPROVE_CANDIDATE'; reason = 'générique modèle-seul -> cible diesel par défaut'; }
    else { decision = 'KEEP'; reason = 'déjà sur la cible diesel'; }
    return { keyword: k.keyword, pg_id: pgId, gamme, v_level: k.v_level, volume: k.volume,
      current_type_id: k.type_id, recommended_type_id: rep.type_id, recommended_url: newUrl,
      recommended_label: rep.label, decision_source: rep.source, confidence: rep.confidence, owner_decision: decision, reason };
  }).filter(Boolean) as any[];

  rows.sort((a, b) => String(a.recommended_label).localeCompare(String(b.recommended_label)) || a.v_level.localeCompare(b.v_level) || a.keyword.localeCompare(b.keyword));
  const base = path.join(AUDIT_DIR, `vlevel-v3-generics-pack-${gamme}-${DATE}`);
  const cols = ['keyword', 'pg_id', 'gamme', 'v_level', 'volume', 'current_type_id', 'recommended_type_id', 'recommended_url', 'decision_source', 'confidence', 'owner_decision', 'reason'];
  fs.writeFileSync(`${base}.csv`, [cols.join(';'), ...rows.map((r) => cols.map((c) => String(r[c] ?? '').replace(/;/g, ',')).join(';'))].join('\n') + '\n');
  fs.writeFileSync(`${base}.json`, JSON.stringify({ pg_id: pgId, gamme, generated: DATE, mutation: false, rows }, null, 2));
  const counts = rows.reduce((a: any, r) => ((a[r.owner_decision] = (a[r.owner_decision] || 0) + 1), a), {});
  console.log(`✅ generics-pack généré (READ-ONLY): ${base}.{csv,json}\n   ${rows.length} lignes — ${Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(' · ')}`);
}

// ---- décontamination cross-gamme ----
// decontaminate-pack : déclasse (v_level -> NULL) les keywords d'une AUTRE pièce présents dans cette
// gamme (pollution cross-gamme). Le déclassement RETIRE la pollution de l'élection champion SANS
// supprimer la ligne ni toucher la gamme d'origine (aucune fusion, aucune suppression — doctrine).
// Sécurité : ne déclasse QUE les keywords aussi présents dans leur gamme cible (sinon REVIEW_ORPHAN).
// READ-ONLY : émet decision-pack + package SQL gardé (snapshot embarqué = apply set-based + rollback exact).
function sqlLit(s: string): string {
  return `'${String(s).replace(/'/g, "''")}'`;
}

async function decontaminatePack(pgId: number): Promise<void> {
  const s = sb();
  const ownRe = GAMME_PARTS[pgId];
  if (!ownRe) throw new Error(`pas de regex gamme pour pg ${pgId} (GAMME_PARTS)`);
  const others = Object.entries(GAMME_PARTS)
    .filter(([id]) => Number(id) !== pgId)
    .map(([id, re]) => [Number(id), re] as [number, RegExp]);
  const gamme = (await selectIn<any>(s, 'pieces_gamme', 'pg_id,pg_alias', 'pg_id', [String(pgId)]))[0]?.pg_alias || `pg-${pgId}`;

  // lecture PAGINÉE (cap PostgREST 1000) ordonnée sur la PK `id` (unique) -> pagination stable,
  // sans dépendre d'un index composite implicite. Sinon perte silencieuse de lignes sur grandes gammes.
  const kws = await selectAllEq<any>(s, '__seo_keywords', 'keyword,type,v_level,type_id,volume', 'pg_id', pgId, 'id');

  // classification : KEEP (own) / CROSS_GAMME (autre pièce) / REVIEW (ni l'un ni l'autre)
  const classify = (kw: string): { cls: 'KEEP' | 'CROSS' | 'REVIEW'; target: number | null } => {
    if (ownRe.test(kw)) return { cls: 'KEEP', target: null };
    for (const [oid, ore] of others) if (ore.test(kw)) return { cls: 'CROSS', target: oid };
    return { cls: 'REVIEW', target: null };
  };

  const all = (kws as any[]).map((k) => {
    const c = classify(k.keyword);
    let decision: string;
    if (c.cls === 'KEEP') decision = 'KEEP';
    else if (c.cls === 'REVIEW') decision = 'REVIEW_OWNER';
    else decision = k.v_level ? 'MOVE_DECLASSIFY' : 'CROSS_GAMME_NOOP'; // déjà NULL = aucun rôle V-Level
    return {
      keyword: k.keyword, type: k.type, v_level: k.v_level ?? '', volume: k.volume,
      current_type_id: k.type_id ?? '', cross_gamme_target: c.target ?? '', owner_decision: decision,
    };
  });

  // sécurité réversibilité : ne déclasser QUE si le keyword existe dans sa gamme cible (sinon on retirerait
  // la seule trace V-Level du keyword -> REVIEW_ORPHAN, hors apply).
  const moves = all.filter((r) => r.owner_decision === 'MOVE_DECLASSIFY');
  const byTarget = new Map<number, string[]>();
  for (const r of moves) {
    const t = Number(r.cross_gamme_target);
    (byTarget.get(t) || byTarget.set(t, []).get(t)!).push(r.keyword);
  }
  const presentInTarget = new Set<string>(); // `${target}::${keyword}`
  for (const [tg, kwList] of byTarget) {
    const uniq = [...new Set(kwList)];
    for (let i = 0; i < uniq.length; i += 200) {
      const { data, error: e2 } = await s
        .from('__seo_keywords').select('keyword').eq('pg_id', tg).in('keyword', uniq.slice(i, i + 200));
      if (e2) throw new Error(`presence pg ${tg}: ${e2.message}`);
      for (const row of (data as any[])) presentInTarget.add(`${tg}::${row.keyword}`);
    }
  }
  for (const r of moves) {
    if (!presentInTarget.has(`${r.cross_gamme_target}::${r.keyword}`)) r.owner_decision = 'REVIEW_ORPHAN';
  }
  const declassify = moves.filter((r) => r.owner_decision === 'MOVE_DECLASSIFY'); // set final (réversible prouvé)
  declassify.sort((a, b) =>
    String(a.v_level).localeCompare(String(b.v_level)) || b.volume - a.volume || a.keyword.localeCompare(b.keyword));

  // --- artefacts ---
  const counts = all.reduce((acc: Record<string, number>, r) => ((acc[r.owner_decision] = (acc[r.owner_decision] || 0) + 1), acc), {});
  const base = path.join(AUDIT_DIR, `vlevel-decontaminate-${gamme}-${DATE}`);

  // CSV (toutes les lignes classées)
  const cols = ['keyword', 'type', 'v_level', 'volume', 'current_type_id', 'cross_gamme_target', 'owner_decision'];
  fs.writeFileSync(`${base}.csv`,
    [cols.join(';'), ...all.map((r) => cols.map((c) => String((r as any)[c] ?? '').replace(/;/g, ',')).join(';'))].join('\n') + '\n');
  fs.writeFileSync(`${base}.json`, JSON.stringify({ pg_id: pgId, gamme, generated: DATE, mutation: false, counts, declassify_count: declassify.length, rows: all }, null, 2));

  // package SQL gardé (snapshot embarqué) — ZÉRO mutation par le script ; exécution owner-gated séparée
  // ownTerm = terme propre de la gamme (pollution = champion ne le mentionnant pas). contamTerm = label
  // de la pièce dominante polluante (informatif). Le vrai garde = VALUES + ROW_COUNT exact (term-indépendant).
  const ownTerm = ownRe.source.split('|')[0];
  const domTarget = [...declassify.reduce((m, r) => m.set(Number(r.cross_gamme_target), (m.get(Number(r.cross_gamme_target)) || 0) + 1), new Map<number, number>())]
    .sort((a, b) => b[1] - a[1])[0]?.[0];
  const contamTerm = (domTarget && GAMME_PARTS[domTarget]?.source.split('|')[0]) || 'autre-piece';
  const valuesList = declassify.map((r) => `    (${sqlLit(r.keyword)}, ${sqlLit(r.v_level)})`).join(',\n');
  const sql = [
    `-- ====================================================================`,
    `-- V-LEVEL DÉCONTAMINATION cross-gamme — ${gamme} (pg ${pgId}) · ${DATE}`,
    `-- Déclasse (v_level -> NULL) ${declassify.length} keywords « ${contamTerm} » présents dans « ${gamme} »,`,
    `-- TOUS représentés dans leur gamme d'origine (sécurité réversibilité vérifiée).`,
    `-- OWNER-GATED · RÉVERSIBLE · ZÉRO PROD DIRECT · GÉNÉRÉ (ne pas éditer à la main : régénérer).`,
    `-- Doctrine : aucune suppression de ligne, aucune fusion. Déclassement seul = retire la pollution`,
    `-- de l'élection champion ${gamme} sans toucher la gamme d'origine. Snapshot embarqué = rollback exact.`,
    `-- ====================================================================`,
    ``,
    `-- ÉTAPE 0 — BEFORE (pollution des champions ${gamme} = champion ne mentionnant pas « ${ownTerm} ») :`,
    `SELECT v_level, count(*) AS total,`,
    `  count(*) FILTER (WHERE keyword NOT ILIKE '%${ownTerm}%') AS pollution`,
    `FROM "__seo_keywords" WHERE pg_id=${pgId} AND v_level IN ('V2','V3') GROUP BY v_level ORDER BY v_level;`,
    ``,
    `-- ÉTAPE 1 — APPLY (transaction gardée ; COMMIT seulement après vérif AFTER=0) :`,
    `BEGIN;`,
    `DO $$`,
    `DECLARE n int;`,
    `BEGIN`,
    `  UPDATE "__seo_keywords" k SET v_level = NULL`,
    `  FROM (VALUES`,
    valuesList,
    `  ) AS s(keyword, v_level)`,
    `  WHERE k.pg_id = ${pgId} AND k.keyword = s.keyword AND k.v_level = s.v_level;`,
    `  GET DIAGNOSTICS n = ROW_COUNT;`,
    `  IF n <> ${declassify.length} THEN`,
    `    RAISE EXCEPTION 'scope mismatch: % lignes déclassées (attendu ${declassify.length}) — STOP, rien ne doit committer', n;`,
    `  END IF;`,
    `  RAISE NOTICE 'OK: % keywords cross-gamme déclassés (v_level -> NULL)', n;`,
    `END $$;`,
    ``,
    `-- vérif AFTER (doit montrer pollution_restante=0 en V2/V3) :`,
    `SELECT v_level, count(*) AS total,`,
    `  count(*) FILTER (WHERE keyword NOT ILIKE '%${ownTerm}%') AS pollution_restante`,
    `FROM "__seo_keywords" WHERE pg_id=${pgId} AND v_level IN ('V2','V3') GROUP BY v_level ORDER BY v_level;`,
    ``,
    `-- COMMIT;   -- décommenter si pollution_restante=0 partout. SINON : ROLLBACK;`,
    ``,
    `-- ÉTAPE 2 — ROLLBACK (réversible ; restaure le v_level EXACT depuis le snapshot embarqué) :`,
    `-- BEGIN;`,
    `-- UPDATE "__seo_keywords" k SET v_level = s.v_level`,
    `-- FROM (VALUES`,
    ...declassify.map((r, i) => `--     (${sqlLit(r.keyword)}, ${sqlLit(r.v_level)})${i < declassify.length - 1 ? ',' : ''}`),
    `-- ) AS s(keyword, v_level)`,
    `-- WHERE k.pg_id = ${pgId} AND k.keyword = s.keyword AND k.v_level IS NULL;`,
    `-- COMMIT;`,
    ``,
    `-- ÉTAPE 3 — RE-ÉLECTION champions ${gamme} (séparé, NON inclus) : après décontamination, ré-élire`,
    `-- les vrais champions ${gamme} depuis ses propres keywords (modèle disque appliqué). Owner-gated.`,
    ``,
  ].join('\n');
  fs.writeFileSync(`${base}.sql`, sql);

  // MD résumé
  const md = [
    `# Décontamination cross-gamme (PROPOSITION) — ${gamme} (pg ${pgId}) · ${DATE}`,
    ``,
    `> READ-ONLY. Le script PROPOSE le déclassement des keywords cross-gamme. Aucune mutation.`,
    `> Mécanisme = déclassement (v_level -> NULL), **pas** de suppression de ligne ni de fusion.`,
    ``,
    `Lignes pg ${pgId} : ${all.length}. Répartition : ${Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(' · ')}`,
    ``,
    `**Déclassables (réversibilité prouvée, présents dans gamme cible) : ${declassify.length}**`,
    `Package SQL gardé : \`${path.basename(base)}.sql\` (guard ROW_COUNT=${declassify.length}, snapshot embarqué).`,
    ``,
    `| owner_decision | sens |`,
    `|---|---|`,
    `| KEEP | keyword « ${ownRe.source} » légitime de la gamme |`,
    `| MOVE_DECLASSIFY | pollution cross-gamme avec v_level -> déclasser (réversible) |`,
    `| CROSS_GAMME_NOOP | pollution cross-gamme déjà v_level NULL -> aucun rôle V-Level |`,
    `| REVIEW_ORPHAN | pollution NON représentée dans la gamme cible -> ne pas déclasser (prudence) |`,
    `| REVIEW_OWNER | ni la gamme ni une autre pièce identifiée -> arbitrage owner |`,
    ``,
  ].join('\n');
  fs.writeFileSync(`${base}.md`, md);

  console.log(`✅ decontaminate-pack généré (READ-ONLY): ${base}.{md,csv,json,sql}`);
  console.log(`   pg ${pgId} (${gamme}) — ${all.length} lignes — ${Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(' · ')}`);
  console.log(`   → ${declassify.length} déclassables (guard ROW_COUNT=${declassify.length}, snapshot embarqué, réversible).`);
}

// detectEnergy — MIROIR EXACT de gamme-vlevel.service.detectEnergy (type_fuel -> energy v5.0, ordre
// significatif : 1er match gagne). Utilisé pour enrichir l'énergie EN MÉMOIRE avant le groupement
// (le calculateur canonique enrichit les unknown depuis type_fuel AVANT d'élire) — sans réécrire la DB.
function detectEnergy(fuel: string): string {
  const f = (fuel || '').toLowerCase();
  if (['diesel', 'dci', 'hdi', 'tdi', 'cdi', 'd4d', 'jtd', 'cdti', 'crdi', 'dtec'].some((x) => f.includes(x))) return 'diesel';
  if (['hybrid', 'phev', 'e-hybrid', 'plug-in', 'hybride'].some((x) => f.includes(x))) return 'hybride';
  if (['electrique', 'electric', 'ev', 'e-208', 'e-c4'].some((x) => f.includes(x))) return 'electrique';
  if (['gpl', 'lpg', 'bifuel'].some((x) => f.includes(x))) return 'gpl';
  if (['essence', 'tce', 'vti', 'puretech', 'tfsi', 'tsi', 'gti', 'vtec', 'mpi'].some((x) => f.includes(x))) return 'essence';
  return 'unknown';
}

// ---- réélection V2/V3/V4 (post-décontamination) ----
// reelection-pack : réélit V2/V3/V4 parmi les VRAIS keywords de la gamme (mention terme-gamme), en
// MIROIR EXACT de l'élection canonique (gamme-vlevel.service) via les invariants @repo/seo-roles —
// JAMAIS une élection parallèle. Scopé au terme-gamme pour NE PAS re-contaminer (l'élection globale
// re-pulle les keywords cross-gamme déclassés). Gate CLI (type=vehicle, modèle-seul inclus). V5 PRÉSERVÉ
// (jamais touché). Ce pack ne touche QUE v_level — le type_id diesel-default = generics-pack (séparé).
// READ-ONLY : génère decision-pack + package SQL gardé (snapshot+rollback). N'écrit JAMAIS en DB.
async function reelectionPack(pgId: number): Promise<void> {
  const s = sb();
  const ownRe = GAMME_PARTS[pgId];
  if (!ownRe) throw new Error(`pas de regex gamme pour pg ${pgId} (GAMME_PARTS)`);
  const gamme = (await selectIn<any>(s, 'pieces_gamme', 'pg_id,pg_alias', 'pg_id', [String(pgId)]))[0]?.pg_alias || `pg-${pgId}`;

  const all = await selectAllEq<any>(s, '__seo_keywords', 'id,keyword,volume,model,energy,type,v_level,type_id', 'pg_id', pgId, 'id');
  // candidats = vrais keywords gamme, véhicule, non-V5 (gate CLI : type=vehicle, modèle-seul INCLUS).
  const candidates = all.filter((k) => k.type === 'vehicle' && ownRe.test(k.keyword) && k.v_level !== 'V5');

  // ENRICHISSEMENT ÉNERGIE EN MÉMOIRE (miroir canonique §1b) : remplit les unknown depuis auto_type.type_fuel
  // AVANT de grouper ; NE RÉÉCRIT PAS la DB (read-only). Sans ça, la colonne energy incohérente sur-split les groupes.
  const tids = [...new Set(candidates.map((k) => k.type_id).filter(Boolean).map(String))];
  const fuelTypes = await selectIn<any>(s, 'auto_type', 'type_id,type_fuel', 'type_id', tids);
  const fuelMap = new Map(fuelTypes.map((t) => [String(t.type_id), t.type_fuel as string]));
  const energyOf = (k: any): string => {
    const raw = (k.energy ?? '').toLowerCase();
    if (raw && raw !== 'unknown') return raw; // garde une énergie déjà réelle (comme le canonique)
    if (k.type_id) { const d = detectEnergy(fuelMap.get(String(k.type_id)) || ''); if (d !== 'unknown') return d; }
    return raw || 'unknown';
  };

  // ÉLECTION MIROIR (gamme-vlevel.service §5-6) : group [model+énergie enrichie] (gamme NON universelle) ;
  // champion = volume DESC puis longueur keyword ASC ; V2 = top-cap des V3 dédupliqués par groupe.
  const byGroup = new Map<string, any[]>();
  for (const k of candidates) {
    const key = vLevelGroupKey(k.model, energyOf(k));
    (byGroup.get(key) || byGroup.set(key, []).get(key)!).push(k);
  }
  const proposed = new Map<number, string>();
  const v3Champs: any[] = [];
  for (const [, group] of byGroup) {
    group.sort((a: any, b: any) => ((b.volume || 0) - (a.volume || 0)) || ((a.keyword || '').length - (b.keyword || '').length));
    proposed.set(group[0].id, 'V3');
    v3Champs.push(group[0]);
    for (let i = 1; i < group.length; i++) proposed.set(group[i].id, 'V4');
  }
  v3Champs.sort((a, b) => (b.volume || 0) - (a.volume || 0));
  const seen = new Set<string>();
  let promoted = 0;
  for (const c of v3Champs) {
    const key = vLevelGroupKey(c.model, energyOf(c));
    if (seen.has(key)) continue;
    seen.add(key);
    proposed.set(c.id, 'V2');
    if (++promoted >= VLEVEL_V2_CAP) break;
  }

  const rows = candidates.map((k) => {
    const np = proposed.get(k.id)!;
    return {
      keyword: k.keyword, volume: k.volume ?? 0, model: k.model ?? '', energy: energyOf(k),
      group: vLevelGroupKey(k.model, energyOf(k)), current_v_level: k.v_level ?? '',
      proposed_v_level: np, change: (k.v_level ?? '') !== np ? 'CHANGE' : 'KEEP',
    };
  }).sort((a, b) =>
    (a.proposed_v_level.localeCompare(b.proposed_v_level)) || (b.volume - a.volume) || a.keyword.localeCompare(b.keyword));
  const changed = rows.filter((r) => r.change === 'CHANGE');

  const cur = { V2: 0, V3: 0, V4: 0 } as Record<string, number>;
  const prop = { V2: 0, V3: 0, V4: 0 } as Record<string, number>;
  for (const r of rows) { cur[r.current_v_level] = (cur[r.current_v_level] || 0) + 1; prop[r.proposed_v_level]++; }

  const base = path.join(AUDIT_DIR, `vlevel-reelection-${gamme}-${DATE}`);
  const cols = ['keyword', 'volume', 'model', 'energy', 'group', 'current_v_level', 'proposed_v_level', 'change'];
  fs.writeFileSync(`${base}.csv`,
    [cols.join(';'), ...rows.map((r) => cols.map((c) => String((r as any)[c] ?? '').replace(/;/g, ',')).join(';'))].join('\n') + '\n');
  fs.writeFileSync(`${base}.json`, JSON.stringify(
    { pg_id: pgId, gamme, generated: DATE, mutation: false, gate: 'CLI(type=vehicle)', groups: byGroup.size,
      current: cur, proposed: prop, changed_count: changed.length, rows }, null, 2));

  // package SQL gardé (snapshot v_level embarqué) — ne touche QUE v_level des candidats ; V5/NULL/generic/cross-gamme intouchés
  const ownTerm = ownRe.source.split('|')[0];
  const valuesList = changed.map((r) => `    (${sqlLit(r.keyword)}, ${sqlLit(r.current_v_level)}, ${sqlLit(r.proposed_v_level)})`).join(',\n');
  const sql = [
    `-- ====================================================================`,
    `-- V-LEVEL RÉÉLECTION (post-décontamination) — ${gamme} (pg ${pgId}) · ${DATE}`,
    `-- Réélit V2/V3/V4 parmi les ${rows.length} VRAIS keywords « ${ownTerm} » (véhicule, non-V5), MIROIR de`,
    `-- l'élection canonique (gamme-vlevel.service via @repo/seo-roles). ${changed.length} changements.`,
    `-- OWNER-GATED · RÉVERSIBLE · ZÉRO PROD · GÉNÉRÉ (ne pas éditer : régénérer). Ne touche QUE v_level.`,
    `-- INTOUCHÉS : V5 (famille), génériques NULL, REVIEW, keywords disque déclassés (hors candidats).`,
    `-- Le type_id diesel-default = generics-pack (package séparé). Re-lancer l'élection GLOBALE (recalc`,
    `-- admin) re-contaminerait (re-pulle le cross-gamme) -> CE pack ciblé est la voie sûre.`,
    `-- ====================================================================`,
    ``,
    `-- ÉTAPE 0 — BEFORE (distribution V2/V3/V4 des vrais ${ownTerm}) :`,
    `SELECT v_level, count(*) FROM "__seo_keywords"`,
    `WHERE pg_id=${pgId} AND type='vehicle' AND keyword ILIKE '%${ownTerm}%' AND coalesce(v_level,'')<>'V5'`,
    `GROUP BY v_level ORDER BY v_level;`,
    `-- attendu BEFORE : ${Object.entries(cur).map(([k, v]) => `${k}=${v}`).join(' ')}`,
    ``,
    `-- ÉTAPE 1 — APPLY (transaction gardée ; COMMIT après vérif AFTER) :`,
    `BEGIN;`,
    `DO $$`,
    `DECLARE n int;`,
    `BEGIN`,
    `  UPDATE "__seo_keywords" k SET v_level = s.new_vl, updated_at = now()`,
    `  FROM (VALUES`,
    valuesList,
    `  ) AS s(keyword, old_vl, new_vl)`,
    `  WHERE k.pg_id = ${pgId} AND k.keyword = s.keyword AND coalesce(k.v_level,'') = s.old_vl;`,
    `  GET DIAGNOSTICS n = ROW_COUNT;`,
    `  IF n <> ${changed.length} THEN`,
    `    RAISE EXCEPTION 'scope mismatch: % lignes (attendu ${changed.length}) — STOP', n;`,
    `  END IF;`,
    `  RAISE NOTICE 'OK: % réélections v_level', n;`,
    `END $$;`,
    ``,
    `-- vérif AFTER (distribution attendue : ${Object.entries(prop).map(([k, v]) => `${k}=${v}`).join(' ')}) :`,
    `SELECT v_level, count(*) FROM "__seo_keywords"`,
    `WHERE pg_id=${pgId} AND type='vehicle' AND keyword ILIKE '%${ownTerm}%' AND coalesce(v_level,'')<>'V5'`,
    `GROUP BY v_level ORDER BY v_level;`,
    ``,
    `-- COMMIT;   -- décommenter si AFTER conforme. SINON : ROLLBACK;`,
    ``,
    `-- ÉTAPE 2 — ROLLBACK (restaure le v_level EXACT depuis le snapshot embarqué) :`,
    `-- BEGIN;`,
    `-- UPDATE "__seo_keywords" k SET v_level = s.old_vl, updated_at = now()`,
    `-- FROM (VALUES`,
    ...changed.map((r, i) => `--     (${sqlLit(r.keyword)}, ${sqlLit(r.current_v_level)}, ${sqlLit(r.proposed_v_level)})${i < changed.length - 1 ? ',' : ''}`),
    `-- ) AS s(keyword, old_vl, new_vl)`,
    `-- WHERE k.pg_id = ${pgId} AND k.keyword = s.keyword AND coalesce(k.v_level,'') = s.new_vl;`,
    `-- COMMIT;`,
    ``,
  ].join('\n');
  fs.writeFileSync(`${base}.sql`, sql);

  const md = [
    `# Réélection V-Level (PROPOSITION) — ${gamme} (pg ${pgId}) · ${DATE}`,
    ``,
    `> READ-ONLY. Miroir de l'élection canonique (gamme-vlevel.service via @repo/seo-roles). Aucune mutation.`,
    `> Gate CLI (type=vehicle, modèle-seul inclus). Scopé au terme-gamme (anti re-contamination). V5 préservé.`,
    ``,
    `Candidats (vrais ${ownTerm} véhicule, non-V5) : ${rows.length} · groupes [modèle+énergie] : ${byGroup.size}`,
    ``,
    `| niveau | actuel | proposé |`,
    `|---|---|---|`,
    `| V2 | ${cur.V2 || 0} | ${prop.V2} |`,
    `| V3 | ${cur.V3 || 0} | ${prop.V3} |`,
    `| V4 | ${cur.V4 || 0} | ${prop.V4} |`,
    ``,
    `**Changements : ${changed.length}** (package SQL gardé : \`${path.basename(base)}.sql\`, guard ROW_COUNT=${changed.length}).`,
    `Suite séparée : \`generics-pack --pg-id ${pgId}\` pour le type_id diesel-default (REVIEW/DEFER y vivent).`,
    ``,
  ].join('\n');
  fs.writeFileSync(`${base}.md`, md);

  console.log(`✅ reelection-pack généré (READ-ONLY): ${base}.{md,csv,json,sql}`);
  console.log(`   pg ${pgId} (${gamme}) — ${rows.length} candidats · ${byGroup.size} groupes`);
  console.log(`   V2 ${cur.V2 || 0}->${prop.V2} · V3 ${cur.V3 || 0}->${prop.V3} · V4 ${cur.V4 || 0}->${prop.V4} · ${changed.length} changements (guard=${changed.length})`);
}

// ---- orchestrateur de classification (policy AUTO / REVIEW / DEFER / BLOCKED) ----
// Familles de gammes (périmètre initial : freinage). Étendre = ajouter une entrée.
const FAMILIES: Record<string, number[]> = {
  freinage: [82, 402, 124],
  filtration: [7, 424, 9, 8, 416], // filtre huile/habitacle/carburant/air/boîte-auto
};
// Sous-modèles niche : si le type recommandé tombe dessus mais que le keyword ne le nomme PAS,
// c'est une erreur de sous-modèle (Aircross SUV, Allroad break, Décapotable, Be Bop) -> DEFER.
const SUBMODEL_SUSPECT = /aircross|allroad|d[ée]capotable|be ?bop|cabriolet|spacetourer/i;

// auto-plan : classe les champions V3 d'une FAMILLE en AUTO_APPLY_SAFE / OWNER_REVIEW / DEFER / BLOCKED
// (policy owner). READ-ONLY : aucune écriture. Réutilise le seed + helpers (pas de système parallèle).
// AUTO_APPLY_SAFE = seul bucket auto-applicable, et SEULEMENT si tous les checks passent (conf>=80,
// rendable /pieces, pas cross-gamme, pas sous-modèle suspect, pas REVIEW/DEFER flag, rollback prêt).
async function autoPlan(family: string): Promise<void> {
  const pgIds = FAMILIES[family];
  if (!pgIds) throw new Error(`famille inconnue: ${family} (connues: ${Object.keys(FAMILIES).join(', ')})`);
  const s = sb();
  const seed = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
  const reps: Record<string, any> = seed.diesel_default_by_modele || {};
  const reviewKw: Record<string, any> = seed.review_keyword || {};
  const explicitKw: Record<string, any> = seed.explicit_keyword || {};
  const deferCatalog: string[] = seed.defer_catalog_gap || [];
  const AUTO_CONF = 80; // seuil AUTO_APPLY_SAFE (owner)

  const allRows: any[] = [];
  for (const pgId of pgIds) {
    const ownRe = GAMME_PARTS[pgId];
    const gamme = (await selectIn<any>(s, 'pieces_gamme', 'pg_id,pg_alias', 'pg_id', [String(pgId)]))[0]?.pg_alias || `pg-${pgId}`;
    const champs = await selectAllEq<any>(s, '__seo_keywords', 'id,keyword,volume,type_id,model,energy,type,v_level', 'pg_id', pgId, 'id');
    const v3 = champs.filter((k) => k.type === 'vehicle' && k.v_level === 'V3'); // périmètre : V3 uniquement

    const curTids = v3.map((k) => k.type_id).filter(Boolean).map(String);
    const repTids = Object.values(reps).map((r: any) => String(r.type_id));
    const types = await selectIn<any>(s, 'auto_type', 'type_id,type_modele_id,type_alias,type_display', 'type_id', [...new Set([...curTids, ...repTids])]);
    const typeMap = new Map(types.map((t) => [String(t.type_id), t]));
    const modeleIds = [...new Set(types.map((t) => String(t.type_modele_id)).filter((x) => x && x !== 'null'))];
    const modeles = await selectIn<any>(s, 'auto_modele', 'modele_id,modele_name,modele_alias,modele_marque_id', 'modele_id', modeleIds);
    const modMap = new Map(modeles.map((m) => [String(m.modele_id), m]));
    const marques = await selectIn<any>(s, 'auto_marque', 'marque_id,marque_alias', 'marque_id', [...new Set(modeles.map((m) => String(m.modele_marque_id)))]);
    const mqMap = new Map(marques.map((m) => [String(m.marque_id), m]));

    const render = (tid: string): { url: string; modeleName: string } | null => {
      const t = typeMap.get(String(tid));
      if (!t || t.type_display !== '1') return null;
      const m = modMap.get(String(t.type_modele_id));
      const mq = m ? mqMap.get(String(m.modele_marque_id)) : null;
      if (!m || !mq || !t.type_alias) return null;
      return { url: piecesUrl(gamme, pgId, mq.marque_alias, mq.marque_id, m.modele_alias, m.modele_id, t.type_alias, tid), modeleName: m.modele_name || '' };
    };

    for (const k of v3) {
      const r: any = {
        pg_id: pgId, gamme, keyword: k.keyword, volume: k.volume ?? 0,
        current_type_id: k.type_id ?? '', recommended_type_id: '', recommended_url: '', confidence: 0,
        changed: false, decision: '', reason: '',
      };
      // 1. cross-gamme (non résolu) -> BLOCKED
      if (ownRe && !ownRe.test(k.keyword)) { r.decision = 'BLOCKED'; r.reason = 'cross-gamme non résolu'; allRows.push(r); continue; }
      // 2. résolution type_id : motorisation explicite => garder ; modèle-seul => diesel-default seed
      const curT = k.type_id ? typeMap.get(String(k.type_id)) : null;
      const curModId = curT ? String(curT.type_modele_id) : null;
      const modelOnly = !ENERGY_RE.test(k.keyword);
      if (modelOnly && curModId && reps[curModId]) {
        r.recommended_type_id = String(reps[curModId].type_id); r.confidence = reps[curModId].confidence || 0; r.reason = 'diesel-default modèle-seul';
      } else if (!modelOnly && k.type_id) {
        r.recommended_type_id = String(k.type_id); r.confidence = 75; r.reason = 'motorisation explicite (puissance à confirmer)';
      } else {
        r.recommended_type_id = k.type_id ? String(k.type_id) : ''; r.confidence = 50; r.reason = 'modèle-seul sans rep seed';
      }
      r.changed = !!r.recommended_type_id && r.recommended_type_id !== String(k.type_id ?? '');
      const rend = r.recommended_type_id ? render(r.recommended_type_id) : null;
      r.recommended_url = rend?.url || '';
      // 3. BLOCKED : type_id absent ou /pieces impossible
      if (!r.recommended_type_id || !rend) { r.decision = 'BLOCKED'; r.reason = 'type_id absent ou /pieces non rendable'; allRows.push(r); continue; }
      // 4. DEFER : catalogue absent / sous-modèle suspect
      if (deferCatalog.some((d) => k.keyword.includes(d) || d.includes(k.keyword))) { r.decision = 'DEFER'; r.reason = 'catalogue absent'; allRows.push(r); continue; }
      if (SUBMODEL_SUSPECT.test(rend.modeleName) && !SUBMODEL_SUSPECT.test(k.keyword)) { r.decision = 'DEFER'; r.reason = `sous-modèle suspect (${rend.modeleName}) vs keyword générique`; allRows.push(r); continue; }
      // 5. OWNER_REVIEW : flag seed / explicite power-ambigu / confiance 60-79
      if (reviewKw[k.keyword]) { r.decision = 'OWNER_REVIEW'; r.reason = reviewKw[k.keyword]; allRows.push(r); continue; }
      if (explicitKw[k.keyword]?.owner_hint === 'REVIEW') { r.decision = 'OWNER_REVIEW'; r.reason = explicitKw[k.keyword].reason || 'explicite ambigu'; allRows.push(r); continue; }
      // 6a. AUCUN changement à appliquer + rendable + aucun flag => déjà correct = sûr (no-op, rien à écrire)
      if (!r.changed) { r.decision = 'AUTO_APPLY_SAFE'; r.reason = 'déjà sur cible, /pieces rendable (no-op)'; allRows.push(r); continue; }
      // 6b. CHANGEMENT proposé : seuil de confiance pour l'auto-apply
      if (r.confidence >= AUTO_CONF) { r.decision = 'AUTO_APPLY_SAFE'; r.reason = 'safe: re-cible diesel-default web-confirmé (conf>=80)'; allRows.push(r); continue; }
      if (r.confidence >= 60) { r.decision = 'OWNER_REVIEW'; r.reason = `re-cible confiance ${r.confidence} (60-79) — arbitrage owner`; allRows.push(r); continue; }
      r.decision = 'OWNER_REVIEW'; r.reason = `re-cible confiance ${r.confidence} (<60) — défaut prudent`; allRows.push(r);
    }
  }

  allRows.sort((a, b) => a.decision.localeCompare(b.decision) || a.pg_id - b.pg_id || b.volume - a.volume || a.keyword.localeCompare(b.keyword));
  const counts = allRows.reduce((a, r) => ((a[r.decision] = (a[r.decision] || 0) + 1), a), {} as Record<string, number>);
  const autoSafe = allRows.filter((r) => r.decision === 'AUTO_APPLY_SAFE');
  const autoPending = autoSafe.filter((r) => r.changed); // changements RÉELS auto-applicables
  const autoNoop = autoSafe.length - autoPending.length;

  const base = path.join(AUDIT_DIR, `vlevel-auto-plan-${family}-${DATE}`);
  const cols = ['decision', 'pg_id', 'gamme', 'keyword', 'volume', 'current_type_id', 'recommended_type_id', 'recommended_url', 'confidence', 'changed', 'reason'];
  fs.writeFileSync(`${base}.csv`, [cols.join(';'), ...allRows.map((r) => cols.map((c) => String(r[c] ?? '').replace(/;/g, ',')).join(';'))].join('\n') + '\n');
  fs.writeFileSync(`${base}.json`, JSON.stringify({ family, pg_ids: pgIds, generated: DATE, mutation: false, scope: 'V3', counts, auto_pending: autoPending.length, auto_noop: autoNoop, rows: allRows }, null, 2));

  // package SQL gardé : SEULEMENT AUTO_APPLY_SAFE avec changement réel (snapshot + rollback + guard)
  const vals = autoPending.map((r) => `    (${r.pg_id}, ${sqlLit(r.keyword)}, ${sqlLit(String(r.current_type_id))}, ${sqlLit(r.recommended_type_id)})`).join(',\n');
  const sql = [
    `-- ====================================================================`,
    `-- V-LEVEL AUTO-APPLY-SAFE — famille ${family} (pg ${pgIds.join('/')}) · ${DATE} · scope V3`,
    `-- SEULEMENT les ${autoPending.length} cas AUTO_APPLY_SAFE avec changement réel. Réversible (snapshot embarqué).`,
    `-- JAMAIS : OWNER_REVIEW (${counts.OWNER_REVIEW || 0}) · DEFER (${counts.DEFER || 0}) · BLOCKED (${counts.BLOCKED || 0}).`,
    `-- GÉNÉRÉ READ-ONLY. L'apply réel = DO-block gardé (row_count exact) ou RPC gouverné. ZÉRO PROD.`,
    `-- ====================================================================`,
    autoPending.length === 0 ? `-- (aucun changement AUTO_APPLY_SAFE en attente — famille déjà sur cible)` : ``,
    autoPending.length === 0 ? `` : `BEGIN;`,
    autoPending.length === 0 ? `` : `DO $$ DECLARE n int; BEGIN`,
    autoPending.length === 0 ? `` : `  UPDATE "__seo_keywords" k SET type_id = s.new_tid::int, updated_at = now()`,
    autoPending.length === 0 ? `` : `  FROM (VALUES\n${vals}\n  ) AS s(pg, keyword, old_tid, new_tid)`,
    autoPending.length === 0 ? `` : `  WHERE k.pg_id = s.pg AND k.keyword = s.keyword AND k.type_id::text = s.old_tid AND k.v_level='V3';`,
    autoPending.length === 0 ? `` : `  GET DIAGNOSTICS n = ROW_COUNT;`,
    autoPending.length === 0 ? `` : `  IF n <> ${autoPending.length} THEN RAISE EXCEPTION 'GUARD auto-apply: % (attendu ${autoPending.length}) -- ROLLBACK', n; END IF;`,
    autoPending.length === 0 ? `` : `  RAISE NOTICE 'OK: % AUTO_APPLY_SAFE appliqués', n;`,
    autoPending.length === 0 ? `` : `END $$;`,
    autoPending.length === 0 ? `` : `-- COMMIT;  -- décommenter après vérif. ROLLBACK : SET type_id = old_tid depuis le snapshot ci-dessus.`,
  ].filter((l) => l !== ``).join('\n') + '\n';
  fs.writeFileSync(`${base}.sql`, sql);

  console.log(`✅ auto-plan (READ-ONLY) famille=${family} scope=V3 : ${base}.{csv,json,sql}`);
  console.log(`   ${Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(' · ')}`);
  console.log(`   AUTO_APPLY_SAFE: ${autoSafe.length} (dont ${autoPending.length} à appliquer, ${autoNoop} déjà sur cible)`);
}

// ---- résolution des champions BLOCKED (page /pieces impossible) ----
// blocked-plan : pour une famille, liste les champions V2/V3 BLOCKED (type_id NULL / non-rendable /
// TecDoc orphelin / cross-gamme), classe la CAUSE, et propose un candidat rendable + une action.
// READ-ONLY : n'écrit JAMAIS. Réutilise seed + helpers.
const DIESEL_BLK = /(dci|hdi|tdci|cdti|tdi|dti|bluehdi|multijet|jtd|cdti|crdi)/i;
async function blockedPlan(family: string): Promise<void> {
  const pgIds = FAMILIES[family];
  if (!pgIds) throw new Error(`famille inconnue: ${family} (connues: ${Object.keys(FAMILIES).join(', ')})`);
  const s = sb();
  const seed = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
  const reps: Record<string, any> = seed.diesel_default_by_modele || {};

  const out: any[] = [];
  for (const pgId of pgIds) {
    const ownRe = GAMME_PARTS[pgId];
    const gamme = (await selectIn<any>(s, 'pieces_gamme', 'pg_id,pg_alias', 'pg_id', [String(pgId)]))[0]?.pg_alias || `pg-${pgId}`;
    const champs = await selectAllEq<any>(s, '__seo_keywords', 'id,keyword,volume,type_id,model,energy,type,v_level', 'pg_id', pgId, 'id');
    const v3 = champs.filter((k) => k.type === 'vehicle' && (k.v_level === 'V3' || k.v_level === 'V2'));

    // types courants (pour savoir si rendable)
    const curTids = v3.map((k) => k.type_id).filter(Boolean).map(String);
    const curTypes = await selectIn<any>(s, 'auto_type', 'type_id,type_modele_id,type_alias,type_display', 'type_id', curTids);
    const curTypeMap = new Map(curTypes.map((t) => [String(t.type_id), t]));

    // BLOCKED = cross-gamme, ou type_id NULL, ou type absent/non-affiché
    const renderableNow = (k: any): boolean => {
      if (!k.type_id) return false;
      const t = curTypeMap.get(String(k.type_id));
      return !!(t && t.type_display === '1' && t.type_modele_id);
    };
    const blocked = v3.filter((k) => (ownRe && !ownRe.test(k.keyword)) || !renderableNow(k));

    // résoudre le modele_id de chaque blocked : via le type courant (même non-affiché), sinon par
    // MATCH NORMALISÉ k.model ↔ catalogue via modelMatchKey (@repo/seo-roles : accents + roman↔arabe).
    // L'accent casse un ILIKE de préfiltre → on normalise tout le catalogue en mémoire (une fois, si besoin).
    const needFuzzy = blocked.some((k) => !curTypeMap.get(String(k.type_id))?.type_modele_id && k.model);
    const modelKeyMap = new Map<string, any>(); // modelMatchKey(modele_name) -> modele (base préféré sur collision)
    if (needFuzzy) {
      for (let off = 0; ; off += 1000) {
        const { data, error: e3 } = await s.from('auto_modele')
          .select('modele_id,modele_name,modele_alias,modele_marque_id')
          .order('modele_id', { ascending: true }).range(off, off + 999);
        if (e3) throw new Error(`auto_modele.range(${off}): ${e3.message}`);
        const batch = (data || []) as any[];
        for (const m of batch) {
          const key = modelMatchKey(m.modele_name || '');
          if (!key) continue;
          const prev = modelKeyMap.get(key);
          // collision -> préférer le nom le plus court (la base, sans code châssis entre parenthèses)
          if (!prev || String(m.modele_name).length < String(prev.modele_name).length) modelKeyMap.set(key, m);
        }
        if (batch.length < 1000) break;
      }
    }
    const modeleIdOf = (k: any): string | null => {
      const t = curTypeMap.get(String(k.type_id));
      if (t?.type_modele_id && t.type_modele_id !== 'null') return String(t.type_modele_id);
      const fm = k.model ? modelKeyMap.get(modelMatchKey(String(k.model))) : null;
      return fm ? String(fm.modele_id) : null;
    };

    // candidats rendables (display=1) des modeles concernés
    const modeleIds = [...new Set(blocked.map(modeleIdOf).filter(Boolean) as string[])];
    const candTypes = modeleIds.length
      ? (await selectIn<any>(s, 'auto_type', 'type_id,type_modele_id,type_alias,type_power_ps,type_fuel,type_display', 'type_modele_id', modeleIds)).filter((t) => t.type_display === '1')
      : [];
    const candByMod = new Map<string, any[]>();
    for (const t of candTypes) { const a = candByMod.get(String(t.type_modele_id)) || []; a.push(t); candByMod.set(String(t.type_modele_id), a); }
    const modeles = modeleIds.length ? await selectIn<any>(s, 'auto_modele', 'modele_id,modele_name,modele_alias,modele_marque_id', 'modele_id', modeleIds) : [];
    const modMap = new Map(modeles.map((m) => [String(m.modele_id), m]));
    const marques = modeles.length ? await selectIn<any>(s, 'auto_marque', 'marque_id,marque_alias', 'marque_id', [...new Set(modeles.map((m) => String(m.modele_marque_id)))]) : [];
    const mqMap = new Map(marques.map((m) => [String(m.marque_id), m]));

    for (const k of blocked) {
      const modId = modeleIdOf(k);
      const curT = curTypeMap.get(String(k.type_id));
      // 1. CAUSE
      let reason: string;
      if (ownRe && !ownRe.test(k.keyword)) reason = 'WRONG_GAMME';
      else if (!k.type_id) reason = modId ? 'TYPE_ID_NULL' : 'PARSER_MISS';
      else if (!curT) reason = 'TECDOC_ORPHAN'; // type_id absent d'auto_type
      else if (curT.type_display !== '1') reason = 'TECDOC_ORPHAN'; // TecDoc non affiché
      else reason = 'TYPE_NOT_RENDERABLE';

      // 2. CANDIDAT rendable du même modèle (énergie du keyword si explicite, sinon diesel-default)
      let candId = '', candUrl = '', conf = 0;
      const cands = modId ? (candByMod.get(modId) || []) : [];
      if (cands.length && modId) {
        const hasEnergy = ENERGY_RE.test(k.keyword);
        const wantDiesel = !hasEnergy || DIESEL_BLK.test(k.keyword); // modèle-seul OU keyword diesel
        const isDiesel = (t: any) => /diesel/i.test(t.type_fuel || '') || DIESEL_BLK.test(t.type_alias || '');
        const dieselC = cands.filter(isDiesel);
        const petrolC = cands.filter((t) => !isDiesel(t));
        // respecter l'énergie EXPLICITE du keyword : essence -> pool essence ; sinon diesel-default
        const pool = wantDiesel ? (dieselC.length ? dieselC : cands) : (petrolC.length ? petrolC : cands);
        // rep seed diesel = uniquement si on veut du diesel (jamais sur un keyword essence explicite)
        const seedRep = wantDiesel && reps[modId] && cands.find((t) => String(t.type_id) === String(reps[modId].type_id));
        const chosen = seedRep
          || (pool.length ? pool.slice().sort((a, b) => (Number(b.type_power_ps) || 0) - (Number(a.type_power_ps) || 0))[Math.floor((pool.length - 1) / 2)] : null)
          || cands[0];
        if (chosen) {
          candId = String(chosen.type_id);
          const m = modMap.get(modId); const mq = m ? mqMap.get(String(m.modele_marque_id)) : null;
          if (m && mq && chosen.type_alias) candUrl = piecesUrl(gamme, pgId, mq.marque_alias, mq.marque_id, m.modele_alias, m.modele_id, chosen.type_alias, candId);
          conf = seedRep ? (reps[modId].confidence || 70) : (hasEnergy ? 60 : 55);
        }
      }

      // 3. ACTION proposée
      let action: string;
      if (reason === 'WRONG_GAMME') action = 'REMAP_REVIEW';
      else if (reason === 'PARSER_MISS') action = 'PARSER_RETRY_CANDIDATE';
      else if (candId && candUrl) action = (reason === 'TECDOC_ORPHAN') ? 'REMAP_REVIEW' : 'RESOLVE_CANDIDATE';
      else if (modId && !cands.length) action = 'DEFER_CATALOG'; // modèle sans aucune variante rendable
      else if (reason === 'TECDOC_ORPHAN') action = 'QUARANTINE_CANDIDATE';
      else action = 'BLOCKED_KEEP';

      out.push({
        pg_id: pgId, gamme, keyword: k.keyword, volume: k.volume ?? 0, v_level: k.v_level,
        current_type_id: k.type_id ?? '', blocked_reason: reason, candidate_type_id: candId,
        candidate_url: candUrl, confidence: conf, proposed_action: action, owner_decision: action,
      });
    }
  }

  out.sort((a, b) => a.blocked_reason.localeCompare(b.blocked_reason) || a.pg_id - b.pg_id || b.volume - a.volume || a.keyword.localeCompare(b.keyword));
  const byReason = out.reduce((a, r) => ((a[r.blocked_reason] = (a[r.blocked_reason] || 0) + 1), a), {} as Record<string, number>);
  const byAction = out.reduce((a, r) => ((a[r.proposed_action] = (a[r.proposed_action] || 0) + 1), a), {} as Record<string, number>);

  const base = path.join(AUDIT_DIR, `vlevel-blocked-${family}-${DATE}`);
  const cols = ['pg_id', 'gamme', 'keyword', 'volume', 'v_level', 'current_type_id', 'blocked_reason', 'candidate_type_id', 'candidate_url', 'confidence', 'proposed_action', 'owner_decision'];
  fs.writeFileSync(`${base}.csv`, [cols.join(';'), ...out.map((r) => cols.map((c) => String((r as any)[c] ?? '').replace(/;/g, ',')).join(';'))].join('\n') + '\n');
  fs.writeFileSync(`${base}.json`, JSON.stringify({ family, pg_ids: pgIds, generated: DATE, mutation: false, scope: 'V3 BLOCKED', by_reason: byReason, by_action: byAction, rows: out }, null, 2));
  const md = [
    `# Champions V2/V3 BLOCKED (page /pieces impossible) — ${family} · ${DATE}`,
    ``,
    `> READ-ONLY. Le système croit avoir un champion mais la page cible est cassée/impossible. Aucune mutation.`,
    ``,
    `Total : ${out.length}. Cause : ${Object.entries(byReason).map(([k, v]) => `${k}=${v}`).join(' · ')}`,
    `Action proposée : ${Object.entries(byAction).map(([k, v]) => `${k}=${v}`).join(' · ')}`,
    ``,
    `| pg | keyword | cause | candidat | conf | action |`,
    `|---|---|---|---|---|---|`,
    ...out.map((r) => `| ${r.pg_id} | ${r.keyword} | ${r.blocked_reason} | ${r.candidate_type_id || '—'} | ${r.confidence} | ${r.proposed_action} |`),
    ``,
  ].join('\n');
  fs.writeFileSync(`${base}.md`, md);

  console.log(`✅ blocked-plan (READ-ONLY) ${family} : ${base}.{md,csv,json}`);
  console.log(`   ${out.length} BLOCKED — cause: ${Object.entries(byReason).map(([k, v]) => `${k}=${v}`).join(' · ')}`);
  console.log(`   action: ${Object.entries(byAction).map(([k, v]) => `${k}=${v}`).join(' · ')}`);
}

// blocked-apply-pack : package SQL gardé pour les cas CLAIRS du blocked-plan UNIQUEMENT
// (RESOLVE_CANDIDATE + REMAP_REVIEW TecDoc avec candidat rendable). Transforme des champions cassés
// (page /pieces impossible) en champions rendables. READ-ONLY (génère le .sql, n'écrit jamais en DB).
// EXCLUT : QUARANTINE · DEFER_CATALOG · WRONG_GAMME · V5 · 206 · clio 3 1.5 dci · toute autre gamme.
async function blockedApplyPack(family: string, pgFilter?: number, label?: string): Promise<void> {
  const pgIds = FAMILIES[family];
  if (!pgIds) throw new Error(`famille inconnue: ${family}`);
  const jf = path.join(AUDIT_DIR, `vlevel-blocked-${family}-${DATE}.json`);
  if (!fs.existsSync(jf)) throw new Error(`blocked-plan absent: ${jf} (lancer blocked-plan d'abord)`);
  let rows = (JSON.parse(fs.readFileSync(jf, 'utf8')).rows as any[]);
  if (pgFilter) rows = rows.filter((r) => Number(r.pg_id) === pgFilter); // scope gamme unique (ex. filtre-à-huile pg 7)
  const deAccent = (x: string): string => (x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const slug = label || (pgFilter ? deAccent(String(rows[0]?.gamme || `pg${pgFilter}`)).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : family);

  // --- contrôles de cohérence par ligne (verify the proof — pas de candidat approximatif) ---
  // GATE 1 cylindrée : la cylindrée explicite du keyword (ex. "1.5 dci") DOIT être dans l'alias candidat. EXCLUSION (pas flag).
  const kwDisp = (kw: string): string => (kw.match(/\b(\d[.,]\d)\b/)?.[1] || '').replace(/[.,]/, '-');
  const candAlias = (url: string): string => (url.match(/\/([^/]+)-\d+\.html$/)?.[1] || '');
  const engineMatch = (r: any): boolean => { const d = kwDisp(r.keyword); return !d || candAlias(r.candidate_url).includes(d); };
  // GATE 2 moteur : famille carburant du candidat (type_fuel DB). hybride/GPL = thermique (a un filtre à huile).
  const candFamily = (fuel: string): string => {
    const f = deAccent(fuel);
    if (/diesel|dci|hdi|tdi|cdti|crdi/.test(f)) return 'diesel';
    if (/hybr/.test(f)) return 'hybride';
    if (/essence|tce|tfsi|tsi|gpl|lpg|vti|puretech/.test(f)) return 'essence';
    if (/electr/.test(f)) return 'electrique';
    return 'unknown';
  };
  // gammes "fluide-combustion" (huile 7 / carburant 9 / air-moteur 8) : le filtre n'existe que sur un moteur thermique
  // -> candidat 100% électrique = INCOHÉRENT (pas de filtre). N'affecte PAS freinage (disque OK sur électrique).
  const COMBUSTION_FLUID = new Set([7, 9, 8]);
  const fuelReason = (r: any, cf: string): string | null => {
    const kwE = detectEnergy(r.keyword); // tokens dci/tce/tfsi… explicites du keyword
    if (kwE === 'essence' && cf === 'diesel') return `MOTEUR essence(kw)->diesel(cand ${r.candidate_type_id})`;
    if (kwE === 'diesel' && cf === 'essence') return `MOTEUR diesel(kw)->essence(cand ${r.candidate_type_id})`;
    if (COMBUSTION_FLUID.has(Number(r.pg_id)) && cf === 'electrique') return `MOTEUR electrique = pas de filtre (gamme combustion)`;
    return null;
  };

  // cas structurellement clairs : candidat rendable présent ET (RESOLVE_CANDIDATE OU REMAP_REVIEW TecDoc-orphan)
  const isStruct = (r: any) => r.candidate_type_id && r.candidate_url &&
    (r.proposed_action === 'RESOLVE_CANDIDATE' || (r.proposed_action === 'REMAP_REVIEW' && r.blocked_reason === 'TECDOC_ORPHAN'));
  const structOut = rows.filter((r) => !isStruct(r)).map((r) => ({ ...r, _excl: r.proposed_action })); // QUARANTINE/DEFER/PARSER/WRONG_GAMME
  const structural = rows.filter(isStruct);
  const cylBad = structural.filter((r) => !engineMatch(r)).map((r) => ({ ...r, _excl: `CYLINDRÉE ${kwDisp(r.keyword)}!=${candAlias(r.candidate_url)}` }));
  const cylOk = structural.filter(engineMatch);

  // CONTRÔLE DB live : re-vérifier display=1 + récupérer type_fuel des candidats (cylOk) — STOP si un display échoue
  const s = sb();
  const candTids = [...new Set(cylOk.map((r) => String(r.candidate_type_id)))];
  const candTypes = await selectIn<any>(s, 'auto_type', 'type_id,type_display,type_fuel', 'type_id', candTids);
  const displayOk = new Map(candTypes.map((t) => [String(t.type_id), t.type_display === '1']));
  const fuelMap = new Map(candTypes.map((t) => [String(t.type_id), String(t.type_fuel || '')]));
  const bad = cylOk.filter((r) => !displayOk.get(String(r.candidate_type_id)));
  if (bad.length) {
    console.error(`⛔ STOP : ${bad.length} candidat(s) non display=1 (jamais dans un apply) :`);
    bad.forEach((r) => console.error(`   ${r.keyword} -> ${r.candidate_type_id}`));
    process.exitCode = 1; return;
  }

  // GATE 2 moteur : split cylOk en clair (moteur cohérent) vs exclu — preuve = type_fuel DB
  const fuelBad: any[] = [], clear: any[] = [];
  for (const r of cylOk) {
    const reason = fuelReason(r, candFamily(fuelMap.get(String(r.candidate_type_id)) || ''));
    if (reason) fuelBad.push({ ...r, _excl: reason }); else clear.push(r);
  }
  const excluded = [...structOut, ...cylBad, ...fuelBad];

  const N = clear.length;
  const byPg = clear.reduce((a, r) => ((a[r.pg_id] = (a[r.pg_id] || 0) + 1), a), {} as Record<string, number>);
  const byAct = clear.reduce((a, r) => ((a[r.proposed_action] = (a[r.proposed_action] || 0) + 1), a), {} as Record<string, number>);
  const exBy = excluded.reduce((a, r) => ((a[r._excl] = (a[r._excl] || 0) + 1), a), {} as Record<string, number>);

  // VALUES : (pg, keyword, old_tid|'' si NULL, new_tid). match coalesce(type_id,'')=old gère le NULL.
  // Tous les candidats ci-dessous ont passé GATE 1 (cylindrée) + GATE 2 (moteur) + display=1 (preuve DB).
  const vals = clear.map((r, i) =>
    `    (${r.pg_id}, ${sqlLit(r.keyword)}, ${sqlLit(String(r.current_type_id || ''))}, ${sqlLit(String(r.candidate_type_id))})${i < clear.length - 1 ? ',' : ''}  -- ${r.blocked_reason} ${r.proposed_action} -> ${r.candidate_url}`).join('\n');
  const rbVals = clear.map((r) =>
    `--     (${r.pg_id}, ${sqlLit(r.keyword)}, ${sqlLit(String(r.current_type_id || ''))}, ${sqlLit(String(r.candidate_type_id))})${''}`).join(',\n');

  const sql = [
    `-- ====================================================================`,
    `-- V-LEVEL APPLY — champions V2/V3 BLOCKED cas CLAIRS -> rendables — ${slug} (pg ${pgFilter || pgIds.join('/')}) · ${DATE}`,
    `-- ${N} lignes : RESOLVE_CANDIDATE=${byAct.RESOLVE_CANDIDATE || 0} · REMAP_REVIEW(TecDoc rendable)=${byAct.REMAP_REVIEW || 0}.`,
    `-- Transforme UNIQUEMENT des champions cassés (type_id NULL/non-rendable) en champions rendables (display=1).`,
    `-- EXCLUS STRICTS (${excluded.length}) : ${Object.entries(exBy).map(([k, v]) => `${k}=${v}`).join(' · ')}.`,
    `-- NE PAS mélanger avec décontamination / réélection / V5 / quarantine / wrong_gamme.`,
    `-- OWNER-GATED · RÉVERSIBLE · ZÉRO PROD · GÉNÉRÉ. Tous candidats : GATE 1 cylindrée + GATE 2 moteur + display=1 (preuve DB).`,
    `-- ====================================================================`,
    ``,
    `-- ÉTAPE 0 — BEFORE (état cassé : type_id NULL ou TecDoc non-affiché) :`,
    `SELECT k.pg_id, k.keyword, k.v_level, k.type_id, t.type_display`,
    `FROM "__seo_keywords" k LEFT JOIN auto_type t ON t.type_id = k.type_id::text`,
    `WHERE (k.pg_id, k.keyword) IN (${clear.map((r) => `(${r.pg_id},${sqlLit(r.keyword)})`).join(', ')})`,
    `  AND k.v_level IN ('V2','V3') ORDER BY k.pg_id, k.keyword;`,
    ``,
    `-- ÉTAPE 1 — APPLY (transaction gardée ; COMMIT après AFTER conforme) :`,
    `BEGIN;`,
    `DO $$ DECLARE n int;`,
    `BEGIN`,
    `  UPDATE "__seo_keywords" k SET type_id = s.new_tid::int, updated_at = now()`,
    `  FROM (VALUES`,
    vals,
    `  ) AS s(pg, keyword, old_tid, new_tid)`,
    `  WHERE k.pg_id = s.pg AND k.keyword = s.keyword AND k.v_level IN ('V2','V3')`,
    `    AND coalesce(k.type_id::text, '') = s.old_tid;`,
    `  GET DIAGNOSTICS n = ROW_COUNT;`,
    `  IF n <> ${N} THEN RAISE EXCEPTION 'GUARD blocked-clear: % lignes (attendu ${N}) -- ROLLBACK', n; END IF;`,
    `  RAISE NOTICE 'OK: % champions cassés -> rendables', n;`,
    `END $$;`,
    ``,
    `-- vérif AFTER (tous doivent être rendables : type_display=1) :`,
    `SELECT k.pg_id, k.keyword, k.type_id, m.modele_name, t.type_alias, t.type_display`,
    `FROM "__seo_keywords" k JOIN auto_type t ON t.type_id=k.type_id::text`,
    `JOIN auto_modele m ON m.modele_id=NULLIF(t.type_modele_id,'')::int`,
    `WHERE (k.pg_id, k.keyword) IN (${clear.map((r) => `(${r.pg_id},${sqlLit(r.keyword)})`).join(', ')})`,
    `  AND k.v_level IN ('V2','V3') ORDER BY k.pg_id, k.keyword;`,
    ``,
    `-- COMMIT;   -- décommenter si AFTER montre tous display=1. SINON : ROLLBACK;`,
    ``,
    `-- ÉTAPE 2 — ROLLBACK (réversible ; restaure l'état cassé : NULL si old vide, sinon l'ancien type_id) :`,
    `-- BEGIN;`,
    `-- UPDATE "__seo_keywords" k SET type_id = CASE WHEN s.old_tid='' THEN NULL ELSE s.old_tid::int END, updated_at = now()`,
    `-- FROM (VALUES`,
    rbVals,
    `-- ) AS s(pg, keyword, old_tid, new_tid)`,
    `-- WHERE k.pg_id = s.pg AND k.keyword = s.keyword AND k.v_level IN ('V2','V3') AND k.type_id::text = s.new_tid;`,
    `-- COMMIT;`,
    ``,
  ].join('\n');

  const outDir = path.join(ROOT, 'scripts', 'seo');
  const outFile = path.join(outDir, `vlevel-v3-apply-${slug}-blocked-clear-${DATE}.sql`);
  fs.writeFileSync(outFile, sql);

  console.log(`✅ blocked-apply-pack généré (READ-ONLY, ZÉRO mutation) : ${outFile}`);
  console.log(`   ${N} lignes CLAIRES — par pg : ${Object.entries(byPg).map(([k, v]) => `pg${k}=${v}`).join(' · ')}`);
  console.log(`   par action : ${Object.entries(byAct).map(([k, v]) => `${k}=${v}`).join(' · ')}`);
  console.log(`   EXCLUS STRICTS (${excluded.length}) : ${Object.entries(exBy).map(([k, v]) => `${k}=${v}`).join(' · ')}`);
  const flagged = excluded.filter((r) => /^CYLINDRÉE|^MOTEUR/.test(r._excl));
  if (flagged.length) {
    console.log(`   ⚠ ${flagged.length} candidat(s) rendable(s) mais INCOHÉRENT(s) (exclus, à arbitrer owner séparément) :`);
    flagged.forEach((r) => console.log(`     "${r.keyword}" -> ${r.candidate_type_id} (${candAlias(r.candidate_url)}) [${r._excl}]`));
  }
}

function readPackCsv(file: string): Record<string, string>[] {
  const lines = fs.readFileSync(file, 'utf8').trim().split('\n');
  const head = lines[0].split(';');
  return lines.slice(1).map((l) => {
    const v = l.split(';');
    const r = Object.fromEntries(head.map((h, i) => [h, v[i] ?? ''])) as Record<string, string>;
    // tolère les packs owner-rédigés (colonnes selected_*) comme alias de recommended_*
    r.recommended_type_id = r.recommended_type_id || r.selected_type_id || '';
    r.recommended_url = r.recommended_url || r.selected_url || '';
    r.current_url = r.current_url || '';
    return r;
  });
}

function validatePack(file: string): void {
  const rows = readPackCsv(file);
  const APPLY = new Set(['APPROVE', 'APPROVE_DISTINCT']);
  const issues: string[] = [];
  let appliable = 0;
  for (const r of rows) {
    const d = (r.owner_decision || '').trim();
    if (!APPLY.has(d)) continue;
    appliable++;
    if (!r.recommended_type_id) issues.push(`[${r.keyword}] APPROVE sans recommended_type_id`);
    if (!/^\/pieces\/.+\.html$/.test(r.recommended_url || '')) issues.push(`[${r.keyword}] recommended_url non /pieces/...html : "${r.recommended_url}"`);
    if (/constructeurs\//.test(r.recommended_url || '')) issues.push(`[${r.keyword}] URL constructeur seule interdite`);
    if (r.gamme && r.pg_id && !(r.recommended_url || '').includes(`-${r.pg_id}/`)) issues.push(`[${r.keyword}] gamme incohérente (pg_id ${r.pg_id} absent de l'URL)`);
  }
  const candidates = rows.filter((r) => /_CANDIDATE$|_OWNER$/.test(r.owner_decision || ''));
  console.log(`validate-pack: ${rows.length} lignes, ${appliable} APPLICABLES (APPROVE/APPROVE_DISTINCT).`);
  if (candidates.length) console.log(`⚠️  ${candidates.length} lignes encore en proposition (_CANDIDATE/_OWNER) — owner doit trancher.`);
  if (issues.length) { console.error(`❌ ${issues.length} problème(s):`); issues.forEach((i) => console.error('   - ' + i)); process.exitCode = 1; }
  else console.log(`✅ Contrôles OK sur les lignes applicables. REVIEW/DEFER/REJECT exclues de tout apply.`);
}

async function applyPack(file: string): Promise<void> {
  if (flag('--apply')) {
    console.error('⛔ apply RÉEL non implémenté (owner-gated, hors périmètre). Ce build ne fait QUE le dry-run.');
    console.error('   Aucune écriture DB possible depuis ce script. Utiliser --dry-run.');
    process.exitCode = 2; return;
  }
  const rows = readPackCsv(file).filter((r) => ['APPROVE', 'APPROVE_DISTINCT'].includes((r.owner_decision || '').trim()));
  const changes = rows.filter((r) => r.recommended_type_id && r.recommended_type_id !== r.current_type_id);
  const out: string[] = [
    `-- DRY-RUN V3 apply (AUCUNE MUTATION) · ${DATE}`,
    `-- ${rows.length} lignes APPROVE/APPROVE_DISTINCT, dont ${changes.length} changeraient.`,
    '-- SQL ci-dessous = PROPOSITION pour exécution owner-gated manuelle. Le script n écrit JAMAIS.', '',
  ];
  console.log(`\nDRY-RUN — ${rows.length} lignes applicables, ${changes.length} changements :\n`);
  for (const r of changes) {
    console.log(`  • ${r.keyword} [pg ${r.pg_id}] : ${r.current_type_id || 'NULL'} -> ${r.recommended_type_id}`);
    console.log(`      avant : ${r.current_url || '(aucune)'}`);
    console.log(`      après : ${r.recommended_url}`);
    // v_level exact si le pack le porte (packs génériques V2/V3/V4), sinon champions V2/V3
    const vl = r.v_level ? `v_level = '${r.v_level}'` : `v_level IN ('V2','V3')`;
    out.push(`-- ${r.keyword} (pg ${r.pg_id}, ${r.v_level || 'V2/V3'}) : ${r.current_type_id || 'NULL'} -> ${r.recommended_type_id}`);
    out.push(`UPDATE "__seo_keywords" SET type_id = ${r.recommended_type_id} WHERE pg_id = ${r.pg_id} AND keyword = '${r.keyword.replace(/'/g, "''")}' AND ${vl}; -- rollback: SET type_id = ${r.current_type_id || 'NULL'}`);
  }
  const sqlFile = file.replace(/\.csv$/, `.apply-dryrun.sql`);
  fs.writeFileSync(sqlFile, out.join('\n') + '\n');
  console.log(`\n📄 SQL proposé (NON exécuté) : ${sqlFile}`);
  console.log('⚠️  ZÉRO mutation. essence≠diesel : l essence courante reste un V3 distinct (ne pas supprimer).');
}

(async () => {
  const mode = process.argv[2];
  if (mode === 'decision-pack') await decisionPack(Number(arg('--pg-id') || 402));
  else if (mode === 'generics-pack') await genericsPack(Number(arg('--pg-id') || 402));
  else if (mode === 'decontaminate-pack') await decontaminatePack(Number(arg('--pg-id') || 402));
  else if (mode === 'reelection-pack') await reelectionPack(Number(arg('--pg-id') || 402));
  else if (mode === 'auto-plan') await autoPlan(arg('--family') || 'freinage');
  else if (mode === 'blocked-plan') await blockedPlan(arg('--family') || 'freinage');
  else if (mode === 'blocked-apply-pack') await blockedApplyPack(arg('--family') || 'freinage', arg('--pg-id') ? Number(arg('--pg-id')) : undefined, arg('--label'));
  else if (mode === 'validate-pack') validatePack(arg('--file')!);
  else if (mode === 'apply-pack') await applyPack(arg('--file')!);
  else { console.error('Usage: vlevel-v3-pipeline.ts <decision-pack|generics-pack|validate-pack|apply-pack> [--pg-id N | --file f] [--dry-run|--apply --owner-approved]'); process.exitCode = 1; }
})().catch((e) => { console.error('ERR:', e.message); process.exitCode = 1; });

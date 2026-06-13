/**
 * seo-readiness.ts — Cockpit READ-ONLY multi-rôles (généralise r1-readiness.ts).
 *
 * Verdict 4 dimensions (WIKI_EXPORT · KW · CONTENT · LIVE) + NEXT_ACTION par rôle,
 * pour gammes (R1/R3/R4/R6). R8 (véhicule) = déféré V1.1 (gap snapshots).
 *
 * STRICTEMENT read-only : n'exécute AUCUN pipeline (RAW→WIKI, /kp, content-gen).
 * Verdict + NEXT_ACTION seulement ; toute exécution reste owner-gated.
 *
 * Réutilise les gates WIKI de validate-gamme-schema.ts (pas de système parallèle).
 *
 * Mode batch (flotte) : classement des gammes via la vue v_gamme_readiness
 * (tri final_priority × seo_score + next_action_counts) — port du mode flotte
 * de l'ex-gamme-readiness.py (salvage A6 pré-purge RAG). Les meilleures
 * candidates à la promotion WIKI sortent en tête du classement.
 *
 * Usage: npx tsx scripts/seo/seo-readiness.ts <pg_alias> [--role R1|R3|R4|R6 | --all] [--json]
 *        npx tsx scripts/seo/seo-readiness.ts --batch [--top N] [--filter READY|PARTIAL|STARTED|BLOCKED] [--json]
 * Ref: spec build seo-readiness-multirole-signal-map (workflow).
 */

import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import {
  loadGammeFrontmatter,
  r1WikiExportReadiness,
  r3WikiExportReadiness,
  r4WikiExportReadiness,
  r6WikiExportReadiness,
} from '../validate-gamme-schema';

dotenv.config({ path: path.join(__dirname, '../../backend/.env'), quiet: true } as dotenv.DotenvConfigOptions);

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

const CONTENT_MIN_CHARS = 5000;
const CONTENT_MIN_H2 = 5;
const KW_QUALITY_MIN = 80;
const GAMME_ROLES = ['R1', 'R3', 'R4', 'R6'] as const;
type Role = (typeof GAMME_ROLES)[number];

type Dim = { status: string; detail?: string; blockers?: string[]; warnings?: string[]; reasons?: string[] };
interface RoleVerdict {
  role: Role;
  wiki: Dim;
  kw: Dim;
  content: Dim;
  live: Dim;
  next_action: string;
  error?: string;
}

// ── KW readiness (parametrized; latest version, validated + quality>=80) ──
async function kwReady(
  table: string, pgCol: string, pgVal: any, statusCol: string, qualityCol: string, versionCol: string,
): Promise<Dim> {
  const { data } = await supabase
    .from(table).select(`${statusCol}, ${qualityCol}, ${versionCol}`)
    .eq(pgCol, pgVal).order(versionCol, { ascending: false }).limit(1).maybeSingle();
  if (!data) return { status: 'BLOCKED', reasons: ['no_plan'] };
  const reasons: string[] = [];
  if ((data as any)[statusCol] !== 'validated') reasons.push(`status=${(data as any)[statusCol]}`);
  const q = (data as any)[qualityCol] ?? 0;
  if (q < KW_QUALITY_MIN) reasons.push(`quality=${q}<${KW_QUALITY_MIN}`);
  return { status: reasons.length ? 'BLOCKED' : 'READY', reasons };
}

// ── Per-role CONTENT + LIVE ──
async function r1Content(pgId: number): Promise<{ content: Dim; live: Dim }> {
  const { data } = await supabase.from('__seo_gamme').select('sg_content').eq('sg_pg_id', String(pgId)).maybeSingle();
  const c = ((data as any)?.sg_content as string) ?? '';
  const h2 = (c.match(/<h2[\s>]/gi) || []).length;
  return {
    content: { status: c.length >= CONTENT_MIN_CHARS && h2 >= CONTENT_MIN_H2 ? 'OK' : 'THIN', detail: `chars=${c.length} h2=${h2}` },
    live: { status: c.length > 0 ? 'RENDERED' : 'NOT_RENDERED' },
  };
}
async function r3Content(pgId: number): Promise<{ content: Dim; live: Dim }> {
  const { data } = await supabase.from('__seo_gamme_conseil').select('sgc_content, sgc_quality_score').eq('sgc_pg_id', String(pgId));
  const rows = (data as any[]) || [];
  const ne = rows.filter((r) => (r.sgc_content || '').trim().length > 0);
  const sum = ne.reduce((a, r) => a + (r.sgc_content || '').length, 0);
  const avgQ = ne.length ? ne.reduce((a, r) => a + (r.sgc_quality_score || 0), 0) / ne.length : 0;
  return {
    content: { status: ne.length >= 8 && sum >= 5000 && avgQ >= 80 ? 'OK' : 'THIN', detail: `sections=${ne.length} chars=${sum} avg_q=${avgQ.toFixed(0)}` },
    live: { status: ne.length >= 1 ? 'RENDERED' : 'NOT_RENDERED' },
  };
}
async function r4Content(pgId: number): Promise<{ content: Dim; live: Dim }> {
  const { data } = await supabase.from('__seo_reference')
    .select('definition, role_mecanique, composition, confusions_courantes, regles_metier, is_published').eq('pg_id', pgId).maybeSingle();
  const r = (data as any) || {};
  const def = (r.definition || '').length, roleM = (r.role_mecanique || '').length;
  const comp = Array.isArray(r.composition) ? r.composition.length : 0;
  const conf = Array.isArray(r.confusions_courantes) ? r.confusions_courantes.length : 0;
  const regles = Array.isArray(r.regles_metier) ? r.regles_metier.length : 0;
  return {
    content: { status: def >= 800 && comp >= 3 && conf >= 3 && roleM >= 200 && regles >= 3 ? 'OK' : 'THIN', detail: `def=${def} role_meca=${roleM} comp=${comp} conf=${conf} regles=${regles} published=${!!r.is_published}` },
    live: { status: r.is_published && def > 0 ? 'RENDERED' : 'NOT_RENDERED' },
  };
}
async function r6Content(pgId: number): Promise<{ content: Dim; live: Dim }> {
  const { data } = await supabase.from('__seo_gamme_purchase_guide')
    .select('sgpg_how_to_choose, sgpg_brands_guide, sgpg_selection_criteria, sgpg_gatekeeper_score, sgpg_is_draft, sgpg_role_version').eq('sgpg_pg_id', String(pgId)).maybeSingle();
  const g = (data as any) || null;
  if (!g) return { content: { status: 'THIN', detail: 'no_purchase_guide_row' }, live: { status: 'NOT_RENDERED' } };
  const choose = (g.sgpg_how_to_choose || '').length;
  const bg = g.sgpg_brands_guide;
  const brandsOk = Array.isArray(bg) ? bg.length > 0 : bg && typeof bg === 'object' ? Object.keys(bg).length > 0 : !!bg;
  const selCrit = Array.isArray(g.sgpg_selection_criteria) ? g.sgpg_selection_criteria.length : 0;
  const gk = g.sgpg_gatekeeper_score || 0;
  const v2 = String(g.sgpg_role_version || '').startsWith('v2');
  const rich = v2 ? brandsOk && selCrit >= 3 && choose >= 1000 : choose >= 1000;
  return {
    content: { status: !g.sgpg_is_draft && rich && gk >= 70 ? 'OK' : 'THIN', detail: `choose=${choose} brands=${brandsOk} sel_crit=${selCrit} gatekeeper=${gk} v=${g.sgpg_role_version} draft=${g.sgpg_is_draft}` },
    live: { status: !g.sgpg_is_draft ? 'RENDERED' : 'NOT_RENDERED' },
  };
}

function nextAction(role: Role, wiki: Dim, kw: Dim, content: Dim, live: Dim): string {
  if (wiki.status === 'BLOCKED') return 'RUN_TARGETED_RAW_TO_WIKI_GAMME';
  if (kw.status === 'BLOCKED') return `RUN_KP_${role}`;
  if (content.status === 'THIN') return `RUN_CONTENT_GEN_${role}`;
  if (live.status === 'NOT_RENDERED') return 'INVESTIGATE_RENDER';
  return 'RUN_SEO_AUDIT';
}

async function assessRole(role: Role, pgId: number, fm: any): Promise<RoleVerdict> {
  try {
    let wiki: Dim, kw: Dim, cl: { content: Dim; live: Dim };
    if (role === 'R1') {
      wiki = r1WikiExportReadiness(fm) as any;
      kw = await kwReady('__seo_r1_keyword_plan', 'rkp_pg_id', pgId, 'rkp_status', 'rkp_quality_score', 'rkp_version');
      cl = await r1Content(pgId);
    } else if (role === 'R3') {
      wiki = r3WikiExportReadiness(fm) as any;
      kw = await kwReady('__seo_r3_keyword_plan', 'skp_pg_id', pgId, 'skp_status', 'skp_quality_score', 'skp_version');
      cl = await r3Content(pgId);
    } else if (role === 'R4') {
      wiki = r4WikiExportReadiness(fm) as any;
      kw = await kwReady('__seo_r4_keyword_plan', 'r4kp_pg_id', pgId, 'r4kp_status', 'r4kp_quality_score', 'r4kp_version');
      cl = await r4Content(pgId);
    } else {
      wiki = r6WikiExportReadiness(fm) as any;
      kw = await kwReady('__seo_r6_keyword_plan', 'r6kp_pg_id', String(pgId), 'r6kp_status', 'r6kp_quality_score', 'r6kp_version');
      cl = await r6Content(pgId);
    }
    return { role, wiki, kw, content: cl.content, live: cl.live, next_action: nextAction(role, wiki, kw, cl.content, cl.live) };
  } catch (e) {
    return { role, wiki: { status: 'UNKNOWN' }, kw: { status: 'UNKNOWN' }, content: { status: 'UNKNOWN' }, live: { status: 'UNKNOWN' }, next_action: 'ERROR', error: String((e as Error).message || e) };
  }
}

// Severity for consolidation: WIKI(4) > KW(3) > CONTENT(2) > LIVE(1) > 0.
function severity(v: RoleVerdict): number {
  if (v.wiki.status === 'BLOCKED') return 4;
  if (v.kw.status === 'BLOCKED') return 3;
  if (v.content.status === 'THIN') return 2;
  if (v.live.status === 'NOT_RENDERED') return 1;
  return 0;
}

// ── Mode batch (flotte) — port du tri/agrégats de l'ex-gamme-readiness.py ──
// Source DB : vue v_gamme_readiness (cross __seo_* + gamme_aggregates, read-only).
const PRIORITY_ORDER: Record<string, number> = { P1: 0, 'P1-PENDING': 1, P2: 2, P3: 3, 'SOFT-INDEX': 4 };
const READINESS_LEVELS = ['READY', 'PARTIAL', 'STARTED', 'BLOCKED'] as const;

interface GammeReadinessRow {
  pg_id: number | null;
  pg_alias: string | null;
  final_priority: string | null;
  seo_score: number | null;
  conseil_sections: number | null;
  standard_coverage: number | null;
  conseil_avg_quality: number | null;
  readiness_level: string | null;
  next_action: string | null;
}

// Cap supabase-js 1000 lignes → pagination .range() systématique.
async function fetchGammeReadiness(): Promise<GammeReadinessRow[]> {
  const PAGE = 1000;
  const rows: GammeReadinessRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('v_gamme_readiness')
      .select('pg_id, pg_alias, final_priority, seo_score, conseil_sections, standard_coverage, conseil_avg_quality, readiness_level, next_action')
      .order('pg_id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`v_gamme_readiness: ${error.message}`);
    rows.push(...((data as GammeReadinessRow[]) ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows.filter((r) => r.pg_alias);
}

async function runBatch(args: string[]): Promise<void> {
  const topArg = (() => { const i = args.indexOf('--top'); return i >= 0 ? parseInt(args[i + 1], 10) : NaN; })();
  const filterArg = (() => { const i = args.indexOf('--filter'); return i >= 0 ? args[i + 1]?.toUpperCase() : null; })();
  if (filterArg && !(READINESS_LEVELS as readonly string[]).includes(filterArg)) {
    console.error(`--filter invalide: ${filterArg}. Dispo: ${READINESS_LEVELS.join('|')}`);
    process.exit(2);
  }

  const all = await fetchGammeReadiness();

  // Tri repris du legacy : final_priority ASC (P1 d'abord), seo_score DESC.
  const ranked = (filterArg ? all.filter((r) => r.readiness_level === filterArg) : [...all]).sort(
    (a, b) =>
      (PRIORITY_ORDER[a.final_priority ?? ''] ?? 99) - (PRIORITY_ORDER[b.final_priority ?? ''] ?? 99) ||
      (b.seo_score ?? 0) - (a.seo_score ?? 0),
  );
  const top = Number.isFinite(topArg) && topArg > 0 ? ranked.slice(0, topArg) : ranked;

  // Agrégats (sur le périmètre filtré) : distribution readiness + next_action_counts.
  const readinessCounts: Record<string, number> = {};
  const nextActionCounts: Record<string, number> = {};
  for (const r of ranked) {
    const rl = r.readiness_level ?? 'BLOCKED';
    const na = r.next_action ?? '?';
    readinessCounts[rl] = (readinessCounts[rl] ?? 0) + 1;
    nextActionCounts[na] = (nextActionCounts[na] ?? 0) + 1;
  }

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({
      kind: 'gamme_batch',
      source: 'v_gamme_readiness',
      total: ranked.length,
      filter: filterArg,
      readiness_counts: readinessCounts,
      next_action_counts: nextActionCounts,
      ranking: top,
    }, null, 2));
    return;
  }

  console.log(`\nSEO_READINESS --batch (${ranked.length} gammes${filterArg ? `, filter=${filterArg}` : ''}) — read-only, n'exécute rien`);
  console.log(`Tri: final_priority ASC × seo_score DESC — meilleures candidates promotion WIKI en tête.\n`);

  for (const level of READINESS_LEVELS) {
    const count = readinessCounts[level] ?? 0;
    const pct = ranked.length ? Math.round((100 * count) / ranked.length) : 0;
    console.log(`  ${level.padEnd(10)}: ${String(count).padStart(4)} (${String(pct).padStart(2)}%)`);
  }

  console.log(`\n  Actions suggérées (next_action_counts) :`);
  for (const [action, count] of Object.entries(nextActionCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${action.padEnd(30)}: ${count} gammes`);
  }

  console.log(`\n  ${'#'.padStart(3)}  ${'Alias'.padEnd(30)} ${'Pri'.padStart(11)} ${'SEO'.padStart(4)} ${'Sect'.padStart(5)} ${'Cov'.padStart(5)} ${'Qual'.padStart(5)} ${'Ready'.padStart(8)}  Action`);
  console.log(`  ${'-'.repeat(100)}`);
  top.forEach((r, i) => {
    const cov = r.standard_coverage != null ? `${Math.round(Number(r.standard_coverage) * 100)}%` : '0%';
    const qual = r.conseil_avg_quality != null ? `${Math.round(Number(r.conseil_avg_quality))}` : '0';
    console.log(
      `  ${String(i + 1).padStart(3)}  ${(r.pg_alias ?? '?').padEnd(30)} ${(r.final_priority ?? '?').padStart(11)} ${String(r.seo_score ?? 0).padStart(4)} ${String(r.conseil_sections ?? 0).padStart(5)} ${cov.padStart(5)} ${qual.padStart(5)} ${(r.readiness_level ?? '?').padStart(8)}  ${r.next_action ?? '?'}`,
    );
  });
}

async function main() {
  const args = process.argv.slice(2);

  // Mode batch (flotte) : classement v_gamme_readiness, pas d'alias requis.
  if (args.includes('--batch')) { await runBatch(args); return; }

  const alias = args.find((a) => !a.startsWith('--'));
  const roleArg = (() => { const i = args.indexOf('--role'); return i >= 0 ? args[i + 1] : null; })();
  const all = args.includes('--all');
  if (!alias) { console.error('Usage: npx tsx scripts/seo/seo-readiness.ts <pg_alias> [--role R1|R3|R4|R6 | --all] [--json]\n       npx tsx scripts/seo/seo-readiness.ts --batch [--top N] [--filter READY|PARTIAL|STARTED|BLOCKED] [--json]'); process.exit(2); }

  // Entity-kind detection (gamme). Vehicle/R8 deferred V1.1.
  const { data: g } = await supabase.from('pieces_gamme').select('pg_id, pg_name').eq('pg_alias', alias).maybeSingle();
  if (!g) { console.error(`gamme introuvable: ${alias} (R8/véhicule non couvert en V1)`); process.exit(1); }
  const pgId = (g as any).pg_id as number;
  const fm = loadGammeFrontmatter(alias);

  let roles: Role[] = [...GAMME_ROLES];
  if (roleArg && !all) {
    const r = roleArg.toUpperCase() as Role;
    if (!GAMME_ROLES.includes(r)) { console.error(`Rôle non couvert en V1 (gamme): ${roleArg}. Dispo: ${GAMME_ROLES.join(',')} (R8=véhicule, déféré).`); process.exit(2); }
    roles = [r];
  }

  const verdicts: RoleVerdict[] = [];
  for (const role of roles) verdicts.push(await assessRole(role, pgId, fm));

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ alias, pg_id: pgId, kind: 'gamme', roles: verdicts }, null, 2));
    return;
  }

  console.log(`\nSEO_READINESS ${alias} (pg_id ${pgId}, gamme) — read-only, n'exécute rien`);
  for (const v of verdicts) {
    const wx = v.wiki.blockers?.length ? `  blockers:[${v.wiki.blockers.join(', ')}]` : '';
    const ww = v.wiki.warnings?.length ? `  warnings:[${v.wiki.warnings.join(', ')}]` : '';
    const kr = v.kw.reasons?.length ? `  reasons:[${v.kw.reasons.join(', ')}]` : '';
    console.log(`\n[${v.role}]${v.error ? `  ERROR: ${v.error}` : ''}`);
    console.log(`  WIKI_EXPORT: ${v.wiki.status}${wx}${ww}`);
    console.log(`  KW:          ${v.kw.status}${kr}`);
    console.log(`  CONTENT:     ${v.content.status}  (${v.content.detail ?? ''})`);
    console.log(`  LIVE:        ${v.live.status}`);
    console.log(`  NEXT_ACTION: ${v.next_action}`);
  }

  // Consolidated entity-level NEXT_ACTION (worst role first).
  const blocking = verdicts.filter((v) => severity(v) > 0).sort((a, b) => severity(b) - severity(a));
  console.log(`\n── CONSOLIDÉ ──`);
  if (!blocking.length) {
    console.log(`  Tous rôles OK → RUN_SEO_AUDIT (re-vérif périodique, owner-gated)`);
  } else {
    console.log(`  Rôles bloqués (pire d'abord) : ${blocking.map((v) => `${v.role}(${v.next_action})`).join('  ·  ')}`);
    console.log(`  NEXT_ACTION: enrichir ${blocking[0].role} d'abord → ${blocking[0].next_action}   (owner-gated)`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

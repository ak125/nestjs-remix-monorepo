/**
 * seo-r3-consolidation-evidence.logic.ts — PURE decision logic + renderer.
 *
 * No I/O (testable on fixtures). Encodes the owner-approved guardrails:
 *  (1) evidence_complete=false ⇒ recommendation/url_* forced to OBSERVE.
 *  (2) architecture `recommendation` rendered SEPARATELY from URL posture.
 *  (3) explicit risk_level + risk_reasons.
 *  (4) lexical Jaccard is a WEAK signal — never triggers MERGE+301 alone;
 *      a fold candidate needs HIGH overlap + 0 clicks + same intent + R3 rich.
 */
import { escapeMarkdownCell } from '../audit/utils/escape-markdown-cell';
import type { GammeRow, Matrix, RoleSignalsT } from './seo-r3-consolidation-evidence.schema';

// ── thresholds (reused from seo-readiness.ts / validate-gamme-schema.ts) ──
export const CONTENT_MIN_CHARS = 5000;
const R3_MIN_SECTIONS = 8;
const KW_QUALITY_MIN = 80;
const IMPR_MEANINGFUL_90D = 100; // 90d impressions floor to call search demand "meaningful"
const OVERLAP_LOW = 0.15;
const OVERLAP_HIGH = 0.35;

// ── date window (input-derived from --end ; no wall-clock) ──
export function windowFromEnd(end: string): Matrix['window'] {
  const e = new Date(`${end}T00:00:00Z`);
  if (Number.isNaN(e.getTime())) throw new Error(`invalid --end date: ${end}`);
  const minus = (days: number): string => {
    const d = new Date(e);
    d.setUTCDate(e.getUTCDate() - days);
    return d.toISOString().slice(0, 10);
  };
  return { end, d28: { start: minus(27), end }, d90: { start: minus(89), end } };
}

// ── lexical overlap (WEAK signal) ──
const FR_STOP = new Set(['pour', 'avec', 'dans', 'votre', 'vous', 'cette', 'plus', 'sont', 'leur', 'des', 'les', 'une', 'aux', 'sur', 'par', 'que', 'qui', 'est', 'son', 'ses', 'ces', 'the', 'and']);
export function tokenizeFr(text: string): Set<string> {
  const norm = (text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ');
  const out = new Set<string>();
  for (const tok of norm.split(' ')) {
    if (tok.length >= 4 && !FR_STOP.has(tok)) out.add(tok);
  }
  return out;
}
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}
export function overlapBand(j: number | null): 'LOW' | 'MED' | 'HIGH' | 'OBSERVE' {
  if (j === null) return 'OBSERVE';
  if (j < OVERLAP_LOW) return 'LOW';
  if (j < OVERLAP_HIGH) return 'MED';
  return 'HIGH';
}

// ── live status (reused thresholds) ──
export function r3Live(sections: { content: string; quality: number }[]): RoleSignalsT['live'] {
  const ne = sections.filter((s) => (s.content || '').trim().length > 0);
  if (ne.length === 0) return 'ABSENT';
  const sum = ne.reduce((a, s) => a + (s.content || '').length, 0);
  const avgQ = ne.reduce((a, s) => a + (s.quality || 0), 0) / ne.length;
  return ne.length >= R3_MIN_SECTIONS && sum >= CONTENT_MIN_CHARS && avgQ >= KW_QUALITY_MIN ? 'PRESENT_RICH' : 'PRESENT_THIN';
}
export function r4Live(row: any | null): RoleSignalsT['live'] {
  if (!row) return 'ABSENT';
  const def = (row.definition || '').length;
  const roleM = (row.role_mecanique || '').length;
  const comp = Array.isArray(row.composition) ? row.composition.length : 0;
  const conf = Array.isArray(row.confusions_courantes) ? row.confusions_courantes.length : 0;
  const regles = Array.isArray(row.regles_metier) ? row.regles_metier.length : 0;
  if (!row.is_published) return def > 0 ? 'DRAFT' : 'ABSENT';
  return def >= 800 && comp >= 3 && conf >= 3 && roleM >= 200 && regles >= 3 ? 'PRESENT_RICH' : 'PRESENT_THIN';
}
export function r6Live(row: any | null): RoleSignalsT['live'] {
  if (!row) return 'ABSENT';
  if (row.sgpg_is_draft) return 'DRAFT';
  const choose = (row.sgpg_how_to_choose || '').length;
  const bg = row.sgpg_brands_guide;
  const brandsOk = Array.isArray(bg) ? bg.length > 0 : bg && typeof bg === 'object' ? Object.keys(bg).length > 0 : !!bg;
  const selCrit = Array.isArray(row.sgpg_selection_criteria) ? row.sgpg_selection_criteria.length : 0;
  const gk = row.sgpg_gatekeeper_score || 0;
  const rich = brandsOk && selCrit >= 3 && choose >= 1000 && gk >= 70;
  return rich ? 'PRESENT_RICH' : 'PRESENT_THIN';
}

// ── per-role signal helpers ──
const hasClicks = (r: RoleSignalsT): boolean => (r.gsc_28d?.clicks ?? 0) > 0 || (r.gsc_90d?.clicks ?? 0) > 0;
const hasImpr = (r: RoleSignalsT): boolean => (r.gsc_90d?.impressions ?? 0) >= IMPR_MEANINGFUL_90D;
const isLive = (r: RoleSignalsT): boolean => r.live === 'PRESENT_RICH' || r.live === 'PRESENT_THIN';

/** Missing signals for a role that IS live (absent pages need no GSC/robots). */
function roleMissing(r: RoleSignalsT): string[] {
  if (!isLive(r)) return [];
  const m: string[] = [];
  if (r.gsc_28d === null) m.push(`${r.role}.gsc`);
  if (r.index_follow === 'OBSERVE') m.push(`${r.role}.index_follow`);
  if (r.inbound_links === null) m.push(`${r.role}.inbound_links`);
  return m;
}

/** Owner adjustment 1 — row evidence completeness (only R4/R6 fold candidates gate it). */
export function evidenceCompleteness(row: Pick<GammeRow, 'roles'>): { complete: boolean; missing: string[] } {
  const missing = [...roleMissing(row.roles.R4), ...roleMissing(row.roles.R6)];
  return { complete: missing.length === 0, missing };
}

function overlapFor(row: GammeRow, pair: 'R3_R4' | 'R3_R6'): 'LOW' | 'MED' | 'HIGH' | 'OBSERVE' {
  return row.overlaps.find((o) => o.pair === pair)?.band ?? 'OBSERVE';
}

/**
 * URL posture for a fold-candidate role (R4 or R6) — TARGET state, never executed.
 * Owner adj 4: MERGE+301 requires HIGH overlap + 0 clicks + 0 meaningful impr + R3 rich
 * (near-dup with no distinct demand). Distinct demand → KEEP. Doubtful → CANONICAL.
 */
export function urlVerdict(
  role: RoleSignalsT,
  band: 'LOW' | 'MED' | 'HIGH' | 'OBSERVE',
  r3Rich: boolean,
  evidenceComplete: boolean,
): 'KEEP' | 'MERGE+301' | 'CANONICAL' | 'OBSERVE' {
  if (!evidenceComplete) return 'OBSERVE'; // adj 1
  if (!isLive(role)) return 'OBSERVE'; // no live page → no posture
  // KEEP requires REAL demand — owner adj 4: lexical overlap (incl. LOW) never decides alone.
  const demand = hasClicks(role) || (hasImpr(role) && role.index_follow === 'INDEX_FOLLOW');
  if (demand) return 'KEEP';
  // No demand: a near-duplicate of a rich R3 is a fold candidate; a near-dup of a thin R3
  // is canonical-first; otherwise (LOW/MED overlap, no demand) signals are too weak → OBSERVE.
  if (band === 'HIGH' && r3Rich) return 'MERGE+301';
  if (band === 'HIGH') return 'CANONICAL';
  return 'OBSERVE';
}

/** Owner adjustment 2 — architecture recommendation, derived from KEEP decisions. */
export function recommendation(row: GammeRow): GammeRow['recommendation'] {
  if (!row.evidence_complete) return 'OBSERVE'; // adj 1
  if (row.roles.R3.live === 'ABSENT') return 'OBSERVE'; // no R3 pillar yet
  const r4Live = isLive(row.roles.R4);
  const r6Live = isLive(row.roles.R6);
  if (!r4Live && !r6Live) return 'NO_ACTION'; // R3-only page-set already; nothing to consolidate
  // An undetermined live role (insufficient evidence to keep or fold) blocks a final call.
  if ((r4Live && row.url_R4 === 'OBSERVE') || (r6Live && row.url_R6 === 'OBSERVE')) return 'OBSERVE';
  const keepR4 = row.url_R4 === 'KEEP';
  const keepR6 = row.url_R6 === 'KEEP';
  if (keepR4 && keepR6) return 'R3_PLUS_R4_R6';
  if (keepR4) return 'R3_PLUS_R4';
  if (keepR6) return 'R3_PLUS_R6';
  return 'R3_ONLY'; // all live fold-candidates → MERGE+301/CANONICAL (consolidate into R3)
}

/** Owner adjustment 3 — explicit risk of treating R4/R6 as mergeable. */
export function risk(row: Pick<GammeRow, 'roles' | 'overlaps'>): { level: GammeRow['risk_level']; reasons: string[] } {
  const reasons: string[] = [];
  const r3Rich = row.roles.R3.live === 'PRESENT_RICH';
  for (const role of [row.roles.R4, row.roles.R6]) {
    if (!isLive(role)) continue;
    if (hasClicks(role)) reasons.push(`${role.role} a des clics GSC`);
    if (hasImpr(role) && role.index_follow === 'INDEX_FOLLOW') reasons.push(`${role.role} index/follow avec impressions`);
  }
  for (const o of row.overlaps) if (o.band === 'LOW') reasons.push(`overlap ${o.pair} faible (intention probablement distincte)`);
  if (reasons.length > 0) return { level: 'HIGH', reasons };
  // No demand/distinct-intent signal → LOW only if a clean near-duplicate against a rich R3.
  const nearDupCandidate = [row.roles.R4, row.roles.R6].some(
    (r) => isLive(r) && row.overlaps.find((o) => o.pair === (r.role === 'R4' ? 'R3_R4' : 'R3_R6'))?.band === 'HIGH',
  );
  if (nearDupCandidate && r3Rich) return { level: 'LOW', reasons: ['quasi-duplicat sans clics + overlap fort + R3 riche'] };
  return { level: 'MEDIUM', reasons: ['GSC faible mais signal de duplication non concluant'] };
}

function nextAction(row: GammeRow): string {
  if (!row.evidence_complete) return `COLLECT_SIGNALS (${row.missing_signals.join(', ')})`;
  if (row.recommendation === 'OBSERVE') return 'OBSERVE_GSC';
  if (row.recommendation === 'NO_ACTION') return 'NO_ACTION';
  return 'OWNER_REVIEW_ARCHITECTURE'; // any fold/canonical/301 stays owner+ADR-gated, out of scope
}

/** Assemble the verdict fields for a row whose signals are already populated. */
export function decide(base: Omit<GammeRow, 'evidence_complete' | 'missing_signals' | 'recommendation' | 'url_R4' | 'url_R6' | 'risk_level' | 'risk_reasons' | 'next_action'>): GammeRow {
  const { complete, missing } = evidenceCompleteness(base);
  const r3Rich = base.roles.R3.live === 'PRESENT_RICH';
  const url_R4 = urlVerdict(base.roles.R4, overlapFor(base as GammeRow, 'R3_R4'), r3Rich, complete);
  const url_R6 = urlVerdict(base.roles.R6, overlapFor(base as GammeRow, 'R3_R6'), r3Rich, complete);
  const withUrls = { ...base, evidence_complete: complete, missing_signals: missing, url_R4, url_R6 } as GammeRow;
  const reco = recommendation(withUrls);
  const r = risk(withUrls);
  const row: GammeRow = { ...withUrls, recommendation: reco, risk_level: r.level, risk_reasons: r.reasons, next_action: '' };
  row.next_action = nextAction(row);
  return row;
}

// ── markdown renderer (architecture ⟂ URL posture, owner adj 2) ──
const cell = (v: unknown): string => escapeMarkdownCell(String(v ?? ''));
const gscCell = (m: { clicks: number; impressions: number; position: number | null } | null): string =>
  m === null ? 'OBSERVE' : `${m.clicks}c / ${m.impressions}i / ${m.position === null ? '—' : m.position.toFixed(1)}`;

export function renderMatrixMd(matrix: Matrix): string {
  const counts: Record<string, number> = {};
  for (const r of matrix.rows) counts[r.recommendation] = (counts[r.recommendation] ?? 0) + 1;
  const L: string[] = [];
  L.push(`# R3 pillar consolidation evidence — ${matrix.window.end}`);
  L.push('');
  L.push(`> **Read-only evidence matrix.** Mesure uniquement — ne décide AUCUN fold/canonical/301.`);
  L.push(`> Site \`${matrix.site}\` · fenêtres GSC 28j (${matrix.window.d28.start}→${matrix.window.d28.end}) + 90j (${matrix.window.d90.start}→${matrix.window.d90.end}) · live-robots: ${matrix.live_robots}.`);
  L.push(`> **\`evidence_complete=false\` ⇒ recommendation & url_* = OBSERVE** (aucun verdict fort sans tous les signaux).`);
  L.push(`> **Architecture recommendation ≠ URL posture** : \`R3_ONLY\` n'implique JAMAIS 301. \`MERGE+301\` = cible théorique, jamais une action.`);
  L.push(`> Overlap lexical (Jaccard) = **signal faible** : ne déclenche jamais MERGE+301 seul (exige HIGH overlap + 0 clic + même intention + R3 riche).`);
  L.push('');
  L.push(`**Recommendations:** ${Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(' · ') || '—'}`);
  L.push('');
  // Summary table
  L.push('## Synthèse');
  L.push('');
  L.push('| gamme | architecture | url_R4 | url_R6 | risk | evidence | next_action |');
  L.push('|---|---|---|---|---|---|---|');
  for (const r of matrix.rows) {
    L.push(`| ${cell(r.pg_alias)} (${r.pg_id}) | ${cell(r.recommendation)} | ${cell(r.url_R4)} | ${cell(r.url_R6)} | ${cell(r.risk_level)} | ${r.evidence_complete ? 'complete' : 'INCOMPLETE'} | ${cell(r.next_action)} |`);
  }
  L.push('');
  // Per-gamme detail (skip NO_ACTION)
  L.push('## Détail par gamme');
  for (const r of matrix.rows) {
    if (r.recommendation === 'NO_ACTION') continue;
    L.push('');
    L.push(`### ${r.pg_alias} (pg_id ${r.pg_id})`);
    L.push('');
    L.push(`- **Architecture recommendation**: \`${r.recommendation}\``);
    L.push(`- **URL posture**: R4 \`${r.url_R4}\` · R6 \`${r.url_R6}\``);
    L.push(`- **Risk**: \`${r.risk_level}\`${r.risk_reasons.length ? ` — ${r.risk_reasons.map(cell).join(' ; ')}` : ''}`);
    L.push(`- **evidence_complete**: ${r.evidence_complete}${r.missing_signals.length ? ` — missing: ${r.missing_signals.join(', ')}` : ''}`);
    L.push(`- **intent_targets**: ${r.intent_targets.join(', ') || '—'}${r.user_intent_gap.length ? ` · gap: ${r.user_intent_gap.join(', ')}` : ''}`);
    L.push('');
    L.push('  | rôle | live | GSC 28j | GSC 90j | index/follow | inbound | overlap↔R3 |');
    L.push('  |---|---|---|---|---|---|---|');
    const ovl = (p: 'R3_R4' | 'R3_R6'): string => r.overlaps.find((o) => o.pair === p)?.band ?? '—';
    L.push(`  | R3 | ${r.roles.R3.live} | ${gscCell(r.roles.R3.gsc_28d)} | ${gscCell(r.roles.R3.gsc_90d)} | ${r.roles.R3.index_follow} | ${r.roles.R3.inbound_links ?? 'OBSERVE'} | — |`);
    L.push(`  | R4 | ${r.roles.R4.live} | ${gscCell(r.roles.R4.gsc_28d)} | ${gscCell(r.roles.R4.gsc_90d)} | ${r.roles.R4.index_follow} | ${r.roles.R4.inbound_links ?? 'OBSERVE'} | ${ovl('R3_R4')} |`);
    L.push(`  | R6 | ${r.roles.R6.live} | ${gscCell(r.roles.R6.gsc_28d)} | ${gscCell(r.roles.R6.gsc_90d)} | ${r.roles.R6.index_follow} | ${r.roles.R6.inbound_links ?? 'OBSERVE'} | ${ovl('R3_R6')} |`);
  }
  L.push('');
  L.push('---');
  L.push('_Read-only evidence. Toute décision fold/canonical/301 reste owner-gated + ADR, par lot ≤5 + surveillance GSC, APRÈS lecture de cette matrice._');
  L.push('');
  return L.join('\n');
}

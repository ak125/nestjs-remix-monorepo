/**
 * R8 Owned-Editorial Composer — Fix B Phase A (flag `R8_OWNED_EDITORIAL_ENABLED`).
 *
 * Purpose
 * -------
 * Blend OWNED, human-validated gamme editorial — `__seo_gamme_purchase_guide`
 * (gatekeeper-scored) + `__seo_gamme_conseil` (quality-scored) — with the
 * per-motorisation facts already known to the R8 enricher, to produce real
 * prose editorial blocks instead of the template/RAG-FAQ rotation that makes
 * sibling motorisations duplicate (Defect B, see
 * `audit/seo-r8-switch-coverage-baseline-clio3-20260606.md` + plan note
 * `audit/seo-r8-fixb-editorial-wiring-plan-20260608.md`).
 *
 * Anti-bricolage contract
 * -----------------------
 * - NO invented facts. The owned prose is real (sourced, gatekept); the vehicle
 *   facts are real (RPC). This module only FRAMES and CONCATENATES them.
 * - Pure functions only — no `this`, no Supabase, no I/O. DB reads live in
 *   `R8VehicleEnricherService.loadGammeEditorial()`. This keeps the composition
 *   deterministic and unit-testable.
 * - Reuses the existing R8 block shape + V5 block `type` vocabulary
 *   (`selection_help`, `maintenance_context`, `dedicated_faq`) — never invents a
 *   new block id/type (those are enum-gated by `R8_V5_ALL_BLOCK_TYPES`).
 *
 * Known Phase-A limit (honest, surfaced for owner review)
 * -------------------------------------------------------
 * Owned editorial is keyed by GAMME, not by motorisation. Two siblings sharing
 * the same anchor gamme get the same owned prose BODY; per-sibling distinctness
 * here comes from the factual frame (type/power/fuel/year) layered on top, while
 * the hard differentiation stays in the existing per-type blocks (S_TECH_SPECS,
 * S_VARIANT_DIFFERENCE). Whether this lifts `diversity_score` past the gate is
 * what the DEV pilot measures. Deeper per-motorisation editorial = Phase B (NO-GO).
 */

/** Min quality floor for owned editorial to be eligible (gatekeeper / conseil quality). */
export const R8_OWNED_EDITORIAL_MIN_QUALITY = 75;

// ── Gamme source (compatible gammes for owned editorial) ───────────────────

/** Minimal gamme row consumed by `R8VehicleEnricherService.loadGammeEditorial()`. */
export interface OwnedGammeSource {
  pg_id: number;
  pg_alias: string;
  pg_name: string;
  product_count: number;
}

/**
 * Extract the compatible-gamme list for owned editorial from the cache RPC
 * (`get_vehicle_page_data_cached`). The enricher's legacy `families` reads
 * `compatible_families`, which the current RPC does NOT return — the gammes
 * live under `popular_parts` (top, popularity-ranked) and, as a fallback,
 * `catalog.families[].gammes[]`. Used ONLY by the flag-gated owned-editorial
 * path; it does NOT touch the legacy `families` / catalog block. Pure +
 * defensive: returns `[]` when neither source is present.
 */
export function extractGammeSourceFromRpc(
  vehicleData: unknown,
): OwnedGammeSource[] {
  const vd = (vehicleData ?? {}) as Record<string, any>;
  const popular = Array.isArray(vd.popular_parts) ? vd.popular_parts : [];
  const catFamilies =
    vd.catalog && Array.isArray(vd.catalog.families) ? vd.catalog.families : [];
  const flattened = catFamilies.flatMap((f: any) =>
    Array.isArray(f?.gammes) ? f.gammes : [],
  );
  const source = popular.length > 0 ? popular : flattened;
  const out: OwnedGammeSource[] = [];
  const seen = new Set<number>();
  source.forEach((g: any, i: number) => {
    const pgId = Number(g?.pg_id);
    if (!Number.isFinite(pgId) || pgId <= 0 || seen.has(pgId)) return;
    if (!g?.pg_alias || !g?.pg_name) return;
    seen.add(pgId);
    out.push({
      pg_id: pgId,
      pg_alias: String(g.pg_alias),
      pg_name: String(g.pg_name),
      // RPC carries no product_count here; preserve source order as a proxy
      // (popular_parts is already popularity-ranked) so the anchor pick is stable.
      product_count:
        typeof g.product_count === 'number' ? g.product_count : 1000 - i,
    });
  });
  return out;
}

// ── Inputs (plain data — the service maps DB rows into these) ──────────────

export interface GammePurchaseGuide {
  how_to_choose: string | null;
  /** jsonb — array of strings or array of {label|criterion|title|name, description?} */
  selection_criteria: unknown;
  symptoms: string[] | null;
  risk_explanation: string | null;
  risk_consequences: string[] | null;
  timing_years: string | null;
  timing_km: string | null;
  timing_note: string | null;
  anti_mistakes: string[] | null;
  /** jsonb — array of {q,a} or {question,answer} */
  faq: unknown;
}

export interface GammeConseilBlock {
  content: string | null;
  section_type: string | null;
  title: string | null;
}

export interface GammeEditorial {
  pgId: number;
  pgName: string;
  pgAlias: string;
  productCount: number;
  purchaseGuide: GammePurchaseGuide | null;
  conseil: GammeConseilBlock[];
}

export interface MotorisationFacts {
  brand: string;
  model: string;
  type: string;
  power: string;
  fuel: string;
  yearFrom: string;
  yearTo: string;
}

/** Structurally compatible with the enricher's internal `R8Block`. */
export interface OwnedEditorialBlock {
  id: string;
  type: string;
  title: string;
  renderedText: string;
  specificityWeight: number;
  boilerplateRisk: number;
  semanticPayload: string[];
}

// ── jsonb / array helpers (defensive — shapes vary across gammes) ──────────

function asStringArray(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (out.length >= max) break;
    if (typeof item === 'string') {
      const s = item.trim();
      if (s) out.push(s);
    } else if (item && typeof item === 'object') {
      const o = item as Record<string, unknown>;
      const label = o.label ?? o.criterion ?? o.title ?? o.name ?? o.text;
      if (typeof label === 'string' && label.trim()) out.push(label.trim());
    }
  }
  return out;
}

export interface FaqPair {
  q: string;
  a: string;
}

export function parseOwnedFaq(value: unknown): FaqPair[] {
  if (!Array.isArray(value)) return [];
  const out: FaqPair[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const q = (o.q ?? o.question) as unknown;
    const a = (o.a ?? o.answer) as unknown;
    if (
      typeof q === 'string' &&
      typeof a === 'string' &&
      q.trim() &&
      a.trim()
    ) {
      out.push({ q: q.trim(), a: a.trim() });
    }
  }
  return out;
}

/** Factual motorisation suffix, e.g. "110 ch (diesel)". Only real facts. */
function powerFuelSuffix(facts: MotorisationFacts): string {
  const power = facts.power ? `${facts.power} ch` : '';
  const fuel = facts.fuel ? `(${facts.fuel})` : '';
  return [power, fuel].filter(Boolean).join(' ');
}

function yearSpan(facts: MotorisationFacts): string {
  if (!facts.yearFrom) return '';
  return facts.yearTo
    ? `${facts.yearFrom}–${facts.yearTo}`
    : `depuis ${facts.yearFrom}`;
}

// ── Anchor selection ───────────────────────────────────────────────────────

/**
 * Pick the anchor gamme for the per-vehicle editorial sections: the first
 * gamme (input order = product_count desc) that carries a usable purchase guide.
 */
export function pickAnchorGamme(
  editorials: GammeEditorial[],
): GammeEditorial | null {
  for (const e of editorials) {
    const pg = e.purchaseGuide;
    if (!pg) continue;
    const usable =
      (pg.how_to_choose && pg.how_to_choose.trim()) ||
      (pg.risk_explanation && pg.risk_explanation.trim()) ||
      (Array.isArray(pg.symptoms) && pg.symptoms.length > 0) ||
      (pg.timing_km && pg.timing_km.trim()) ||
      (pg.timing_years && pg.timing_years.trim());
    if (usable) return e;
  }
  return null;
}

// ── Builders (each returns null → caller falls back to existing path) ──────

/**
 * S_SELECTION_GUIDE from owned `how_to_choose` + `selection_criteria` +
 * `anti_mistakes`, optionally enriched by the top conseil block. Vehicle-framed.
 */
export function buildOwnedSelectionGuide(
  anchor: GammeEditorial,
  facts: MotorisationFacts,
): OwnedEditorialBlock | null {
  const pg = anchor.purchaseGuide;
  const howTo = pg?.how_to_choose?.trim() ?? '';
  const conseil = anchor.conseil.find((c) => c.content && c.content.trim());
  if (!howTo && !conseil) return null;

  const gammeLabel = anchor.pgName ? anchor.pgName.toLowerCase() : 'pièces';
  const suffix = powerFuelSuffix(facts);
  const frame =
    `Pour votre ${facts.brand} ${facts.model} ${facts.type}` +
    (suffix ? ` ${suffix}` : '') +
    `, voici comment bien choisir vos ${gammeLabel}.`;

  const parts: string[] = [frame];
  if (howTo) parts.push(howTo);
  else if (conseil?.content) parts.push(conseil.content.trim());

  const criteria = asStringArray(pg?.selection_criteria, 5);
  if (criteria.length) {
    parts.push(
      `**Critères de sélection :**\n${criteria.map((c) => `- ${c}`).join('\n')}`,
    );
  }

  const mistakes = asStringArray(pg?.anti_mistakes, 4);
  if (mistakes.length) {
    parts.push(`**À éviter :**\n${mistakes.map((m) => `- ${m}`).join('\n')}`);
  }

  return {
    id: 'S_SELECTION_GUIDE',
    type: 'selection_help',
    title: `Bien choisir vos ${anchor.pgName} — ${facts.brand} ${facts.model} ${facts.type}`,
    renderedText: parts.join('\n\n'),
    specificityWeight: 0.9,
    boilerplateRisk: 0.1,
    semanticPayload: [
      anchor.pgAlias,
      facts.type,
      facts.fuel,
      ...criteria.slice(0, 3),
    ].filter(Boolean),
  };
}

/**
 * S_ENTRETIEN_CONTEXT from owned `timing_*` + `risk_explanation` + `symptoms`.
 * Framed by the vehicle's age (year span). Real owned prose, no invented numbers.
 */
export function buildOwnedEntretien(
  anchor: GammeEditorial,
  facts: MotorisationFacts,
): OwnedEditorialBlock | null {
  const pg = anchor.purchaseGuide;
  if (!pg) return null;
  const risk = pg.risk_explanation?.trim() ?? '';
  const symptoms = (pg.symptoms ?? []).filter((s) => s && s.trim());
  const timingKm = pg.timing_km?.trim() ?? '';
  const timingYears = pg.timing_years?.trim() ?? '';
  const timingNote = pg.timing_note?.trim() ?? '';
  if (!risk && symptoms.length === 0 && !timingKm && !timingYears) return null;

  const span = yearSpan(facts);
  const parts: string[] = [];
  const frameHead =
    `Sur votre ${facts.brand} ${facts.model} ${facts.type}` +
    (span ? ` (${span})` : '') +
    ' :';
  parts.push(frameHead);

  if (timingKm || timingYears) {
    const echeance = [timingKm, timingYears].filter(Boolean).join(' ou ');
    parts.push(
      `**Échéance indicative :** ${echeance}.${timingNote ? ` ${timingNote}` : ''}`,
    );
  } else if (timingNote) {
    parts.push(timingNote);
  }

  if (risk) parts.push(risk);

  if (symptoms.length) {
    parts.push(
      `**Symptômes à surveiller :**\n${symptoms
        .slice(0, 5)
        .map((s) => `- ${s.trim()}`)
        .join('\n')}`,
    );
  }

  return {
    id: 'S_ENTRETIEN_CONTEXT',
    type: 'maintenance_context',
    title: `Entretien et usure — ${facts.brand} ${facts.model} ${facts.type}`,
    renderedText: parts.join('\n\n'),
    specificityWeight: 0.88,
    boilerplateRisk: 0.1,
    semanticPayload: [
      anchor.pgAlias,
      facts.type,
      ...symptoms.slice(0, 3).map((s) => s.trim()),
    ].filter(Boolean),
  };
}

/**
 * S_FAQ_DEDICATED from owned `sgpg_faq` merged across the available gammes
 * (dedup by question), instead of the per-gamme RAG-md FAQ. `opener` is the
 * existing deterministic variation opener (connective tissue, not content).
 * Requires ≥2 owned FAQ entries; else null → fallback.
 */
export function buildOwnedFaq(
  editorials: GammeEditorial[],
  facts: MotorisationFacts,
  opener: string,
): OwnedEditorialBlock | null {
  const all: FaqPair[] = [];
  for (const e of editorials) {
    if (e.purchaseGuide) all.push(...parseOwnedFaq(e.purchaseGuide.faq));
  }
  const seen = new Set<string>();
  const unique = all.filter((f) => {
    const key = f.q.toLowerCase().replace(/\s+/g, ' ').trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (unique.length < 2) return null;
  const picked = unique.slice(0, 6);

  return {
    id: 'S_FAQ_DEDICATED',
    type: 'dedicated_faq',
    title: `Questions fréquentes — ${facts.brand} ${facts.model}`,
    renderedText: `${opener}\n\n${picked
      .map((f) => `**${f.q}**\n${f.a}`)
      .join('\n\n')}`,
    specificityWeight: 0.72,
    boilerplateRisk: 0.18,
    semanticPayload: picked.map((f) => f.q.slice(0, 30)),
  };
}

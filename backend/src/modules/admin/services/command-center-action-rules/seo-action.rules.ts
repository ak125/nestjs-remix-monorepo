/**
 * SEO opportunity rules — REAL business actions (source SEO/GSC is CERTIFIED).
 * Input = GSC rows already filtered by the service to "high impressions, ~0 clicks"
 * (the clearest opportunity). Pure function (no I/O) → testable with fixtures.
 *
 * Aggregated by PAGE KIND so the queue stays a prioritized list, not 500 rows.
 * NB: these are local opportunity-grouping buckets, NOT the governed SEO R* role
 * ids — naming them by page kind avoids borrowing the canonical role vocabulary:
 *   - product (/pieces/…)            → CA impact (title/meta + bloc commercial + maillage)
 *   - content (/blog-… /conseils)    → traffic impact (CTR title/meta + maillage)
 */
import {
  CONFIDENCE_BY_CERT,
  type RawAction,
  type SeoOpportunityDetail,
} from './score-action';

export interface GscOpportunityRow {
  page: string;
  impressions: number;
  clicks: number;
  position?: number | null; // PR3: avg SERP position (rpc_seo_low_ctr_v1.avg_position)
}

type PageKind = 'product' | 'content' | 'other';

/** Deterministic URL → page kind (no DB). Mirrors the product URL + blog paths. */
export function pageKindFromUrl(url: string): PageKind {
  if (/\/pieces\//.test(url)) return 'product';
  if (/\/blog-pieces-auto\/|\/conseils\//.test(url)) return 'content';
  return 'other';
}

const KIND_META: Record<
  PageKind,
  { label: string; impact: number; urgency: number; step: string }
> = {
  product: {
    label: 'fiches produit',
    impact: 8, // trafic transactionnel → CA
    urgency: 7,
    step: 'Améliorer title/meta + ajouter un bloc commercial + renforcer le maillage interne entrant.',
  },
  content: {
    label: 'pages conseils',
    impact: 5, // trafic
    urgency: 6,
    step: 'Améliorer title/meta pour le CTR + mailler vers les fiches produit liées.',
  },
  other: {
    label: 'pages',
    impact: 4,
    urgency: 5,
    step: 'Vérifier title/meta + maillage interne.',
  },
};

// SERP "ranked" cutoff — mirrors rpc_seo_low_ctr_v1's position bands
// (top5 ≤ 5 + top15 ≤ 15 = ranked ; beyond > 15). Named (not magic): reuses the
// governed RPC's own cutoff so the advisory stays consistent with the source.
// NB: we re-derive the band from the NUMERIC position, NOT the RPC's position_band —
// the RPC maps a NULL avg_position to 'beyond', so consuming it would fabricate a
// "low position" diagnosis. Unknown must stay unknown (honest fallback below).
const SERP_RANKED_MAX = 15;

/**
 * PR3 — advisory, deterministic per-URL editorial next_step. RULE-BASED ONLY: no
 * content generation, no DB mutation, no meta/H1 edit — the operator acts manually.
 * Honest fallback when the SERP position is unknown (no fabricated diagnosis):
 *   - ranks (pos ≤ 15) but 0 clic → SERP appeal: title/meta + intent
 *   - doesn't rank (pos > 15)     → authority/content: maillage / enrich + money link
 */
export function deriveUrlNextStep(
  kind: PageKind,
  position: number | null,
): string {
  if (position == null || !Number.isFinite(position) || position <= 0) {
    // No ranking signal → generic recommendation, never a fake SERP claim.
    if (kind === 'product')
      return 'Vérifier title/meta + renforcer le maillage interne entrant (position SERP inconnue).';
    if (kind === 'content')
      return 'Vérifier title/meta + ajouter un lien vers une page produit (position SERP inconnue).';
    return 'Vérifier title/meta + indexation (position SERP inconnue).';
  }
  const pos = position.toFixed(1);
  if (position <= SERP_RANKED_MAX) {
    // Ranks but zero-click → the SERP snippet/intent is the lever, not authority.
    if (kind === 'product')
      return `Optimiser title/meta + intention d'achat : ranke (pos. ${pos}) sans clic → attractivité SERP.`;
    if (kind === 'content')
      return `Améliorer title/meta + intro/intention : ranke (pos. ${pos}) sans clic → CTR à récupérer.`;
    return `Vérifier title/meta + intention SERP : ranke (pos. ${pos}) sans clic.`;
  }
  // Beyond top15 → doesn't rank yet → authority/content first.
  if (kind === 'product')
    return `Renforcer le maillage interne entrant + vérifier l'indexation : position faible (pos. ${pos}).`;
  if (kind === 'content')
    return `Enrichir le contenu + ajouter un lien vers la page transactionnelle (money) : position faible (pos. ${pos}).`;
  return `Vérifier l'indexation + enrichir le contenu : position faible (pos. ${pos}).`;
}

export function buildSeoOpportunityActions(
  rows: GscOpportunityRow[],
): RawAction[] {
  if (!rows.length) return [];

  const byKind = new Map<PageKind, GscOpportunityRow[]>();
  for (const r of rows) {
    const kind = pageKindFromUrl(r.page);
    const arr = byKind.get(kind) ?? [];
    arr.push(r);
    byKind.set(kind, arr);
  }

  const out: RawAction[] = [];
  for (const kind of ['product', 'content', 'other'] as const) {
    const list = byKind.get(kind);
    if (!list || !list.length) continue;
    const totalImp = list.reduce((s, r) => s + r.impressions, 0);
    const sorted = [...list].sort((a, b) => b.impressions - a.impressions);
    const m = KIND_META[kind];
    // PR2 drill-down + PR3 per-URL advisory next_step. Every page behind this
    // action (already bounded by the RPC p_limit). ctr = clicks/impressions (~0
    // here, zero-click source). next_step is rule-derived from page kind + SERP
    // position (honest fallback if position is unknown).
    const details: SeoOpportunityDetail[] = sorted.map((r) => {
      const position = r.position ?? null;
      return {
        url: r.page,
        page_kind: kind,
        impressions: r.impressions,
        clicks: r.clicks,
        ctr: r.impressions > 0 ? r.clicks / r.impressions : 0,
        position,
        next_step: deriveUrlNextStep(kind, position),
      };
    });
    out.push({
      id: `seo:opportunity:${kind}`,
      title: `${list.length} ${m.label} à fort potentiel SEO (impressions sans clic)`,
      department: 'seo',
      source: 'seo',
      action_type: 'business',
      impact: m.impact,
      urgency: m.urgency,
      data_confidence: CONFIDENCE_BY_CERT.CERTIFIED, // GSC certified
      effort: kind === 'product' ? 4 : 3,
      risk: 1,
      reason: `${list.length} ${m.label} cumulent ${totalImp} impressions sur 120j avec ~0 clic → CTR à récupérer.`,
      evidence: sorted
        .slice(0, 3)
        .map((r) => `${r.page} (${r.impressions} imp, ${r.clicks} clic)`),
      next_step: m.step,
      details,
    });
  }
  return out;
}

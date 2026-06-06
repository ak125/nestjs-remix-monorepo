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
import { CONFIDENCE_BY_CERT, type RawAction } from './score-action';

export interface GscOpportunityRow {
  page: string;
  impressions: number;
  clicks: number;
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
    const top = [...list]
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 3);
    const m = KIND_META[kind];
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
      evidence: top.map(
        (r) => `${r.page} (${r.impressions} imp, ${r.clicks} clic)`,
      ),
      next_step: m.step,
    });
  }
  return out;
}

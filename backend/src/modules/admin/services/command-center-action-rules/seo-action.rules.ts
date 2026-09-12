/**
 * SEO opportunity rules — REAL business actions (source SEO/GSC, CERTIFIED
 * seulement si grain page fidèle + fraîcheur + couverture sont vérifiés — sinon PARTIAL).
 * Input = GSC rows already filtered by the service to "high impressions, ~0 clicks"
 * (the clearest opportunity) — requêtes synthétiques exclues côté RPC
 * (_seo_is_synthetic_query). Pure function (no I/O) → testable with fixtures.
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

/**
 * Méta d'honnêteté de la source GSC (enveloppe rpc_seo_low_ctr_v4/v3/v2) :
 *   - total_qualifying : pages qualifiantes AVANT le cap p_limit (divulgue le cap),
 *   - data_from/data_to : couverture réellement présente dans la fenêtre demandée
 *     (remplace le « sur 120j » qui affirmait une couverture non vérifiée),
 *   - freshness : 'fresh' = dernière ingestion dans le SLA ; 'stale'/'unknown'
 *     dégradent la confiance à PARTIAL — jamais un CERTIFIED non vérifié.
 */
export interface GscOpportunityMeta {
  total_qualifying: number | null;
  data_from: string | null; // YYYY-MM-DD — première date réellement couverte
  data_to: string | null; // YYYY-MM-DD — dernière date réellement couverte
  freshness: 'fresh' | 'stale' | 'unknown';
  /**
   * Fidélité du grain page sommé par la RPC (OBLIGATOIRE — pas de défaut rassurant) :
   *   - 'faithful' : `__seo_gsc_daily_page_totals` (dimension page seule ≈ total
   *     propriété ; rpc_seo_low_ctr_v4) ;
   *   - 'lossy'    : grains segmentés (v3 page+country+device, v2/v1 requêtes) qui
   *     restituent ~7 % des clics (mesure API 2026-09-10) → CTR par page sous-estimé ;
   *   - 'unknown'  : enveloppe absente (v1).
   * Seul 'faithful' peut être CERTIFIED.
   */
  grain_fidelity: 'faithful' | 'lossy' | 'unknown';
  /**
   * Synthèse de couverture publiée par la RPC (absente en v2/v1). v3 : ratio
   * impressions du grain segmenté. v4 (sans ratio) : 'insufficient_data' = aucune
   * impression commitée ; 'coverage_gap' = jour commité sans ligne page (grain non
   * récupéré) ; 'incomplete_days' = jours attendus absents ou non confirmés. L'écart
   * d'agrégation GSC byPage/propriété n'entre pas dans ce statut. Tout statut ≠
   * 'ok' dégrade la confiance → PARTIAL, jamais un faux CERTIFIED.
   */
  coverage_status?:
    | 'ok'
    | 'coverage_gap'
    | 'insufficient_data'
    | 'incomplete_days';
  /** Jours attendus / confirmés (marqueur de commit) dans la fenêtre (v4 uniquement ; null = inconnu). */
  days_expected?: number | null;
  days_confirmed?: number | null;
}

/** Fallback honnête (RPC v1 sans enveloppe) : rien d'affirmé, confiance PARTIAL. */
export const UNKNOWN_GSC_META: GscOpportunityMeta = {
  total_qualifying: null,
  data_from: null,
  data_to: null,
  freshness: 'unknown',
  grain_fidelity: 'unknown',
};

/**
 * Source GSC certifiable = grain page fidèle + fraîcheur vérifiée + couverture
 * 'ok' (jours complets, clics et impressions au plancher). Une couverture absente
 * n'est PAS une couverture ok.
 */
function isGscSourceCertifiable(meta: GscOpportunityMeta): boolean {
  return (
    meta.grain_fidelity === 'faithful' &&
    meta.freshness === 'fresh' &&
    meta.coverage_status === 'ok'
  );
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
  meta: GscOpportunityMeta = UNKNOWN_GSC_META,
): RawAction[] {
  const certifiable = isGscSourceCertifiable(meta);
  if (!rows.length) {
    // 0 ligne + source certifiable (grain fidèle, fraîche, couverte) = vraie
    // bonne nouvelle → rien. Sinon indistinguable d'une panne d'ingestion ou
    // d'un grain qui perd des lignes : signal de certification, jamais un silence.
    if (certifiable && meta.data_from) return [];
    return [
      {
        id: 'seo:gsc-data-gap',
        title:
          'Données GSC absentes ou non fraîches — fiabiliser avant de conclure',
        department: 'seo',
        source: 'seo',
        action_type: 'certification',
        impact: 6,
        urgency: 6,
        // le constat « pas de donnée fraîche » est lui-même certain
        data_confidence: CONFIDENCE_BY_CERT.CERTIFIED,
        effort: 3,
        risk: 1,
        reason:
          "0 page d'opportunité remontée, mais la source GSC n'est pas vérifiée " +
          `(fraîcheur : ${meta.freshness} ; grain : ${meta.grain_fidelity} ; couverture : ${meta.coverage_status ?? 'inconnue'}${meta.data_from ? '' : ', période inconnue'}) — ` +
          "impossible de distinguer « aucune opportunité » d'une ingestion arrêtée ou d'un grain incomplet.",
        evidence: [
          '__seo_gsc_daily_page_totals / __seo_gsc_daily_property_total (fenêtre vide, non fraîche ou non couverte)',
        ],
        next_step:
          "Vérifier l'ingestion GSC (gsc-daily-fetcher, rattrapage des jours manquants) et appliquer les migrations rpc_seo_low_ctr_v4 si absentes.",
      },
    ];
  }

  const sampleSize = rows.length;
  const truncated =
    meta.total_qualifying != null && meta.total_qualifying > sampleSize;
  // CERTIFIED exige grain fidèle + fraîcheur vérifiée + couverture 'ok' ; tout
  // autre cas → PARTIAL (≥ floor 40 : l'action business survit mais l'UI la
  // marque « prudence », pas de faux 90 sur donnée partielle ou grain lossy).
  const confidence = certifiable
    ? CONFIDENCE_BY_CERT.CERTIFIED
    : CONFIDENCE_BY_CERT.PARTIAL;
  // sampleSize/total_qualifying sont GLOBAUX (tous types de pages, cap p_limit
  // partagé) alors que chaque action est émise PAR type — le wording le dit.
  // « Liste complète » n'est affirmé que sur une source certifiable.
  const scopeNote = truncated
    ? `Échantillon global top ${sampleSize} par impact — ${meta.total_qualifying} pages qualifiantes (fortes impressions, ~0 clic) au total, tous types de pages confondus.`
    : meta.total_qualifying != null
      ? certifiable
        ? `Liste complète (${meta.total_qualifying} pages qualifiantes, tous types confondus).`
        : `Liste non exhaustive (${meta.total_qualifying} pages qualifiantes sur les données disponibles, tous types confondus).`
      : `Échantillon top ${sampleSize} (toutes pages) — total qualifiant inconnu (RPC v1).`;
  const daysNote =
    meta.days_expected != null && meta.days_confirmed != null
      ? ` (${meta.days_confirmed}/${meta.days_expected} jours confirmés)`
      : '';
  const coverageNote =
    meta.data_from && meta.data_to
      ? `Données GSC réellement couvertes du ${meta.data_from} au ${meta.data_to}${daysNote}`
      : 'Couverture réelle des données GSC inconnue';
  const freshnessNote =
    (meta.freshness === 'fresh'
      ? ''
      : meta.freshness === 'stale'
        ? ' ; fraîcheur GSC dégradée (ingestion en retard)'
        : ' ; fraîcheur GSC non vérifiée') +
    (meta.grain_fidelity === 'faithful'
      ? ''
      : meta.grain_fidelity === 'lossy'
        ? ' ; grain pages non exhaustif (détail segmenté ≈ 7 % des clics) — CTR par page sous-estimé, opportunités à confirmer'
        : ' ; fidélité du grain pages inconnue') +
    (meta.coverage_status == null
      ? meta.grain_fidelity === 'faithful'
        ? ' ; couverture GSC non publiée'
        : ''
      : meta.coverage_status === 'ok'
        ? ''
        : meta.coverage_status === 'insufficient_data'
          ? ' ; couverture GSC indéterminée (total propriété absent)'
          : meta.coverage_status === 'incomplete_days'
            ? ' ; jours GSC manquants ou non confirmés dans la fenêtre — totaux non exhaustifs'
            : meta.grain_fidelity === 'faithful'
              ? ' ; grain page non récupéré pour certains jours commités — opportunités possiblement incomplètes'
              : ' ; couverture pages partielle vs total propriété — opportunités possiblement incomplètes');

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
      title: `${list.length} ${m.label} à fort potentiel SEO (impressions sans clic${truncated ? ` — top ${sampleSize} toutes pages` : ''})`,
      department: 'seo',
      source: 'seo',
      action_type: 'business',
      impact: m.impact,
      urgency: m.urgency,
      data_confidence: confidence,
      effort: kind === 'product' ? 4 : 3,
      risk: 1,
      reason: `${list.length} ${m.label} cumulent ${totalImp} impressions avec ~0 clic → CTR à récupérer. ${scopeNote} ${coverageNote}${freshnessNote}.`,
      evidence: sorted
        .slice(0, 3)
        .map((r) => `${r.page} (${r.impressions} imp, ${r.clicks} clic)`),
      next_step: m.step,
      details,
    });
  }
  return out;
}

/**
 * KPI primaires mesurés des départements Data, Pages & SEO et Diagnostic
 * (`kpi_primary` de .spec/00-canon/ai-registry/agent-operating-map.yaml) —
 * règles pures. Les lectures vivent dans CommandCenterKpiService.
 *
 *   - `metric_reliability` (Data) : reprend le verdict
 *     `tracking-integrity-verdict.v1`, le rapport que la carte des départements
 *     attribue à Data (audit/automecanik-departments-map.md, Vue 6). Aucune
 *     seconde mesure de fiabilité.
 *   - `pages_generating_atc` (Pages & SEO) : pages SEO distinctes d'où part au
 *     moins un `r2_add_to_cart`. La page vient de `payload.source_url` ; « page
 *     SEO » = un rôle connu de getPageRoleFromUrl (la recherche n'en est pas une).
 *     Le ratio vue→panier du scorecard n'est pas repris : `r2_view` compte une
 *     session par vue depuis juillet (~33 000 vues pour 32 700 sessions sur 30 j,
 *     relevé du 2026-10-05), un dénominateur qui ne mesure plus des visiteurs.
 *   - `diagnostic_to_product` (Diagnostic) : sessions passées par le diagnostic
 *     (`diag_hub_view`) qui voient ensuite une page produit (`r2_view`, même
 *     `session_id`, après la première visite du diagnostic).
 *
 * Statut : la carte ne déclare aucune cible chiffrée. Comme pour `payments_kept`,
 * le statut ne juge que ce qui se constate sans cible : zéro = CRITICAL, contrôle
 * en échec = WARNING. Fort / Moyen / Faible au-delà exigerait une cible posée
 * par l'owner. La tendance passe par la fenêtre précédente (champ « Évolution »).
 */
import type { TrackingIntegrityVerdictV1 } from '../../../analytics';
import { getPageRoleFromUrl } from '../../../seo/types/page-role.types';
import type { LiveExecutiveKpi } from './live-kpi';

/** Une ligne d'événement réduite à sa session et à sa date. */
export interface SessionEventRow {
  session_id: string | null;
  created_at: string;
}

export interface DiagnosticToProductCounts {
  sessions: number;
  reachedProduct: number;
}

export interface DiagnosticVisits {
  /** Première visite du diagnostic de chaque session (ms epoch). */
  firstVisit: Map<string, number>;
  /** Sessions distinctes écartées : identifiant hors du format de l'émetteur. */
  malformedSessions: number;
}

/**
 * Format des identifiants que produit l'émetteur (generateSessionId,
 * frontend/app/utils/funnel-beacon.ts) : UUID, 32 hexadécimaux ou
 * `s_<horodatage>`. L'ingestion n'exige qu'une chaîne non vide
 * (FunnelEventInputSchema) : un autre format vient d'un client hors émetteur.
 * Il n'entre ni dans la mesure ni dans un filtre `in(...)`, où postgrest-js
 * entoure de guillemets les valeurs à `,()` sans échapper `"`. Relevé du
 * 2026-10-07 sur 60 jours : aucun identifiant hors format.
 */
const SESSION_ID_FORMAT = /^[A-Za-z0-9_-]{1,64}$/;

function unknownKpi(id: string, label: string): LiveExecutiveKpi {
  return {
    id,
    label,
    value: null,
    status: 'UNKNOWN',
    source: 'db',
    certified: false,
  };
}

export function toMetricReliabilityKpi(
  verdict: TrackingIntegrityVerdictV1 | null,
  windowDays: number,
): LiveExecutiveKpi {
  const id = 'metric_reliability';
  const label = `Data — contrôles de la mesure des commandes réussis (${windowDays} j)`;
  // UNKNOWN = lecture en échec ou aucune donnée à contrôler : rien n'est certifié.
  if (!verdict || verdict.status === 'UNKNOWN') return unknownKpi(id, label);
  const passed = verdict.checks.filter((c) => c.status === 'PASS').length;
  const status =
    verdict.status === 'CERTIFIED'
      ? 'OK'
      : passed === 0
        ? 'CRITICAL'
        : 'WARNING';
  return {
    id,
    label,
    value: passed,
    unit: `/${verdict.checks.length}`,
    status,
    source: 'db',
    certified: true,
  };
}

/** Chemin sans requête ni ancre ; null si `source_url` n'est pas un chemin. */
function pagePath(sourceUrl: string | null): string | null {
  const path = sourceUrl?.trim().split(/[?#]/, 1)[0];
  return path && path.startsWith('/') ? path : null;
}

export function countPagesGeneratingAtc(
  rows: readonly { source_url: string | null }[],
): number {
  const pages = new Set<string>();
  for (const row of rows) {
    const path = pagePath(row.source_url);
    if (path && getPageRoleFromUrl(path) != null) pages.add(path);
  }
  return pages.size;
}

export function toPagesGeneratingAtcKpi(
  pages: number | null,
  windowDays: number,
): LiveExecutiveKpi {
  const id = 'pages_generating_atc';
  const label = `Pages & SEO — pages SEO ayant généré un ajout au panier (${windowDays} j)`;
  if (pages == null) return unknownKpi(id, label);
  return {
    id,
    label,
    value: pages,
    status: pages === 0 ? 'CRITICAL' : 'OK',
    source: 'db',
    certified: true,
  };
}

/** Première visite du diagnostic de chaque session au format de l'émetteur. */
export function firstVisitBySession(
  rows: readonly SessionEventRow[],
): DiagnosticVisits {
  const first = new Map<string, number>();
  const malformed = new Set<string>();
  for (const row of rows) {
    const at = Date.parse(row.created_at);
    if (!row.session_id || Number.isNaN(at)) continue;
    if (!SESSION_ID_FORMAT.test(row.session_id)) {
      malformed.add(row.session_id);
      continue;
    }
    const known = first.get(row.session_id);
    if (known == null || at < known) first.set(row.session_id, at);
  }
  return { firstVisit: first, malformedSessions: malformed.size };
}

export function countDiagnosticToProduct(
  firstVisit: ReadonlyMap<string, number>,
  productViews: readonly SessionEventRow[],
): DiagnosticToProductCounts {
  const reached = new Set<string>();
  for (const view of productViews) {
    const session = view.session_id;
    if (!session) continue;
    const visit = firstVisit.get(session);
    if (visit != null && Date.parse(view.created_at) > visit) {
      reached.add(session);
    }
  }
  return { sessions: firstVisit.size, reachedProduct: reached.size };
}

export function toDiagnosticToProductKpi(
  counts: DiagnosticToProductCounts | null,
  windowDays: number,
): LiveExecutiveKpi {
  const id = 'diagnostic_to_product';
  const label = `Diagnostic — sessions du diagnostic qui voient ensuite un produit (${windowDays} j)`;
  if (!counts) return unknownKpi(id, label);
  return {
    id,
    label,
    value: counts.reachedProduct,
    unit: `/${counts.sessions}`,
    status: counts.reachedProduct === 0 ? 'CRITICAL' : 'OK',
    source: 'db',
    certified: true,
  };
}

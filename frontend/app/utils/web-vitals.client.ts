/**
 * web-vitals.client — Field Web Vitals reporter (LCP, INP, CLS, FCP, TTFB).
 *
 * Pousse chaque Web Vital vers, en cascade :
 *   1. Sentry.metrics.distribution (si l'API existe dans la version SDK installée)
 *   2. window.gtag (GA4) - déjà câblé via root.tsx, RGPD consent géré
 *   3. console.info (toujours, pour debug + Sentry breadcrumbs)
 *
 * ⚡ Attribution (web-vitals/attribution) : on capture, en plus de la valeur,
 * le *pourquoi* (élément interagi + décomposition des phases). C'est ce qui
 * permet de diagnostiquer un INP > 500ms en champ (quel sélecteur, et si le
 * coût est en input delay / processing / presentation). Sans ça on ne voit
 * que la valeur agrégée, jamais la cause. Le build attribution est le même
 * package `web-vitals` (pas de nouvelle dépendance) et ne tourne que côté
 * client après hydratation.
 *
 * Aucun appel n'est inventé : `Sentry.metrics?.distribution` est testé runtime
 * avant usage. Si la lib n'expose pas cette API (build minimal, version sans
 * Metrics, DSN absent → init noop), on tombe sur le fallback GA4/console
 * sans planter. Le dispatch entier est aussi wrappé en try/catch : un reporter
 * passif ne doit jamais corrompre l'app (extension navigateur qui hook
 * `console`, CMP qui mock `gtag`, etc.).
 */

import {
  onLCP,
  onCLS,
  onINP,
  onFCP,
  onTTFB,
  type MetricWithAttribution,
} from "web-vitals/attribution";

interface SentryMetricsDistribution {
  (
    name: string,
    value: number,
    options?: { unit?: string; tags?: Record<string, string> },
  ): void;
}

interface SentryMetricsApi {
  distribution?: SentryMetricsDistribution;
}

interface SentryWithMetrics {
  metrics?: SentryMetricsApi;
}

// Sentry instance is bound here by entry.client.tsx after lazy load
// (post-hydration idle). Until then `_sentry` is null and reportToSentry()
// short-circuits to GA4 + console without error.
let _sentry: SentryWithMetrics | null = null;

/**
 * Bind the lazy-loaded Sentry instance to the web-vitals reporter.
 * Called once from entry.client.tsx after `Sentry.init()` succeeds.
 */
export function setSentryInstance(s: unknown): void {
  _sentry = s as SentryWithMetrics;
}

interface GtagWindow {
  gtag?: (
    command: "event",
    eventName: string,
    params: Record<string, unknown>,
  ) => void;
}

// GA4 param values et Sentry tag values sont bornés (≈100-200 chars). Les
// sélecteurs CSS d'attribution peuvent être longs → on tronque.
const MAX_SELECTOR_LEN = 100;
function truncate(s: string, n = MAX_SELECTOR_LEN): string {
  return s.length > n ? s.slice(0, n) : s;
}

/**
 * Champs d'attribution actionnables par métrique. Le narrowing sur
 * `metric.name` (union discriminée web-vitals) type `metric.attribution`.
 * Valeurs numériques arrondies (ms). Renvoie {} pour les métriques dont
 * l'attribution n'apporte pas de diagnostic actionnable (FCP/TTFB).
 */
function attributionFields(
  metric: MetricWithAttribution,
): Record<string, string | number> {
  switch (metric.name) {
    case "INP":
      return {
        attr_target: truncate(metric.attribution.interactionTarget),
        attr_interaction_type: metric.attribution.interactionType,
        attr_load_state: metric.attribution.loadState,
        attr_input_delay: Math.round(metric.attribution.inputDelay),
        attr_processing_duration: Math.round(
          metric.attribution.processingDuration,
        ),
        attr_presentation_delay: Math.round(
          metric.attribution.presentationDelay,
        ),
      };
    case "LCP":
      return {
        attr_element: truncate(metric.attribution.target ?? ""),
        attr_ttfb: Math.round(metric.attribution.timeToFirstByte),
        attr_resource_load_delay: Math.round(
          metric.attribution.resourceLoadDelay,
        ),
        attr_resource_load_duration: Math.round(
          metric.attribution.resourceLoadDuration,
        ),
        attr_element_render_delay: Math.round(
          metric.attribution.elementRenderDelay,
        ),
      };
    case "CLS":
      return {
        attr_largest_shift_target: truncate(
          metric.attribution.largestShiftTarget ?? "",
        ),
      };
    default:
      return {};
  }
}

function reportToSentry(metric: MetricWithAttribution): boolean {
  // Vérification runtime : ne pas inventer l'API. Si Sentry est noop (DSN
  // absent), pas encore chargé (idle pas encore fired), ou build sans Metrics,
  // on échoue silencieusement.
  const sentry = _sentry;
  if (typeof sentry?.metrics?.distribution !== "function") return false;

  try {
    // Tags Sentry = strings uniquement → on stringify l'attribution.
    const attrTags: Record<string, string> = {};
    for (const [k, v] of Object.entries(attributionFields(metric))) {
      attrTags[k] = String(v);
    }
    sentry.metrics.distribution(
      `web_vital.${metric.name.toLowerCase()}`,
      metric.value,
      {
        unit: "millisecond",
        tags: {
          rating: metric.rating,
          navigation_type: metric.navigationType ?? "unknown",
          ...attrTags,
        },
      },
    );
    return true;
  } catch {
    return false;
  }
}

function reportToGtag(metric: MetricWithAttribution): boolean {
  const gtag = (window as GtagWindow).gtag;
  if (typeof gtag !== "function") return false;

  try {
    gtag("event", "web_vitals", {
      metric_name: metric.name,
      metric_value: Math.round(metric.value),
      metric_rating: metric.rating,
      metric_id: metric.id,
      navigation_type: metric.navigationType,
      page_path: typeof window !== "undefined" ? window.location.pathname : "",
      ...attributionFields(metric),
    });
    return true;
  } catch {
    return false;
  }
}

function reportToConsole(metric: MetricWithAttribution): void {
  // Toujours appelé : utile pour debug local + capturé en breadcrumb par Sentry
  // si `Sentry.init` capture les console (default v10 = true via integrations).
  // L'attribution rend ce log directement actionnable en lab (élément + phase).
  // eslint-disable-next-line no-console
  console.info("[web-vitals]", {
    name: metric.name,
    value: Math.round(metric.value),
    rating: metric.rating,
    id: metric.id,
    path: typeof window !== "undefined" ? window.location.pathname : "",
    ...attributionFields(metric),
  });
}

function dispatchMetric(metric: MetricWithAttribution) {
  try {
    reportToSentry(metric);
    reportToGtag(metric);
    reportToConsole(metric);
  } catch {
    // Reporter passif — ne jamais propager dans une callback PerformanceObserver.
  }
}

/**
 * Démarre le reporter Web Vitals. À appeler une seule fois après hydratation.
 * Safe à no-op côté SSR (les `on*` callbacks ne fire qu'au browser).
 */
export function reportWebVitals(): void {
  if (typeof window === "undefined") return;

  onLCP(dispatchMetric);
  onCLS(dispatchMetric);
  onINP(dispatchMetric);
  onFCP(dispatchMetric);
  onTTFB(dispatchMetric);
}

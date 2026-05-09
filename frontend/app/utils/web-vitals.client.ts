/**
 * web-vitals.client — Field Web Vitals reporter (LCP, INP, CLS, FCP, TTFB).
 *
 * Pousse chaque Web Vital vers, en cascade :
 *   1. Sentry.metrics.distribution (si l'API existe dans la version SDK installée)
 *   2. window.gtag (GA4) - déjà câblé via root.tsx, RGPD consent géré
 *   3. console.info (toujours, pour debug + Sentry breadcrumbs)
 *
 * Aucun appel n'est inventé : `Sentry.metrics?.distribution` est testé runtime
 * avant usage. Si la lib n'expose pas cette API (build minimal, version sans
 * Metrics, DSN absent → init noop), on tombe sur le fallback GA4/console
 * sans planter. Le dispatch entier est aussi wrappé en try/catch : un reporter
 * passif ne doit jamais corrompre l'app (extension navigateur qui hook
 * `console`, CMP qui mock `gtag`, etc.).
 */

import { onLCP, onCLS, onINP, onFCP, onTTFB, type Metric } from "web-vitals";

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

function reportToSentry(metric: Metric): boolean {
  // Vérification runtime : ne pas inventer l'API. Si Sentry est noop (DSN
  // absent), pas encore chargé (idle pas encore fired), ou build sans Metrics,
  // on échoue silencieusement.
  const sentry = _sentry;
  if (typeof sentry?.metrics?.distribution !== "function") return false;

  try {
    sentry.metrics.distribution(
      `web_vital.${metric.name.toLowerCase()}`,
      metric.value,
      {
        unit: "millisecond",
        tags: {
          rating: metric.rating,
          navigation_type: metric.navigationType ?? "unknown",
        },
      },
    );
    return true;
  } catch {
    return false;
  }
}

function reportToGtag(metric: Metric): boolean {
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
    });
    return true;
  } catch {
    return false;
  }
}

function reportToConsole(metric: Metric): void {
  // Toujours appelé : utile pour debug local + capturé en breadcrumb par Sentry
  // si `Sentry.init` capture les console (default v10 = true via integrations).
  // eslint-disable-next-line no-console
  console.info("[web-vitals]", {
    name: metric.name,
    value: Math.round(metric.value),
    rating: metric.rating,
    id: metric.id,
    path: typeof window !== "undefined" ? window.location.pathname : "",
  });
}

function dispatchMetric(metric: Metric) {
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

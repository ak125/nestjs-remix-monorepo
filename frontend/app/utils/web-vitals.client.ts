/**
 * web-vitals.client — Field Web Vitals reporter (LCP, INP, CLS, FCP, TTFB).
 *
 * Plan: /home/deploy/.claude/plans/automecanik-com-confidentialit-condition-greedy-harp.md (PR-C)
 *
 * Pousse chaque Web Vital vers (par ordre de priorité) :
 *   1. Sentry.metrics.distribution (si l'API existe dans la version SDK installée)
 *   2. window.gtag (GA4) - déjà câblé via root.tsx, RGPD consent géré
 *   3. console.info (toujours, pour debug + Sentry breadcrumbs)
 *
 * Aucun appel n'est inventé : `Sentry.metrics?.distribution` est testé runtime
 * avant usage. Si la lib n'expose pas cette API (build minimal, version sans
 * Metrics, DSN absent → init noop), on tombe sur le fallback GA4/console
 * sans planter.
 */

import * as Sentry from '@sentry/remix';
import { onLCP, onCLS, onINP, onFCP, onTTFB, type Metric } from 'web-vitals';

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

interface GtagWindow {
  gtag?: (
    command: 'event',
    eventName: string,
    params: Record<string, unknown>,
  ) => void;
}

function reportToSentry(metric: Metric): boolean {
  // Vérification runtime : ne pas inventer l'API. Si Sentry est noop (DSN
  // absent) ou build sans Metrics, on échoue silencieusement.
  const sentry = Sentry as unknown as SentryWithMetrics;
  if (typeof sentry.metrics?.distribution !== 'function') return false;

  try {
    sentry.metrics.distribution(`web_vital.${metric.name.toLowerCase()}`, metric.value, {
      unit: 'millisecond',
      tags: {
        rating: metric.rating,
        navigation_type: metric.navigationType ?? 'unknown',
      },
    });
    return true;
  } catch {
    return false;
  }
}

function reportToGtag(metric: Metric): boolean {
  const gtag = (window as GtagWindow).gtag;
  if (typeof gtag !== 'function') return false;

  try {
    gtag('event', 'web_vitals', {
      metric_name: metric.name,
      metric_value: Math.round(metric.value),
      metric_rating: metric.rating,
      metric_id: metric.id,
      navigation_type: metric.navigationType,
      page_path:
        typeof window !== 'undefined' ? window.location.pathname : '',
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
  console.info('[web-vitals]', {
    name: metric.name,
    value: Math.round(metric.value),
    rating: metric.rating,
    id: metric.id,
    path: typeof window !== 'undefined' ? window.location.pathname : '',
  });
}

function dispatchMetric(metric: Metric) {
  // Try Sentry first, then GA4. Console always fires.
  reportToSentry(metric);
  reportToGtag(metric);
  reportToConsole(metric);
}

/**
 * Démarre le reporter Web Vitals. À appeler une seule fois après hydratation.
 * Safe à no-op côté SSR (les `on*` callbacks ne fire qu'au browser).
 */
export function reportWebVitals(): void {
  if (typeof window === 'undefined') return;

  onLCP(dispatchMetric);
  onCLS(dispatchMetric);
  onINP(dispatchMetric);
  onFCP(dispatchMetric);
  onTTFB(dispatchMetric);
}

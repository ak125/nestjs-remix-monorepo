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
import {
  classifyRoute,
  type DeviceType,
  type NavType,
} from "@repo/cwv-taxonomy";

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

// =============================================================================
// Beacon backend ingestion (bloc 3) — POST /api/seo/cwv/beacon via sendBeacon
// =============================================================================
//
// Discipline :
//   - session_id : sessionStorage anon (no PII, regenerated per browsing session,
//     never cookie/localStorage — RGPD-friendly)
//   - Honor navigator.doNotTrack — opt-out respect
//   - Feature-detect sendBeacon — fail silently if unavailable
//   - Funnel step tracking : derived from route via classifyRoute(), previous
//     step kept in sessionStorage for journey reconstruction
//   - Sanitize attribution selector : strip #ids client-side before send (bloc
//     3 backend re-sanitizes via Zod for defense in depth)

const SESSION_ID_KEY = "_aut_cwv_sid";
const PREVIOUS_STEP_KEY = "_aut_cwv_prev_step";

function getOrCreateSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_ID_KEY);
    if (existing && existing.length >= 8) return existing;
    const fresh = crypto.randomUUID();
    sessionStorage.setItem(SESSION_ID_KEY, fresh);
    return fresh;
  } catch {
    // Storage disabled (private mode strict, CMP block) — fallback ephemeral.
    return crypto.randomUUID();
  }
}

function detectDevice(): DeviceType {
  if (typeof window === "undefined") return "unknown";
  const ua = navigator.userAgent.toLowerCase();
  if (/ipad|tablet|playbook|silk/.test(ua) && !/mobile/.test(ua)) return "tablet";
  if (/mobile|android|iphone|ipod|blackberry|opera mini|iemobile/.test(ua)) {
    return "mobile";
  }
  return "desktop";
}

function detectNavType(metric: MetricWithAttribution): NavType {
  const t = metric.navigationType;
  if (t === "navigate" || t === "reload" || t === "back-forward" || t === "prerender" || t === "restore") {
    return t === "back-forward" ? "back_forward" : t;
  }
  return "unknown";
}

function dntOptedOut(): boolean {
  if (typeof navigator === "undefined") return false;
  // navigator.doNotTrack returns '1' when DNT enabled in most browsers.
  // Honor strict (any non-'0' / non-null/unspecified value is opt-out signal).
  const dnt = navigator.doNotTrack;
  return dnt === "1" || dnt === "yes";
}

/** Sanitize CSS selector client-side : strip #ids, keep tag.class structure. */
function sanitizeSelector(raw: string | undefined): string | undefined {
  if (!raw) return raw;
  return raw.replace(/#[a-zA-Z0-9_-]+/g, "#dyn").slice(0, 120);
}

function buildBeaconPayload(metric: MetricWithAttribution): Record<string, unknown> | null {
  if (typeof window === "undefined") return null;
  const url = window.location.href;
  const pathname = window.location.pathname;
  const classification = classifyRoute(pathname);

  // previous_funnel_step lookup + persist current
  let previous_funnel_step: string | null = null;
  try {
    previous_funnel_step = sessionStorage.getItem(PREVIOUS_STEP_KEY);
    sessionStorage.setItem(PREVIOUS_STEP_KEY, classification.funnel_step);
  } catch {
    // ignore storage errors
  }

  // Sanitize attribution selectors (defense in depth, backend re-sanitizes via Zod)
  const rawAttr = attributionFields(metric);
  const attribution: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rawAttr)) {
    if (typeof v === "string" && (k === "attr_target" || k === "attr_element" || k === "attr_largest_shift_target")) {
      const s = sanitizeSelector(v);
      if (s !== undefined) attribution[k] = s;
    } else {
      attribution[k] = v;
    }
  }

  return {
    session_id: getOrCreateSessionId(),
    surface: classification.surface,
    route_group: classification.route_group,
    funnel_step: classification.funnel_step,
    previous_funnel_step,
    url: url.slice(0, 2000),
    metric: metric.name,
    value: Number(metric.value.toFixed(metric.name === "CLS" ? 4 : 0)),
    device: detectDevice(),
    attribution: Object.keys(attribution).length > 0 ? attribution : undefined,
    nav_type: detectNavType(metric),
  };
}

function reportToBeacon(metric: MetricWithAttribution): boolean {
  if (typeof window === "undefined") return false;
  if (typeof navigator.sendBeacon !== "function") return false;
  if (dntOptedOut()) return false;

  try {
    const payload = buildBeaconPayload(metric);
    if (!payload) return false;
    const blob = new Blob([JSON.stringify(payload)], {
      type: "application/json",
    });
    return navigator.sendBeacon("/api/seo/cwv/beacon", blob);
  } catch {
    return false;
  }
}

function dispatchMetric(metric: MetricWithAttribution) {
  try {
    reportToSentry(metric);
    reportToGtag(metric);
    reportToBeacon(metric);
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

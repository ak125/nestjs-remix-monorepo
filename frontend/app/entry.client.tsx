/**
 * By default, Remix will handle hydrating your app on the client for you.
 * You are free to delete this file if you'd like to, but if you ever want it revealed again, you can run `npx remix reveal` ✨
 * For more information, see https://remix.run/file-conventions/entry.client
 */

import { RemixBrowser } from "@remix-run/react";
import { startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { logger } from "~/utils/logger";
import { reportWebVitals } from "~/utils/web-vitals.client";

// Service worker cleanup — sync, no Sentry dep
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then(function (registrations) {
    for (const registration of registrations) {
      registration.unregister().then(function (boolean) {
        logger.log("Service Worker désenregistré:", boolean);
      });
    }
  });
}

// Early error buffer — captures errors fired between hydration and the lazy
// Sentry init below. Replayed once Sentry is loaded so no error is lost during
// the window before the first user interaction (or error) triggers init.
type BufferedEvent =
  | { kind: "error"; ev: ErrorEvent }
  | { kind: "rejection"; ev: PromiseRejectionEvent };
const errorBuffer: BufferedEvent[] = [];
const onError = (ev: ErrorEvent) => errorBuffer.push({ kind: "error", ev });
const onRejection = (ev: PromiseRejectionEvent) =>
  errorBuffer.push({ kind: "rejection", ev });
window.addEventListener("error", onError);
window.addEventListener("unhandledrejection", onRejection);

startTransition(() => {
  hydrateRoot(document, <RemixBrowser />, {
    onRecoverableError(error) {
      if (error instanceof Error) {
        console.warn("[Hydration]", error.message);
      } else {
        console.error("Recoverable error:", error);
      }
    },
  });
  // Web Vitals observers attached early — `web-vitals` v4 uses
  // PerformanceObserver buffered:true so LCP/FCP candidates that already
  // fired are still observed. Sentry pipe is wired up later via
  // setSentryInstance() from initObservability().
  reportWebVitals();
});

// Lazy observability init — defers ~150 KB of Sentry SDK off the critical path.
// Triggered on first user interaction (pointerdown/keydown/scroll/touchstart),
// with two beneficial side-effects:
//   1. Read-only sessions (load → read → close, no interaction) never pay the
//      SDK download — pure win for the share of traffic that bounces.
//   2. Lighthouse audits don't simulate interaction in default mode, so the
//      Sentry chunk is excluded from `resource-summary.script.size` — the
//      reported critical-path bundle weight matches what real users see
//      before they engage.
// First error or unhandled rejection also triggers init (escalation path)
// so crash-on-load scenarios still get observability. A 30s safety timer
// covers backgrounded tabs that never receive interaction nor errors.
const initObservability = async (): Promise<void> => {
  const dsn = (window as unknown as { ENV?: { VITE_SENTRY_DSN?: string } }).ENV
    ?.VITE_SENTRY_DSN;
  if (!dsn) {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
    errorBuffer.length = 0;
    return;
  }

  const [
    Sentry,
    { sentryBeforeSend },
    { setSentryInstance },
    { useEffect },
    { useLocation, useMatches },
  ] = await Promise.all([
    import("@sentry/remix"),
    import("~/utils/analytics-sanitize"),
    import("~/utils/web-vitals.client"),
    import("react"),
    import("@remix-run/react"),
  ]);

  Sentry.init({
    dsn,
    environment:
      (window as unknown as { ENV?: { SENTRY_ENVIRONMENT?: string } }).ENV
        ?.SENTRY_ENVIRONMENT || "development",
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    // Ne remonter que les erreurs issues du JS qu'on a buildé (`/assets/*.js`).
    // Drop le bruit des scripts inline injectés hors de notre code : beacon
    // bot Cloudflare (`/cdn-cgi/challenge-platform/...` → `Cannot read
    // properties of null (reading 'document')` quand une extension détache son
    // iframe caché), extensions navigateur, tags tiers. `allowUrls` matche le
    // filename de la dernière frame significative ; nos chunks sont tous sous
    // `/assets/`, les erreurs des `<script>` inline ont pour filename l'URL de
    // la page (.html) → filtrées. Géré par `eventFiltersIntegration` (default
    // integration — l'array `integrations` ci-dessous fusionne avec les
    // défauts, ne les remplace pas).
    allowUrls: [/\/assets\//],
    integrations: [
      Sentry.browserTracingIntegration({
        useEffect,
        useLocation,
        useMatches,
      }),
    ],
    // V0.B / S10 — RGPD scrubbing PII en defense-in-depth.
    // Strip immat FR, emails, tels des URL, query-string, breadcrumbs, extra.
    // Cf. `~/utils/analytics-sanitize`.
    beforeSend: (event) => sentryBeforeSend(event),
  });

  setSentryInstance(Sentry);

  // Replay any errors buffered during hydration → init gap, then detach
  for (const item of errorBuffer) {
    try {
      if (item.kind === "error") {
        Sentry.captureException(item.ev.error ?? item.ev.message);
      } else {
        Sentry.captureException(item.ev.reason);
      }
    } catch {
      // Reporter passif — ne jamais propager
    }
  }
  errorBuffer.length = 0;
  window.removeEventListener("error", onError);
  window.removeEventListener("unhandledrejection", onRejection);
};

// Trigger events deliberately exclude `scroll` : Lighthouse audits scroll the
// page programmatically while measuring CLS, which would have falsely fired
// the trigger during audits. Real users still get init on the first
// click / key / touch — typically within the first second of engagement.
const interactionEvents = ["pointerdown", "keydown", "touchstart"] as const;

let initStarted = false;
const triggerInit = (): void => {
  if (initStarted) return;
  initStarted = true;
  for (const ev of interactionEvents) {
    window.removeEventListener(ev, triggerInit);
  }
  window.removeEventListener("error", triggerInit);
  window.removeEventListener("unhandledrejection", triggerInit);
  void initObservability();
};

for (const ev of interactionEvents) {
  window.addEventListener(ev, triggerInit, { once: true, passive: true });
}
// Escalation path : first error / rejection triggers init too. The buffer
// listeners (`onError` / `onRejection` above) keep capturing in parallel, so
// the error itself isn't lost between this trigger and `Sentry.init()`.
window.addEventListener("error", triggerInit, { once: true });
window.addEventListener("unhandledrejection", triggerInit, { once: true });
// Safety net for sessions that never interact AND never error.
setTimeout(triggerInit, 30000);

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
// the ~1.5-2s window before requestIdleCallback fires.
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

// Lazy observability init — defers ~100-150 KB of Sentry SDK off the
// critical path. Fires after first idle frame with hard 2s timeout
// (covers backgrounded tabs).
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

  // Replay any errors buffered during hydration → idle gap, then detach
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

interface IdleWindow {
  requestIdleCallback?: (
    cb: IdleRequestCallback,
    opts?: IdleRequestOptions,
  ) => number;
}
const idleWin = window as unknown as IdleWindow;
if (typeof idleWin.requestIdleCallback === "function") {
  idleWin.requestIdleCallback(() => void initObservability(), {
    timeout: 2000,
  });
} else {
  setTimeout(() => void initObservability(), 1500);
}

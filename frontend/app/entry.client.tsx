/**
 * By default, Remix will handle hydrating your app on the client for you.
 * You are free to delete this file if you'd like to, but if you ever want it revealed again, you can run `npx remix reveal` ✨
 * For more information, see https://remix.run/file-conventions/entry.client
 */

// MUST be first: installs the ES2022 Array.prototype.at polyfill before any
// other module loads. Sentry's bundled INP web-vital code calls `.at(-1)`,
// which throws on engines without it (Safari < 15.4, old WebViews, crawlers).
// See ~/utils/array-at-polyfill.client for the full rationale.
import "~/utils/array-at-polyfill.client";

import { startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";
import { logger } from "~/utils/logger";
import {
  captureReactErrorToSentry,
  createDeferredReactErrorBuffer,
  createReactErrorHandlers,
  type BufferedReactError,
  type SentryLike,
} from "~/utils/react-error-handlers.client";
import {
  reportHydrationError,
  startRuntimeErrorReporter,
} from "~/utils/runtime-errors.client";
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
  | { kind: "rejection"; ev: PromiseRejectionEvent }
  | BufferedReactError;
const errorBuffer: BufferedEvent[] = [];
// Bound the pre-init buffer so it can never grow unbounded if Sentry init is
// very delayed or never fires (e.g. no-DSN PROD / SENTRY_LIVE_BLOCKED).
const MAX_BUFFER = 50;
const bufferPush = (entry: BufferedEvent): void => {
  if (errorBuffer.length < MAX_BUFFER) errorBuffer.push(entry);
};
const onError = (ev: ErrorEvent) => bufferPush({ kind: "error", ev });
const onRejection = (ev: PromiseRejectionEvent) =>
  bufferPush({ kind: "rejection", ev });
window.addEventListener("error", onError);
window.addEventListener("unhandledrejection", onRejection);

// Observability lifecycle for React-channel errors. Unlike window 'error'
// events (captured post-init by Sentry's native global handlers), React's
// onRecoverableError/onCaughtError/onUncaughtError are NOT hooked by Sentry —
// these handlers are the ONLY path. So: buffer BEFORE init (replayed once),
// capture DIRECTLY once Sentry is live, and DROP if observability is disabled
// (no DSN) — never buffer unbounded.
let liveSentry: SentryLike | null = null;
let observabilityDisabled = false;

const reactErrorHandlers = createReactErrorHandlers({
  buffer: createDeferredReactErrorBuffer({
    isDisabled: () => observabilityDisabled,
    getLive: () => liveSentry,
    bufferPush: (entry) => bufferPush(entry),
  }),
  reportHydration: () => reportHydrationError({ source: "onRecoverableError" }),
});

startTransition(() => {
  // PROD/PREPROD only: providing these options replaces React's default error
  // handlers, so in DEV we pass `undefined` to keep React's standard dev
  // diagnostics + overlay (per React 19 docs). `import.meta.env.PROD` is fixed
  // at build time — false under the DEV `vite dev` server, true in the Docker
  // production build that ships to both PREPROD and PROD.
  const rootOptions = import.meta.env.PROD ? reactErrorHandlers : undefined;
  hydrateRoot(document, <HydratedRouter />, rootOptions);
  // Web Vitals observers attached early — `web-vitals` v4 uses
  // PerformanceObserver buffered:true so LCP/FCP candidates that already
  // fired are still observed. Sentry pipe is wired up later via
  // setSentryInstance() from initObservability().
  reportWebVitals();

  // CWV Runtime Observability bloc 5 — hydration/longtask/chunk-load reporters.
  // Captured BEFORE Sentry init for replay independence (canon
  // feedback_no_external_canary_when_internal_observability_exists).
  startRuntimeErrorReporter();
});

// Lazy observability init — defers ~150 KB of Sentry SDK off the critical
// path. Body unchanged; scheduling is now done via the platform scheduler
// (see the block below). Errors buffered between hydration and the first
// scheduled tick are replayed once Sentry is loaded so no event is lost.
const initObservability = async (): Promise<void> => {
  const dsn = (window as unknown as { ENV?: { VITE_SENTRY_DSN?: string } }).ENV
    ?.VITE_SENTRY_DSN;
  if (!dsn) {
    // No DSN → observability is off. Stop React-channel buffering so it can't
    // leak, and detach the window listeners.
    observabilityDisabled = true;
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
    errorBuffer.length = 0;
    return;
  }

  const [Sentry, { sentryBeforeSend }, { setSentryInstance }] =
    await Promise.all([
      import("@sentry/react-router"),
      import("~/utils/analytics-sanitize"),
      import("~/utils/web-vitals.client"),
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
      // RR7 : auto-instrumente le routing (remplace browserTracingIntegration
      // qui prenait useEffect/useLocation/useMatches en Remix v2).
      Sentry.reactRouterTracingIntegration(),
    ],
    // V0.B / S10 — RGPD scrubbing PII en defense-in-depth.
    // Strip immat FR, emails, tels des URL, query-string, breadcrumbs, extra.
    // Cf. `~/utils/analytics-sanitize`.
    beforeSend: (event) => sentryBeforeSend(event),
  });

  setSentryInstance(Sentry);

  // Mark Sentry live BEFORE replay so React-channel errors fired from now on are
  // captured DIRECTLY (the buffer below only holds pre-init entries — no double,
  // no miss).
  liveSentry = Sentry;

  // Replay any errors buffered during hydration → init gap, then detach
  for (const item of errorBuffer) {
    try {
      if (item.kind === "error") {
        Sentry.captureException(item.ev.error ?? item.ev.message);
      } else if (item.kind === "rejection") {
        Sentry.captureException(item.ev.reason);
      } else {
        // kind === "reactError" — bounded scope (channel tag + truncated
        // componentStack/cause), never serialize the raw cause object.
        captureReactErrorToSentry(Sentry, item);
      }
    } catch {
      // Reporter passif — ne jamais propager
    }
  }
  errorBuffer.length = 0;
  window.removeEventListener("error", onError);
  window.removeEventListener("unhandledrejection", onRejection);
};

// Defer Sentry SDK init via the modern platform scheduler.
//
// Previous design attached `pointerdown` / `touchstart` / `keydown`
// listeners that dynamically imported `@sentry/remix` (~159 KB gzip) inside
// the listener callback. That parse ran INSIDE the INP measurement window
// of the user's first interaction — on mid-range Android the cost was
// ~350-550 ms → "Poor" CWV (CrUX p75 = 512 ms on /pieces/* surfaced
// 2026-05-13, GSC alert covered 303 URLs).
//
// `scheduler.postTask({priority:"background"})` runs AFTER user-blocking
// and user-visible tasks have settled by design, so the dynamic import +
// parse never collide with interaction. Fallback chain covers Firefox
// (`requestIdleCallback`) and Safari iOS (`setTimeout`).
let initStarted = false;
const startInit = (): void => {
  if (initStarted) return;
  initStarted = true;
  window.removeEventListener("error", startInit);
  window.removeEventListener("unhandledrejection", startInit);
  void initObservability();
};

type SchedulerPostTask = (
  callback: () => void,
  options?: {
    priority?: "user-blocking" | "user-visible" | "background";
    delay?: number;
  },
) => unknown;
const schedulerApi = (
  globalThis as { scheduler?: { postTask?: SchedulerPostTask } }
).scheduler;

if (typeof schedulerApi?.postTask === "function") {
  // Chrome 94+ — covers ≥ 80 % of Android CrUX cohort.
  schedulerApi.postTask(startInit, { priority: "background" });
} else if (typeof window.requestIdleCallback === "function") {
  // Firefox + older Chromium. 8 s ceiling so busy SPAs still init.
  window.requestIdleCallback(startInit, { timeout: 8000 });
} else {
  // Safari iOS path. 3 s is comfortably after LCP/INP windows.
  setTimeout(startInit, 3000);
}

// Escalation : first error / rejection triggers init immediately. The page
// is already broken — observability wins, INP no longer measured.
window.addEventListener("error", startInit, { once: true });
window.addEventListener("unhandledrejection", startInit, { once: true });

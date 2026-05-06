/**
 * By default, Remix will handle hydrating your app on the client for you.
 * You are free to delete this file if you'd like to, but if you ever want it revealed again, you can run `npx remix reveal` ✨
 * For more information, see https://remix.run/file-conventions/entry.client
 */

import * as Sentry from "@sentry/remix";
import { useLocation, useMatches, RemixBrowser } from "@remix-run/react";
import { startTransition, useEffect } from "react";
import { hydrateRoot } from "react-dom/client";
import { logger } from "~/utils/logger";

// Sentry browser SDK — DSN injected at SSR time via `window.ENV.VITE_SENTRY_DSN`
// (see root.tsx loader). When the DSN is absent, all Sentry calls are no-ops.
const dsn =
  (typeof window !== "undefined" &&
    (window as unknown as { ENV?: { VITE_SENTRY_DSN?: string } }).ENV
      ?.VITE_SENTRY_DSN) ||
  undefined;

if (dsn) {
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
  });
}

// Nettoyage des service workers existants
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then(function (registrations) {
    for (let registration of registrations) {
      registration.unregister().then(function (boolean) {
        logger.log("Service Worker désenregistré:", boolean);
      });
    }
  });
}

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
});

/**
 * By default, Remix will handle generating the HTTP Response for you.
 * You are free to delete this file if you'd like to, but if you ever want it revealed again, you can run `npx remix reveal` ✨
 * For more information, see https://remix.run/file-conventions/entry.server
 */

import { PassThrough } from "node:stream";
import { createReadableStreamFromReadable } from "@react-router/node";
import * as Sentry from "@sentry/react-router";
import { isbot } from "isbot";
import { renderToPipeableStream } from "react-dom/server";
import {
  ServerRouter,
  type AppLoadContext,
  type EntryContext,
  type HandleErrorFunction,
} from "react-router";
import { logger } from "~/utils/logger";

// Sentry server SDK init — picks up DSN from process.env populated by NestJS
// before SSR runs. In the monorepo, Remix is mounted inside NestJS so process.env
// is already populated by the backend's `dotenv/config` (via `instrument.ts`).
//
// Guard `!Sentry.getClient()` — DO NOT REMOVE (PROD incident 2026-06-22).
// When Remix is embedded in NestJS, the backend has ALREADY called Sentry.init()
// (@sentry/nestjs → CJS @sentry/core) and registered the client on the shared
// `globalThis.__SENTRY__[SDK_VERSION]` carrier, which both the CJS and ESM builds
// of @sentry/core read. This ESM bundle (@sentry/react-router → @sentry/node) must
// NOT init a second client: a second init re-runs the `Http` integration, which
// re-subscribes to the `http.server.request.start` diagnostics channel. Because
// @sentry/core's `lastSentryEmitMap` dedup guard is module-scoped (one WeakMap per
// CJS/ESM build), neither realm sees the other's wrapper, so `server.emit` is
// re-wrapped in a new Proxy on every request — the chain grows unbounded until
// `RangeError: Maximum call stack size exceeded` (surfaced after the @sentry
// 10.53→10.59 bump in #1052). Skipping the redundant init keeps a single HTTP-server
// instrumentation; the capture below (handleError / captureException / instrumentations)
// transparently uses the shared client. Standalone (non-embedded) frontend: no client
// yet → init runs normally, so observability is preserved either way.
if (process.env.SENTRY_DSN && !Sentry.getClient()) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment:
      process.env.SENTRY_ENVIRONMENT ||
      process.env.APP_ENV ||
      process.env.NODE_ENV ||
      "development",
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
  });
}

// Capture Sentry (`createSentryHandleError` = équivalent RR7 de l'ancien
// `wrapHandleErrorWithSentry`) + logging applicatif préservé. `logErrors: false`
// évite le double-log (on garde notre propre logger).
const captureErrorToSentry = Sentry.createSentryHandleError({
  logErrors: false,
});

export const handleError: HandleErrorFunction = (error, details) => {
  captureErrorToSentry(error, details);
  if (error instanceof Error) {
    logger.error("[Remix SSR]", error.message);
  }
};

// Instrumentation serveur RR7 (loaders / actions / middleware / request handlers) —
// équivalent de l'auto-instrumentation @sentry/remix. Requiert React Router ≥ 7.15.
// Annotation explicite : le type inféré référence un module interne @sentry non
// portable (TS2742) ; `ReturnType<…>[]` le nomme via la fonction.
export const instrumentations: ReturnType<
  typeof Sentry.createSentryServerInstrumentation
>[] = [Sentry.createSentryServerInstrumentation()];

// Single Fetch : `streamTimeout` borne le rejet des promesses différées côté serveur ;
// l'abort du flux React doit être strictement au-dessus (streamTimeout + 1s).
export const streamTimeout = 5_000;
const ABORT_DELAY = streamTimeout + 1_000;

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  reactRouterContext: EntryContext,
  loadContext: AppLoadContext,
) {
  const nonce = loadContext.cspNonce || "";

  return isbot(request.headers.get("user-agent") || "")
    ? handleBotRequest(
        request,
        responseStatusCode,
        responseHeaders,
        reactRouterContext,
        nonce,
      )
    : handleBrowserRequest(
        request,
        responseStatusCode,
        responseHeaders,
        reactRouterContext,
        nonce,
      );
}

function handleBotRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  reactRouterContext: EntryContext,
  nonce: string,
) {
  return new Promise((resolve, reject) => {
    let shellRendered = false;
    const { pipe, abort } = renderToPipeableStream(
      <ServerRouter
        context={reactRouterContext}
        url={request.url}
        nonce={nonce}
      />,
      {
        nonce,
        onAllReady() {
          shellRendered = true;
          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);

          responseHeaders.set("Content-Type", "text/html; charset=utf-8");

          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode,
            }),
          );

          pipe(body);
        },
        onShellError(error: unknown) {
          reject(error);
        },
        onError(error: unknown) {
          responseStatusCode = 500;
          // Surface ALL streaming render errors. On the bot path (onAllReady)
          // `shellRendered` only flips at the very end, so a render error that
          // React recovers from (via an ErrorBoundary) — or a render that hits
          // the ABORT_DELAY timeout — would otherwise be SILENT: a Googlebot-only
          // 500 with no log and no Sentry event. Non-shell errors never
          // double-log (true shell errors go through onShellError -> reject ->
          // handleError).
          logger.error("[SSR onError]", error);
          Sentry.captureException(error);
        },
      },
    );

    setTimeout(abort, ABORT_DELAY);
  });
}

function handleBrowserRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  reactRouterContext: EntryContext,
  nonce: string,
) {
  return new Promise((resolve, reject) => {
    let shellRendered = false;
    const { pipe, abort } = renderToPipeableStream(
      <ServerRouter
        context={reactRouterContext}
        url={request.url}
        nonce={nonce}
      />,
      {
        nonce,
        onShellReady() {
          shellRendered = true;
          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);

          responseHeaders.set("Content-Type", "text/html; charset=utf-8");

          // 🚀 TTFB Optimization: Early Hints pour preload ressources critiques
          // Permet au navigateur de commencer à télécharger pendant le streaming
          const url = new URL(request.url);
          if (
            url.pathname.startsWith("/pieces/") &&
            url.pathname.endsWith(".html")
          ) {
            // Pages produit: preconnect aux domaines externes (fonts self-hosted, plus besoin de Google)
            responseHeaders.set(
              "Link",
              `<${process.env.VITE_SUPABASE_URL || ""}>; rel=preconnect`,
            );
          }

          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode,
            }),
          );

          pipe(body);
        },
        onShellError(error: unknown) {
          reject(error);
        },
        onError(error: unknown) {
          responseStatusCode = 500;
          // Same rationale as the bot path: never swallow a render error silently.
          logger.error("[SSR onError]", error);
          Sentry.captureException(error);
        },
      },
    );

    setTimeout(abort, ABORT_DELAY);
  });
}

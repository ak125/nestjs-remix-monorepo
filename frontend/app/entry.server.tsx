/**
 * By default, Remix will handle generating the HTTP Response for you.
 * You are free to delete this file if you'd like to, but if you ever want it revealed again, you can run `npx remix reveal` ✨
 * For more information, see https://remix.run/file-conventions/entry.server
 */

import { PassThrough } from "node:stream";
import { createReadableStreamFromReadable } from "@react-router/node";
import { isbot } from "isbot";
import { renderToPipeableStream } from "react-dom/server";
import {
  ServerRouter,
  isRouteErrorResponse,
  type EntryContext,
  type HandleErrorFunction,
  type RouterContextProvider,
} from "react-router";
import {
  cspNonceContext,
  serverObservabilityContext,
} from "~/utils/load-context";
import { logger } from "~/utils/logger";
import  { type ServerObservability } from "~/utils/observability-contract";

// Re-export the load-context factory so the SSR build exposes it on
// `build.entry.module` for the NestJS façade bridge (`getCreateAppLoadContext`).
// This is the CJS→ESM pont: NestJS calls the factory without ever importing the
// identity-keyed `createContext()` keys (dual-realm safety, incident #1106).
export { createAppLoadContext } from "~/utils/load-context";

// ⚠️ NO server-side Sentry SDK in this SSR bundle — DO NOT add `Sentry.init()` /
// import `@sentry/node` / `@sentry/react-router` here. `@sentry/nestjs`
// (backend/src/instrument.ts) is the SINGLE server SDK owner. A second init in
// this ESM bundle re-ran the Http integration and re-wrapped `server.emit` on
// every request → unbounded Proxy chain → `RangeError: Maximum call stack size
// exceeded` (PROD dual-realm incident #1106 / getsentry#21696). Server-side
// errors are forwarded to the NestJS-owned Sentry client via
// `AppLoadContext.serverObservability` (the pont injected in remix.controller.ts).
// Standalone (non-embedded) frontend: no reporter → deliberate no-op
// (STANDALONE server observability = NOT_SUPPORTED; prod is always NestJS→RR).

export const handleError: HandleErrorFunction = (
  error,
  { request, context },
): void => {
  // Deterministic client-side routing errors (4xx) are NOT application
  // incidents and must not reach Sentry: e.g. a scanner probing `POST /_next`
  // matches the splat route `routes/$` (which has no `action`) → React Router
  // throws a 405 `ErrorResponse`. Capturing those floods the project with bot
  // noise. Only 5xx (real server faults) and non-Response throws deserve an
  // event. The HTTP response sent to the client is unchanged — this gates
  // observability only, at the single point every RR routing error flows through.
  if (isRouteErrorResponse(error) && error.status < 500) return;
  if (error instanceof Response && error.status < 500) return;

  // v8_middleware: `context` is a Readonly<RouterContextProvider>. RR's server
  // runtime can invoke handleError BEFORE the load context is resolved (its
  // `loadContext` is still undefined when it rejects an invalid context value),
  // so `context` may be undefined here — optional-chain it (the key itself
  // carries a nullable default, so `.get` never throws once context exists).
  const observability = context?.get(serverObservabilityContext);
  // Skip aborted requests (client gone) — equivalent to @sentry/react-router's
  // createSentryHandleError abort guard. `flushIfServerless` deliberately NOT
  // reproduced: persistent NestJS process, not serverless (and RR doesn't await
  // handleError anyway).
  if (!request.signal.aborted) {
    observability?.captureException(error, {
      mechanism: { type: "react-router", handled: false },
      tags: { observability_channel: "react-router-handle-error" },
      extra: { method: request.method, pathname: new URL(request.url).pathname },
    });
  }
  if (error instanceof Error) {
    logger.error("[React Router SSR]", error.message);
  }
};

// Single Fetch : `streamTimeout` borne le rejet des promesses différées côté serveur ;
// l'abort du flux React doit être strictement au-dessus (streamTimeout + 1s).
export const streamTimeout = 5_000;
const ABORT_DELAY = streamTimeout + 1_000;

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  reactRouterContext: EntryContext,
  loadContext: RouterContextProvider,
) {
  const nonce = loadContext.get(cspNonceContext) || "";
  // Pass the reporter OBJECT (not a detached method) down so the streaming
  // onError callbacks can forward render errors to the NestJS-owned Sentry client.
  const observability = loadContext.get(serverObservabilityContext) ?? undefined;

  return isbot(request.headers.get("user-agent") || "")
    ? handleBotRequest(
        request,
        responseStatusCode,
        responseHeaders,
        reactRouterContext,
        nonce,
        observability,
      )
    : handleBrowserRequest(
        request,
        responseStatusCode,
        responseHeaders,
        reactRouterContext,
        nonce,
        observability,
      );
}

function handleBotRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  reactRouterContext: EntryContext,
  nonce: string,
  observability?: ServerObservability,
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
          // handleError). Request-context attachment here is best-effort (same as
          // before): the bridge call may run after ALS context is lost mid-stream.
          logger.error("[SSR onError]", error);
          observability?.captureException(error, {
            mechanism: { type: "react-ssr-stream", handled: false },
            tags: { observability_channel: "ssr-stream", rendering_path: "bot" },
          });
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
  observability?: ServerObservability,
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
          observability?.captureException(error, {
            mechanism: { type: "react-ssr-stream", handled: false },
            tags: {
              observability_channel: "ssr-stream",
              rendering_path: "browser",
            },
          });
        },
      },
    );

    setTimeout(abort, ABORT_DELAY);
  });
}

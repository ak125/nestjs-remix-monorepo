// Sentry SDK initialization. Imported FIRST in main.ts (line 1) so that the
// OpenTelemetry-based instrumentation can patch http/fs/express before any
// other module loads.
//
// ── SINGLE SERVER SDK OWNER — DO NOT DUPLICATE IN THE SSR BUNDLE. ──
// @sentry/nestjs is the ONLY server-side SDK allowed to call Sentry.init().
// The React Router SSR bundle (frontend/app/entry.server.tsx) initializes NO
// server SDK; it reports through AppLoadContext.serverObservability (the pont in
// backend/src/remix/remix.controller.ts). Reintroducing an init in the ESM SSR
// bundle caused the PROD dual-realm server.emit recursion incident
// (RangeError: Maximum call stack size — #1106 / getsentry/sentry-javascript#21696).
//
// Loads dotenv internally so `process.env.SENTRY_DSN` is populated before
// Sentry.init runs. main.ts can therefore drop its own `import 'dotenv/config'`.
//
// If SENTRY_DSN is unset (e.g. local dev without observability) the SDK is a
// no-op — no network calls, no overhead beyond the import cost.

import 'dotenv/config';
import * as Sentry from '@sentry/nestjs';
import type { ErrorEvent, EventHint } from '@sentry/nestjs';

// Socket-level client-disconnect codes. A bare `Error` carrying one of these
// with a read/write syscall is an inbound connection reset, not an application
// fault (see sanitizeSentryEvent).
const CLIENT_DISCONNECT_CODES = new Set([
  'ECONNRESET',
  'EPIPE',
  'ECONNABORTED',
]);

// Exported `beforeSend` predicate. Drops expected client-disconnect noise and
// scrubs sensitive request headers as defence-in-depth on top of Sentry's
// server-side PII scrubbing. Two client-disconnect shapes are silenced:
//
//  1. raw-body `BadRequestError: request aborted` (`err.type = 'request.aborted'`)
//     — the TCP connection is cut before the request BODY finishes streaming
//     (typical for tracking beacons during page unload).
//  2. bare socket resets `Error: read ECONNRESET` / `write EPIPE` /
//     `ECONNABORTED` (`err.code` + `err.syscall`) from `TCP.onStreamRead` — an
//     inbound keep-alive socket reset. The Docker HEALTHCHECK
//     `wget -qO- http://localhost:3000/health` and real clients (browsers,
//     CDN/LB) closing keep-alive sockets produce these; they carry no HTTP
//     status and reach the global filter's `@SentryExceptionCaptured()` as
//     unhandled `auto.function.nestjs.exception_captured` events.
//
// This is NOT a silent fallback for real failures: genuine UPSTREAM resets
// (e.g. a Supabase socket drop mid-request) are caught and retried in the data
// layer (supabase-base.service.ts) and never reach this hook as a bare socket
// error; requiring `err.syscall` keeps the filter to true socket-level noise.
// Server crashes stay observable via the uncaughtException handler + failing
// (non-200) healthchecks, not via these inbound resets.
export function sanitizeSentryEvent(
  event: ErrorEvent,
  hint: EventHint,
): ErrorEvent | null {
  const err = hint?.originalException as
    | { type?: string; message?: string; code?: string; syscall?: string }
    | undefined;
  if (err?.type === 'request.aborted' || err?.message === 'request aborted') {
    return null;
  }
  if (
    err?.code !== undefined &&
    CLIENT_DISCONNECT_CODES.has(err.code) &&
    (err.syscall === 'read' || err.syscall === 'write')
  ) {
    return null;
  }

  if (event.request?.headers) {
    const h = event.request.headers as Record<string, string>;
    for (const k of Object.keys(h)) {
      const lower = k.toLowerCase();
      if (
        lower === 'authorization' ||
        lower === 'cookie' ||
        lower === 'set-cookie' ||
        lower.startsWith('x-api-key')
      ) {
        h[k] = '[Filtered]';
      }
    }
  }
  return event;
}

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment:
      process.env.SENTRY_ENVIRONMENT ||
      process.env.APP_ENV ||
      process.env.NODE_ENV ||
      'development',

    // Release tag — bound to git SHA at deploy time so stack traces resolve
    // against the correct source maps once they are uploaded post-deploy.
    release: process.env.SENTRY_RELEASE || process.env.GIT_SHA || undefined,

    // 10 % traces sampled in DEV. Tune downward in PROD if volume becomes a
    // cost issue (Sentry quota is event-based for performance monitoring).
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),

    // RGPD-safe default — opt-in IP / cookie collection only when explicitly
    // requested by the operator. The Sentry NestJS wizard's default is `true`
    // but we override to comply with RGPD minimisation by default.
    sendDefaultPii: process.env.SENTRY_SEND_PII === 'true',

    beforeSend: sanitizeSentryEvent,
  });
}

// Defense-in-depth — a single unhandled promise rejection must NOT take down the
// whole server. Several background paths fire-and-forget async work (cache warms,
// scheduled refreshes, web-vitals beacons). When one rejects — e.g. an RLS-blocked
// write in READ_ONLY PREPROD (anon key, ADR-028 Option D), or a transient RPC error
// — Node's default (`--unhandled-rejections=throw`) exits the process with code 1.
// On the PREPROD container's `restart: always` that became a ~5-min crash-loop that
// intermittently broke the E2E Smoke gate (:3200 unreachable mid-suite →
// ERR_CONNECTION_REFUSED / socket hang up). Log + report to Sentry and keep serving:
// the failing operation still fails, the server survives. NOT a silent fallback —
// every rejection is surfaced (stderr + Sentry), which also reveals the culprit path
// for a follow-up source fix. Registered here (instrument.ts is imported first, before
// bootstrap) so it covers rejections from the very start. uncaughtException is left to
// Node's default — a sync uncaught error genuinely leaves the process in an undefined
// state and should still terminate.
process.on('unhandledRejection', (reason: unknown) => {
  // eslint-disable-next-line no-console
  console.error('[unhandledRejection] non-fatal — logged + reported:', reason);
  try {
    Sentry.captureException(reason);
  } catch {
    // Sentry not initialised (no DSN) — the stderr line above is the record.
  }
});

// uncaughtException is genuinely fatal — a synchronous error left the process in an
// undefined state, so we keep Node's "exit" semantics (NOT a silent fallback). But we
// first capture + flush to Sentry so the crash is finally observable: until now these
// exits produced no recognisable marker in the container logs, which is exactly why the
// ~5-min restart cause stayed invisible. Log → report → best-effort flush → exit(1).
process.on('uncaughtException', (err: Error) => {
  // eslint-disable-next-line no-console
  console.error('[uncaughtException] fatal — logged + reported, exiting:', err);
  try {
    Sentry.captureException(err);
    // Give Sentry up to 2s to ship the event, then exit regardless.
    void Sentry.close(2000).then(
      () => process.exit(1),
      () => process.exit(1),
    );
  } catch {
    process.exit(1);
  }
});

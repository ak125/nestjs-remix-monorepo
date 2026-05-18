// Sentry SDK initialization. Imported FIRST in main.ts (line 1) so that the
// OpenTelemetry-based instrumentation can patch http/fs/express before any
// other module loads.
//
// Loads dotenv internally so `process.env.SENTRY_DSN` is populated before
// Sentry.init runs. main.ts can therefore drop its own `import 'dotenv/config'`.
//
// If SENTRY_DSN is unset (e.g. local dev without observability) the SDK is a
// no-op — no network calls, no overhead beyond the import cost.

import 'dotenv/config';
import * as Sentry from '@sentry/nestjs';
import type { ErrorEvent, EventHint } from '@sentry/nestjs';

// Exported `beforeSend` predicate. Drops client-aborted body-parser errors
// (raw-body fires `BadRequestError: request aborted` with `err.type =
// 'request.aborted'` when the TCP connection is cut before the request body
// finishes streaming — typical for tracking beacons during page unload). Also
// scrubs sensitive request headers as defence-in-depth on top of Sentry's
// server-side PII scrubbing.
export function sanitizeSentryEvent(
  event: ErrorEvent,
  hint: EventHint,
): ErrorEvent | null {
  const err = hint?.originalException as
    | { type?: string; message?: string }
    | undefined;
  if (err?.type === 'request.aborted' || err?.message === 'request aborted') {
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

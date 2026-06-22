/**
 * react-error-handlers.client — React 19 root error observability.
 *
 * React 19 (`hydrateRoot`/`createRoot`) exposes three error callbacks:
 *   - onRecoverableError : React auto-recovered (e.g. a hydration mismatch it
 *     re-rendered on the client). `error.cause` may carry the original error.
 *   - onCaughtError      : caught by an Error Boundary.
 *   - onUncaughtError    : NOT caught by any Error Boundary.
 *
 * Routing decisions (see plan §Phase 4) :
 *   - All three feed the SAME Sentry buffer (single `BufferedReactError`
 *     variant, discriminated by `channel`) — no parallel buffer.
 *   - ONLY a recoverable error *identified as a hydration mismatch* emits the
 *     internal `seo.runtime.hydration_error` event. `onRecoverableError` is NOT
 *     a synonym for "hydration error" — classifying every recoverable error as
 *     one would skew the SEO metric. The internal endpoint also only accepts 4
 *     event types (Zod enum + Postgres ENUM), so caught/uncaught MUST NOT emit.
 *
 * NOTE on `onUncaughtError` exclusivity: React is *expected* to suppress its
 * default `window.reportError` when this callback is provided, making the
 * callback the sole owner of React render errors (window 'error' listeners then
 * own only non-React errors). This is NOT a documented permanent contract — it
 * is verified empirically by an integration test against the pinned React 19.
 *
 * This module is pure / dependency-injected so it is unit-testable without a DOM.
 */

export type ReactErrorChannel = "recoverable" | "caught" | "uncaught";

export type BufferedReactError = {
  kind: "reactError";
  channel: ReactErrorChannel;
  error: unknown;
  componentStack?: string | null;
  cause?: unknown;
};

/** React 19 passes an errorInfo object carrying the component stack. */
export interface ReactErrorInfo {
  componentStack?: string | null;
}

// Must match the React 19 hydration wording verified against the React source:
//   "Hydration failed because the server rendered HTML didn't match the client…"
//   "A tree hydrated but some attributes of the server rendered HTML didn't match…"
// Keep IN SYNC with the Playwright hydration spec regex.
const HYDRATION_RE =
  /hydrat|server rendered html|did(?:n['’]t| not) match|does not match/i;

/**
 * Read `error.cause` (ES2022) without requiring the global `lib` to include it.
 * The runtime (Node 24 / modern browsers) has `cause`; only the ES2019 type lib
 * here does not — a localized, scoped accessor avoids a broad tsconfig change.
 */
function getErrorCause(error: unknown): unknown {
  return error instanceof Error
    ? (error as Error & { cause?: unknown }).cause
    : undefined;
}

/**
 * True only when a recoverable error is a hydration mismatch. React exposes no
 * public `HydrationError` type/code, so we inspect the error message + cause —
 * NOT a `console.error` text proxy.
 */
export function isHydrationRecoverableError(error: unknown): boolean {
  const cause = getErrorCause(error);
  const msg =
    error instanceof Error
      ? `${error.message} ${cause instanceof Error ? cause.message : ""}`
      : String(error);
  return HYDRATION_RE.test(msg);
}

/** Sinks injected by the entry point (buffer + the narrow hydration reporter). */
export interface ReactErrorSink {
  /** Push a React error onto the existing pre-Sentry buffer. */
  buffer: (entry: BufferedReactError) => void;
  /** Emit the normalized `seo.runtime.hydration_error` internal event. */
  reportHydration: () => void;
}

export interface ReactRootErrorHandlers {
  onRecoverableError: (error: unknown, errorInfo?: ReactErrorInfo) => void;
  onCaughtError: (error: unknown, errorInfo?: ReactErrorInfo) => void;
  onUncaughtError: (error: unknown, errorInfo?: ReactErrorInfo) => void;
}

/** Build the three root error handlers around injected sinks (testable). */
export function createReactErrorHandlers(
  sink: ReactErrorSink,
): ReactRootErrorHandlers {
  const push = (
    channel: ReactErrorChannel,
    error: unknown,
    errorInfo?: ReactErrorInfo,
  ): void => {
    sink.buffer({
      kind: "reactError",
      channel,
      error,
      componentStack: errorInfo?.componentStack ?? null,
      cause: getErrorCause(error),
    });
  };

  return {
    onRecoverableError(error, errorInfo) {
      push("recoverable", error, errorInfo);
      // Internal SEO event ONLY for genuine hydration mismatches.
      if (isHydrationRecoverableError(error)) sink.reportHydration();
    },
    onCaughtError(error, errorInfo) {
      push("caught", error, errorInfo); // Sentry only — no internal event.
    },
    onUncaughtError(error, errorInfo) {
      push("uncaught", error, errorInfo); // Sentry only — no internal event.
    },
  };
}

/** Minimal Sentry surface used for replay (avoids SDK type coupling). */
export interface SentryLike {
  withScope: (cb: (scope: SentryScopeLike) => void) => void;
  captureException: (error: unknown) => void;
}
export interface SentryScopeLike {
  setTag: (key: string, value: string) => void;
  setExtra: (key: string, value: unknown) => void;
}

const MAX_COMPONENT_STACK = 4000;
const MAX_CAUSE_MESSAGE = 500;

/**
 * Replay a buffered React error to Sentry with a bounded scope — never
 * serialize an arbitrary (possibly cyclic / large) `cause` object.
 */
export function captureReactErrorToSentry(
  Sentry: SentryLike,
  item: BufferedReactError,
): void {
  Sentry.withScope((scope) => {
    scope.setTag("react.error_channel", item.channel);
    if (item.componentStack) {
      scope.setExtra(
        "react.component_stack",
        String(item.componentStack).slice(0, MAX_COMPONENT_STACK),
      );
    }
    if (item.cause instanceof Error) {
      scope.setExtra("react.cause_name", item.cause.name);
      scope.setExtra(
        "react.cause_message",
        String(item.cause.message).slice(0, MAX_CAUSE_MESSAGE),
      );
    }
    Sentry.captureException(item.error);
  });
}

/**
 * Polyfill for `Array.prototype.at` (ES2022) — client only.
 *
 * Why this exists
 * ---------------
 * `@sentry-internal/browser-utils` (pulled in by `@sentry/react`) ships INP
 * web-vital instrumentation that calls `this._longestInteractionList.at(-1)`
 * in `InteractionManager._processEntry`. Sentry explicitly declares
 * "We support ES2021 and earlier" and de-`.at()`-ed the sibling CLS path
 * (`LayoutShiftManager`, now `[length - 1]`) but MISSED this INP call-site.
 * On engines without `Array.prototype.at` (Safari < 15.4, old Chromium /
 * Android WebViews, several crawler engines) the INP `PerformanceObserver`
 * callback throws `… .at is not a function`. It is thrown inside Sentry's own
 * instrumentation and re-captured by Sentry's global handler, so it surfaces
 * in PROD as `this.i.at is not a function` / `i.entries.at is not a function`.
 * The page itself is unaffected (async observer callback), but it spams the
 * Sentry error budget and loses INP telemetry for those clients.
 *
 * A polyfill at the root (rather than patching `node_modules`) fixes every
 * `.at()` call-site — Sentry's INP path and any other bundled dependency —
 * for old engines, and is the correct interim until `@sentry/*` ships an
 * upstream release that also fixes the INP `.at(-1)`. Remove this module then.
 *
 * Loaded as the FIRST import in `entry.client.tsx` so `.at` exists before the
 * lazily-scheduled Sentry init registers its observers. The method is defined
 * non-enumerable to match the native descriptor — a plain assignment would be
 * enumerable and leak into `for…in` iteration over arrays.
 */
export function installArrayAtPolyfill(): void {
  if (typeof (Array.prototype as { at?: unknown }).at === "function") {
    return;
  }

  // Intentional, spec-faithful prototype extension (see file header) — only
  // installed when the native method is absent, and non-enumerable.
  // eslint-disable-next-line no-extend-native
  Object.defineProperty(Array.prototype, "at", {
    value: function at(this: unknown[], index: number): unknown {
      const len = this.length;
      let k = Math.trunc(index) || 0;
      if (k < 0) {
        k += len;
      }
      return k < 0 || k >= len ? undefined : this[k];
    },
    writable: true,
    enumerable: false,
    configurable: true,
  });
}

installArrayAtPolyfill();

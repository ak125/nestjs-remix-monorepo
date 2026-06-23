import { describe, it, expect, afterEach } from "vitest";

import { installArrayAtPolyfill } from "~/utils/array-at-polyfill.client";

/**
 * Regression guard for the Sentry INP crash on engines without ES2022
 * `Array.prototype.at`.
 *
 * `@sentry-internal/browser-utils` (via `@sentry/react`) calls
 * `this._longestInteractionList.at(-1)` in `InteractionManager._processEntry`
 * (INP web-vital). Sentry declares ES2021 support and de-`.at()`-ed the
 * sibling CLS path but missed this INP call-site, so on Safari < 15.4 / old
 * Chromium-WebViews / several crawler engines the INP PerformanceObserver
 * callback throws `… .at is not a function` — surfaced in Sentry PROD as
 * `this.i.at is not a function` / `i.entries.at is not a function`.
 *
 * Node ships native `.at`, so these tests simulate the old engine by deleting
 * the method, then assert the polyfill restores spec-correct behaviour.
 */
describe("Array.prototype.at polyfill", () => {
  const nativeDescriptor = Object.getOwnPropertyDescriptor(
    Array.prototype,
    "at",
  );

  afterEach(() => {
    if (nativeDescriptor) {
      // Restore the native descriptor after each simulated old-engine test.
      // eslint-disable-next-line no-extend-native
      Object.defineProperty(Array.prototype, "at", nativeDescriptor);
    }
  });

  const removeNativeAt = () => {
    delete (Array.prototype as { at?: unknown }).at;
  };

  const atOf = (arr: unknown[]) =>
    (arr as unknown as { at(index: number): unknown }).at.bind(arr);

  it("reproduces the crash on an engine lacking Array.prototype.at", () => {
    removeNativeAt();
    expect(() =>
      ([1, 2, 3] as unknown as { at(index: number): unknown }).at(-1),
    ).toThrow(/is not a function/);
  });

  it("restores spec-correct .at() — including the .at(-1) Sentry's INP code calls", () => {
    removeNativeAt();
    installArrayAtPolyfill();

    const at = atOf([10, 20, 30]);
    expect(at(-1)).toBe(30); // the exact access InteractionManager makes
    expect(at(0)).toBe(10);
    expect(at(2)).toBe(30);
    expect(at(-3)).toBe(10);
    expect(at(3)).toBeUndefined();
    expect(at(-4)).toBeUndefined();
  });

  it("defines .at as non-enumerable (no leak into for…in over arrays)", () => {
    removeNativeAt();
    installArrayAtPolyfill();

    const keys: string[] = [];
    // eslint-disable-next-line guard-for-in
    for (const k in [1, 2, 3]) keys.push(k);
    expect(keys).not.toContain("at");
  });

  it("is a no-op when native .at is present (does not overwrite)", () => {
    const before = (Array.prototype as { at?: unknown }).at;
    installArrayAtPolyfill();
    expect((Array.prototype as { at?: unknown }).at).toBe(before);
  });
});

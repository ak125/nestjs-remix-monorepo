/**
 * Tests unitaires — `chunk-reload.client.ts`.
 *
 * 1. `shouldReloadOnPreloadError` (pur) : garde anti-boucle du recovery
 *    `vite:preloadError` — un reload ne doit JAMAIS se déclencher en boucle
 *    serrée (CDN servant encore le HTML périmé dans sa fenêtre `s-maxage`),
 *    tout en récupérant sur un déploiement réellement plus récent une fois la
 *    fenêtre écoulée.
 *
 * 2. `installChunkReloadGuard` (listener) : incident Sentry PROD 2026-07-10
 *    (`TypeError: reading 'links'`, cf.
 *    audit/sentry-prod-links-undefined-and-removechild-triage-2026-07-14.md).
 *    Le guard doit aussi (a) marquer la fenêtre de recovery pour que le
 *    beforeSend Sentry classe les artefacts de course (`preventDefault` →
 *    `__vitePreload` résout `undefined` → TypeError en aval), et (b) émettre le
 *    beacon interne `seo.runtime.chunk_load_error` — sans lui, les échecs
 *    d'import de modules de route sont invisibles sur les DEUX chemins du guard
 *    (preventDefault avale le rejet ; anti-loop → catch de loadRouteModule).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CHUNK_RELOAD_TS_KEY,
  RELOAD_WINDOW_MS,
  installChunkReloadGuard,
  isChunkReloadRecoveryActive,
  shouldReloadOnPreloadError,
} from "~/utils/chunk-reload.client";
import { reportChunkResolvedInvalid } from "~/utils/runtime-errors.client";

vi.mock("~/utils/runtime-errors.client", () => ({
  reportChunkResolvedInvalid: vi.fn(),
}));

describe("shouldReloadOnPreloadError", () => {
  it("reloads on the first failure (no prior timestamp)", () => {
    expect(shouldReloadOnPreloadError(1_000_000, null)).toBe(true);
  });

  it("reloads when last reload is older than the window", () => {
    const now = 1_000_000;
    const last = now - RELOAD_WINDOW_MS - 1;
    expect(shouldReloadOnPreloadError(now, last)).toBe(true);
  });

  it("does NOT reload within the window (anti-loop)", () => {
    const now = 1_000_000;
    const last = now - 1_000; // 1s ago, well inside 10s window
    expect(shouldReloadOnPreloadError(now, last)).toBe(false);
  });

  it("does NOT reload exactly at the window boundary (strict >)", () => {
    const now = 1_000_000;
    const last = now - RELOAD_WINDOW_MS;
    expect(shouldReloadOnPreloadError(now, last)).toBe(false);
  });

  it("reloads when the persisted timestamp is corrupt (NaN)", () => {
    expect(shouldReloadOnPreloadError(1_000_000, Number.NaN)).toBe(true);
  });

  it("reloads when the persisted timestamp is non-finite (Infinity)", () => {
    expect(
      shouldReloadOnPreloadError(1_000_000, Number.POSITIVE_INFINITY),
    ).toBe(true);
  });

  it("honours a custom window argument", () => {
    const now = 1_000_000;
    expect(shouldReloadOnPreloadError(now, now - 500, 1_000)).toBe(false);
    expect(shouldReloadOnPreloadError(now, now - 1_500, 1_000)).toBe(true);
  });
});

describe("installChunkReloadGuard — recovery marker + beacon", () => {
  let uninstall: (() => void) | null = null;
  const reload = vi.fn();

  const dispatchPreloadError = (payload: unknown): Event => {
    const event = new Event("vite:preloadError", { cancelable: true });
    (event as Event & { payload?: unknown }).payload = payload;
    window.dispatchEvent(event);
    return event;
  };

  beforeEach(() => {
    sessionStorage.clear();
    reload.mockClear();
    vi.mocked(reportChunkResolvedInvalid).mockClear();
    uninstall = installChunkReloadGuard(reload);
  });

  afterEach(() => {
    uninstall?.();
    uninstall = null;
  });

  it("is inactive before any preload error", () => {
    expect(isChunkReloadRecoveryActive()).toBe(false);
  });

  it("marks recovery active, prevents default and reloads on first failure", () => {
    const event = dispatchPreloadError(
      new Error("Failed to fetch dynamically imported module: /assets/x.js"),
    );

    expect(event.defaultPrevented).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(isChunkReloadRecoveryActive()).toBe(true);
    expect(sessionStorage.getItem(CHUNK_RELOAD_TS_KEY)).not.toBeNull();
  });

  it("emits the internal chunk beacon (stage rejected, guard source) on the reload path", () => {
    dispatchPreloadError(new Error("boom-chunk"));

    expect(reportChunkResolvedInvalid).toHaveBeenCalledTimes(1);
    expect(reportChunkResolvedInvalid).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: "rejected",
        source: "vite_preload_error_guard",
        recovery: "reload",
        error_message: "boom-chunk",
      }),
    );
  });

  it("anti-loop path: no preventDefault, no reload, marker stays inactive, beacon still emitted", () => {
    sessionStorage.setItem(CHUNK_RELOAD_TS_KEY, String(Date.now()));

    const event = dispatchPreloadError(new Error("boom-again"));

    expect(event.defaultPrevented).toBe(false);
    expect(reload).not.toHaveBeenCalled();
    expect(isChunkReloadRecoveryActive()).toBe(false);
    expect(reportChunkResolvedInvalid).toHaveBeenCalledTimes(1);
    expect(reportChunkResolvedInvalid).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: "rejected",
        source: "vite_preload_error_guard",
        recovery: "skipped_antiloop",
      }),
    );
  });

  it("bounds error_message and tolerates a non-Error payload", () => {
    dispatchPreloadError("a".repeat(500));

    expect(reportChunkResolvedInvalid).toHaveBeenCalledWith(
      expect.objectContaining({
        error_message: "a".repeat(200),
      }),
    );
  });

  it("recovery window is time-bounded (marker expires after RELOAD_WINDOW_MS)", () => {
    dispatchPreloadError(new Error("x"));

    expect(isChunkReloadRecoveryActive()).toBe(true);
    expect(isChunkReloadRecoveryActive(Date.now() + RELOAD_WINDOW_MS + 1)).toBe(
      false,
    );
  });

  it("dep-burst discipline: events after the reload decision emit NO extra beacon (1 per page life)", () => {
    // Vite dispatche un vite:preloadError PAR dep rejetée + un pour le module :
    // une seule navigation cassée peut produire 2-3 events dans la même boucle.
    dispatchPreloadError(new Error("Unable to preload CSS for /assets/a.css"));
    dispatchPreloadError(
      new Error("Failed to fetch dynamically imported module: /assets/x.js"),
    );
    dispatchPreloadError(new Error("Unable to preload CSS for /assets/b.css"));

    expect(reload).toHaveBeenCalledTimes(1);
    expect(reportChunkResolvedInvalid).toHaveBeenCalledTimes(1);
    expect(reportChunkResolvedInvalid).toHaveBeenCalledWith(
      expect.objectContaining({ recovery: "reload" }),
    );
  });

  it("uninstall resets the marker (isolation contract for tests and HMR)", () => {
    dispatchPreloadError(new Error("x"));
    expect(isChunkReloadRecoveryActive()).toBe(true);

    uninstall?.();
    uninstall = null;

    expect(isChunkReloadRecoveryActive()).toBe(false);
  });
});

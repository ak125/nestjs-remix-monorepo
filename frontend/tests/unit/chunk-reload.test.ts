/**
 * Tests unitaires — `shouldReloadOnPreloadError`
 * (`frontend/app/utils/chunk-reload.client.ts`).
 *
 * Garde anti-boucle du recovery `vite:preloadError` : un reload ne doit JAMAIS
 * se déclencher en boucle serrée (CDN servant encore le HTML périmé dans sa
 * fenêtre `s-maxage`), tout en récupérant sur un déploiement réellement plus
 * récent une fois la fenêtre écoulée.
 */

import { describe, expect, it } from 'vitest';

import {
  RELOAD_WINDOW_MS,
  shouldReloadOnPreloadError,
} from '~/utils/chunk-reload.client';

describe('shouldReloadOnPreloadError', () => {
  it('reloads on the first failure (no prior timestamp)', () => {
    expect(shouldReloadOnPreloadError(1_000_000, null)).toBe(true);
  });

  it('reloads when last reload is older than the window', () => {
    const now = 1_000_000;
    const last = now - RELOAD_WINDOW_MS - 1;
    expect(shouldReloadOnPreloadError(now, last)).toBe(true);
  });

  it('does NOT reload within the window (anti-loop)', () => {
    const now = 1_000_000;
    const last = now - 1_000; // 1s ago, well inside 10s window
    expect(shouldReloadOnPreloadError(now, last)).toBe(false);
  });

  it('does NOT reload exactly at the window boundary (strict >)', () => {
    const now = 1_000_000;
    const last = now - RELOAD_WINDOW_MS;
    expect(shouldReloadOnPreloadError(now, last)).toBe(false);
  });

  it('reloads when the persisted timestamp is corrupt (NaN)', () => {
    expect(shouldReloadOnPreloadError(1_000_000, Number.NaN)).toBe(true);
  });

  it('reloads when the persisted timestamp is non-finite (Infinity)', () => {
    expect(shouldReloadOnPreloadError(1_000_000, Number.POSITIVE_INFINITY)).toBe(
      true,
    );
  });

  it('honours a custom window argument', () => {
    const now = 1_000_000;
    expect(shouldReloadOnPreloadError(now, now - 500, 1_000)).toBe(false);
    expect(shouldReloadOnPreloadError(now, now - 1_500, 1_000)).toBe(true);
  });
});

/**
 * Tests unitaires — `postJsonBeacon` (frontend/app/utils/beacon.ts).
 *
 * Pins the contract that drives the Sentry noise fix on
 * `POST /api/seo/track-impression`:
 *   - prefer `navigator.sendBeacon` so the request survives page unloads
 *   - fall back to `fetch({ keepalive: true })` only when sendBeacon refuses
 *   - never throw and never block when the helper is invoked SSR-side
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { postJsonBeacon } from '~/utils/beacon';

describe('postJsonBeacon', () => {
  const originalNavigator = global.navigator;
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      configurable: true,
      writable: true,
    });
    global.fetch = originalFetch;
  });

  it('uses navigator.sendBeacon when available and it returns true', () => {
    const sendBeacon = vi.fn().mockReturnValue(true);
    Object.defineProperty(global, 'navigator', {
      value: { sendBeacon },
      configurable: true,
      writable: true,
    });
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    postJsonBeacon('/api/seo/track-impression', { linkType: 'X', linkCount: 1 });

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    const [url, blob] = sendBeacon.mock.calls[0];
    expect(url).toBe('/api/seo/track-impression');
    expect(blob).toBeInstanceOf(Blob);
    expect((blob as Blob).type).toBe('application/json');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('falls back to fetch with keepalive when sendBeacon returns false', () => {
    const sendBeacon = vi.fn().mockReturnValue(false);
    Object.defineProperty(global, 'navigator', {
      value: { sendBeacon },
      configurable: true,
      writable: true,
    });
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchSpy;

    postJsonBeacon('/api/seo/track-impression', { foo: 'bar' });

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('/api/seo/track-impression');
    expect(init).toMatchObject({
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
    });
    expect(init.body).toBe(JSON.stringify({ foo: 'bar' }));
  });

  it('falls back to fetch when sendBeacon is not implemented', () => {
    Object.defineProperty(global, 'navigator', {
      value: {},
      configurable: true,
      writable: true,
    });
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchSpy;

    postJsonBeacon('/api/seo/track-impression', { foo: 'bar' });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when navigator is undefined (SSR safety)', () => {
    // jsdom always defines navigator, so we delete it for this test
    const savedNavigator = global.navigator;
    // @ts-expect-error — intentional deletion to simulate SSR
    delete global.navigator;
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    expect(() =>
      postJsonBeacon('/api/seo/track-impression', { foo: 'bar' }),
    ).not.toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();

    Object.defineProperty(global, 'navigator', {
      value: savedNavigator,
      configurable: true,
      writable: true,
    });
  });

  it('swallows fetch rejection without throwing', async () => {
    Object.defineProperty(global, 'navigator', {
      value: {},
      configurable: true,
      writable: true,
    });
    const fetchSpy = vi.fn().mockRejectedValue(new Error('network down'));
    global.fetch = fetchSpy;

    expect(() =>
      postJsonBeacon('/api/seo/track-impression', { foo: 'bar' }),
    ).not.toThrow();
    // Let the rejected promise settle so the .catch handler runs.
    await Promise.resolve();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

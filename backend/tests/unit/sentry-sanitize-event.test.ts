/**
 * Regression test: `sanitizeSentryEvent` (Sentry `beforeSend` predicate) must:
 *   - drop `BadRequestError: request aborted` from `raw-body` (client TCP cut
 *     mid-body — typical for tracking beacons during page unload)
 *   - keep unrelated errors and scrub sensitive request headers
 *
 * Pins the filter so a future refactor cannot silently re-introduce the noise
 * burst seen on `POST /api/seo/track-impression` in PROD (Sentry alert
 * 2026-05-12 12:15 UTC).
 */

import type { ErrorEvent, EventHint } from '@sentry/nestjs';
import { sanitizeSentryEvent } from '../../src/instrument';

describe('sanitizeSentryEvent — Sentry beforeSend predicate', () => {
  it('drops events whose originalException has type === "request.aborted"', () => {
    const event = { event_id: 'evt-1' } as ErrorEvent;
    const hint = {
      originalException: { type: 'request.aborted', message: 'request aborted' },
    } as unknown as EventHint;
    expect(sanitizeSentryEvent(event, hint)).toBeNull();
  });

  it('drops events whose originalException.message === "request aborted" even without type', () => {
    const event = { event_id: 'evt-2' } as ErrorEvent;
    const hint = {
      originalException: { message: 'request aborted' },
    } as unknown as EventHint;
    expect(sanitizeSentryEvent(event, hint)).toBeNull();
  });

  it('keeps unrelated errors', () => {
    const event = { event_id: 'evt-3' } as ErrorEvent;
    const hint = {
      originalException: new Error('database connection refused'),
    } as unknown as EventHint;
    expect(sanitizeSentryEvent(event, hint)).toBe(event);
  });

  it('scrubs Authorization, Cookie, Set-Cookie, X-API-Key headers on kept events', () => {
    const event = {
      event_id: 'evt-4',
      request: {
        headers: {
          Authorization: 'Bearer s3cret',
          Cookie: 'connect.sid=xyz',
          'Set-Cookie': 'a=1',
          'X-API-Key': 'k',
          'X-Trace-Id': 'visible',
        },
      },
    } as unknown as ErrorEvent;
    const hint = {
      originalException: new Error('whatever'),
    } as unknown as EventHint;

    const result = sanitizeSentryEvent(event, hint);
    expect(result).not.toBeNull();
    const headers = result!.request!.headers as Record<string, string>;
    expect(headers.Authorization).toBe('[Filtered]');
    expect(headers.Cookie).toBe('[Filtered]');
    expect(headers['Set-Cookie']).toBe('[Filtered]');
    expect(headers['X-API-Key']).toBe('[Filtered]');
    expect(headers['X-Trace-Id']).toBe('visible');
  });

  it('handles missing hint / originalException gracefully', () => {
    const event = { event_id: 'evt-5' } as ErrorEvent;
    expect(sanitizeSentryEvent(event, {} as EventHint)).toBe(event);
  });
});

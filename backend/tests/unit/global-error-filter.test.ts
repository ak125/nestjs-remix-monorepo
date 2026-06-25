/**
 * GlobalErrorFilter — handleGenericError content-negotiation tests
 *
 * Covers the structural gap surfaced 2026-06-25: generic errors (429, 5xx and
 * other non-special 4xx) were always returned as raw JSON, even to a browser /
 * crawler. The fix makes `handleGenericError` content-negotiated, mirroring the
 * existing `isApiRequest()` pattern used by handle404/410/412/451:
 *   - browser request (Accept: text/html, non-/api) → status-aware HTML page,
 *     HTTP status PRESERVED (429 stays 429), `X-Robots-Tag: noindex, follow`.
 *   - API request (/api/* or Accept: application/json) → JSON (unchanged).
 *
 * @see backend/src/modules/errors/filters/global-error.filter.ts
 */
import { GlobalErrorFilter } from '@modules/errors/filters/global-error.filter';

// ─── Helpers ────────────────────────────────────────────────────────────────

function createErrorServiceMock() {
  return {
    logError: jest.fn().mockResolvedValue(undefined),
    handle404: jest.fn(),
    handle410: jest.fn(),
  };
}

function createResponseMock() {
  const res: Record<string, jest.Mock | unknown> = {
    headersSent: false,
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
    redirect: jest.fn().mockReturnThis(),
  };
  return res as any;
}

function createRequest(overrides: Record<string, unknown> = {}) {
  return {
    url: '/pieces/alternateur-4.html',
    path: '/pieces/alternateur-4.html',
    method: 'GET',
    headers: { accept: 'text/html' },
    ...overrides,
  } as any;
}

// handleGenericError is private; we exercise it directly (decorator-free,
// deterministic) — the public `catch()` routes 429/5xx here via its switch.
function callGeneric(
  filter: GlobalErrorFilter,
  req: unknown,
  res: unknown,
  status: number,
  message = 'Erreur',
  code = 'Error',
) {
  return (filter as any).handleGenericError(
    req,
    res,
    status,
    message,
    code,
    new Error(message),
  );
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('GlobalErrorFilter.handleGenericError — content negotiation', () => {
  let filter: GlobalErrorFilter;
  let errorService: ReturnType<typeof createErrorServiceMock>;

  beforeEach(() => {
    errorService = createErrorServiceMock();
    filter = new GlobalErrorFilter(errorService as any);
  });

  afterEach(() => jest.clearAllMocks());

  describe('browser request (Accept: text/html)', () => {
    it('429 → status-aware HTML with status code PRESERVED (not 302, not JSON)', () => {
      const res = createResponseMock();
      callGeneric(filter, createRequest(), res, 429, 'Too many requests');

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.send).toHaveBeenCalledTimes(1);
      expect(res.json).not.toHaveBeenCalled();
      expect(res.redirect).not.toHaveBeenCalled();

      const html = String(res.send.mock.calls[0][0]);
      expect(html).toContain('429');
      expect(html).toContain('Trop de requêtes'); // FR label, status-aware
      expect(html.toLowerCase()).toContain('<!doctype html');
    });

    it('emits X-Robots-Tag: noindex, follow (server-side, SEO-safe)', () => {
      const res = createResponseMock();
      callGeneric(filter, createRequest(), res, 503, 'Service unavailable');

      expect(res.setHeader).toHaveBeenCalledWith(
        'X-Robots-Tag',
        expect.stringContaining('noindex'),
      );
      const html = String(res.send.mock.calls[0][0]);
      expect(html).toContain('503');
      expect(html).toContain('Service indisponible');
    });

    it('sends Retry-After on 429 and 503', () => {
      const res429 = createResponseMock();
      callGeneric(filter, createRequest(), res429, 429);
      expect(res429.setHeader).toHaveBeenCalledWith(
        'Retry-After',
        expect.anything(),
      );

      const res503 = createResponseMock();
      callGeneric(filter, createRequest(), res503, 503);
      expect(res503.setHeader).toHaveBeenCalledWith(
        'Retry-After',
        expect.anything(),
      );
    });

    it('does NOT send Retry-After on a 500', () => {
      const res = createResponseMock();
      callGeneric(filter, createRequest(), res, 500);
      const retryCalls = res.setHeader.mock.calls.filter(
        (c: unknown[]) => c[0] === 'Retry-After',
      );
      expect(retryCalls).toHaveLength(0);
    });

    it('does NOT reflect the raw internal message into public HTML (no info-leak, no injection)', () => {
      const res = createResponseMock();
      callGeneric(
        filter,
        createRequest(),
        res,
        500,
        '<script>alert(1)</script> dsn=postgres://secret',
      );
      const html = String(res.send.mock.calls[0][0]);
      // The internal message is never echoed into the public page.
      expect(html).not.toContain('alert(1)');
      expect(html).not.toContain('secret');
      expect(html).not.toContain('<script>alert(1)</script>');
      // Still status-aware (controlled, static label + integer status).
      expect(html).toContain('500');
      expect(html).toContain('Erreur serveur interne');
    });
  });

  describe('API request (unchanged → JSON)', () => {
    it('/api/* path → JSON, never HTML', () => {
      const res = createResponseMock();
      const req = createRequest({
        url: '/api/foo',
        path: '/api/foo',
        headers: { accept: 'application/json' },
      });
      callGeneric(filter, req, res, 429, 'Too many requests');

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledTimes(1);
      expect(res.send).not.toHaveBeenCalled();

      const payload = res.json.mock.calls[0][0];
      expect(payload).toMatchObject({ statusCode: 429 });
    });

    it('Accept: application/json (non-/api) → JSON', () => {
      const res = createResponseMock();
      const req = createRequest({ headers: { accept: 'application/json' } });
      callGeneric(filter, req, res, 500);

      expect(res.json).toHaveBeenCalledTimes(1);
      expect(res.send).not.toHaveBeenCalled();
    });
  });

  it('respects headersSent guard (no double-send)', () => {
    const res = createResponseMock();
    res.headersSent = true;
    callGeneric(filter, createRequest(), res, 429);
    expect(res.send).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});

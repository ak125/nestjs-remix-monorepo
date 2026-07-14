/**
 * H2 (PR #1272 review) — single-fetch `.data` responses bypass the
 * entry.server document arbiter (`applySessionCachePrivacy` runs only for HTML
 * documents; RR8 has no `handleDataRequest`). PR B gave several previously
 * root-`private` public routes a `public, s-maxage` `headers` export, so a
 * session-bearing `.data` for one of those routes would ship a shared-cache
 * policy over a body embedding the revalidated root `{ user, cart }`.
 *
 * These tests lock the invariant at the façade guard:
 *   #1 anonymous `.data` on a healthy public route → public TTL preserved;
 *   #2 same `.data` with `connect.sid` → private/no-store at all three tiers;
 *   #3 a route newly made public by PR B (not just `pieces.$slug`);
 *   #4 the body may carry root data yet never receives `public` when sessioned.
 */
import { type Response } from 'express';
import {
  enforceSessionedDataCachePrivacy,
  requiresSessionedDataPrivacy,
  SESSIONED_DATA_CACHE_HEADERS,
} from './remix.controller';

// The `.data` privacy helpers are colocated in remix.controller.ts (kept inside
// that already-owned file rather than a new module). Mock the controller's heavy
// deps so importing the pure helpers doesn't drag the SSR build / Nest graph.
// (ts-jest hoists these jest.mock() calls above the import above.)
jest.mock('@fafa/frontend', () => ({
  getServerBuild: jest.fn(),
  getCreateAppLoadContext: jest.fn(),
}));
jest.mock('@react-router/express', () => ({ createRequestHandler: jest.fn() }));
jest.mock('@sentry/nestjs', () => ({
  withScope: jest.fn(),
  captureException: jest.fn(),
}));
jest.mock('./remix.service', () => ({ RemixService: class {} }));
jest.mock('./remix-api.service', () => ({ RemixApiService: class {} }));

// Minimal Express-response double mirroring how @react-router/express writes:
// per-header `res.append(...)`, then an implicit `res.writeHead` at flush, then
// the streamed body. Header names are compared case-insensitively (HTTP).
function makeFakeRes() {
  const headers = new Map<string, string>();
  const body: string[] = [];
  const res = {
    setHeader(name: string, value: string) {
      headers.set(name.toLowerCase(), value);
      return res;
    },
    append(name: string, value: string) {
      const cur = headers.get(name.toLowerCase());
      headers.set(name.toLowerCase(), cur ? `${cur}, ${value}` : value);
      return res;
    },
    writeHead(_status: number) {
      return res;
    },
    write(chunk: string) {
      body.push(chunk);
      return true;
    },
    end(chunk?: string) {
      if (chunk) body.push(chunk);
      return res;
    },
  };
  return { res, headers, body };
}

const cookieReq = (path: string, cookie?: string) =>
  ({ path, headers: cookie ? { cookie } : {} }) as {
    path: string;
    headers: { cookie?: string };
  };

// A route PR B newly moved from root-`private` to a public `headers` export.
const NEWLY_PUBLIC_DATA_PATH = '/blog-pieces-auto/advice.data';
const SESSION_COOKIE = 'connect.sid=s%3AsomeSignedSessionValue.hmac';

describe('requiresSessionedDataPrivacy — classification', () => {
  it('#3 sessioned `.data` on a route PR B made public → requires privacy', () => {
    expect(
      requiresSessionedDataPrivacy(NEWLY_PUBLIC_DATA_PATH, SESSION_COOKIE),
    ).toBe(true);
    // not only pieces.$slug:
    expect(
      requiresSessionedDataPrivacy('/reference-auto/xyz.data', SESSION_COOKIE),
    ).toBe(true);
    expect(
      requiresSessionedDataPrivacy('/pieces/x.html.data', SESSION_COOKIE),
    ).toBe(true);
  });

  it('generic `session` cookie also counts (mirror of the Caddy/app matcher)', () => {
    expect(
      requiresSessionedDataPrivacy(NEWLY_PUBLIC_DATA_PATH, 'my_session=abc'),
    ).toBe(true);
  });

  it('#1 anonymous `.data` (no cookie) → does NOT require privacy', () => {
    expect(
      requiresSessionedDataPrivacy(NEWLY_PUBLIC_DATA_PATH, undefined),
    ).toBe(false);
    expect(requiresSessionedDataPrivacy(NEWLY_PUBLIC_DATA_PATH, '')).toBe(
      false,
    );
  });

  it('non-session cookie on `.data` → does NOT require privacy', () => {
    expect(
      requiresSessionedDataPrivacy(NEWLY_PUBLIC_DATA_PATH, 'theme=dark'),
    ).toBe(false);
  });

  it('document requests are out of scope (covered by the entry.server arbiter)', () => {
    expect(
      requiresSessionedDataPrivacy('/blog-pieces-auto/advice', SESSION_COOKIE),
    ).toBe(false);
    expect(requiresSessionedDataPrivacy('/pieces/x.html', SESSION_COOKIE)).toBe(
      false,
    );
  });
});

describe('enforceSessionedDataCachePrivacy — response invariant', () => {
  it('#2/#4 sessioned `.data`: public route policy overridden to private/no-store at all three tiers; body untouched', () => {
    const { res, headers, body } = makeFakeRes();

    const armed = enforceSessionedDataCachePrivacy(
      cookieReq(NEWLY_PUBLIC_DATA_PATH, SESSION_COOKIE),
      res as unknown as Response,
    );
    expect(armed).toBe(true);

    // The RR express adapter emits the route's public policy, then streams a
    // body carrying the revalidated root loader ({ user, cart }).
    res.append('Cache-Control', 'public, max-age=300, s-maxage=3600');
    res.writeHead(200); // implicit flush → guard fires
    res.write(
      JSON.stringify({ root: { user: { id: 7 }, cart: { items: 3 } } }),
    );
    res.end();

    expect(headers.get('cache-control')).toBe(
      SESSIONED_DATA_CACHE_HEADERS['Cache-Control'],
    );
    expect(headers.get('cache-control')).not.toContain('public');
    expect(headers.get('cache-control')).not.toContain('s-maxage');
    expect(headers.get('cdn-cache-control')).toBe('no-store');
    expect(headers.get('cloudflare-cdn-cache-control')).toBe('no-store');
    // #4 body carried root PII but the response is private/no-store, never public.
    expect(body.join('')).toContain('"user"');
    expect(body.join('')).toContain('"cart"');
  });

  it('#1 anonymous `.data`: guard not armed → the public TTL is preserved', () => {
    const { res, headers } = makeFakeRes();

    const armed = enforceSessionedDataCachePrivacy(
      cookieReq(NEWLY_PUBLIC_DATA_PATH),
      res as unknown as Response,
    );
    expect(armed).toBe(false);

    res.append('Cache-Control', 'public, max-age=300, s-maxage=3600');
    res.writeHead(200);

    expect(headers.get('cache-control')).toBe(
      'public, max-age=300, s-maxage=3600',
    );
    expect(headers.get('cdn-cache-control')).toBeUndefined();
    expect(headers.get('cloudflare-cdn-cache-control')).toBeUndefined();
  });
});

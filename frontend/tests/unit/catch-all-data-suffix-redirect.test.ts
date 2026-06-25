import { describe, it, expect, vi, beforeEach } from "vitest";

import { loader } from "~/routes/$";

vi.mock("~/utils/logger", () => ({
  logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

/**
 * Régression 2026-06-25 — RR8 single-fetch (navigation client) garde le suffixe
 * `.data` sur request.url. Le catch-all dérivait son `pathname` de request.url,
 * donc les quick-redirects de `resolveKnownPattern` (match EXACT, ex.
 * `pathname === "/blog"`) ne se déclenchaient plus en navigation client → 404 au
 * lieu du 301. Empirique : /blog → 301 en document, 404 en `.data` (avant fix).
 *
 * Ce test prouve, côté loader, que le suffixe est retiré AVANT resolveKnownPattern,
 * donc que document et single-fetch produisent le MÊME 301.
 */
describe("catch-all $.tsx — quick-redirect survit au suffixe single-fetch .data", () => {
  beforeEach(() => {
    // resolveKnownPattern court-circuite AVANT tout fetch ; stub par sécurité.
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({ found: false })))),
    );
  });

  const call = (path: string) =>
    loader({
      request: new Request(`https://www.automecanik.com${path}`),
      params: {},
      context: {},
    } as never);

  it("document /blog → 301 vers /blog-pieces-auto", async () => {
    const res = (await call("/blog")) as Response;
    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe("/blog-pieces-auto");
  });

  it("single-fetch /blog.data → 301 vers /blog-pieces-auto (identique au document)", async () => {
    const res = (await call("/blog.data")) as Response;
    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe("/blog-pieces-auto");
  });
});

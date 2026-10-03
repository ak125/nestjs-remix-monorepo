import { describe, it, expect, vi, beforeEach } from "vitest";

import { loader } from "~/routes/$";

vi.mock("~/utils/logger", () => ({
  logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

/**
 * Régression GSC 404 (2026-10-03) — /blog-pieces-auto/comment-* est un ba_alias
 * de conseil. Le quick-redirect l'envoyait vers /blog-pieces-auto/conseils/comment-*,
 * route indexée sur pg_alias (aucun pg_alias ne commence par « comment- ») → 404.
 * Il délègue désormais au résolveur /blog-pieces-auto/article/{ba_alias}, qui 301
 * vers /conseils/{pg_alias}.
 */
describe("catch-all $.tsx — ba_alias de conseil → résolveur /article/", () => {
  beforeEach(() => {
    // resolveKnownPattern court-circuite AVANT tout fetch ; stub par sécurité.
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(new Response(JSON.stringify({ found: false }))),
      ),
    );
  });

  const call = (path: string) =>
    loader({
      request: new Request(`https://www.automecanik.com${path}`),
      params: {},
      context: {},
    } as never);

  it("/blog-pieces-auto/comment-changer-un-demarreur → 301 /blog-pieces-auto/article/comment-changer-un-demarreur", async () => {
    const res = (await call(
      "/blog-pieces-auto/comment-changer-un-demarreur",
    )) as Response;
    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe(
      "/blog-pieces-auto/article/comment-changer-un-demarreur",
    );
  });

  it("ne cible plus /blog-pieces-auto/conseils/comment-* (route inexistante)", async () => {
    const res = (await call(
      "/blog-pieces-auto/comment-changer-un-thermostat",
    )) as Response;
    expect(res.headers.get("Location")).not.toMatch(
      /^\/blog-pieces-auto\/conseils\/comment-/,
    );
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

import { loader } from "~/routes/$";

// vi.mock is hoisted by Vitest's transformer (runs before imports at runtime),
// safe to declare after the import for ESLint's `import/first` rule.
vi.mock("~/utils/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

const fetchMock = vi.fn(() =>
  Promise.resolve(new Response(JSON.stringify({ redirectUrl: null }))),
);

/**
 * Régression : SeoHeadersInterceptor (backend) applique
 * `X-Robots-Tag: index, follow` par défaut pour les paths non-matchés (catch-all).
 * Sans header explicite côté Remix loader, Google reçoit `index, follow` sur
 * des 404 (`/wp-admin/`, `/panier`, etc.) ce qui contredit la doctrine SEO.
 *
 * Empirique 2026-05-25 : audit GSC automecanik.com confirme bug sur 3/3 URLs sondées.
 * Fix : tout throw json(..., status 404|410) du catch-all DOIT inclure
 * `"X-Robots-Tag": "noindex, follow"` (canon : `noindex` + `follow` pour permettre
 * crawl des liens internes existants tout en empêchant l'indexation).
 */
describe("catch-all $.tsx — 404/410 X-Robots-Tag noindex,follow", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ redirectUrl: null }))),
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  it("404 catch-all émet X-Robots-Tag: noindex, follow", async () => {
    const request = new Request("https://www.automecanik.com/wp-admin/");

    let thrown: Response | undefined;
    try {
      await loader({ request, params: {}, context: {} } as never);
    } catch (e) {
      thrown = e as Response;
    }

    expect(thrown).toBeInstanceOf(Response);
    expect(thrown?.status).toBe(404);
    expect(thrown?.headers.get("X-Robots-Tag")).toBe("noindex, follow");
  });

  it("410 garbage URL émet X-Robots-Tag: noindex, follow (pas noindex seul)", async () => {
    // Base64-style garbage path → short-circuit isGarbageUrl()
    const request = new Request(
      "https://www.automecanik.com/wl8k5m6HsSkVW3cXi61ZQ==",
    );

    let thrown: Response | undefined;
    try {
      await loader({ request, params: {}, context: {} } as never);
    } catch (e) {
      thrown = e as Response;
    }

    expect(thrown).toBeInstanceOf(Response);
    expect(thrown?.status).toBe(410);
    expect(thrown?.headers.get("X-Robots-Tag")).toBe("noindex, follow");
  });

  it("404 de fallback (error path) émet X-Robots-Tag: noindex, follow", async () => {
    // Force l'erreur try/catch en faisant échouer le fetch interne
    fetchMock.mockRejectedValueOnce(new Error("API unreachable"));
    fetchMock.mockRejectedValueOnce(new Error("API unreachable"));

    const request = new Request(
      "https://www.automecanik.com/this-page-does-not-exist-12345",
    );

    let thrown: Response | undefined;
    try {
      await loader({ request, params: {}, context: {} } as never);
    } catch (e) {
      thrown = e as Response;
    }

    expect(thrown).toBeInstanceOf(Response);
    expect(thrown?.status).toBe(404);
    expect(thrown?.headers.get("X-Robots-Tag")).toBe("noindex, follow");
  });
});

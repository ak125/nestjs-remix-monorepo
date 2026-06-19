import { describe, it, expect, vi } from "vitest";

import { headers as catchAllHeaders, loader } from "~/routes/constructeurs.$";

// vi.mock est hoisté par le transformer Vitest (avant les imports au runtime).
vi.mock("~/utils/logger", () => ({
  logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

/**
 * ADR-084 — Le niveau-modèle 2-segments
 * (/constructeurs/{marque}-{id}/{modele}-{id}.html, 973 URLs) est SUPPRIMÉ :
 * tout chemin 2-segments de la route catch-all /constructeurs/* renvoie 410 Gone,
 * noindex,follow, et Cache-Control long TTL (Gone permanent, aligné sur seoError R8).
 */
describe("constructeurs.$.tsx — niveau-modèle 2-seg → 410 Gone (ADR-084)", () => {
  const call = (splat: string) =>
    loader({
      params: { "*": splat },
      request: new Request(`https://www.automecanik.com/constructeurs/${splat}`),
      context: {},
    } as never);

  it("2-segments (.html) → 410 + X-Robots-Tag noindex,follow + Cache-Control public,max-age=86400", async () => {
    let thrown: Response | undefined;
    try {
      await call("kia-88/cee-d-i-88016.html");
    } catch (e) {
      thrown = e as Response;
    }
    expect(thrown).toBeInstanceOf(Response);
    expect(thrown?.status).toBe(410);
    expect(thrown?.headers.get("X-Robots-Tag")).toBe("noindex, follow");
    expect(thrown?.headers.get("Cache-Control")).toBe("public, max-age=86400");
  });

  it("2-segments sans .html → 410 aussi", async () => {
    let thrown: Response | undefined;
    try {
      await call("iveco-84/daily-v-84010");
    } catch (e) {
      thrown = e as Response;
    }
    expect(thrown?.status).toBe(410);
  });

  it("chemin inconnu (ni 2-seg, ni legacy 1-seg) → 404", async () => {
    let thrown: Response | undefined;
    try {
      await call("a/b/c/d");
    } catch (e) {
      thrown = e as Response;
    }
    expect(thrown).toBeInstanceOf(Response);
    expect(thrown?.status).toBe(404);
  });

  it("headers() propage Cache-Control public,max-age=86400 + noindex du throw 410", () => {
    const ctx = (errorHeaders: Headers) =>
      ({
        loaderHeaders: new Headers(),
        parentHeaders: new Headers(),
        actionHeaders: new Headers(),
        errorHeaders,
      }) as never;

    const result = catchAllHeaders(
      ctx(
        new Headers({
          "X-Robots-Tag": "noindex, follow",
          "Cache-Control": "public, max-age=86400",
        }),
      ),
    ) as Record<string, string>;

    expect(result["X-Robots-Tag"]).toBe("noindex, follow");
    expect(result["Cache-Control"]).toBe("public, max-age=86400");
  });
});

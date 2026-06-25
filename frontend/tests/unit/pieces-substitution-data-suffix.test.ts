import { describe, it, expect, vi, beforeEach } from "vitest";

import { loader } from "~/routes/pieces.$slug";

/**
 * Régression R1 404 (2026-06-25) — fuite du suffixe `.data` (React Router v8
 * single-fetch) dans l'URL envoyée au moteur de substitution.
 *
 * Sur une navigation client, RR8 requête `<url>.data`. Le loader construisait
 * l'URL de substitution depuis `new URL(request.url).pathname`, qui CONSERVE le
 * suffixe `.data` (`/pieces/filtre-a-huile-7.html.data`). Le parser substitution
 * (`-(\d+)\.html$`) ne reconnaît alors plus la gamme → `unknown_slug` →
 * httpStatus 404 → le loader throw 404 sur une page POURTANT valide.
 * En F5/document (`request.url` sans `.data`) → 200. D'où un 404 qui n'apparaît
 * qu'en navigation client (et figé 2h par le CDN en PROD).
 *
 * Le param de route `params.slug` est, lui, TOUJOURS propre (RR retire `.data`
 * avant le matching). Le correctif : bâtir l'URL substitution depuis `slug`.
 */

// vi.mock est hoisté par Vitest avant les imports au runtime — déclaré après les
// imports pour satisfaire `import/first` tout en gardant les mocks effectifs.
vi.mock("~/utils/logger", () => ({
  logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock("~/utils/internal-api.server", () => ({
  getInternalApiUrl: () => "http://internal-api",
}));

// apiData minimal mais suffisant pour franchir le guard "gamme existe".
vi.mock("~/services/api/gamme-api.service", () => ({
  fetchGammePageData: vi.fn(async () => ({
    hero: {
      pg_name: "Filtre à huile",
      pg_alias: "filtre-a-huile",
      h1: "Filtre à huile",
    },
    meta: {},
  })),
}));

describe("pieces.$slug loader — pas de fuite du suffixe .data vers la substitution", () => {
  let capturedSubUrl: string | undefined;

  beforeEach(() => {
    capturedSubUrl = undefined;
    // Simule le vrai backend "200 Always" : httpStatus dans le body.
    // Renvoie 404 SI (et seulement si) l'URL reçue contient `.data` —
    // exactement le comportement observé en live.
    global.fetch = vi.fn(async (input: unknown) => {
      const url =
        typeof input === "string"
          ? input
          : (input as Request).url ?? String(input);
      if (url.includes("/api/substitution/check")) {
        capturedSubUrl = url;
        const dirty = decodeURIComponent(url).includes(".data");
        return new Response(
          JSON.stringify({
            httpStatus: dirty ? 404 : 200,
            type: dirty ? "unknown_slug" : "none",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response("{}", {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof fetch;
  });

  it("requête single-fetch (.data) → substitution appelée avec /pieces/<slug> propre, jamais 404", async () => {
    let thrown: unknown;
    try {
      await loader({
        params: { slug: "filtre-a-huile-7.html" },
        request: new Request(
          "https://www.automecanik.com/pieces/filtre-a-huile-7.html.data",
        ),
        context: {},
      } as never);
    } catch (e) {
      thrown = e;
    }

    // Cœur du correctif : l'URL substitution ne doit PAS porter le suffixe .data.
    expect(capturedSubUrl).toBeDefined();
    const decoded = decodeURIComponent(capturedSubUrl as string);
    expect(decoded).toContain("/pieces/filtre-a-huile-7.html");
    expect(decoded).not.toContain(".data");

    // Garantie utilisateur : une page valide ne doit jamais ressortir en 404.
    if (thrown instanceof Response) {
      expect(thrown.status).not.toBe(404);
    }
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

import { loader } from "~/routes/pieces.$slug";

/**
 * INP hub gamme (audit 2026-07-14) — le payload client ne doit JAMAIS
 * sérialiser `substitution.lock`.
 *
 * La réponse de `/api/substitution/check` sert au routing 404/410 côté loader
 * uniquement (les deux branches jettent une Response nue). Son wizard `lock`
 * embarque la liste complète des options véhicule — 5 309 options ≈ 540KB
 * turbo-stream mesurés sur gamme 7, soit ~70% du script d'hydration (790KB →
 * 30KB une fois strippé) → input delay INP mobile sur toutes les pages hub.
 * Aucun consommateur client de `data.substitution.lock` sur cette route ;
 * SubstitutionSchema déclare `lock` optional.
 */
vi.mock("~/utils/logger", () => ({
  logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock("~/utils/internal-api.server", () => ({
  getInternalApiUrl: () => "http://internal-api",
}));

// apiData minimal mais Tier-1-valide (meta/content stricts dans le contrat).
vi.mock("~/services/api/gamme-api.service", () => ({
  fetchGammePageData: vi.fn(async () => ({
    hero: {
      pg_name: "Filtre à huile",
      pg_alias: "filtre-a-huile",
      h1: "Filtre à huile pas cher",
      content: "",
    },
    meta: {
      title: "Filtre à huile",
      description: "Filtre à huile neuf pour votre véhicule.",
      keywords: "filtre a huile",
      robots: "index,follow",
      canonical: "/pieces/filtre-a-huile-7.html",
    },
  })),
}));

describe("pieces.$slug loader — substitution.lock strippé du payload client", () => {
  beforeEach(() => {
    // Backend substitution "200 Always" avec un wizard lock volumineux,
    // comme sur les vraies pages hub 200.
    global.fetch = vi.fn(async (input: unknown) => {
      const url =
        typeof input === "string"
          ? input
          : ((input as Request).url ?? String(input));
      if (url.includes("/api/substitution/check")) {
        return new Response(
          JSON.stringify({
            httpStatus: 200,
            type: "none",
            robots: "index,follow",
            lock: {
              type: "vehicle",
              missing: "Marque, modèle et motorisation",
              known: { gamme: { id: 7, name: "Filtre à huile", alias: "f" } },
              options: Array.from({ length: 5309 }, (_, i) => ({
                id: i,
                label: `Option ${i}`,
                url: `/pieces/filtre-a-huile-7/m/mo/t-${i}.html`,
              })),
            },
            compatibleGammes: [],
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

  it("page 200 : substitution présente SANS lock (httpStatus conservé)", async () => {
    const result = (await loader({
      params: { slug: "filtre-a-huile-7.html" },
      request: new Request(
        "https://www.automecanik.com/pieces/filtre-a-huile-7.html",
      ),
      context: {},
    } as never)) as { data: { substitution: Record<string, unknown> | null } };

    const substitution = result.data.substitution;
    expect(substitution).toBeTruthy();
    expect(substitution).not.toHaveProperty("lock");
    // Les champs utiles au contrat restent servis.
    expect(substitution?.httpStatus).toBe(200);
  });
});

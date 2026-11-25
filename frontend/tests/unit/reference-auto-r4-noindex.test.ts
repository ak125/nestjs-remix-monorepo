/**
 * Mandat EW — `/reference-auto/{slug}` : la meta robots suit le champ `robots`
 * de GET /api/seo/reference/:slug (liste fermée et drapeau portés par le
 * backend). Sans ce champ : `index, follow` comme aujourd'hui. Canonique
 * inchangée, aucun appel de plus, aucun X-Robots-Tag sur un succès (meta seule
 * source, donc pas de contradiction meta/en-tête).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { headers, loader, meta } from "~/routes/reference-auto.$slug";

vi.mock("~/utils/logger", () => ({
  logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));
vi.mock("~/utils/internal-api.server", () => ({
  getInternalApiUrl: () => "http://internal",
}));

const SLUG = "capteur-de-pluie";

function ref(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    slug: SLUG,
    title: "Capteur de pluie",
    metaDescription: "desc",
    definition: "Définition",
    canonicalUrl: `/reference-auto/${SLUG}`,
    updatedAt: "2026-11-25T00:00:00Z",
    ...extra,
  };
}

type MetaEntry = Record<string, unknown>;
function metaOf(reference: Record<string, unknown>): MetaEntry[] {
  return (meta as unknown as (a: unknown) => MetaEntry[])({
    loaderData: { reference, relatedRefs: [] },
  });
}
const robotsOf = (m: MetaEntry[]) =>
  m.filter((e) => e.name === "robots").map((e) => e.content);
const canonicalOf = (m: MetaEntry[]) =>
  m.filter((e) => e.rel === "canonical").map((e) => e.href);

describe("reference-auto.$slug meta — R4 noindex (mandat EW)", () => {
  it("sans champ robots (drapeau éteint ou hors liste) : index, follow", () => {
    const m = metaOf(ref());
    expect(robotsOf(m)).toEqual(["index, follow"]);
  });

  it("robots = noindex, follow : une seule meta robots, noindex, follow", () => {
    const m = metaOf(ref({ robots: "noindex, follow" }));
    expect(robotsOf(m)).toEqual(["noindex, follow"]);
  });

  it("valeur inattendue : index, follow (seule la directive EW passe)", () => {
    expect(robotsOf(metaOf(ref({ robots: "noindex, nofollow" })))).toEqual([
      "index, follow",
    ]);
  });

  it("canonique identique avec et sans noindex : URL propre de la page", () => {
    const plain = canonicalOf(metaOf(ref()));
    const noindex = canonicalOf(metaOf(ref({ robots: "noindex, follow" })));
    expect(plain).toHaveLength(1);
    expect(String(plain[0])).toMatch(new RegExp(`/reference-auto/${SLUG}$`));
    expect(noindex).toEqual(plain);
  });

  it("le reste de la meta est identique avec et sans noindex", () => {
    const strip = (m: MetaEntry[]) => m.filter((e) => e.name !== "robots");
    expect(strip(metaOf(ref({ robots: "noindex, follow" })))).toEqual(
      strip(metaOf(ref())),
    );
  });
});

describe("reference-auto.$slug headers — cohérence meta / en-tête", () => {
  const call = headers as unknown as (a: unknown) => Record<string, string>;

  it("succès : aucun X-Robots-Tag (la meta porte la directive)", () => {
    const out = call({
      loaderHeaders: new Headers({ "Cache-Control": "public, max-age=300" }),
      errorHeaders: undefined,
    });
    expect(out["X-Robots-Tag"]).toBeUndefined();
  });

  it("erreur : noindex, follow comme aujourd'hui", () => {
    const out = call({
      loaderHeaders: new Headers(),
      errorHeaders: new Headers(),
    });
    expect(out["X-Robots-Tag"]).toBe("noindex, follow");
  });
});

describe("reference-auto.$slug loader — transmet robots sans appel de plus", () => {
  // Appels du loader de main (mandat ER compris) : sonde de redirection, fiche,
  // fiches liées. EW n'en ajoute aucun.
  const EXPECTED_URLS = [
    `http://internal/api/seo/reference/redirect/${SLUG}`,
    `http://internal/api/seo/reference/${SLUG}`,
    `http://internal/api/seo/reference/${SLUG}/related`,
  ];
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const okJson = (body: unknown) => ({ ok: true, json: async () => body });
  const run = () =>
    loader({
      params: { slug: SLUG },
      request: new Request(
        `https://www.automecanik.com/reference-auto/${SLUG}`,
      ),
      context: {},
    } as never);

  for (const body of [ref(), ref({ robots: "noindex, follow" })]) {
    it(`mêmes 3 fetch que main, robots=${String(body.robots)}`, async () => {
      fetchMock.mockImplementation((u: string) =>
        Promise.resolve(
          u.endsWith("/related")
            ? okJson({ related: [] })
            : u.includes("/redirect/")
              ? okJson({ redirect_to: null, pg_alias: null })
              : okJson(body),
        ),
      );
      const res = (await run()) as unknown as {
        data: { reference: Record<string, unknown> };
        init: { headers: Record<string, string> };
      };
      expect(fetchMock.mock.calls.map(([u]) => String(u)).sort()).toEqual(
        [...EXPECTED_URLS].sort(),
      );
      expect(res.data.reference.robots).toBe(body.robots);
      expect(res.init.headers["X-Robots-Tag"]).toBeUndefined();
    });
  }
});

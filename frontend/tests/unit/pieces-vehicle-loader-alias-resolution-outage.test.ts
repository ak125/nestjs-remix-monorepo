// @vitest-environment node
import { createServer, type Server } from "node:http";
import { type AddressInfo } from "node:net";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { fetchRmPageV2 } from "~/services/api/rm-api.service";
import {
  IdResolutionUnavailableError,
  resolveGammeId,
  resolveVehicleIds,
} from "~/utils/pieces-id-resolution.server";
import { parseUrlParam } from "~/utils/pieces-route.utils";
import { piecesVehicleLoader } from "~/utils/pieces-vehicle.loader.server";

vi.mock("~/utils/logger", () => ({
  logger: {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));
// Seules les frontières réseau en aval de la résolution sont simulées. Les
// résolveurs d'ID (`pieces-id-resolution.server`) et le loader sont réels.
vi.mock("~/services/api/rm-api.service", () => ({ fetchRmPageV2: vi.fn() }));
vi.mock("~/services/pieces/pieces-route.service", () => ({
  fetchBlogArticleWithRelated: vi.fn(() =>
    Promise.resolve({ article: null, relatedArticles: [] }),
  ),
  fetchSeoSwitches: vi.fn(() => Promise.resolve(null)),
}));
vi.mock("~/utils/fetch.utils", () => ({
  fetchJsonOrNull: vi.fn(() => Promise.resolve(null)),
}));

/**
 * R2 — URL sans ID : une API de résolution en panne n'est pas un alias inconnu.
 *
 * Les URL historiques sans ID (`/pieces/filtre-a-huile/renault/clio-iii/…`)
 * passent par l'API pour retrouver leurs IDs. Les résolveurs avalaient toute
 * erreur (réseau, 5xx, JSON illisible) et retombaient sur des IDs à 0 : le
 * loader répondait alors 410 `invalid_vehicle` (« définitivement supprimée »,
 * mis en cache 1 h par le CDN) pendant une simple indisponibilité du backend.
 */

const ORIGIN = "https://www.example.com";
// Marque et modèle sans ID → résolution par l'API véhicules.
const VEHICLE_ALIAS_PATH =
  "/pieces/filtre-a-huile-7/renault/clio-iii/diesel-12345.html";
// Gamme sans ID et hors table statique → résolution par l'API gammes.
const GAMME_ALIAS_PATH =
  "/pieces/bougie-de-prechauffage/renault-140/clio-iii-140004/diesel-12345.html";

type Route = (url: string) => Response | Promise<Response>;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/** Simule l'API backend : chaque fragment d'URL a sa réponse. */
function stubBackend(routes: Record<string, Route>) {
  const fetchMock = vi.fn(async (input: unknown, _init?: RequestInit) => {
    const url = String(input);
    for (const [fragment, respond] of Object.entries(routes)) {
      if (url.includes(fragment)) return respond(url);
    }
    throw new Error(`appel réseau inattendu : ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const BRANDS = "/api/vehicles/brands?";
const MODELS = "/api/vehicles/brands/140/models";
const GAMME_BY_ALIAS = "/api/catalog/gammes/by-alias/";
const ERROR_LOG = "/api/internal/error-log";

const brandsFound: Route = () =>
  json({
    success: true,
    data: [{ marque_id: 140, marque_alias: "renault", marque_name: "RENAULT" }],
  });
const modelsFound: Route = () =>
  json({
    success: true,
    data: [
      { modele_id: 140004, modele_alias: "clio-iii", modele_name: "Clio III" },
    ],
  });
const serverError: Route = () => json({ statusCode: 500 }, 500);

/** Appelle le loader réel et retourne la `Response` qu'il lève. */
async function thrownResponse(path: string): Promise<Response> {
  const [, gamme, marque, modele, type] =
    path.match(/^\/pieces\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)\.html$/) ?? [];
  const url = new URL(`${ORIGIN}${path}`);
  try {
    await piecesVehicleLoader({
      params: { gamme, marque, modele, type },
      request: new Request(url),
      url,
      context: {},
    } as never);
  } catch (thrown) {
    if (thrown instanceof Response) return thrown;
    throw thrown;
  }
  throw new Error("le loader n'a rien levé");
}

beforeEach(() => {
  vi.stubEnv("INTERNAL_API_KEY", "");
  vi.stubEnv("INTERNAL_API_BASE_URL", "");
  vi.mocked(fetchRmPageV2).mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("resolveVehicleIds — panne distincte d'un alias inconnu", () => {
  it("IDs complets dans l'URL : aucun appel réseau", async () => {
    const fetchMock = stubBackend({});
    await expect(
      resolveVehicleIds("renault-140", "clio-iii-140004", "diesel-12345"),
    ).resolves.toEqual({ marqueId: 140, modeleId: 140004, typeId: 12345 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("alias résolus par l'API", async () => {
    stubBackend({ [MODELS]: modelsFound, [BRANDS]: brandsFound });
    await expect(
      resolveVehicleIds("renault", "clio-iii", "diesel-12345"),
    ).resolves.toEqual({ marqueId: 140, modeleId: 140004, typeId: 12345 });
  });

  it.each([500, 502, 503, 504, 408, 429])(
    "API marques en HTTP %i → résolution indisponible",
    async (status) => {
      stubBackend({ [BRANDS]: () => json({}, status) });
      await expect(
        resolveVehicleIds("renault", "clio-iii", "diesel-12345"),
      ).rejects.toBeInstanceOf(IdResolutionUnavailableError);
    },
  );

  it("backend injoignable → résolution indisponible", async () => {
    stubBackend({
      [BRANDS]: () => {
        throw new TypeError("fetch failed");
      },
    });
    await expect(
      resolveVehicleIds("renault", "clio-iii", "diesel-12345"),
    ).rejects.toBeInstanceOf(IdResolutionUnavailableError);
  });

  it("API modèles en panne après une marque trouvée → résolution indisponible", async () => {
    stubBackend({ [MODELS]: serverError, [BRANDS]: brandsFound });
    await expect(
      resolveVehicleIds("renault", "clio-iii", "diesel-12345"),
    ).rejects.toBeInstanceOf(IdResolutionUnavailableError);
  });

  it("corps illisible → résolution indisponible", async () => {
    stubBackend({ [BRANDS]: () => new Response("<html>bad gateway</html>") });
    await expect(
      resolveVehicleIds("renault", "clio-iii", "diesel-12345"),
    ).rejects.toBeInstanceOf(IdResolutionUnavailableError);
  });

  it("marque inconnue de l'API → IDs de l'URL (0), comportement inchangé", async () => {
    stubBackend({ [BRANDS]: () => json({ success: true, data: [] }) });
    await expect(
      resolveVehicleIds("marque-inconnue", "clio-iii", "diesel-12345"),
    ).resolves.toEqual({ marqueId: 0, modeleId: 0, typeId: 12345 });
  });

  it("modèle inconnu de l'API → modeleId 0 (410 côté loader)", async () => {
    stubBackend({
      [MODELS]: () => json({ success: true, data: [] }),
      [BRANDS]: brandsFound,
    });
    await expect(
      resolveVehicleIds("renault", "modele-inconnu", "diesel-12345"),
    ).resolves.toEqual({ marqueId: 140, modeleId: 0, typeId: 12345 });
  });

  it("réponse 200 sans liste → résolution indisponible, pas « alias inconnu »", async () => {
    stubBackend({ [BRANDS]: () => json({ success: true }) });
    await expect(
      resolveVehicleIds("renault", "clio-iii", "diesel-12345"),
    ).rejects.toBeInstanceOf(IdResolutionUnavailableError);
  });

  it("demande refusée par l'API (400) → traitée comme alias inconnu", async () => {
    stubBackend({ [BRANDS]: () => json({ statusCode: 400 }, 400) });
    await expect(
      resolveVehicleIds("renault", "clio-iii", "diesel-12345"),
    ).resolves.toEqual({ marqueId: 0, modeleId: 0, typeId: 12345 });
  });
});

describe("resolveGammeId — panne distincte d'un alias inconnu", () => {
  it("ID dans l'URL : aucun appel réseau", async () => {
    const fetchMock = stubBackend({});
    await expect(resolveGammeId("filtre-a-huile-7")).resolves.toBe(7);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("alias résolu par l'API", async () => {
    stubBackend({
      [GAMME_BY_ALIAS]: () => json({ success: true, data: { id: 243 } }),
    });
    await expect(resolveGammeId("bougie-de-prechauffage")).resolves.toBe(243);
  });

  it("alias inconnu de l'API → 0, comportement inchangé", async () => {
    stubBackend({
      [GAMME_BY_ALIAS]: () => json({ success: false, data: null }),
    });
    await expect(resolveGammeId("gamme-inconnue")).resolves.toBe(0);
  });

  it("API gammes en panne → résolution indisponible", async () => {
    stubBackend({ [GAMME_BY_ALIAS]: serverError });
    await expect(
      resolveGammeId("bougie-de-prechauffage"),
    ).rejects.toBeInstanceOf(IdResolutionUnavailableError);
  });

  it("backend injoignable → résolution indisponible", async () => {
    stubBackend({
      [GAMME_BY_ALIAS]: () => {
        throw new TypeError("fetch failed");
      },
    });
    await expect(
      resolveGammeId("bougie-de-prechauffage"),
    ).rejects.toBeInstanceOf(IdResolutionUnavailableError);
  });
});

describe("loader R2 — URL sans ID pendant une panne de résolution", () => {
  it("API véhicules en panne : 503 non mis en cache, jamais 410", async () => {
    stubBackend({ [BRANDS]: serverError });

    const res = await thrownResponse(VEHICLE_ALIAS_PATH);

    expect(res.status).toBe(503);
    expect(res.headers.get("Retry-After")).toBe("300");
    expect(res.headers.get("Cache-Control")).toBe("no-store, must-revalidate");
    expect(res.headers.get("X-Robots-Tag")).toBeNull();
    expect(fetchRmPageV2).not.toHaveBeenCalled();
  });

  it("API gammes en panne : 503, le catalogue n'est pas interrogé avec une gamme 0", async () => {
    stubBackend({ [GAMME_BY_ALIAS]: serverError });

    const res = await thrownResponse(GAMME_ALIAS_PATH);

    expect(res.status).toBe(503);
    expect(res.headers.get("Cache-Control")).toBe("no-store, must-revalidate");
    expect(fetchRmPageV2).not.toHaveBeenCalled();
  });

  it("la panne est signalée au journal d'erreurs du backend", async () => {
    vi.stubEnv("INTERNAL_API_KEY", "test-key");
    const fetchMock = stubBackend({
      [ERROR_LOG]: () => json({ ok: true }),
      [BRANDS]: serverError,
    });

    const res = await thrownResponse(VEHICLE_ALIAS_PATH);

    expect(res.status).toBe(503);
    const report = fetchMock.mock.calls.find(([input]) =>
      String(input).includes(ERROR_LOG),
    );
    expect(report).toBeDefined();
    expect(JSON.parse(String(report?.[1]?.body))).toMatchObject({
      status: 503,
      url: VEHICLE_ALIAS_PATH,
      subject: "LOADER_503_ID_RESOLUTION_UNAVAILABLE",
      metadata: { target: "vehicle" },
    });
  });

  it("marque réellement inconnue : 410 invalid_vehicle inchangé", async () => {
    stubBackend({ [BRANDS]: () => json({ success: true, data: [] }) });

    const res = await thrownResponse(
      "/pieces/filtre-a-huile-7/marque-inconnue/clio-iii/diesel-12345.html",
    );

    expect(res.status).toBe(410);
    expect(await res.json()).toMatchObject({ reason: "invalid_vehicle" });
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex, follow");
  });
});

/**
 * R2 — un ID n'est jamais fabriqué, et un alias existant est toujours retrouvé.
 *
 * Constats du 2026-11-13 sur le runtime DEV :
 *   - `…/clio-iii-140004/1-5-dci.html` (type sans ID) était servi en 200
 *     « non référencé » pour la motorisation 5, lue dans « 1-5-dci » ;
 *   - `…/renault/twingo-ii/1-2-23485.html` répondait 410 alors que la page
 *     existe : seule la première page de 50 modèles de la marque était lue ;
 *   - `alfa-romeo`, `land-rover` n'étaient jamais retrouvées (recherche sur le
 *     nom « ALFA ROMEO », pas sur l'alias).
 */
describe("parseUrlParam — l'ID est le dernier élément, entièrement numérique", () => {
  it.each([
    ["renault-140", "renault", 140],
    ["clio-iii-140004", "clio-iii", 140004],
    ["1-5-dci-12345", "1-5-dci", 12345],
    ["206", "", 206],
    // Ambiguïté irréductible sans la base (alias « serie-3 » ou ID 3) : inchangé.
    ["serie-3", "serie", 3],
  ])("%s → alias « %s », id %i", (segment, alias, id) => {
    expect(parseUrlParam(segment)).toEqual({ alias, id });
  });

  it.each([
    "1-5-dci",
    "1-2-16v",
    "1-5-dci-110cv",
    "206-sw",
    "320d",
    "essence",
    "renault-0",
    "type-99999999999999999999",
  ])("%s ne porte pas d'ID : alias intact, id 0", (segment) => {
    expect(parseUrlParam(segment)).toEqual({ alias: segment, id: 0 });
  });

  it("segment absent → id 0", () => {
    expect(parseUrlParam(undefined).id).toBe(0);
  });
});

describe("resolveVehicleIds — résolution exacte et complète", () => {
  const PAGE_SIZE = 200;
  const fullPage = Array.from({ length: PAGE_SIZE }, (_, i) => ({
    modele_id: 1000 + i,
    modele_alias: `modele-${i}`,
    modele_name: `MODELE ${i}`,
  }));

  it("type sans ID : typeId 0, aucun appel réseau", async () => {
    const fetchMock = stubBackend({});
    await expect(
      resolveVehicleIds("renault", "clio-iii", "1-5-dci"),
    ).resolves.toEqual({ marqueId: 0, modeleId: 0, typeId: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("modèle au-delà de la première page de l'API : retrouvé", async () => {
    const fetchMock = stubBackend({
      [MODELS]: (url) =>
        url.includes("page=0")
          ? json({ success: true, data: fullPage, total: PAGE_SIZE + 1 })
          : json({
              success: true,
              data: [
                {
                  modele_id: 140098,
                  modele_alias: "twingo-ii",
                  modele_name: "TWINGO II",
                },
              ],
              total: PAGE_SIZE + 1,
            }),
    });
    await expect(
      resolveVehicleIds("renault-140", "twingo-ii", "1-2-23485"),
    ).resolves.toEqual({ marqueId: 140, modeleId: 140098, typeId: 23485 });
    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([
      `http://127.0.0.1:3000${MODELS}?limit=${PAGE_SIZE}&page=0`,
      `http://127.0.0.1:3000${MODELS}?limit=${PAGE_SIZE}&page=1`,
    ]);
  });

  it("marque à nom composé : retrouvée par son alias", async () => {
    stubBackend({
      "/api/vehicles/brands/13/models": () =>
        json({
          success: true,
          data: [
            { modele_id: 13044, modele_alias: "giulietta", modele_name: "X" },
          ],
        }),
      [BRANDS]: () =>
        json({
          success: true,
          data: [
            {
              marque_id: 13,
              marque_alias: "alfa-romeo",
              marque_name: "ALFA ROMEO",
            },
            { marque_id: 140, marque_alias: "renault", marque_name: "RENAULT" },
          ],
        }),
    });
    await expect(
      resolveVehicleIds("alfa-romeo", "giulietta", "1-4-tb-33333"),
    ).resolves.toEqual({ marqueId: 13, modeleId: 13044, typeId: 33333 });
  });

  it("alias exact préféré à un nom qui contient l'alias", async () => {
    stubBackend({
      [MODELS]: () =>
        json({
          success: true,
          data: [
            { modele_id: 1, modele_alias: "clio-i", modele_name: "CLIO I" },
            { modele_id: 2, modele_alias: "clio", modele_name: "CLIO" },
          ],
        }),
    });
    await expect(
      resolveVehicleIds("renault-140", "clio", "diesel-12345"),
    ).resolves.toEqual({ marqueId: 140, modeleId: 2, typeId: 12345 });
  });

  it("alias de modèle commençant par un nombre (206-sw) : résolu en entier", async () => {
    const fetchMock = stubBackend({
      "/api/vehicles/brands/128/models": () =>
        json({
          success: true,
          data: [
            { modele_id: 128001, modele_alias: "206", modele_name: "206" },
            {
              modele_id: 128020,
              modele_alias: "206-sw",
              modele_name: "206 SW",
            },
          ],
        }),
    });
    await expect(
      resolveVehicleIds("peugeot-128", "206-sw", "1-4-hdi-9999"),
    ).resolves.toEqual({ marqueId: 128, modeleId: 128020, typeId: 9999 });
    // La marque porte son ID : elle n'est pas redemandée à l'API.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("API qui ne cesse de renvoyer des pages pleines → résolution indisponible", async () => {
    stubBackend({
      [MODELS]: () => json({ success: true, data: fullPage }),
    });
    await expect(
      resolveVehicleIds("renault-140", "twingo-ii", "1-2-23485"),
    ).rejects.toBeInstanceOf(IdResolutionUnavailableError);
  });
});

describe("résolution — délai maximal contre un vrai serveur muet", () => {
  let server: Server;

  beforeEach(async () => {
    // Accepte la connexion et ne répond jamais.
    server = createServer(() => {});
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const { port } = server.address() as AddressInfo;
    vi.stubEnv("INTERNAL_API_BASE_URL", `http://127.0.0.1:${port}`);
  });

  afterEach(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });

  it("backend qui ne répond pas : indisponible après 3 s, pas d'attente sans fin", async () => {
    const startedAt = Date.now();
    await expect(
      resolveGammeId("bougie-de-prechauffage"),
    ).rejects.toBeInstanceOf(IdResolutionUnavailableError);
    const elapsed = Date.now() - startedAt;
    expect(elapsed).toBeGreaterThanOrEqual(2900);
    expect(elapsed).toBeLessThan(6000);
  }, 10_000);

  it("loader : 503 non mis en cache quand la résolution dépasse le délai", async () => {
    const res = await thrownResponse(VEHICLE_ALIAS_PATH);
    expect(res.status).toBe(503);
    expect(res.headers.get("Retry-After")).toBe("300");
    expect(res.headers.get("Cache-Control")).toBe("no-store, must-revalidate");
    expect(fetchRmPageV2).not.toHaveBeenCalled();
  }, 10_000);
});

describe("loader R2 — URL dont le type ne porte pas d'ID", () => {
  it.each([
    "/pieces/filtre-a-huile-7/renault-140/clio-iii-140004/1-5-dci.html",
    "/pieces/filtre-a-huile-7/renault-140/clio-iii-140004/1-2-16v.html",
    "/pieces/filtre-a-huile-7/renault-140/clio-iii/1-5-dci-110cv.html",
    "/pieces/filtre-a-huile-7/peugeot/206-sw/1-4-hdi.html",
    "/pieces/filtre-a-huile-7/renault-140/clio-iii-140004/essence.html",
  ])("%s → 410 invalid_vehicle, aucune motorisation inventée", async (path) => {
    const fetchMock = stubBackend({});

    const res = await thrownResponse(path);

    expect(res.status).toBe(410);
    expect(await res.json()).toMatchObject({ reason: "invalid_vehicle" });
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex, follow");
    // Ni catalogue interrogé avec un type fabriqué, ni beacon soft-404.
    expect(fetchRmPageV2).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { fetchRmPageV2 } from "~/services/api/rm-api.service";
import {
  IdResolutionUnavailableError,
  resolveGammeId,
  resolveVehicleIds,
} from "~/utils/pieces-route.utils";
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
// résolveurs d'ID (`pieces-route.utils`) et le loader sont réels.
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

const BRANDS = "/api/vehicles/brands?search=";
const MODELS = "/api/vehicles/brands/140/models";
const GAMME_BY_ALIAS = "/api/catalog/gammes/by-alias/";
const ERROR_LOG = "/api/internal/error-log";

const brandsFound: Route = () =>
  json({ success: true, data: [{ marque_id: 140, marque_name: "Renault" }] });
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
  vi.stubEnv("BACKEND_URL", "");
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

  it("modèle inconnu de l'API → IDs de l'URL (0), comportement inchangé", async () => {
    stubBackend({
      [MODELS]: () => json({ success: true, data: [] }),
      [BRANDS]: brandsFound,
    });
    await expect(
      resolveVehicleIds("renault", "modele-inconnu", "diesel-12345"),
    ).resolves.toEqual({ marqueId: 0, modeleId: 0, typeId: 12345 });
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

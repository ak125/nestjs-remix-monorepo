// @vitest-environment node
import {
  createRequestHandler,
  UNSAFE_decodeViaTurboStream as decodeViaTurboStream,
  UNSAFE_SingleFetchRedirectSymbol as SingleFetchRedirectSymbol,
  type ServerBuild,
} from "react-router";
import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterEach,
} from "vitest";

import { fetchRmPageV2 } from "~/services/api/rm-api.service";
import { buildCacheHeaders } from "~/utils/cache-control";
import { resolveGammeId, resolveVehicleIds } from "~/utils/pieces-route.utils";
import { piecesVehicleLoader } from "~/utils/pieces-vehicle.loader.server";
import { mapRmV2ToLoaderData } from "~/utils/rm-mapper";
import routeConfig from "../../app/routes";

vi.mock("~/utils/logger", () => ({
  logger: {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));
// Frontières I/O du loader R2 : seules les dépendances réseau sont simulées. Le
// calcul du chemin canonique (url-builder + @repo/seo-url-contract) reste réel.
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
vi.mock("~/utils/pieces-loader.utils", () => ({
  buildCataloguePromise: vi.fn(() => Promise.resolve(null)),
}));
vi.mock("~/utils/seo/catalog-gammes.server", () => ({
  loadCatalogGammeIds: vi.fn(() => Promise.resolve(null)),
}));
vi.mock("~/utils/rm-mapper", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  mapRmV2ToLoaderData: vi.fn(),
}));
vi.mock("~/utils/pieces-route.utils", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  resolveVehicleIds: vi.fn(),
  resolveGammeId: vi.fn(),
}));

/**
 * Boucle de redirection canonique R2 en navigation client (single-fetch RR8).
 *
 * En navigation client, React Router requête `<chemin>.data` (souvent avec
 * `_routes`) et transmet ce `request.url` brut au loader. Comparer ce pathname
 * au chemin canonique échouait toujours : chaque navigation R2 recevait un 301
 * vers `?r=1` (aller-retour réseau, entrée d'historique en plus, scroll perdu).
 *
 * Les requêtes passent par le vrai `createRequestHandler` de React Router, avec
 * l'entrée de route issue de la configuration réelle (`app/routes.ts`) : le
 * loader reçoit `request` et `url` exactement comme en production, et un redirect
 * en single-fetch est encodé comme le client le reçoit (202 +
 * `SingleFetchRedirect`).
 */

const ORIGIN = "https://www.example.com";
const R2_FILE = "routes/pieces.$gamme.$marque.$modele.$type[.]html.tsx";

const VEHICLE = {
  marque: "Renault",
  marqueAlias: "renault",
  marqueId: 140,
  modele: "Clio III",
  modeleAlias: "clio-iii",
  modeleId: 140004,
  type: "1.5 dCi",
  typeName: "1.5 dCi",
  typeAlias: "1-5-dci",
  typeId: 12345,
  typePowerPs: 86,
  typeFuel: "Diesel",
};
const GAMME = {
  id: 7,
  name: "Filtre à huile",
  alias: "filtre-a-huile",
  description: "",
};

const CANONICAL_PATH =
  "/pieces/filtre-a-huile-7/renault-140/clio-iii-140004/1-5-dci-12345.html";
// Même véhicule, alias de motorisation périmé → non canonique.
const STALE_PATH =
  "/pieces/filtre-a-huile-7/renault-140/clio-iii-140004/ancien-alias-12345.html";
// Chemin canonique dont des caractères non réservés sont percent-encodés : la
// comparaison se fait après décodage, il reste canonique.
const ENCODED_CANONICAL_PATH = CANONICAL_PATH.replace(
  "filtre-a-huile",
  "filtre%2Da%2Dhuile",
);

type RouteEntry = {
  id?: string;
  path?: string;
  file: string;
  children?: RouteEntry[];
};

function findRouteEntry(entries: RouteEntry[], file: string): RouteEntry {
  for (const entry of entries) {
    if (entry.file === file) return entry;
    if (entry.children) {
      const found = findRouteEntry(entry.children, file);
      if (found.file === file) return found;
    }
  }
  return { file: "" };
}

let handleRequest: ReturnType<typeof createRequestHandler>;
let r2RouteId: string;

beforeAll(async () => {
  const entry = findRouteEntry(
    (await routeConfig) as unknown as RouteEntry[],
    R2_FILE,
  );
  expect(entry.path).toBeTruthy();
  r2RouteId = entry.id ?? "";
  const routeFlags = {
    hasAction: false,
    hasClientAction: false,
    hasClientLoader: false,
    hasClientMiddleware: false,
    hasErrorBoundary: true,
  };
  const build = {
    entry: {
      module: {
        default: (_request: Request, status: number, headers: Headers) =>
          new Response("<!doctype html>", { status, headers }),
      },
    },
    routes: {
      root: { id: "root", path: "", module: { default: () => null } },
      [r2RouteId]: {
        id: r2RouteId,
        parentId: "root",
        path: entry.path,
        module: {
          loader: piecesVehicleLoader,
          default: () => null,
          ErrorBoundary: () => null,
          headers: buildCacheHeaders(
            "public, max-age=60, s-maxage=86400, stale-while-revalidate=3600",
          ),
        },
      },
    },
    assets: {
      entry: { module: "/entry.client.js", imports: [] },
      routes: {
        root: {
          id: "root",
          path: "",
          module: "/root.js",
          hasLoader: false,
          ...routeFlags,
        },
        [r2RouteId]: {
          id: r2RouteId,
          parentId: "root",
          path: entry.path,
          module: "/r2.js",
          hasLoader: true,
          ...routeFlags,
        },
      },
      url: "/manifest.js",
      version: "test",
    },
    publicPath: "/",
    assetsBuildDirectory: "build/client",
    future: {},
    ssr: true,
    isSpaMode: false,
    prerender: [],
    routeDiscovery: { mode: "initial", manifestPath: "/__manifest" },
  } as unknown as ServerBuild;
  handleRequest = createRequestHandler(build, "test");
});

beforeEach(() => {
  vi.stubEnv("INTERNAL_API_KEY", "");
  vi.stubEnv("SEO_R2_SELLABLE_NOINDEX_ENABLED", "false");
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            success: true,
            alternativeGammes: [],
            alternativeVehicles: [],
            relatedModels: [],
          }),
        ),
    ),
  );
  vi.mocked(resolveVehicleIds).mockResolvedValue({
    marqueId: VEHICLE.marqueId,
    modeleId: VEHICLE.modeleId,
    typeId: VEHICLE.typeId,
  } as never);
  vi.mocked(resolveGammeId).mockResolvedValue(GAMME.id);
  vi.mocked(fetchRmPageV2).mockResolvedValue({
    success: true,
    count: 1,
    duration_ms: 1,
    cacheHit: true,
    vehicleInfo: {},
    gamme: { pg_name: GAMME.name },
    products: [{ piece_id: 1, price_ttc: 10, stock_status: "IN_STOCK" }],
    grouped_pieces: [],
    filters: null,
    validation: { valid: true, dataQuality: { quality: 100 } },
    seo: { title: "t", h1: "h", description: "d" },
  } as never);
  vi.mocked(mapRmV2ToLoaderData).mockReturnValue({
    vehicle: VEHICLE,
    gamme: GAMME,
    pieces: [],
    minPrice: 0,
    maxPrice: 0,
    seoContent: { h1: "h", longDescription: "d" },
    faqItems: [],
    buyingGuide: { title: "Guide", content: "", tips: [], warnings: [] },
    compatibilityInfo: null,
    crossSellingGammes: [],
    oemRefs: null,
    oemRefsSeo: null,
  } as never);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const get = (pathAndQuery: string) =>
  handleRequest(new Request(`${ORIGIN}${pathAndQuery}`));

type SingleFetchPayload = Record<string | symbol, unknown>;

async function decodeSingleFetch(res: Response): Promise<SingleFetchPayload> {
  const decoded = await decodeViaTurboStream(
    res.body as ReadableStream<Uint8Array>,
    globalThis as never,
  );
  return decoded.value as SingleFetchPayload;
}

function singleFetchRedirect(payload: SingleFetchPayload) {
  return payload[SingleFetchRedirectSymbol] as
    | { redirect: string; status: number }
    | undefined;
}

describe("R2 — requêtes document : comportement inchangé", () => {
  it("chemin canonique → pas de redirection", async () => {
    const res = await get(CANONICAL_PATH);
    expect(res.status).toBe(200);
    expect(res.headers.get("Location")).toBeNull();
  });

  it("chemin non canonique → 301 vers le canonique sans paramètre r", async () => {
    const res = await get(STALE_PATH);
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe(`${ORIGIN}${CANONICAL_PATH}`);
  });

  it("non canonique avec query : paramètres et sérialisation conservés", async () => {
    const res = await get(`${STALE_PATH}?utm_source=a%20b&gclid=g`);
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe(
      `${ORIGIN}${CANONICAL_PATH}?utm_source=a+b&gclid=g`,
    );
  });

  it("chemin canonique percent-encodé → pas de redirection", async () => {
    const res = await get(ENCODED_CANONICAL_PATH);
    expect(res.status).toBe(200);
    expect(res.headers.get("Location")).toBeNull();
  });

  it("slash final → 301 vers le canonique sans slash", async () => {
    const res = await get(`${CANONICAL_PATH}/`);
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe(`${ORIGIN}${CANONICAL_PATH}`);
  });

  it.each(["?r=1", "?r=0", "?r=1&r=1"])(
    "ancien paramètre %s : nettoyé même avec un alias périmé",
    async (query) => {
      const res = await get(`${STALE_PATH}${query}`);
      expect(res.status).toBe(301);
      expect(res.headers.get("Location")).toBe(`${ORIGIN}${CANONICAL_PATH}`);
      const next = await get(new URL(res.headers.get("Location")!).pathname);
      expect(next.status).toBe(200);
      expect(next.headers.get("Location")).toBeNull();
    },
  );

  it("URL canonique avec r : nettoyée sans perdre les filtres", async () => {
    const res = await get(`${CANONICAL_PATH}?r=1&brand=bosch`);
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe(
      `${ORIGIN}${CANONICAL_PATH}?brand=bosch`,
    );
  });
});

describe("R2 — navigation client (single-fetch `.data`)", () => {
  it("chemin canonique → données servies, sans redirection", async () => {
    const res = await get(`${CANONICAL_PATH}.data`);
    expect(res.status).toBe(200);
    const payload = await decodeSingleFetch(res);
    expect(singleFetchRedirect(payload)).toBeUndefined();
    expect(
      (payload[r2RouteId] as { data: { canonicalPath: string } }).data
        .canonicalPath,
    ).toBe(CANONICAL_PATH);
  });

  it("chemin canonique avec `_routes` → données servies, sans redirection", async () => {
    const res = await get(
      `${CANONICAL_PATH}.data?_routes=${encodeURIComponent(r2RouteId)}`,
    );
    expect(res.status).toBe(200);
    expect(singleFetchRedirect(await decodeSingleFetch(res))).toBeUndefined();
  });

  it("chemin canonique percent-encodé → données servies, sans redirection", async () => {
    const res = await get(`${ENCODED_CANONICAL_PATH}.data`);
    expect(res.status).toBe(200);
    expect(singleFetchRedirect(await decodeSingleFetch(res))).toBeUndefined();
  });

  it("chemin non canonique → une redirection vers le chemin document canonique", async () => {
    const res = await get(
      `${STALE_PATH}.data?gclid=g&_routes=${encodeURIComponent(r2RouteId)}`,
    );
    expect(res.status).toBe(202);
    expect(singleFetchRedirect(await decodeSingleFetch(res))).toEqual(
      expect.objectContaining({
        redirect: `${ORIGIN}${CANONICAL_PATH}?gclid=g`,
        status: 301,
      }),
    );
  });

  it("ancien paramètre r en navigation client : une seule redirection nettoyée", async () => {
    const res = await get(`${STALE_PATH}.data?r=1`);
    expect(res.status).toBe(202);
    expect(singleFetchRedirect(await decodeSingleFetch(res))).toEqual(
      expect.objectContaining({
        redirect: `${ORIGIN}${CANONICAL_PATH}`,
        status: 301,
      }),
    );
    const next = await get(`${CANONICAL_PATH}.data`);
    expect(next.status).toBe(200);
    expect(singleFetchRedirect(await decodeSingleFetch(next))).toBeUndefined();
  });
});

describe("R2 — cible bâtie sur l'URL normalisée par React Router (argument `url`)", () => {
  // `url` exclut les détails d'implémentation du framework (suffixe `.data`,
  // paramètres réservés `_routes` / `index`) : une URL visible donnée reçoit la
  // même cible, qu'elle arrive en document ou en navigation client.
  it("paramètre réservé `_routes` → même cible en document et en single-fetch", async () => {
    const reserved = `_routes=${encodeURIComponent(r2RouteId)}`;
    const documentRes = await get(`${STALE_PATH}?gclid=g&${reserved}`);
    const dataRes = await get(`${STALE_PATH}.data?gclid=g&${reserved}`);

    expect(documentRes.status).toBe(301);
    expect(documentRes.headers.get("Location")).toBe(
      `${ORIGIN}${CANONICAL_PATH}?gclid=g`,
    );
    expect(
      singleFetchRedirect(await decodeSingleFetch(dataRes))?.redirect,
    ).toBe(documentRes.headers.get("Location"));
  });
});

describe("R2 — panne catalogue distincte d'un catalogue vide", () => {
  const empty = {
    success: true,
    count: 0,
    products: [],
    validation: { valid: false },
    vehicleInfo: {},
    gamme: {},
  };
  const malformedPayloads = [
    null,
    { ...empty, success: false },
    { ...empty, count: -1 },
    { ...empty, count: 1 },
    { ...empty, count: "0" },
    { ...empty, products: null },
    { ...empty, products: [{ piece_id: 1 }] },
    {
      ...empty,
      count: 1,
      products: [{ piece_id: 1 }],
      validation: { valid: false },
    },
  ];
  it.each(malformedPayloads)(
    "payload incohérent %# : 503 sans demande de désindexation",
    async (value) => {
      vi.mocked(fetchRmPageV2).mockResolvedValue(value as never);
      const res = await get(CANONICAL_PATH);
      expect(res.status).toBe(503);
      expect(res.headers.get("Cache-Control")).toContain("no-store");
      expect(res.headers.get("Retry-After")).toBe("300");
      expect(res.headers.get("X-Robots-Tag")).toBeNull();
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it("panne réseau : 503 observable, aucune page alternatives", async () => {
    vi.mocked(fetchRmPageV2).mockRejectedValue(new Error("catalogue offline"));
    const res = await get(CANONICAL_PATH);
    expect(res.status).toBe(503);
    expect(res.headers.get("Cache-Control")).toContain("no-store");
    expect(res.headers.get("X-Robots-Tag")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("vrai catalogue vide : conserve les alternatives et noindex, follow", async () => {
    vi.mocked(fetchRmPageV2).mockResolvedValue(empty as never);
    const res = await get(CANONICAL_PATH);
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex, follow");
    expect(fetch).toHaveBeenCalled();
  });

  it("vrai catalogue vide avec r : nettoie le paramètre avant de servir les alternatives", async () => {
    vi.mocked(fetchRmPageV2).mockResolvedValue(empty as never);
    const res = await get(`${CANONICAL_PATH}?r=1&brand=bosch`);
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe(
      `${ORIGIN}${CANONICAL_PATH}?brand=bosch`,
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("échec du mapper : 503 sans demande de désindexation ni cache durable", async () => {
    vi.mocked(mapRmV2ToLoaderData).mockImplementationOnce(() => {
      throw new Error("mapping failure");
    });
    const res = await get(CANONICAL_PATH);
    expect(res.status).toBe(503);
    expect(res.headers.get("Cache-Control")).toContain("no-store");
    expect(res.headers.get("X-Robots-Tag")).toBeNull();
  });
});

describe("R2 — le contenu servi respecte les données éditoriales disponibles", () => {
  it("ne remplit pas une source vide avec des FAQ commerciales ou un guide générique", async () => {
    const res = await get(`${CANONICAL_PATH}.data`);
    const payload = await decodeSingleFetch(res);
    const page = (
      payload[r2RouteId] as {
        data: {
          faqItems: unknown[];
          buyingGuide: { content: string; tips: string[] };
          seo: { title: string; h1: string };
          canonicalPath: string;
        };
      }
    ).data;
    expect(page.faqItems).toEqual([]);
    expect(page.buyingGuide.content).toBe("");
    expect(page.buyingGuide.tips).toEqual([]);
    expect(page.seo.title).toBe("t");
    expect(page.seo.h1).toBe("h");
    expect(page.canonicalPath).toBe(CANONICAL_PATH);
  });
});

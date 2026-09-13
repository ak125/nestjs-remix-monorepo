// @vitest-environment node
import {
  createRequestHandler,
  UNSAFE_decodeViaTurboStream as decodeViaTurboStream,
  UNSAFE_SingleFetchRedirectSymbol as SingleFetchRedirectSymbol,
  type ServerBuild,
} from "react-router";
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

import { loader } from "~/routes/$";
import routeConfig from "../../app/routes";

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
 * Les requêtes passent par le vrai `createRequestHandler` de React Router, avec
 * l'entrée de route issue de `app/routes.ts` : le loader reçoit `request` et
 * `url` exactement comme en production, y compris pour la forme `<path>/_.data`
 * qu'emploie le client pour un chemin à slash final. Document et single-fetch
 * doivent produire la MÊME cible de 301.
 */

const ORIGIN = "https://www.automecanik.com";
const CATCH_ALL_FILE = "routes/$.tsx";

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

beforeAll(async () => {
  const entry = findRouteEntry(
    (await routeConfig) as unknown as RouteEntry[],
    CATCH_ALL_FILE,
  );
  expect(entry.path).toBeTruthy();
  const routeId = entry.id ?? "";
  const routeFlags = {
    hasAction: false,
    hasClientAction: false,
    hasClientLoader: false,
    hasClientMiddleware: false,
    hasErrorBoundary: false,
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
      [routeId]: {
        id: routeId,
        parentId: "root",
        path: entry.path,
        module: { loader, default: () => null },
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
        [routeId]: {
          id: routeId,
          parentId: "root",
          path: entry.path,
          module: "/catch-all.js",
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
  // resolveKnownPattern court-circuite AVANT tout fetch ; stub par sécurité.
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ found: false }))),
    ),
  );
});

const get = (path: string) => handleRequest(new Request(`${ORIGIN}${path}`));

async function singleFetchRedirectTarget(res: Response) {
  expect(res.status).toBe(202);
  const decoded = await decodeViaTurboStream(
    res.body as ReadableStream<Uint8Array>,
    globalThis as never,
  );
  const payload = decoded.value as Record<symbol, unknown>;
  return payload[SingleFetchRedirectSymbol] as {
    redirect: string;
    status: number;
  };
}

describe("catch-all $.tsx — quick-redirect survit au suffixe single-fetch .data", () => {
  it("document /blog → 301 vers /blog-pieces-auto", async () => {
    const res = await get("/blog");
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe("/blog-pieces-auto");
  });

  it("single-fetch /blog.data → 301 vers /blog-pieces-auto (identique au document)", async () => {
    expect(await singleFetchRedirectTarget(await get("/blog.data"))).toEqual(
      expect.objectContaining({ redirect: "/blog-pieces-auto", status: 301 }),
    );
  });

  // RR8 requête un chemin à slash final à `<path>/_.data` : sans normalisation de
  // cette forme, la cible du 301 héritait d'un segment `_` parasite.
  it("document à slash final → 301 guide-achat, slash final conservé", async () => {
    const res = await get("/blog-pieces-auto/guide/freinage/");
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe(
      "/blog-pieces-auto/guide-achat/freinage/",
    );
  });

  it("single-fetch slash final `/_.data` → même 301 que le document", async () => {
    expect(
      await singleFetchRedirectTarget(
        await get("/blog-pieces-auto/guide/freinage/_.data"),
      ),
    ).toEqual(
      expect.objectContaining({
        redirect: "/blog-pieces-auto/guide-achat/freinage/",
        status: 301,
      }),
    );
  });
});

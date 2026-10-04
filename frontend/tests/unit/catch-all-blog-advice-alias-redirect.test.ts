import { describe, it, expect, vi, beforeEach } from "vitest";

import { headers, loader } from "~/routes/$";

vi.mock("~/utils/logger", () => ({
  logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

/**
 * Anciennes adresses d'un conseil : /blog-pieces-auto/{ba_alias} (ex-liens
 * précédent/suivant, GSC 404 du 2026-10-03). Le ba_alias n'a pas de forme
 * fixe (comment-*, changer-*, symptomes-*…) : l'article lui-même
 * (/api/blog/article/{slug}) décide de la cible, en un seul saut.
 */

type Article = {
  type: string;
  slug: string;
  pg_alias?: string | null;
  legacy_table?: string;
};

const ARTICLES: Record<string, Article> = {
  "comment-changer-un-demarreur": {
    type: "advice",
    slug: "comment-changer-un-demarreur",
    pg_alias: "demarreur",
    legacy_table: "__blog_advice",
  },
  "changer-votre-filtre-boite-auto": {
    type: "advice",
    slug: "changer-votre-filtre-boite-auto",
    pg_alias: "filtre-de-boite-auto",
    legacy_table: "__blog_advice",
  },
  "comment-changer-un-leve-vitre": {
    type: "advice",
    slug: "comment-changer-un-leve-vitre",
    pg_alias: null,
    legacy_table: "__blog_advice",
  },
  "guide-achat-disque": {
    type: "guide",
    slug: "guide-achat-disque",
    legacy_table: "__blog_guide",
  },
};

const ARTICLE_API = /\/api\/blog\/article\/([^/?]+)$/;

/** API simulée : articles ci-dessus, aucune règle de redirection en table. */
function apiResponding(articleStatus?: number) {
  return vi.fn((input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input);
    const match = ARTICLE_API.exec(url);
    if (!match) {
      return Promise.resolve(new Response(JSON.stringify({ found: false })));
    }
    if (articleStatus) {
      return Promise.resolve(new Response("{}", { status: articleStatus }));
    }
    const article = ARTICLES[decodeURIComponent(match[1])];
    return Promise.resolve(
      article
        ? new Response(JSON.stringify({ success: true, data: article }))
        : new Response(JSON.stringify({ message: "non trouvé" }), {
            status: 404,
          }),
    );
  });
}

const call = (path: string) =>
  loader({
    request: new Request(`https://www.automecanik.com${path}`),
    params: {},
    context: {},
  } as never);

async function thrownBy(path: string): Promise<unknown> {
  try {
    await call(path);
  } catch (e) {
    return e;
  }
  throw new Error("le loader n'a rien levé");
}

type Args = Parameters<typeof headers>[0];
const headersFor = (res: Response) =>
  headers({
    loaderHeaders: new Headers(),
    parentHeaders: new Headers(),
    actionHeaders: new Headers(),
    errorHeaders: res.headers,
  } as unknown as Args) as Record<string, string>;

describe("catch-all $.tsx — /blog-pieces-auto/{ba_alias} → adresse canonique du conseil", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", apiResponding());
  });

  it.each([
    ["comment-changer-un-demarreur", "/blog-pieces-auto/conseils/demarreur"],
    [
      "changer-votre-filtre-boite-auto",
      "/blog-pieces-auto/conseils/filtre-de-boite-auto",
    ],
    [
      "comment-changer-un-leve-vitre",
      "/blog-pieces-auto/article/comment-changer-un-leve-vitre",
    ],
  ])("/blog-pieces-auto/%s → 301 %s", async (slug, location) => {
    const res = (await thrownBy(`/blog-pieces-auto/${slug}`)) as Response;
    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe(location);
    expect(res.headers.get("X-Redirect-Reason")).toBe(
      "legacy-blog-advice-alias",
    );
  });

  it("slash final toléré", async () => {
    const res = (await thrownBy(
      "/blog-pieces-auto/changer-votre-filtre-boite-auto/",
    )) as Response;
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe(
      "/blog-pieces-auto/conseils/filtre-de-boite-auto",
    );
  });

  it.each([
    ["alias inconnu", "/blog-pieces-auto/comment-changer-un-thermostat"],
    ["un guide n'est pas un conseil", "/blog-pieces-auto/guide-achat-disque"],
    ["segment encodé", "/blog-pieces-auto/comment%2Fchanger"],
  ])("%s → 404 noindex, aucune redirection", async (_cas, path) => {
    const thrown = (await thrownBy(path)) as {
      init?: { status?: number; headers?: Record<string, string> };
    };
    expect(thrown).not.toBeInstanceOf(Response);
    expect(thrown.init?.status).toBe(404);
    expect(thrown.init?.headers?.["X-Robots-Tag"]).toBe("noindex, follow");
  });

  it("segment encodé : l'API article n'est pas interrogée", async () => {
    const fetchMock = apiResponding();
    vi.stubGlobal("fetch", fetchMock);
    await thrownBy("/blog-pieces-auto/comment%2Fchanger");
    const urls = fetchMock.mock.calls.map(([input]) => String(input));
    expect(urls.some((u) => ARTICLE_API.test(u))).toBe(false);
  });

  it("chemin à 2 segments : hors périmètre (aucun appel à l'API article)", async () => {
    const fetchMock = apiResponding();
    vi.stubGlobal("fetch", fetchMock);
    await thrownBy("/blog-pieces-auto/inconnu/comment-changer-un-demarreur");
    const urls = fetchMock.mock.calls.map(([input]) => String(input));
    expect(urls.some((u) => ARTICLE_API.test(u))).toBe(false);
  });

  it.each([500, 429])(
    "API article %i → 503 Retry-After, jamais mis en cache",
    async (status) => {
      vi.stubGlobal("fetch", apiResponding(status));
      const res = (await thrownBy(
        "/blog-pieces-auto/changer-votre-filtre-boite-auto",
      )) as Response;
      expect(res).toBeInstanceOf(Response);
      expect(res.status).toBe(503);
      expect(headersFor(res)).toEqual({
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "X-Robots-Tag": "noindex, follow",
        "Retry-After": "60",
      });
    },
  );

  it("API article injoignable → 503 (une panne n'est jamais un 404)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request) =>
        ARTICLE_API.test(String(input))
          ? Promise.reject(new TypeError("fetch failed"))
          : Promise.resolve(new Response(JSON.stringify({ found: false }))),
      ),
    );
    const res = (await thrownBy(
      "/blog-pieces-auto/comment-changer-un-demarreur",
    )) as Response;
    expect(res.status).toBe(503);
  });

  it("une règle de redirection en table garde la priorité", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL | Request) =>
        Promise.resolve(
          new Response(
            JSON.stringify(
              String(input).includes("/api/redirects/check")
                ? { found: true, destination: "/ailleurs", permanent: true }
                : { found: false },
            ),
          ),
        ),
      ),
    );
    const res = (await thrownBy(
      "/blog-pieces-auto/comment-changer-un-demarreur",
    )) as Response;
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe("/ailleurs");
  });
});

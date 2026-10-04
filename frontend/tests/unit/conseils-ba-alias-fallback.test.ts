import { describe, it, expect, vi, beforeEach } from "vitest";

import { headers, loader } from "~/routes/blog-pieces-auto.conseils.$pg_alias";

vi.mock("~/utils/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

/**
 * /blog-pieces-auto/conseils/{x} sans guide R3 : x peut être le ba_alias d'un
 * conseil (anciens liens /conseils/{ba_alias}, dont le bloc « guide d'achat »
 * des R1). L'article décide de l'adresse canonique ; tout le reste est 404.
 */

type Thrown = {
  status?: number;
  headers?: Headers;
  init?: { status?: number; headers?: Record<string, string> };
};

const R3_API = /\/api\/r3-guide\//;
const ARTICLE_API = /\/api\/blog\/article\/([^/?]+)$/;

function api(opts: {
  article?: Record<string, unknown>;
  articleStatus?: number;
}) {
  return vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    if (R3_API.test(url)) return new Response("{}", { status: 404 });
    if (ARTICLE_API.test(url)) {
      if (opts.articleStatus) {
        return new Response("{}", { status: opts.articleStatus });
      }
      return opts.article
        ? new Response(JSON.stringify({ success: true, data: opts.article }))
        : new Response("{}", { status: 404 });
    }
    throw new Error(`appel inattendu : ${url}`);
  });
}

async function thrownBy(pgAlias: string): Promise<Thrown> {
  try {
    await loader({
      request: new Request(
        `https://www.automecanik.com/blog-pieces-auto/conseils/${pgAlias}`,
      ),
      params: { pg_alias: pgAlias },
      context: {},
    } as never);
  } catch (e) {
    return e as Thrown;
  }
  throw new Error("le loader n'a rien levé");
}

type Args = Parameters<typeof headers>[0];
const headersFor = (thrown: Thrown) =>
  headers({
    loaderHeaders: new Headers(),
    parentHeaders: new Headers(),
    actionHeaders: new Headers(),
    errorHeaders: thrown.init?.headers
      ? new Headers(thrown.init.headers)
      : undefined,
  } as unknown as Args) as Record<string, string>;

const advice = (slug: string, pgAlias: string | null) => ({
  type: "advice",
  slug,
  pg_alias: pgAlias,
  legacy_table: "__blog_advice",
});

describe("conseils loader — ba_alias sans guide R3", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("ba_alias d'un conseil rattaché → 301 /conseils/{pg_alias}", async () => {
    vi.stubGlobal(
      "fetch",
      api({ article: advice("comment-changer-un-demarreur", "demarreur") }),
    );
    const thrown = await thrownBy("comment-changer-un-demarreur");
    expect(thrown).toBeInstanceOf(Response);
    expect(thrown.status).toBe(301);
    expect(thrown.headers?.get("Location")).toBe(
      "/blog-pieces-auto/conseils/demarreur",
    );
  });

  it("ba_alias d'un conseil sans gamme → 301 /article/{ba_alias}", async () => {
    vi.stubGlobal(
      "fetch",
      api({ article: advice("comment-changer-un-leve-vitre", null) }),
    );
    const thrown = await thrownBy("comment-changer-un-leve-vitre");
    expect(thrown.status).toBe(301);
    expect(thrown.headers?.get("Location")).toBe(
      "/blog-pieces-auto/article/comment-changer-un-leve-vitre",
    );
  });

  it("cible = cette même URL → 404, jamais de boucle", async () => {
    vi.stubGlobal("fetch", api({ article: advice("x", "demarreur") }));
    const thrown = await thrownBy("demarreur");
    expect(thrown).not.toBeInstanceOf(Response);
    expect(thrown.init?.status).toBe(404);
    expect(headersFor(thrown)["Cache-Control"]).toBe(
      "no-cache, no-store, must-revalidate",
    );
  });

  it.each([
    ["aucun article", {}],
    [
      "un guide n'est pas un conseil",
      {
        article: {
          type: "guide",
          slug: "g",
          legacy_table: "__blog_guide",
        },
      },
    ],
  ])("%s → 404 no-store", async (_cas, opts) => {
    vi.stubGlobal("fetch", api(opts));
    const thrown = await thrownBy("inconnu");
    expect(thrown.init?.status).toBe(404);
    expect(headersFor(thrown)["Cache-Control"]).toBe(
      "no-cache, no-store, must-revalidate",
    );
  });

  it("API article en échec → 503 Retry-After, no-store", async () => {
    vi.stubGlobal("fetch", api({ articleStatus: 500 }));
    const thrown = await thrownBy("comment-changer-un-demarreur");
    expect(thrown.init?.status).toBe(503);
    expect(headersFor(thrown)).toEqual({
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Retry-After": "60",
    });
  });
});

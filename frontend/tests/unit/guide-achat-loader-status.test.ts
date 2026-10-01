import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  headers,
  loader,
} from "~/routes/blog-pieces-auto.guide-achat.$pg_alias";
import { logger } from "~/utils/logger";

// vi.mock is hoisted by Vitest's transformer (runs before imports at runtime),
// safe to declare after the import for ESLint's `import/first` rule.
vi.mock("~/utils/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

/**
 * Régression : `data()` renvoie un DataWithResponseInit, pas une Response.
 * Les 404 levés DANS le `try` du loader guide d'achat étaient rattrapés par le
 * `catch` (qui ne relance que `instanceof Response`) et remplacés par sa 500 :
 * un guide absent répondait 500. Le loader ne répond 404 que si les DEUX
 * sources (endpoint R6, puis guides blog) disent « absent » ; toute autre issue
 * est passagère et répond 503 + Retry-After (précédent R3, route conseils).
 */

type Thrown = {
  data?: { message?: string };
  init?: { status?: number; headers?: Record<string, string> };
};

const ALIAS = "disque-de-frein";

const R6_GUIDE = {
  intentType: "R6",
  page: { pg_id: 0, pg_alias: ALIAS },
};

const BLOG_GUIDE = { slug: ALIAS, title: "Disque de frein", sections: [] };

type Reply = { status: number; body?: unknown } | Error;

const fetchMock = vi.fn();

function apiReplies(r6: Reply, blog: Reply) {
  fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    const reply: Reply = url.includes("/api/r6-guide/redirect/")
      ? { status: 200, body: { redirect_to: null, robots: null } }
      : url.includes("/api/r6-guide/")
        ? r6
        : url.includes("/api/blog/guides/slug/")
          ? blog
          : { status: 404 };
    if (reply instanceof Error) throw reply;
    return new Response(JSON.stringify(reply.body ?? {}), {
      status: reply.status,
      headers: { "Content-Type": "application/json" },
    });
  });
}

async function thrownBy(run: () => Promise<unknown>): Promise<Thrown> {
  try {
    await run();
  } catch (e) {
    return e as Thrown;
  }
  throw new Error("le loader n'a rien levé");
}

const run = () =>
  loader({
    request: new Request(
      `https://www.automecanik.com/blog-pieces-auto/guide-achat/${ALIAS}`,
    ),
    params: { pg_alias: ALIAS },
    context: {},
  } as never);

beforeEach(() => {
  fetchMock.mockReset();
  vi.mocked(logger.error).mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

describe("guide d'achat loader — absence réelle → 404", () => {
  it.each([
    ["R6 404, blog 404", { status: 404 }, { status: 404 }, "non trouve"],
    [
      "R6 sans guide R6, blog sans guide",
      { status: 200, body: { data: null } },
      { status: 200, body: { data: null } },
      "non disponible",
    ],
    [
      "R6 d'une autre intention, blog 404",
      { status: 200, body: { data: { ...R6_GUIDE, intentType: "R3" } } },
      { status: 404 },
      "non trouve",
    ],
  ])("%s → 404, sans journal d'erreur", async (_cas, r6, blog, message) => {
    apiReplies(r6, blog);
    const thrown = await thrownBy(run);
    expect(thrown.init?.status).toBe(404);
    expect(thrown.data?.message).toBe(`Guide "${ALIAS}" ${message}`);
    expect(logger.error).not.toHaveBeenCalled();
  });
});

describe("guide d'achat loader — panne passagère → 503 + Retry-After", () => {
  it.each([
    ["R6 500, blog 404", { status: 500 }, { status: 404 }],
    ["R6 429, blog sans guide", { status: 429 }, { status: 200, body: {} }],
    ["R6 404, blog 500", { status: 404 }, { status: 500 }],
    ["R6 injoignable", new Error("ECONNREFUSED"), { status: 404 }],
    ["blog injoignable", { status: 404 }, new Error("ECONNRESET")],
  ])("%s → 503, journalisée une fois", async (_cas, r6, blog) => {
    apiReplies(r6, blog);
    const thrown = await thrownBy(run);
    expect(thrown.init?.status).toBe(503);
    expect(thrown.init?.headers).toEqual({ "Retry-After": "60" });
    expect(logger.error).toHaveBeenCalledTimes(1);
  });
});

describe("guide d'achat loader — succès inchangés", () => {
  it("guide R6 → servi", async () => {
    apiReplies({ status: 200, body: { data: R6_GUIDE } }, { status: 404 });
    await expect(run()).resolves.toEqual({
      guide: R6_GUIDE,
      pg_alias: ALIAS,
      r4Reference: null,
      robots: null,
    });
  });

  it("R6 en panne, guide blog présent → guide blog servi", async () => {
    apiReplies({ status: 500 }, { status: 200, body: { data: BLOG_GUIDE } });
    const result = (await run()) as { guide: { sourceType: string } };
    expect(result.guide.sourceType).toBe("manual");
    expect(logger.error).not.toHaveBeenCalled();
  });
});

describe("guide d'achat headers — une erreur n'est jamais mise en cache", () => {
  type Args = Parameters<typeof headers>[0];
  const invoke = (error?: Record<string, string>) =>
    headers({
      loaderHeaders: new Headers(),
      parentHeaders: new Headers(),
      actionHeaders: new Headers(),
      errorHeaders: error ? new Headers(error) : undefined,
    } as unknown as Args);

  it("succès → politique de cache inchangée", () => {
    expect(invoke()).toEqual({
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
    });
  });

  it("503 levé → no-store et Retry-After propagé", () => {
    expect(invoke({ "Retry-After": "60" })).toEqual({
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Retry-After": "60",
    });
  });
});

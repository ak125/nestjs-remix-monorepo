/**
 * PR B review, blocker #3: several loaders ABSORB a backend failure and return
 * an empty-200 (or a transient redirect) instead of throwing. buildCacheHeaders
 * only forces no-store on THROWN Responses, so those degraded pages would inherit
 * the public success TTL and Cloudflare would cache the failure for hours.
 *
 * These tests prove that a backend failure NEVER receives the success TTL: the
 * loader itself stamps `Cache-Control: no-store` (+ `X-Robots-Tag: noindex,
 * follow` for indexable empty pages) on every degraded exit — including the
 * subtle case where per-fetch `.catch(() => null)` swallows the failure and it
 * reaches the SUCCESS return with empty data.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { loader as homeLoader } from "~/routes/_index";
import { loader as blogIndexLoader } from "~/routes/blog-pieces-auto._index";
import { loader as adviceLoader } from "~/routes/blog-pieces-auto.advice._index";
import { loader as articleLoader } from "~/routes/blog-pieces-auto.article.$slug";
import { loader as autoMarqueLoader } from "~/routes/blog-pieces-auto.auto.$marque.index";
import { loader as autoIndexLoader } from "~/routes/blog-pieces-auto.auto._index";
import { loader as conseilsLoader } from "~/routes/blog-pieces-auto.conseils._index";
import { loader as constructeursLoader } from "~/routes/blog-pieces-auto.constructeurs._index";

vi.mock("~/utils/logger", () => ({
  logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));
vi.mock("~/utils/internal-api.server", () => ({
  getInternalApiUrl: (p = "") => `http://internal${p}`,
  getInternalApiUrlFromRequest: (p = "") => `http://internal${p}`,
}));
// Home uses a DI service (not fetch) for its above-fold families.
vi.mock("~/server/remix-api.server", () => ({
  getRemixApiService: async () => ({
    getHomepageFamilies: async () => {
      throw new Error("families backend down");
    },
    getHomepageBelowFold: async () => null,
  }),
}));

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

function cacheControlOf(result: unknown): string | null {
  if (result instanceof Response) return result.headers.get("Cache-Control");
  const init = (result as { init?: { headers?: Record<string, string> } })
    ?.init;
  return init?.headers?.["Cache-Control"] ?? null;
}
function xRobotsOf(result: unknown): string | null {
  if (result instanceof Response) return result.headers.get("X-Robots-Tag");
  const init = (result as { init?: { headers?: Record<string, string> } })
    ?.init;
  return init?.headers?.["X-Robots-Tag"] ?? null;
}

const req = (url = "https://www.automecanik.com/x") => new Request(url);
const call = (loader: (a: never) => unknown, args: object = {}) =>
  loader({ request: req(), context: {}, params: {}, ...args } as never);

const jsonOk = (body: unknown) => ({ ok: true, json: async () => body });
// HTTP 200 whose body is not parseable JSON (proxy hiccup / truncated payload):
// `.ok` is true but `.json()` rejects → the loader's `.json().catch(() => null)`
// yields a null parsed body.
const jsonBad = () => ({
  ok: true,
  json: async () => {
    throw new SyntaxError("Unexpected end of JSON input");
  },
});

describe("degraded fallback → never the success TTL", () => {
  it("blog _index: API failure → no-store + noindex (not the public s-maxage)", async () => {
    fetchMock.mockRejectedValue(new Error("backend down"));
    const out = await call(blogIndexLoader);
    expect(cacheControlOf(out)).toBe("no-store");
    expect(xRobotsOf(out)).toBe("noindex, follow");
  });

  it("blog _index: real success → public TTL, NOT no-store", async () => {
    fetchMock.mockResolvedValue(
      jsonOk({ success: true, data: { featured: [], stats: {} } }),
    );
    const out = await call(blogIndexLoader);
    const cc = cacheControlOf(out);
    expect(cc).toContain("s-maxage");
    expect(cc).not.toContain("no-store");
  });

  it("advice _index: API failure → no-store + noindex", async () => {
    fetchMock.mockRejectedValue(new Error("backend down"));
    const out = await call(adviceLoader);
    expect(cacheControlOf(out)).toBe("no-store");
    expect(xRobotsOf(out)).toBe("noindex, follow");
  });

  it("auto _index: per-fetch swallow → still no-store on the empty success return", async () => {
    // fetches are `.catch(() => null)` — failure reaches the SUCCESS return, not the catch
    fetchMock.mockRejectedValue(new Error("backend down"));
    const out = await call(autoIndexLoader);
    expect(cacheControlOf(out)).toBe("no-store");
    expect(xRobotsOf(out)).toBe("noindex, follow");
  });

  it("auto _index: HTTP 200 but brands body unparseable → no-store + noindex (H1, not the public TTL)", async () => {
    // 200 OK on every fetch, but the brands payload fails to parse → brandsData === null.
    fetchMock.mockImplementation((url: string) =>
      /brands-logos/.test(url)
        ? Promise.resolve(jsonBad())
        : Promise.resolve(jsonOk({ data: [] })),
    );
    const out = await call(autoIndexLoader);
    const cc = cacheControlOf(out);
    expect(cc).toBe("no-store");
    expect(cc).not.toContain("public");
    expect(cc).not.toContain("s-maxage");
    expect(xRobotsOf(out)).toBe("noindex, follow");
  });

  it("auto _index: HTTP 200 but models body unparseable → no-store + noindex (H1)", async () => {
    fetchMock.mockImplementation((url: string) =>
      /popular-models/.test(url)
        ? Promise.resolve(jsonBad())
        : Promise.resolve(jsonOk({ data: [] })),
    );
    const out = await call(autoIndexLoader);
    const cc = cacheControlOf(out);
    expect(cc).toBe("no-store");
    expect(cc).not.toContain("public");
    expect(xRobotsOf(out)).toBe("noindex, follow");
  });

  it("auto _index: genuine 200 success (both bodies parse) → NOT degraded (delegates to public headers export, no no-store/noindex)", async () => {
    // Guard against over-privatising a healthy page: on real success the loader
    // returns `data(payload, undefined)` (the public `headers` export applies) and
    // must NOT stamp the degraded no-store/noindex.
    fetchMock.mockResolvedValue(jsonOk({ data: [] }));
    const out = await call(autoIndexLoader);
    expect(cacheControlOf(out)).toBeNull();
    expect(xRobotsOf(out)).toBeNull();
  });

  it("auto $marque index: brand OK but models fetch fails → degraded no-store", async () => {
    fetchMock.mockImplementation((url: string) =>
      /model/i.test(url)
        ? Promise.reject(new Error("models down"))
        : Promise.resolve(
            jsonOk({ success: true, data: { name: "Renault", id: 1 } }),
          ),
    );
    const out = await call(autoMarqueLoader, { params: { marque: "renault" } });
    expect(cacheControlOf(out)).toBe("no-store");
  });

  it("conseils _index: API failure → no-store + noindex", async () => {
    fetchMock.mockRejectedValue(new Error("backend down"));
    const out = await call(conseilsLoader);
    expect(cacheControlOf(out)).toBe("no-store");
    expect(xRobotsOf(out)).toBe("noindex, follow");
  });

  it("constructeurs _index: API failure → no-store + noindex", async () => {
    fetchMock.mockRejectedValue(new Error("backend down"));
    const out = await call(constructeursLoader);
    expect(cacheControlOf(out)).toBe("no-store");
    expect(xRobotsOf(out)).toBe("noindex, follow");
  });

  it("home _index: families service failure → no-store + noindex", async () => {
    fetchMock.mockRejectedValue(new Error("faq down")); // deferred faq → []
    const out = await call(homeLoader);
    expect(cacheControlOf(out)).toBe("no-store");
    expect(xRobotsOf(out)).toBe("noindex, follow");
  });

  it("article $slug: transient backend error → 302 redirect carrying no-store", async () => {
    fetchMock.mockRejectedValue(new Error("backend down"));
    const out = await call(articleLoader, {
      params: { slug: "comment-changer-les-plaquettes" },
    });
    expect(out).toBeInstanceOf(Response);
    expect((out as Response).status).toBe(302);
    expect(cacheControlOf(out)).toBe("no-store");
  });
});

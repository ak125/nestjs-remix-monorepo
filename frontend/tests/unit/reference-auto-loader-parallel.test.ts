/**
 * PR #8 (audit LCP 2026-07-14 §2C) — le loader `/reference-auto/{slug}` enchaînait
 * le fetch principal PUIS le fetch `/related` en SÉQUENTIEL, malgré le commentaire
 * "non-blocking" : les deux ne dépendent que de `slug`. Ce test épingle :
 *   1. le parallélisme (les 2 fetch partent avant que le principal ne résolve) ;
 *   2. la préservation du 404 (principal !ok) et du silent-[] (related en erreur).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { loader } from "~/routes/reference-auto.$slug";

vi.mock("~/utils/logger", () => ({
  logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));
vi.mock("~/utils/internal-api.server", () => ({
  getInternalApiUrl: () => "http://internal",
}));

const SLUG = "soupape-d-admission";
const call = () =>
  loader({
    params: { slug: SLUG },
    request: new Request(`https://www.automecanik.com/reference-auto/${SLUG}`),
    context: {},
  } as never);

const okJson = (body: unknown) => ({ ok: true, json: async () => body });

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("reference-auto.$slug loader — parallélise le fetch principal + /related", () => {
  it("dispatche les DEUX fetch avant que le principal ne résolve (parallélisme)", async () => {
    const main = deferred<{ ok: boolean; json: () => Promise<unknown> }>();
    fetchMock.mockImplementation((url: string) =>
      url.endsWith("/related")
        ? Promise.resolve(okJson({ related: [] }))
        : main.promise,
    );

    const p = call(); // principal encore pending
    await Promise.resolve();

    // Cœur de la régression : en séquentiel, seul le fetch principal est parti.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.some(([u]) => String(u).endsWith("/related"))).toBe(
      true,
    );

    main.resolve(okJson({ slug: SLUG, title: "Soupape" }));
    await p;
  });

  it("happy-path : retourne reference + relatedRefs mappés", async () => {
    fetchMock.mockImplementation((url: string) =>
      url.endsWith("/related")
        ? Promise.resolve(
            okJson({ related: [{ slug: "a", title: "A", extra: "drop" }] }),
          )
        : Promise.resolve(okJson({ slug: SLUG, title: "Soupape" })),
    );

    const body = (
      (await call()) as { data: { reference: unknown; relatedRefs: unknown } }
    ).data;
    expect(body.reference).toEqual({ slug: SLUG, title: "Soupape" });
    expect(body.relatedRefs).toEqual([{ slug: "a", title: "A" }]);
  });

  it("principal !ok → 404", async () => {
    fetchMock.mockImplementation((url: string) =>
      url.endsWith("/related")
        ? Promise.resolve(okJson({ related: [] }))
        : Promise.resolve({ ok: false, json: async () => ({}) }),
    );

    let thrown: Response | undefined;
    try {
      await call();
    } catch (e) {
      thrown = e as Response;
    }
    expect(thrown).toBeInstanceOf(Response);
    expect(thrown?.status).toBe(404);
  });

  it("related en erreur → relatedRefs = [] (silent)", async () => {
    fetchMock.mockImplementation((url: string) =>
      url.endsWith("/related")
        ? Promise.reject(new Error("boom"))
        : Promise.resolve(okJson({ slug: SLUG, title: "Soupape" })),
    );

    const body = (
      (await call()) as { data: { reference: unknown; relatedRefs: unknown } }
    ).data;
    expect(body.reference).toEqual({ slug: SLUG, title: "Soupape" });
    expect(body.relatedRefs).toEqual([]);
  });
});

/**
 * PR #8 (audit LCP 2026-07-14 §2C) — le loader `/reference-auto/{slug}` enchaînait
 * le fetch principal PUIS le fetch `/related` en SÉQUENTIEL, malgré le commentaire
 * "non-blocking" : les deux ne dépendent que de `slug`. Ce test épingle :
 *   1. le parallélisme (les 2 fetch partent avant que le principal ne résolve) ;
 *   2. le silent-[] (related en erreur).
 *
 * Mise à jour 2026-08-15 : le contrat d'erreur épinglé ici était « principal !ok
 * → 404 », ce qui écrasait AUSSI les pannes transitoires (429 du rate limiter de
 * l'app, 5xx, coupure réseau) en 404 sur une URL indexée — risque de
 * désindexation. Le contrat est désormais explicite par statut : 404 = absence
 * réelle, tout le reste = 503 + Retry-After.
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

  /** Runs the loader against a main-fetch outcome and returns what it threw. */
  const throwsFor = async (main: unknown): Promise<Response | undefined> => {
    fetchMock.mockImplementation((url: string) =>
      url.endsWith("/related")
        ? Promise.resolve(okJson({ related: [] }))
        : (main as Promise<unknown>) instanceof Promise
          ? (main as Promise<unknown>)
          : Promise.resolve(main),
    );
    try {
      await call();
    } catch (e) {
      return e as Response;
    }
    return undefined;
  };

  it("principal 404 → 404 (absence réelle)", async () => {
    const thrown = await throwsFor({ ok: false, status: 404, json: async () => ({}) });
    expect(thrown).toBeInstanceOf(Response);
    expect(thrown?.status).toBe(404);
  });

  // Un 429 (rate limiter de l'app) ou un 5xx est TRANSITOIRE. Le rendre en 404
  // sur une URL indexée invite à la désindexation — d'où le 503 retryable.
  it.each([429, 500, 502, 503])(
    "principal %i → 503 + Retry-After (transitoire, jamais 404)",
    async (status) => {
      const thrown = await throwsFor({ ok: false, status, json: async () => ({}) });
      expect(thrown).toBeInstanceOf(Response);
      expect(thrown?.status).toBe(503);
      expect(thrown?.headers.get("Retry-After")).toBe("60");
    },
  );

  it("panne réseau du principal → 503, pas 404", async () => {
    const thrown = await throwsFor(Promise.reject(new Error("ECONNRESET")));
    expect(thrown).toBeInstanceOf(Response);
    expect(thrown?.status).toBe(503);
  });

  it("payload vide malgré un 200 → 404 (absence réelle)", async () => {
    const thrown = await throwsFor(okJson({}));
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

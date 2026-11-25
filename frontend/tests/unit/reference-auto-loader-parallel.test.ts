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
 *
 * Mandat ER (2026-11-25) : un 3e appel parallèle, `/redirect/{slug}`, porte la
 * consolidation R4 → R3. Cible conseils → 301 ; null, erreur ou cible hors
 * `/blog-pieces-auto/conseils/` → page R4 servie comme aujourd'hui.
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
  it("dispatche les fetch avant que le principal ne résolve (parallélisme)", async () => {
    const main = deferred<{ ok: boolean; json: () => Promise<unknown> }>();
    fetchMock.mockImplementation((url: string) =>
      url.endsWith("/related")
        ? Promise.resolve(okJson({ related: [] }))
        : url.includes("/redirect/")
          ? Promise.resolve(okJson({ redirect_to: null, pg_alias: null }))
          : main.promise,
    );

    const p = call(); // principal encore pending
    await Promise.resolve();

    // Cœur de la régression : en séquentiel, seul le fetch principal est parti.
    // 3 appels : principal, /related, /redirect (mandat ER).
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(
      fetchMock.mock.calls.some(([u]) => String(u).endsWith("/related")),
    ).toBe(true);
    expect(
      fetchMock.mock.calls.some(
        ([u]) =>
          String(u) === `http://internal/api/seo/reference/redirect/${SLUG}`,
      ),
    ).toBe(true);

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
    const thrown = await throwsFor({
      ok: false,
      status: 404,
      json: async () => ({}),
    });
    expect(thrown).toBeInstanceOf(Response);
    expect(thrown?.status).toBe(404);
  });

  // Un 429 (rate limiter de l'app) ou un 5xx est TRANSITOIRE. Le rendre en 404
  // sur une URL indexée invite à la désindexation — d'où le 503 retryable.
  it.each([429, 500, 502, 503])(
    "principal %i → 503 + Retry-After (transitoire, jamais 404)",
    async (status) => {
      const thrown = await throwsFor({
        ok: false,
        status,
        json: async () => ({}),
      });
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

describe("reference-auto.$slug loader — consolidation R4 → R3 (mandat ER)", () => {
  const route = (redirect: () => Promise<unknown>) =>
    fetchMock.mockImplementation((url: string) =>
      url.includes("/redirect/")
        ? redirect()
        : url.endsWith("/related")
          ? Promise.resolve(okJson({ related: [] }))
          : Promise.resolve(okJson({ slug: SLUG, title: "Soupape" })),
    );

  it("cible conseils → 301 en un saut vers la page conseils", async () => {
    route(() =>
      Promise.resolve(
        okJson({
          redirect_to: "/blog-pieces-auto/conseils/thermostat",
          pg_alias: "thermostat",
        }),
      ),
    );
    const res = (await call()) as Response;
    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe(
      "/blog-pieces-auto/conseils/thermostat",
    );
  });

  it.each([
    [
      "null",
      () => Promise.resolve(okJson({ redirect_to: null, pg_alias: null })),
    ],
    [
      "HTTP 500",
      () => Promise.resolve({ ok: false, status: 500, json: async () => ({}) }),
    ],
    ["panne réseau", () => Promise.reject(new Error("ECONNRESET"))],
    [
      "JSON invalide",
      () =>
        Promise.resolve({
          ok: true,
          json: async () => {
            throw new SyntaxError("x");
          },
        }),
    ],
    [
      "cible hors conseils",
      () => Promise.resolve(okJson({ redirect_to: "https://evil.example/x" })),
    ],
  ])("redirection %s → page R4 servie", async (_l, redirect) => {
    route(redirect);
    const body = (
      (await call()) as { data: { reference: unknown; relatedRefs: unknown } }
    ).data;
    expect(body.reference).toEqual({ slug: SLUG, title: "Soupape" });
  });

  it("liens liés : href du backend si présent, absent sinon", async () => {
    fetchMock.mockImplementation((url: string) =>
      url.includes("/redirect/")
        ? Promise.resolve(okJson({ redirect_to: null }))
        : url.endsWith("/related")
          ? Promise.resolve(
              okJson({
                related: [
                  {
                    slug: "a",
                    title: "A",
                    href: "/blog-pieces-auto/conseils/a",
                  },
                  { slug: "b", title: "B" },
                ],
              }),
            )
          : Promise.resolve(okJson({ slug: SLUG, title: "Soupape" })),
    );
    const body = ((await call()) as { data: { relatedRefs: unknown } }).data;
    expect(body.relatedRefs).toEqual([
      { slug: "a", title: "A", href: "/blog-pieces-auto/conseils/a" },
      { slug: "b", title: "B" },
    ]);
  });

  // C7 (contre-vérification EV) : sonde bornée par un délai court, annulée à
  // l'échéance ; la page R4 est alors servie comme sur une panne de la sonde.
  it("sonde muette → appel annulé à l'échéance, page R4 servie", async () => {
    let probeSignal: AbortSignal | undefined;
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/redirect/")) {
        probeSignal = init?.signal ?? undefined;
        return new Promise((_resolve, reject) => {
          probeSignal?.addEventListener("abort", () =>
            reject(probeSignal?.reason),
          );
        });
      }
      return url.endsWith("/related")
        ? Promise.resolve(okJson({ related: [] }))
        : Promise.resolve(okJson({ slug: SLUG, title: "Soupape" }));
    });

    const p = call();
    expect(probeSignal).toBeInstanceOf(AbortSignal);
    const body = ((await p) as { data: { reference: unknown } }).data;
    expect(probeSignal?.aborted).toBe(true);
    expect(body.reference).toEqual({ slug: SLUG, title: "Soupape" });
  }, 5000);

  // C8 : la promesse principale a un gestionnaire de rejet dès sa création ;
  // un rejet pendant l'attente de la sonde n'est pas une rejection non gérée.
  it("principal rejeté pendant l'attente de la sonde → aucune rejection non gérée, 503", async () => {
    const probe = deferred<{ ok: boolean; json: () => Promise<unknown> }>();
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    try {
      // Fonction nue, pas vi.fn : le suivi des résultats de vi.fn attache un
      // gestionnaire à la promesse rendue et masquerait la rejection.
      vi.stubGlobal("fetch", (url: string) =>
        url.includes("/redirect/")
          ? probe.promise
          : url.endsWith("/related")
            ? Promise.resolve(okJson({ related: [] }))
            : Promise.reject(new Error("ECONNRESET")),
      );

      const p = call().catch((e: unknown) => e);
      await new Promise((r) => setTimeout(r, 20));
      expect(unhandled).not.toHaveBeenCalled();

      probe.resolve(okJson({ redirect_to: null }));
      const thrown = (await p) as Response;
      expect(thrown).toBeInstanceOf(Response);
      expect(thrown.status).toBe(503);
    } finally {
      process.off("unhandledRejection", unhandled);
    }
  });
});

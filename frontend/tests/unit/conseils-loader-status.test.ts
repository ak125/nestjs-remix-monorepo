import { describe, it, expect, vi, beforeEach } from "vitest";

import { headers, loader } from "~/routes/blog-pieces-auto.conseils.$pg_alias";

// vi.mock is hoisted by Vitest's transformer (runs before imports at runtime),
// safe to declare after the import for ESLint's `import/first` rule.
vi.mock("~/utils/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

/**
 * Chaîne loader → headers de la page conseils (R3). React Router 8 ne transmet
 * à `headers` les en-têtes d'une erreur levée que si `data()` en porte
 * (router.js : `headers: result.init?.headers ? new Headers(…) : void 0`) ;
 * sans eux, `errorHeaders` est absent et `buildCacheHeaders` applique la
 * politique de SUCCÈS (public, max-age=300) à l'erreur.
 */

type Thrown = {
  init?: { status?: number; headers?: Record<string, string> };
};

const ALIAS = "disque-de-frein";
const NO_STORE = "no-cache, no-store, must-revalidate";

const fetchMock = vi.fn();

async function thrownBy(run: () => Promise<unknown>): Promise<Thrown> {
  try {
    await run();
  } catch (e) {
    return e as Thrown;
  }
  throw new Error("le loader n'a rien levé");
}

const run = (params: Record<string, string> = { pg_alias: ALIAS }) =>
  loader({
    request: new Request(
      `https://www.automecanik.com/blog-pieces-auto/conseils/${params.pg_alias ?? ""}`,
    ),
    params,
    context: {},
  } as never);

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

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("conseils loader → headers — aucune erreur levée n'est mise en cache", () => {
  it.each([
    ["endpoint R3 404", 404, {}, 404],
    ["endpoint R3 sans guide", 200, { data: null }, 404],
    ["endpoint R3 500", 500, {}, 503],
  ])("%s → no-store", async (_cas, status, body, expected) => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const thrown = await thrownBy(() => run());
    expect(thrown.init?.status).toBe(expected);
    expect(headersFor(thrown)["Cache-Control"]).toBe(NO_STORE);
  });

  it("alias manquant → 404 no-store", async () => {
    const thrown = await thrownBy(() => run({}));
    expect(thrown.init?.status).toBe(404);
    expect(headersFor(thrown)["Cache-Control"]).toBe(NO_STORE);
  });
});

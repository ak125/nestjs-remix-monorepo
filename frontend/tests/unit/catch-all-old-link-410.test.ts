import { describe, it, expect, vi, beforeEach } from "vitest";

import { loader } from "~/routes/$";
import { logger } from "~/utils/logger";

vi.mock("~/utils/logger", () => ({
  logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

/**
 * Régression — le statut décidé dans le `try` du loader était avalé par le
 * `catch`.
 *
 * `data()` (React Router 8) renvoie un DataWithResponseInit, PAS une Response.
 * Les 410 (ancien lien connu, /pieces-auto/* non résolu) et la 404 enrichie
 * étaient levés DANS le `try`, dont le `catch` ne relance que les
 * `instanceof Response` : tout retombait sur la 404 de repli « erreur
 * technique ». Même piège que #1681 (admin leads).
 *
 * Empirique PROD (2026-10-10) : /pieces-monroe.html, /old-contact,
 * /reference-auto/xyz, /pieces-auto/zzz-inexistant-999 → 404 `no-cache`,
 * alors que le code les déclare 410 (PR #133 pour /pieces-{marque}.html).
 */
describe("catch-all $.tsx — le statut décidé n'est plus remplacé par la 404 de repli", () => {
  beforeEach(() => {
    vi.mocked(logger.error).mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ found: false, suggestions: [] })),
        ),
      ),
    );
  });

  type Thrown = {
    data?: { error?: string };
    init?: { status?: number; headers?: HeadersInit };
  };

  const call = async (path: string): Promise<Thrown | undefined> => {
    try {
      await loader({
        request: new Request(`https://www.automecanik.com${path}`),
        params: {},
        context: {},
      } as never);
    } catch (e) {
      return e as Thrown;
    }
    return undefined;
  };

  it.each(["/pieces-monroe.html", "/pieces-mann-filter.html", "/old-contact"])(
    "ancien lien connu %s → 410 noindex, cache 24 h",
    async (path) => {
      const thrown = await call(path);

      expect(thrown?.init?.status).toBe(410);
      const headers = new Headers(thrown?.init?.headers);
      expect(headers.get("X-Robots-Tag")).toBe("noindex, follow");
      expect(headers.get("Cache-Control")).toBe("public, max-age=86400");
      expect(logger.error).not.toHaveBeenCalledWith(
        "Erreur dans catch-all route:",
        expect.anything(),
      );
    },
  );

  it("/pieces-auto/* non résolu → 410 (pas la 404 standard)", async () => {
    const thrown = await call("/pieces-auto/zzz-inexistant-999");

    expect(thrown?.init?.status).toBe(410);
    expect(new Headers(thrown?.init?.headers).get("X-Robots-Tag")).toBe(
      "noindex, follow",
    );
    expect(logger.error).not.toHaveBeenCalledWith(
      "Erreur résolution URL legacy:",
      expect.anything(),
    );
  });

  it("URL inconnue → 404 enrichie, pas la 404 de repli « erreur technique »", async () => {
    const thrown = await call("/wp-admin/");

    expect(thrown?.init?.status).toBe(404);
    expect(thrown?.data?.error).toBeUndefined();
    expect(logger.error).not.toHaveBeenCalledWith(
      "Erreur dans catch-all route:",
      expect.anything(),
    );
  });
});

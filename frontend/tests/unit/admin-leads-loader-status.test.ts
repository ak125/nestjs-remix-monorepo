import { describe, it, expect, vi, beforeEach } from "vitest";

import { loader as leadDetailLoader } from "~/routes/admin.leads.$id";
import { loader as leadsIndexLoader } from "~/routes/admin.leads._index";
import { logger } from "~/utils/logger";

// vi.mock is hoisted by Vitest's transformer (runs before imports at runtime),
// safe to declare after the import for ESLint's `import/first` rule.
vi.mock("~/utils/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

/**
 * Régression : `data()` renvoie un DataWithResponseInit, pas une Response.
 * Levé DANS le `try` des loaders admin.leads, il était rattrapé par le `catch`
 * (qui ne relance que `instanceof Response`) et remplacé par la 502 de repli :
 * une session expirée (401/403) ou un lead absent (404) répondaient 502.
 * Le statut décidé dans le `try` doit atteindre l'ErrorBoundary tel quel.
 */

type Thrown = { data?: { error?: string }; init?: { status?: number } };

const fetchMock = vi.fn();

function apiResponds(status: number, body: unknown = {}) {
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

async function thrownBy(run: () => Promise<unknown>): Promise<Thrown> {
  try {
    await run();
  } catch (e) {
    return e as Thrown;
  }
  throw new Error("le loader n'a rien levé");
}

const runDetail = () =>
  leadDetailLoader({
    request: new Request("https://www.automecanik.com/admin/leads/42"),
    params: { id: "42" },
    context: {},
  } as never);

const runIndex = () =>
  leadsIndexLoader({
    request: new Request("https://www.automecanik.com/admin/leads"),
    params: {},
    context: {},
  } as never);

beforeEach(() => {
  fetchMock.mockReset();
  vi.mocked(logger.error).mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

describe("admin.leads.$id loader — statut décidé dans le try", () => {
  it.each([401, 403])(
    "API %i → même statut (session admin requise)",
    async (status) => {
      apiResponds(status);
      const thrown = await thrownBy(runDetail);
      expect(thrown.init?.status).toBe(status);
      expect(thrown.data?.error).toBe("Authentification admin requise");
    },
  );

  it("API 404 → 404 (lead introuvable)", async () => {
    apiResponds(404);
    const thrown = await thrownBy(runDetail);
    expect(thrown.init?.status).toBe(404);
    expect(thrown.data?.error).toBe("Lead introuvable ou non-trackable");
  });

  it("API 500 → 502, journalisée une seule fois", async () => {
    apiResponds(500);
    const thrown = await thrownBy(runDetail);
    expect(thrown.init?.status).toBe(502);
    expect(thrown.data?.error).toBe("API leads failed: 500");
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it("API injoignable → 502", async () => {
    fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const thrown = await thrownBy(runDetail);
    expect(thrown.init?.status).toBe(502);
    expect(thrown.data?.error).toBe("API leads unreachable");
  });

  it("API 200 → lead renvoyé", async () => {
    apiResponds(200, { msg_id: "42" });
    await expect(runDetail()).resolves.toEqual({ lead: { msg_id: "42" } });
  });
});

describe("admin.leads._index loader — statut décidé dans le try", () => {
  it.each([401, 403])(
    "API %i → même statut (session admin requise)",
    async (status) => {
      apiResponds(status);
      const thrown = await thrownBy(runIndex);
      expect(thrown.init?.status).toBe(status);
      expect(thrown.data?.error).toBe("Authentification admin requise");
    },
  );

  it("API 500 → 502, journalisée une seule fois", async () => {
    apiResponds(500);
    const thrown = await thrownBy(runIndex);
    expect(thrown.init?.status).toBe(502);
    expect(thrown.data?.error).toBe("API leads failed: 500");
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it("API injoignable → 502", async () => {
    fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const thrown = await thrownBy(runIndex);
    expect(thrown.init?.status).toBe(502);
    expect(thrown.data?.error).toBe("API leads unreachable");
  });

  it("API 200 → page de leads renvoyée", async () => {
    apiResponds(200, { rows: [], total: 0, page: 1, page_size: 50 });
    await expect(runIndex()).resolves.toEqual({
      rows: [],
      total: 0,
      page: 1,
      page_size: 50,
      filter_status: "",
      filter_follow_up: "any",
    });
  });
});

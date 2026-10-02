import { describe, it, expect, vi, beforeEach } from "vitest";

import { loader } from "~/routes/$";
import { action as suggestionsAction } from "~/routes/api.errors.suggestions";
import { logger } from "~/utils/logger";

// vi.mock is hoisted by Vitest's transformer (runs before imports at runtime),
// safe to declare after the import for ESLint's `import/first` rule.
vi.mock("~/utils/logger", () => ({
  logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

/**
 * Contrat : les appels SSR vers `POST /api/errors/log` ne transportent pas
 * l'adresse du visiteur dans le corps. Ils relaient les en-têtes de proxy
 * (getProxyHeaders) et le backend la résout via `trust proxy` — un 429 du
 * limiteur sur cet appel est journalisé, jamais avalé.
 */
const LOG_ENDPOINT = "/api/errors/log";
const proxied = {
  "X-Forwarded-For": "203.0.113.42",
  "X-Real-IP": "203.0.113.42",
};

let logStatus = 201;
const fetchMock = vi.fn((input: RequestInfo | URL, _init?: RequestInit) =>
  Promise.resolve(
    String(input).endsWith(LOG_ENDPOINT)
      ? new Response(null, { status: logStatus })
      : new Response(JSON.stringify({ redirectUrl: null })),
  ),
);

function logCall(): { headers: Headers; body: Record<string, unknown> } {
  const call = fetchMock.mock.calls.find(([input]) =>
    String(input).endsWith(LOG_ENDPOINT),
  );
  expect(call).toBeDefined();
  const init = call?.[1] ?? {};
  return {
    headers: new Headers(init.headers),
    body: JSON.parse(String(init.body)),
  };
}

beforeEach(() => {
  logStatus = 201;
  fetchMock.mockClear();
  vi.mocked(logger.error).mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

describe("catch-all $.tsx — log 404", () => {
  const call404 = async () => {
    try {
      await loader({
        request: new Request(
          "https://www.automecanik.com/this-page-does-not-exist-12345",
          { headers: proxied },
        ),
        params: {},
        context: {},
      } as never);
    } catch {
      // throw data(..., { status: 404 }) — couvert par catch-all-404-noindex.test
    }
  };

  it("relaie les en-têtes de proxy et n'envoie pas d'adresse dans le corps", async () => {
    await call404();
    const { headers, body } = logCall();
    expect(headers.get("X-Forwarded-For")).toBe("203.0.113.42");
    expect(headers.get("X-Real-IP")).toBe("203.0.113.42");
    expect(body).not.toHaveProperty("ipAddress");
    expect(body).toMatchObject({ code: 404 });
  });

  it("journalise un refus du backend (429) au lieu de l'ignorer", async () => {
    logStatus = 429;
    await call404();
    expect(logger.error).toHaveBeenCalledWith(expect.any(String), 429);
  });
});

describe("api.errors.suggestions — action reportError", () => {
  it("relaie les en-têtes de proxy et n'envoie pas d'adresse dans le corps", async () => {
    await suggestionsAction({
      request: new Request(
        "https://www.automecanik.com/api/errors/suggestions",
        {
          method: "POST",
          headers: { ...proxied, "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "reportError",
            errorData: JSON.stringify({ code: 500, url: "/panne" }),
          }),
        },
      ),
      params: {},
      context: {},
    } as never);

    const { headers, body } = logCall();
    expect(headers.get("X-Forwarded-For")).toBe("203.0.113.42");
    expect(headers.get("X-Real-IP")).toBe("203.0.113.42");
    expect(body).not.toHaveProperty("ipAddress");
    expect(body).toMatchObject({ code: 500, url: "/panne" });
  });
});

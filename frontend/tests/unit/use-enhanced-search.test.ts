/**
 * Tests unitaires — `useEnhancedSearch` (`frontend/app/hooks/useEnhancedSearch.ts`).
 *
 * Contexte (incident 429 PROD 2026-07-03) : le endpoint backend
 * `GET /api/search-existing/autocomplete` est DÉSACTIVÉ (commenté dans
 * `search-enhanced-existing.controller.ts`, renvoyait toujours `suggestions: []`).
 * Le hook l'appelait pourtant à CHAQUE frappe (via `useEnhancedAutocomplete` dans
 * `SearchBarEnhancedHomepage`), produisant une requête morte (404/429) qui
 * consommait le budget du rate-limiter partagé par IP (`@nestjs/throttler`,
 * `cf-connecting-ip`). Ce test verrouille le contrat : le client ne sollicite pas
 * une route désactivée, mais la recherche réelle (`/search`) continue de marcher.
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useEnhancedSearch } from "~/hooks/useEnhancedSearch";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("useEnhancedSearch", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn(() => Promise.resolve(jsonResponse({ suggestions: [] })));
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("does not call the disabled /api/search-existing/autocomplete route and returns []", async () => {
    const { result } = renderHook(() => useEnhancedSearch());
    // Flush the mount-time `loadMetrics` effect so its setState runs inside act.
    await act(async () => {});

    const suggestions = await result.current.autocomplete("90915YZZM3");

    expect(suggestions).toEqual([]);
    const autocompleteCalls = fetchSpy.mock.calls.filter(([url]) =>
      String(url).includes("/api/search-existing/autocomplete"),
    );
    expect(autocompleteCalls).toHaveLength(0);
  });

  it("still performs the real search against /api/search-existing/search", async () => {
    fetchSpy.mockImplementation((url: string) =>
      Promise.resolve(
        String(url).includes("/search")
          ? jsonResponse({ items: [{ id: 1 }], total: 1 })
          : jsonResponse({ suggestions: [] }),
      ),
    );

    const { result } = renderHook(() => useEnhancedSearch());
    let data: Awaited<ReturnType<typeof result.current.search>>;
    await act(async () => {
      data = await result.current.search({ query: "filtre huile" });
    });

    expect(data?.total).toBe(1);
    const searchCalls = fetchSpy.mock.calls.filter(([url]) =>
      String(url).includes("/api/search-existing/search"),
    );
    expect(searchCalls).toHaveLength(1);
  });
});

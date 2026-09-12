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

import {
  useEnhancedAutocomplete,
  useEnhancedSearch,
  useEnhancedSearchWithDebounce,
} from "~/hooks/useEnhancedSearch";

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
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("does not request unused metrics when mounted", async () => {
    const { unmount } = renderHook(() => useEnhancedSearch());
    await act(async () => {});

    expect(fetchSpy).not.toHaveBeenCalled();
    unmount();
  });

  it("only requests a real search after the debounce delay", async () => {
    vi.useFakeTimers();
    const { result, unmount } = renderHook(() =>
      useEnhancedSearchWithDebounce("", 300),
    );
    await act(async () => {});
    expect(fetchSpy).not.toHaveBeenCalled();

    act(() => result.current.setQuery("plaquette"));
    await act(async () => vi.advanceTimersByTimeAsync(299));
    expect(fetchSpy).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTimeAsync(1));

    expect(fetchSpy).toHaveBeenCalledExactlyOnceWith(
      "/api/search-existing/search?query=plaquette",
    );
    unmount();
  });

  it("does not request metrics or disabled suggestions through autocomplete", async () => {
    vi.useFakeTimers();
    const { result, unmount } = renderHook(() =>
      useEnhancedAutocomplete("plaquette", 300),
    );
    await act(async () => vi.advanceTimersByTimeAsync(300));

    expect(result.current.suggestions).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
    unmount();
  });

  it("does not call the disabled /api/search-existing/autocomplete route and returns []", async () => {
    const { result } = renderHook(() => useEnhancedSearch());
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

  it("keeps search failures observable and clears the loading state", async () => {
    fetchSpy.mockResolvedValue(new Response(null, { status: 503 }));
    const { result, unmount } = renderHook(() => useEnhancedSearch());
    await act(async () => {
      expect(await result.current.search({ query: "plaquette" })).toBeNull();
    });

    expect(result.current.error).toContain("503");
    expect(result.current.loading).toBe(false);
    expect(fetchSpy).toHaveBeenCalledExactlyOnceWith(
      "/api/search-existing/search?query=plaquette",
    );
    unmount();
  });
});

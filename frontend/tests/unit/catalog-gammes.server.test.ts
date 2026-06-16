import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  loadCatalogGammeIds,
  __resetCatalogGammeIdsCache,
} from "~/utils/seo/catalog-gammes.server";

const rows = [
  { id: 2, level: 1, is_displayed: true }, // ✓ catalog (niveau 1)
  { id: 54, level: 2, is_displayed: true }, // ✓ catalog (niveau 2)
  { id: 15, level: 0, is_displayed: true }, // ✗ niveau 0
  { id: 999, level: 1, is_displayed: false }, // ✗ non affiché
];

describe("loadCatalogGammeIds", () => {
  beforeEach(() => __resetCatalogGammeIdsCache());
  afterEach(() => vi.unstubAllGlobals());

  it("builds the set of displayed niveau-1/2 gamme IDs (the 232 catalog scope)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => rows })),
    );
    const ids = await loadCatalogGammeIds(1000);
    expect(ids).not.toBeNull();
    expect([...ids!].sort((a, b) => a - b)).toEqual([2, 54]);
  });

  it("returns null on fetch failure (caller falls back to legacy robots)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 500 })),
    );
    expect(await loadCatalogGammeIds(1000)).toBeNull();
  });

  it("caches within TTL (single backend call)", async () => {
    const f = vi.fn(async () => ({ ok: true, json: async () => rows }));
    vi.stubGlobal("fetch", f);
    await loadCatalogGammeIds(1000);
    await loadCatalogGammeIds(1000 + 60_000); // < 30 min TTL
    expect(f).toHaveBeenCalledTimes(1);
  });
});

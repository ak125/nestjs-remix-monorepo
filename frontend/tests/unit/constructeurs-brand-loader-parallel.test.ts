/**
 * PR #8 (audit LCP 2026-07-14 §2C) — le loader de la page marque
 * `/constructeurs/{brand}.html` enchaînait `getBrandPageData` PUIS `getR7Content`
 * en SÉQUENTIEL alors que les deux ne dépendent que de `marque_id` (2 RTT loopback
 * additifs → TTFB). Ce test épingle :
 *   1. le parallélisme (les deux appels partent avant que le 1er ne résolve) ;
 *   2. la préservation du gate 410 (marque_display===0) et du happy-path.
 * getR7Content ne rejette jamais (return null interne) — pas de floating rejection.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

import { loader } from "~/routes/constructeurs.$brand[.]html";

const { getBrandPageData, getR7Content } = vi.hoisted(() => ({
  getBrandPageData: vi.fn(),
  getR7Content: vi.fn(),
}));

vi.mock("~/utils/logger", () => ({
  logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));
vi.mock("~/services/api/brand.api", () => ({
  brandApi: { getBrandPageData, getR7Content },
}));

const call = () =>
  loader({
    params: { brand: "bmw-33" },
    request: new Request("https://www.automecanik.com/constructeurs/bmw-33.html"),
    context: {},
  } as never);

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => {
  getBrandPageData.mockReset();
  getR7Content.mockReset();
});

describe("constructeurs.$brand[.]html loader — parallélise getBrandPageData + getR7Content", () => {
  it("dispatche les DEUX appels avant que getBrandPageData ne résolve (parallélisme)", async () => {
    const brand = deferred<{ success: boolean; data: unknown }>();
    getBrandPageData.mockReturnValue(brand.promise);
    getR7Content.mockResolvedValue(null);

    const p = call(); // ne pas await : getBrandPageData est encore pending
    await Promise.resolve(); // flush microtasks

    // Cœur de la régression : en séquentiel, getR7Content n'est PAS encore appelé.
    expect(getBrandPageData).toHaveBeenCalledWith(33);
    expect(getR7Content).toHaveBeenCalledWith(33);

    brand.resolve({ success: true, data: { brand: { marque_display: 1 } } });
    await p;
  });

  it("happy-path : retourne les données marque + r7Content", async () => {
    getBrandPageData.mockResolvedValue({
      success: true,
      data: { brand: { marque_display: 1 }, popular_parts: [] },
    });
    getR7Content.mockResolvedValue({ h1: "BMW" });

    const result = (await call()) as { r7Content: unknown; brand: unknown };
    expect(result.brand).toEqual({ marque_display: 1 });
    expect(result.r7Content).toEqual({ h1: "BMW" });
    expect(getBrandPageData).toHaveBeenCalledWith(33);
    expect(getR7Content).toHaveBeenCalledWith(33);
  });

  it("gate 410 préservé : marque_display===0 → 410 Gone noindex,follow", async () => {
    getBrandPageData.mockResolvedValue({
      success: true,
      data: { brand: { marque_display: 0 } },
    });
    getR7Content.mockResolvedValue(null);

    let thrown: Response | undefined;
    try {
      await call();
    } catch (e) {
      thrown = e as Response;
    }
    expect(thrown).toBeInstanceOf(Response);
    expect(thrown?.status).toBe(410);
    expect(thrown?.headers.get("X-Robots-Tag")).toBe("noindex, follow");
  });

  it("échec brand → 404 (le résultat r7 ne fuit pas)", async () => {
    getBrandPageData.mockResolvedValue({ success: false, data: null });
    getR7Content.mockResolvedValue({ h1: "leak?" });

    let thrown: Response | undefined;
    try {
      await call();
    } catch (e) {
      thrown = e as Response;
    }
    expect(thrown).toBeInstanceOf(Response);
    expect(thrown?.status).toBe(404);
  });
});

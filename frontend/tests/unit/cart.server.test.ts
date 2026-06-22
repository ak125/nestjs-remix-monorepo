import { afterEach, describe, expect, it, vi } from "vitest";
import { getCart } from "~/services/cart.server";

vi.mock("~/utils/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), log: vi.fn(), debug: vi.fn() },
}));

function makeRequest(): Request {
  return new Request("http://localhost/cart", {
    headers: { Cookie: "connect.sid=abc" },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("cartServerService.getCart — no silent fallback", () => {
  it("normalise un panier rempli (200)", async () => {
    const backend = {
      user_id: "usr_1",
      items: [{ id: "i1", product_id: "p1", quantity: 2, price: 10 }],
      totals: { total_items: 2, total: 20, subtotal: 20 },
      metadata: {},
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(backend), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const cart = await getCart(makeRequest());
    expect(cart.items).toHaveLength(1);
    expect(cart.summary.total_price).toBe(20);
    // Aucun article factice (« T-Shirt Premium ») ne doit apparaître.
    expect(cart.items.some((i) => i.product_name === "T-Shirt Premium")).toBe(
      false,
    );
  });

  it("traite un panier vide (200) comme un succès, pas une erreur", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ items: [], totals: {}, metadata: {} }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const cart = await getCart(makeRequest());
    expect(cart.items).toEqual([]);
    expect(cart.summary.total_items).toBe(0);
  });

  it("PROPAGE une erreur si le backend répond non-2xx (jamais de panier démo)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("boom", { status: 500, statusText: "Internal Server Error" }),
      ),
    );

    await expect(getCart(makeRequest())).rejects.toThrow(/responded 500/);
  });

  it("PROPAGE une erreur réseau (fetch rejette) — pas de fallback silencieux", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
    );

    await expect(getCart(makeRequest())).rejects.toThrow(/unreachable/);
  });
});

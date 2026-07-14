import  { type ActionFunctionArgs } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { action } from "~/routes/checkout";

vi.mock("~/utils/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), log: vi.fn(), debug: vi.fn() },
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// INC tunnel paiement 2026-05→07 : le POST /api/orders/guest régénère la
// session backend, donc le cookie porté par l'action est mort pour tout fetch
// ultérieur. Ce test d'intégration de l'action grave l'invariant : le happy
// path checkout ne fait AUCUN fetch après le POST de création — le redirect
// Paybox est construit depuis la réponse du POST.
function stubFetchRouter(overrides?: { orderResponse?: Record<string, unknown> }) {
  const calls: Array<{ url: string; method: string }> = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    calls.push({ url, method });

    if (url.includes("/api/cart")) {
      return new Response(
        JSON.stringify({
          user_id: "guest-session",
          items: [
            {
              id: "i1",
              product_id: "12345",
              product_name: "Plaquettes de frein",
              product_sku: "REF-123",
              quantity: 1,
              price: 62.35,
            },
          ],
          totals: { total_items: 1, total: 62.35, subtotal: 62.35 },
          metadata: {},
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (url.endsWith("/api/orders/guest") && method === "POST") {
      return new Response(
        JSON.stringify(
          overrides?.orderResponse ?? {
            ord_id: "ORD-42",
            ord_total_ttc: "62.35",
            ord_is_pay: "0",
            customer: { cst_mail: "client@example.com" },
            resumeToken: "tok-1",
          },
        ),
        { status: 201, headers: { "Content-Type": "application/json" } },
      );
    }

    // Tout autre fetch (dont GET /api/orders/:id) = régression → échec net
    throw new Error(`Fetch inattendu dans le happy path checkout: ${method} ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, calls };
}

function makeGuestCheckoutRequest(): Request {
  const form = new FormData();
  form.set("guestEmail", "client@example.com");
  form.set("civility", "M.");
  form.set("firstName", "Jean");
  form.set("lastName", "Testeur");
  form.set("address", "12 rue de la Paix");
  form.set("zipCode", "75001");
  form.set("city", "Paris");
  form.set("country", "France");
  form.set("phone", "0601020304");
  form.set("paymentMethod", "cyberplus");
  form.set("acceptTerms", "on");
  return new Request("http://localhost/checkout", {
    method: "POST",
    headers: { Cookie: "connect.sid=abc" },
    body: form,
  });
}

const contextStub = {
  get: () => undefined,
} as unknown as ActionFunctionArgs["context"];

describe("checkout action — happy path guest sans re-GET (INC 2026-05→07)", () => {
  it("retourne ok + redirectUrl Paybox construit depuis la réponse du POST", async () => {
    const { calls } = stubFetchRouter();

    const result = (await action({
      request: makeGuestCheckoutRequest(),
      context: contextStub,
      params: {},
    } as ActionFunctionArgs)) as Record<string, unknown>;

    expect(result).toMatchObject({
      ok: true,
      orderId: "ORD-42",
      resumeToken: "tok-1",
    });
    expect(result.redirectUrl).toBe(
      "/api/paybox/redirect?orderId=ORD-42&amount=62.35&email=client%40example.com",
    );

    // Exactement 2 fetches : cart + POST création. Aucun GET /api/orders/:id.
    const orderGets = calls.filter(
      (c) => c.method === "GET" && /\/api\/orders\/ORD-/.test(c.url),
    );
    expect(orderGets).toEqual([]);
    expect(calls.some((c) => c.url.endsWith("/api/orders/guest"))).toBe(true);
  });

  it("email absent de la réponse du POST → fallback sur guestEmail du formulaire", async () => {
    stubFetchRouter({
      orderResponse: {
        ord_id: "ORD-43",
        ord_total_ttc: "62.35",
        ord_is_pay: "0",
        // pas de customer.cst_mail
        resumeToken: "tok-2",
      },
    });

    const result = (await action({
      request: makeGuestCheckoutRequest(),
      context: contextStub,
      params: {},
    } as ActionFunctionArgs)) as Record<string, unknown>;

    expect(result).toMatchObject({ ok: true, orderId: "ORD-43" });
    expect(String(result.redirectUrl)).toContain("email=client%40example.com");
  });
});

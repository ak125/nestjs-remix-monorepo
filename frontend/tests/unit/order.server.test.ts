import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createCheckoutOrder,
  extractPaymentFieldsFromCreateOrderResponse,
  type CreateCheckoutOrderPayload,
} from "~/services/order.server";

vi.mock("~/utils/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), log: vi.fn(), debug: vi.fn() },
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// INC tunnel paiement 2026-05→07 : le POST /api/orders/guest régénère la
// session backend, donc l'action checkout ne peut PAS re-GET la commande avec
// son cookie. Tout ce qu'il faut pour le redirect Paybox doit sortir de la
// réponse du POST — ces tests figent ce contrat.
describe("extractPaymentFieldsFromCreateOrderResponse", () => {
  it("lit total/email/isPaid depuis la shape plate getOrderById", () => {
    expect(
      extractPaymentFieldsFromCreateOrderResponse({
        ord_id: "ORD-1",
        ord_total_ttc: "62.35",
        ord_is_pay: "0",
        customer: { cst_mail: "client@example.com" },
      }),
    ).toEqual({
      totalTTC: 62.35,
      customerEmail: "client@example.com",
      isPaid: false,
    });
  });

  it("lit la shape enveloppée { data: ... } (défensif, idiome existant)", () => {
    expect(
      extractPaymentFieldsFromCreateOrderResponse({
        data: {
          ord_total_ttc: "41.12",
          ord_is_pay: "1",
          customer: { cst_mail: "x@y.fr" },
        },
      }),
    ).toEqual({ totalTTC: 41.12, customerEmail: "x@y.fr", isPaid: true });
  });

  it("champs absents → totalTTC 0 / email vide / isPaid false (échec visible en aval, pas de devinette)", () => {
    expect(extractPaymentFieldsFromCreateOrderResponse({})).toEqual({
      totalTTC: 0,
      customerEmail: "",
      isPaid: false,
    });
  });
});

describe("createCheckoutOrder — contrat redirect Paybox sans re-GET", () => {
  function makeRequest(): Request {
    return new Request("http://localhost/checkout", {
      method: "POST",
      headers: { Cookie: "connect.sid=abc" },
    });
  }

  const payload = {
    guestEmail: "client@example.com",
    orderLines: [],
    billingAddress: {},
    shippingAddress: {},
    customerNote: "",
    shippingMethod: "colissimo",
  } as unknown as CreateCheckoutOrderPayload;

  it("porte totalTTC + customerEmail + isPaid depuis la réponse du POST", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            ord_id: "ORD-42",
            ord_total_ttc: "200.36",
            ord_is_pay: "0",
            customer: { cst_mail: "client@example.com" },
            resumeToken: "tok-1",
          }),
          { status: 201 },
        ),
      ),
    );

    const result = await createCheckoutOrder(makeRequest(), payload);
    expect(result).toEqual({
      success: true,
      orderId: "ORD-42",
      resumeToken: "tok-1",
      totalTTC: 200.36,
      customerEmail: "client@example.com",
      isPaid: false,
    });
  });

  it("un seul fetch (POST) — aucun GET /api/orders/:id ne doit suivre", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ord_id: "ORD-43",
          ord_total_ttc: "10.00",
          ord_is_pay: "0",
          customer: { cst_mail: "a@b.fr" },
        }),
        { status: 201 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await createCheckoutOrder(makeRequest(), payload);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/orders/guest");
  });
});

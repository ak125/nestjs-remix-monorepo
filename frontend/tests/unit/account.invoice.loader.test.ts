import { type LoaderFunctionArgs } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loader } from "~/routes/account_.orders.$orderId_.invoice";

vi.mock("~/utils/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), log: vi.fn(), debug: vi.fn() },
}));

const requireAuth = vi.fn();
vi.mock("~/auth/unified.server", () => ({
  requireAuth: (request: Request) => requireAuth(request),
}));

beforeEach(() => {
  requireAuth.mockResolvedValue({ id: "cst-1" });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// La page facture lit la commande via le backend, qui ne sert que les
// commandes du client connecté et calcule l'état de paiement. La page ne
// décide rien seule : elle traduit la réponse.
const ADDRESS = {
  civility: "M.",
  firstName: "Jean",
  lastName: "Martin",
  address: "1 rue de l'Exemple",
  addressLine2: null,
  zipCode: "75001",
  city: "Paris",
  country: "France",
};

function apiInvoice(overrides: Record<string, unknown> = {}) {
  return {
    ord_id: "500",
    ord_parent: "0",
    ord_date: "2026-09-01T10:00:00Z",
    ord_date_pay: null,
    ord_ords_id: "1",
    ord_amount_ttc: "40.00",
    ord_deposit_ttc: "0",
    ord_shipping_fee_ttc: "5.90",
    ord_total_ttc: "45.90",
    lines: [
      {
        orl_id: "9",
        orl_pg_name: "Filtre à huile",
        orl_art_quantity: "2",
        orl_art_price_sell_unit_ttc: "20.00",
        orl_art_price_sell_ttc: "40.00",
      },
    ],
    billing_address: ADDRESS,
    delivery_address: ADDRESS,
    payment_state: "payable",
    payment_refusal: null,
    ...overrides,
  };
}

function stubBackend(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function load(orderId: string | undefined) {
  return loader({
    request: new Request(`http://localhost/account/orders/${orderId}/invoice`, {
      headers: { Cookie: "connect.sid=abc" },
    }),
    params: { orderId },
    context: {},
  } as unknown as LoaderFunctionArgs);
}

async function loadError(orderId: string | undefined) {
  const thrown = await load(orderId).catch((e: unknown) => e);
  expect(thrown).toBeInstanceOf(Response);
  return thrown as Response;
}

describe("account invoice loader", () => {
  it("interroge le backend pour cette commande, avec la session du client", async () => {
    const fetchMock = stubBackend(200, { success: true, data: apiInvoice() });
    await load("50 0");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).pathname).toBe("/api/orders/50%200/invoice");
    expect((init.headers as Record<string, string>).Cookie).toBe(
      "connect.sid=abc",
    );
  });

  it("exige une connexion avant tout appel au backend", async () => {
    const redirect = new Response(null, {
      status: 302,
      headers: { Location: "/login" },
    });
    requireAuth.mockRejectedValue(redirect);
    const fetchMock = stubBackend(200, { data: apiInvoice() });
    expect(await loadError("500")).toBe(redirect);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("commande ordinaire payée : facture, sans bouton de paiement", async () => {
    stubBackend(200, {
      data: apiInvoice({
        payment_state: "paid",
        ord_date_pay: "2026-09-02T10:00:00Z",
      }),
    });
    const { invoice } = await load("500");
    expect(invoice).toEqual({
      id: "500",
      number: "500/A",
      date: "2026-09-01T10:00:00Z",
      datePay: "2026-09-02T10:00:00Z",
      isPaid: true,
      isSupplementOrder: false,
      parentOrderId: null,
      canPay: false,
      paymentRefusal: null,
      amountTTC: 40,
      depositTTC: 0,
      shippingFeeTTC: 5.9,
      totalTTC: 45.9,
      billingAddress: ADDRESS,
      deliveryAddress: ADDRESS,
      lines: [
        {
          id: "9",
          productName: "Filtre à huile",
          unitPriceTTC: 20,
          quantity: 2,
          totalPriceTTC: 40,
        },
      ],
    });
  });

  it("supplément payable : le bouton de paiement est proposé", async () => {
    stubBackend(200, { data: apiInvoice({ ord_parent: "400" }) });
    const { invoice } = await load("500");
    expect(invoice.isSupplementOrder).toBe(true);
    expect(invoice.parentOrderId).toBe("400");
    expect(invoice.canPay).toBe(true);
  });

  it("supplément annulé : pas de bouton, le motif du backend est affiché", async () => {
    const refusal =
      "Cette commande a été annulée : elle ne peut plus être payée.";
    stubBackend(200, {
      data: apiInvoice({
        ord_parent: "400",
        ord_ords_id: "2",
        payment_state: "not_payable",
        payment_refusal: refusal,
      }),
    });
    const { invoice } = await load("500");
    expect(invoice.canPay).toBe(false);
    expect(invoice.isPaid).toBe(false);
    expect(invoice.paymentRefusal).toBe(refusal);
  });

  it("commande ordinaire non payée : jamais de bouton sur cette page", async () => {
    stubBackend(200, { data: apiInvoice({ payment_state: "payable" }) });
    const { invoice } = await load("500");
    expect(invoice.canPay).toBe(false);
  });

  it("adresses absentes : transmises telles quelles (null)", async () => {
    stubBackend(200, {
      data: apiInvoice({ billing_address: null, delivery_address: null }),
    });
    const { invoice } = await load("500");
    expect(invoice.billingAddress).toBeNull();
    expect(invoice.deliveryAddress).toBeNull();
  });

  it("ne renvoie que la facture : ni client ni session dans les données", async () => {
    stubBackend(200, { data: apiInvoice() });
    const data = await load("500");
    expect(Object.keys(data)).toEqual(["invoice"]);
  });

  it("commande introuvable ou d'un autre client (404 backend) → 404", async () => {
    stubBackend(404, { statusCode: 404, message: "Commande non trouvée" });
    expect((await loadError("500")).status).toBe(404);
  });

  it("erreur backend → 500", async () => {
    stubBackend(500, { statusCode: 500 });
    expect((await loadError("500")).status).toBe(500);
  });

  it("backend injoignable → 500", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
    );
    expect((await loadError("500")).status).toBe(500);
  });

  it("réponse sans données → 500", async () => {
    stubBackend(200, { success: true });
    expect((await loadError("500")).status).toBe(500);
  });

  it("identifiant absent → 404 sans appel au backend", async () => {
    const fetchMock = stubBackend(200, { data: apiInvoice() });
    expect((await loadError(undefined)).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// @vitest-environment node
/** Facture client : `___xtr_order.ord_is_pay` est une colonne texte ('1' / '0').
 * Une commande réglée ('1') doit donner `isPaid: true` ; les formes numérique
 * et booléenne déjà reconnues restent reconnues. Valeurs fictives uniquement. */

import { type LoaderFunctionArgs } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loader } from "~/routes/account_.orders.$orderId.invoice";

vi.mock("~/auth/unified.server", () => ({
  requireAuth: vi.fn(async () => ({ id: "CST-FICTIF-1" })),
}));

function orderApiAnswers(ordIsPay: unknown) {
  const order = {
    ord_id: "ORD-FICTIF-1",
    ord_cst_id: "CST-FICTIF-1",
    ord_parent: "0",
    ord_date: "2026-10-04T00:00:00.000Z",
    ord_total_ttc: "49.90",
    ord_is_pay: ordIsPay,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      const body = String(input).includes("___xtr_order_line?") ? [] : [order];
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
}

async function loadIsPaid(ordIsPay: unknown) {
  orderApiAnswers(ordIsPay);
  const data = await loader({
    params: { orderId: "ORD-FICTIF-1" },
    request: new Request(
      "http://localhost/account/orders/ORD-FICTIF-1/invoice",
    ),
    context: {},
  } as unknown as LoaderFunctionArgs);
  return data.invoice.isPaid;
}

describe("facture client — commande réglée", () => {
  beforeEach(() => {
    vi.stubEnv("SUPABASE_URL", "http://supabase.invalid");
    vi.stubEnv("SUPABASE_ANON_KEY", "cle-fictive");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("ord_is_pay = '1' (format de la colonne) : facture réglée", async () => {
    expect(await loadIsPaid("1")).toBe(true);
  });

  it.each([[1], [true]])("ord_is_pay = %j : toujours réglée", async (value) => {
    expect(await loadIsPaid(value)).toBe(true);
  });

  it.each([["0"], [0], [false], [null], [undefined]])(
    "ord_is_pay = %j : non réglée",
    async (value) => {
      expect(await loadIsPaid(value)).toBe(false);
    },
  );
});

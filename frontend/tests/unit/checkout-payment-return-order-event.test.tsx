/** Page de retour de paiement : l'événement funnel `r2_order_placed` porte
 * l'ord_id (`Ref` Paybox = PBX_CMD), jamais le n° d'autorisation (`Auto`).
 * GA4 `trackPurchase` reste inchangé (txId = transactionId || orderId).
 * Valeurs fictives uniquement. */

import { cleanup, render, waitFor } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PaymentReturnPage from "~/routes/checkout-payment-return";
import { trackPurchase } from "~/utils/analytics";
import { emitFunnel } from "~/utils/funnel-beacon";

vi.mock("~/utils/analytics", () => ({ trackPurchase: vi.fn() }));
vi.mock("~/utils/funnel-beacon", () => ({
  emitFunnel: vi.fn(),
  getFunnelSessionId: () => "sid-test",
  classifyReferrer: () => "direct",
}));
vi.mock("~/services/payment.server", () => ({
  processPaymentReturn: vi.fn(),
}));

const AUTH = "AUTH-FICTIF-1";
const ORD = "ORD-FICTIF-1";

function makeResult(overrides: Record<string, unknown> = {}) {
  return {
    status: "SUCCESS",
    transactionId: AUTH,
    orderId: ORD,
    amount: 49.9,
    date: "2026-10-04T00:00:00.000Z",
    ...overrides,
  };
}

function renderPage(result: ReturnType<typeof makeResult>) {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: PaymentReturnPage,
      HydrateFallback: () => null,
      loader: () => ({ result }),
    },
  ]);
  return render(<Stub initialEntries={["/"]} />);
}

describe("checkout-payment-return — événement r2_order_placed", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.mocked(trackPurchase).mockClear();
    vi.mocked(emitFunnel).mockClear();
  });
  afterEach(cleanup);

  it("SUCCESS : order_id = orderId (ord_id), jamais transactionId", async () => {
    renderPage(makeResult());
    await waitFor(() => expect(emitFunnel).toHaveBeenCalledTimes(1));
    expect(emitFunnel).toHaveBeenCalledWith({
      event_type: "r2_order_placed",
      payload: {
        session_id: "sid-test",
        order_id: ORD,
        item_count: 1,
        revenue_cents: 4990,
        referrer: "direct",
      },
    });
    expect(trackPurchase).toHaveBeenCalledWith(AUTH, 49.9);
  });

  it("SUCCESS sans orderId : aucun événement funnel, GA4 inchangé", async () => {
    renderPage(makeResult({ orderId: "" }));
    await waitFor(() => expect(trackPurchase).toHaveBeenCalledWith(AUTH, 49.9));
    expect(emitFunnel).not.toHaveBeenCalled();
  });

  it("GA4 : txId retombe sur orderId quand transactionId est vide", async () => {
    renderPage(makeResult({ transactionId: "" }));
    await waitFor(() => expect(trackPurchase).toHaveBeenCalledWith(ORD, 49.9));
    expect(vi.mocked(emitFunnel).mock.calls[0][0].payload).toMatchObject({
      order_id: ORD,
    });
  });

  it("déjà suivi dans la session : ni GA4 ni événement funnel", async () => {
    sessionStorage.setItem(`purchase_tracked_${AUTH}`, "1");
    const { findByText } = renderPage(makeResult());
    await findByText(/CGV/);
    expect(trackPurchase).not.toHaveBeenCalled();
    expect(emitFunnel).not.toHaveBeenCalled();
  });

  it.each(["REFUSED", "CANCELLED", "PENDING", "ERROR"])(
    "statut %s : ni GA4 ni événement funnel",
    async (status) => {
      const { findByText } = renderPage(makeResult({ status }));
      await findByText(/CGV/);
      expect(trackPurchase).not.toHaveBeenCalled();
      expect(emitFunnel).not.toHaveBeenCalled();
    },
  );
});

/** Page de retour de paiement, paiement refusé ou annulé : le bouton de nouvelle
 * tentative doit ramener au paiement de CETTE commande. Le tunnel pose le jeton
 * de reprise dans sessionStorage (`pendingOrder`) ; quand il correspond à la
 * commande, le bouton mène à `/checkout/resume?token=…`. Sans jeton pour cette
 * commande, l'ancien lien reste le repli.
 * Paiement réussi : la sauvegarde locale du panier est effacée (le panier est
 * devenu une commande payée). Valeurs fictives uniquement. */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PaymentReturnPage from "~/routes/checkout-payment-return";

vi.mock("~/utils/analytics", () => ({ trackPurchase: vi.fn() }));
vi.mock("~/utils/funnel-beacon", () => ({
  emitFunnel: vi.fn(),
  getFunnelSessionId: () => "sid-test",
  classifyReferrer: () => "direct",
}));
vi.mock("~/services/payment.server", () => ({
  processPaymentReturn: vi.fn(),
}));

const ORD = "ORD-FICTIF-1";
const BACKUP_KEY = "automecanik_cart_backup";
const FALLBACK_HREF = `/checkout-payment?orderId=${ORD}`;

function makeResult(status: string) {
  return {
    status,
    transactionId: "AUTH-FICTIF-1",
    orderId: ORD,
    amount: 49.9,
    date: "2026-10-04T00:00:00.000Z",
  };
}

function renderPage(status: string) {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: PaymentReturnPage,
      HydrateFallback: () => null,
      loader: () => ({ result: makeResult(status) }),
    },
  ]);
  return render(<Stub initialEntries={["/"]} />);
}

function setPendingOrder(orderId: string, resumeToken?: string) {
  sessionStorage.setItem(
    "pendingOrder",
    JSON.stringify({ orderId, resumeToken, createdAt: Date.now() }),
  );
}

async function retryHref(label: string) {
  const link = await screen.findByRole("link", { name: label });
  return () => link.getAttribute("href");
}

describe("checkout-payment-return — bouton de nouvelle tentative", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });
  afterEach(cleanup);

  it.each([
    ["REFUSED", "Reessayer le paiement"],
    ["CANCELLED", "Reprendre le paiement"],
  ])(
    "%s avec jeton de reprise de cette commande : lien vers la reprise",
    async (status, label) => {
      setPendingOrder(ORD, "jeton fictif/1");
      renderPage(status);
      const href = await retryHref(label);
      await waitFor(() =>
        expect(href()).toBe("/checkout/resume?token=jeton%20fictif%2F1"),
      );
    },
  );

  it.each([
    ["REFUSED", "Reessayer le paiement"],
    ["CANCELLED", "Reprendre le paiement"],
  ])(
    "%s sans commande en attente : lien de repli inchangé",
    async (status, label) => {
      renderPage(status);
      const href = await retryHref(label);
      expect(href()).toBe(FALLBACK_HREF);
    },
  );

  it("jeton d'une autre commande : jamais utilisé, lien de repli", async () => {
    setPendingOrder("ORD-FICTIF-2", "jeton-autre-commande");
    renderPage("REFUSED");
    const href = await retryHref("Reessayer le paiement");
    // Laisse passer les effets : le lien ne doit pas basculer.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(href()).toBe(FALLBACK_HREF);
  });

  it("commande en attente sans jeton : lien de repli", async () => {
    setPendingOrder(ORD);
    renderPage("REFUSED");
    const href = await retryHref("Reessayer le paiement");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(href()).toBe(FALLBACK_HREF);
  });

  it("sessionStorage illisible : lien de repli, pas d'erreur", async () => {
    sessionStorage.setItem("pendingOrder", "{pas du json");
    renderPage("REFUSED");
    const href = await retryHref("Reessayer le paiement");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(href()).toBe(FALLBACK_HREF);
  });
});

describe("checkout-payment-return — sauvegarde locale du panier", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    localStorage.setItem(
      BACKUP_KEY,
      JSON.stringify({
        items: [{ product_id: 1001, quantity: 2 }],
        savedAt: Date.now(),
      }),
    );
  });
  afterEach(cleanup);

  it("SUCCESS : la sauvegarde du panier payé est effacée", async () => {
    renderPage("SUCCESS");
    await screen.findByText("Paiement reussi !");
    await waitFor(() => expect(localStorage.getItem(BACKUP_KEY)).toBeNull());
  });

  it.each(["REFUSED", "CANCELLED", "PENDING", "ERROR"])(
    "%s : la sauvegarde est conservée",
    async (status) => {
      renderPage(status);
      await screen.findByRole("heading", { level: 1 });
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(localStorage.getItem(BACKUP_KEY)).not.toBeNull();
    },
  );
});

/**
 * Mandat BM — OrderBillingPanel (prêt à brancher, non branché).
 *
 * Verrouille : lecture de l'état, saisie d'une réduction (montant à encaisser
 * rendu), d'un supplément (lien envoyé), de l'état Verifone « encaissée »
 * (montant obligatoire côté backend, facture émise affichée), refus du
 * backend affiché tel quel, 403 ⇒ « facturation non activée », facture
 * émise ⇒ lien PDF et plus aucun formulaire.
 */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  OrderBillingPanel,
  type OrderBilling,
} from "~/components/admin/OrderBillingPanel";

const ID = "ORD-1";
const BASE = `/api/admin/orders/${ID}/billing`;

const state = (over: Partial<OrderBilling> = {}): OrderBilling => ({
  orderId: ID,
  paid: true,
  shippedAt: null,
  totalTtc: "109.90",
  expectedCaptureTtc: "109.90",
  capture: null,
  paymentVoid: null,
  adjustments: [],
  supplements: [],
  invoice: null,
  ...over,
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function submit(formName: string, values: Record<string, string>) {
  const form = screen.getByRole("form", { name: formName });
  for (const [label, value] of Object.entries(values)) {
    const el = screen.getByLabelText(label);
    fireEvent.change(el, { target: { value } });
  }
  fireEvent.submit(form);
}

function postBody(callIndex: number) {
  const [url, init] = fetchMock.mock.calls[callIndex];
  return { url, method: init?.method, body: JSON.parse(init?.body ?? "null") };
}

describe("OrderBillingPanel", () => {
  it("affiche l'état lu (montant à encaisser, état saisi, ajustements)", async () => {
    fetchMock.mockResolvedValueOnce(
      json(
        state({
          expectedCaptureTtc: "94.90",
          capture: {
            ocs_state: "authorized",
            ocs_captured_amount_cents: null,
            ocs_source: "manual",
          },
          adjustments: [
            {
              opa_kind: "reduction",
              opa_amount_ttc_cents: 1500,
              opa_reason: "Pièce moins chère",
            },
          ],
        }),
      ),
    );
    render(<OrderBillingPanel orderId={ID} />);
    expect(
      (await screen.findByTestId("expected-capture")).textContent,
    ).toContain("94,90 €");
    expect(screen.getByTestId("capture-state").textContent).toContain(
      "Autorisée, non encaissée",
    );
    expect(
      screen.getByRole("list", { name: "Ajustements" }).textContent,
    ).toContain("Réduction 15,00 € — Pièce moins chère");
    expect(fetchMock).toHaveBeenCalledWith(BASE, {
      credentials: "same-origin",
    });
    // Mêmes valeurs que CaptureStateSchema (backend) et la contrainte CHECK
    // de __order_capture_state : une valeur de plus serait refusée en 400.
    const select = screen.getByRole("combobox", {
      name: "État Verifone",
    }) as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.value)).toEqual([
      "authorized",
      "captured",
      "cancelled",
      "refunded",
    ]);
  });

  it("réduction : POST du montant et du motif, montant à encaisser affiché", async () => {
    fetchMock
      .mockResolvedValueOnce(json(state()))
      .mockResolvedValueOnce(
        json({
          orderId: ID,
          reductionTtc: "15.00",
          amountToCaptureTtc: "94.90",
        }),
      )
      .mockResolvedValueOnce(json(state({ expectedCaptureTtc: "94.90" })));
    render(<OrderBillingPanel orderId={ID} />);
    await screen.findByTestId("expected-capture");
    submit("Moins cher", {
      "Réduction TTC (€)": "15,00",
      "Motif de la réduction": "Pièce moins chère",
    });
    expect((await screen.findByRole("status")).textContent).toContain(
      "encaisser 94,90 € dans Verifone",
    );
    expect(postBody(1)).toEqual({
      url: `${BASE}/reduction`,
      method: "POST",
      body: { amountTtc: "15,00", reason: "Pièce moins chère" },
    });
  });

  it("supplément : lien envoyé au client", async () => {
    fetchMock
      .mockResolvedValueOnce(json(state()))
      .mockResolvedValueOnce(
        json({ supplementOrderId: "ORD-2", paymentUrl: "x", mail: "sent" }),
      )
      .mockResolvedValueOnce(json(state()));
    render(<OrderBillingPanel orderId={ID} />);
    await screen.findByTestId("expected-capture");
    submit("Plus cher", {
      "Supplément TTC (€)": "12,50",
      "Motif du supplément": "Référence plus chère",
    });
    expect((await screen.findByRole("status")).textContent).toContain(
      "Supplément ORD-2 créé, lien envoyé au client (mail : sent)",
    );
    expect(postBody(1).body).toEqual({
      amountTtc: "12,50",
      reason: "Référence plus chère",
    });
  });

  it("état Verifone « encaissée » : montant envoyé, facture émise affichée", async () => {
    fetchMock
      .mockResolvedValueOnce(json(state({ shippedAt: "2026-11-17T17:00:00Z" })))
      .mockResolvedValueOnce(
        json({
          orderId: ID,
          capture: {},
          invoice: {
            issued: true,
            invoiceNumber: "F2026-000001",
            mail: "sent",
          },
        }),
      )
      .mockResolvedValueOnce(
        json(
          state({
            shippedAt: "2026-11-17T17:00:00Z",
            invoice: { number: "F2026-000001", date: null, totalTtc: "109.90" },
          }),
        ),
      );
    render(<OrderBillingPanel orderId={ID} />);
    await screen.findByTestId("expected-capture");
    submit("État Verifone", { "Montant encaissé TTC (€)": "109,90" });
    expect((await screen.findByRole("status")).textContent).toContain(
      "Facture F2026-000001 émise (mail : sent).",
    );
    expect(postBody(1)).toEqual({
      url: `${BASE}/capture-state`,
      method: "POST",
      body: { state: "captured", capturedAmountTtc: "109,90" },
    });
    await waitFor(() =>
      expect(
        screen.getByRole("link", { name: "PDF" }).getAttribute("href"),
      ).toBe(`${BASE}/invoice.pdf`),
    );
    expect(screen.queryByRole("form", { name: "Moins cher" })).toBeNull();
  });

  it("facture en attente : raison du backend affichée", async () => {
    fetchMock
      .mockResolvedValueOnce(json(state({ shippedAt: "2026-11-17T17:00:00Z" })))
      .mockResolvedValueOnce(
        json({ issued: false, reason: "encaissement non confirmé" }),
      )
      .mockResolvedValueOnce(
        json(state({ shippedAt: "2026-11-17T17:00:00Z" })),
      );
    render(<OrderBillingPanel orderId={ID} />);
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Réessayer l'émission de la facture",
      }),
    );
    expect((await screen.findByRole("status")).textContent).toContain(
      "Facture en attente : encaissement non confirmé",
    );
    expect(postBody(1).url).toBe(`${BASE}/issue-invoice`);
  });

  it("refus du backend affiché tel quel, sans rechargement", async () => {
    fetchMock
      .mockResolvedValueOnce(json(state()))
      .mockResolvedValueOnce(
        json(
          { message: "Commande ORD-1 déjà encaissée : pas de réduction" },
          409,
        ),
      );
    render(<OrderBillingPanel orderId={ID} />);
    await screen.findByTestId("expected-capture");
    submit("Moins cher", {
      "Réduction TTC (€)": "1",
      "Motif de la réduction": "abc",
    });
    expect((await screen.findByRole("alert")).textContent).toContain(
      "déjà encaissée : pas de réduction",
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  // Complément BM n° 2 : paiement annulé ou remboursé dans Paybox.
  it.each([
    ["cancelled", "Paiement annulé"],
    ["refunded", "Remboursée — ne pas expédier"],
  ])(
    "paiement %s : motif affiché, facture, réduction et supplément désactivés",
    async (st, label) => {
      fetchMock.mockResolvedValueOnce(
        json(
          state({
            shippedAt: "2026-11-17T17:00:00Z",
            paymentVoid: { state: st, label },
          }),
        ),
      );
      render(<OrderBillingPanel orderId={ID} />);
      expect((await screen.findByTestId("payment-void")).textContent).toContain(
        label,
      );
      for (const name of [
        "Réessayer l'émission de la facture",
        "Enregistrer la réduction",
        "Envoyer le lien de supplément",
      ]) {
        const b = screen.getByRole("button", { name }) as HTMLButtonElement;
        expect(b.disabled).toBe(true);
        expect(b.title).toBe(label);
      }
      expect(
        (
          screen.getByRole("button", {
            name: "Enregistrer l'état",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false);
    },
  );

  it("drapeau éteint (403) : « facturation non activée »", async () => {
    fetchMock.mockResolvedValueOnce(json({ message: "Forbidden" }, 403));
    render(<OrderBillingPanel orderId={ID} />);
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Facturation non activée",
    );
    expect(screen.queryByRole("form")).toBeNull();
  });
});

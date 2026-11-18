/**
 * Complément BM n° 2 (2026-11-18) — commande payée dont le paiement est
 * annulé ou remboursé dans Paybox. Données inventées.
 *
 * Verrouille :
 * - fiche : lecture `enabled` / marque / drapeau éteint / erreur, une erreur
 *   n'étant jamais rendue comme « aucune marque » ;
 * - liste : badge du libellé backend sur la ligne concernée seulement,
 *   avertissement « État d'encaissement indisponible » sur une erreur, rien
 *   quand le drapeau est éteint, une seule demande pour la page.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OrdersTable } from "~/components/orders/OrdersTable";
import { readPaymentVoid } from "~/components/orders/payment-void";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("readPaymentVoid (fiche)", () => {
  it("marque rendue telle que donnée par le backend", async () => {
    await expect(
      readPaymentVoid(
        json({
          enabled: true,
          paymentVoid: {
            state: "refunded",
            label: "Remboursée — ne pas expédier",
          },
        }),
      ),
    ).resolves.toEqual({
      status: "ok",
      mark: { state: "refunded", label: "Remboursée — ne pas expédier" },
    });
  });

  it("aucune marque", async () => {
    await expect(
      readPaymentVoid(json({ enabled: true, paymentVoid: null })),
    ).resolves.toEqual({ status: "ok", mark: null });
  });

  it("drapeau éteint : off", async () => {
    await expect(
      readPaymentVoid(json({ enabled: false, paymentVoid: null })),
    ).resolves.toEqual({ status: "off" });
  });

  it.each([
    [json({ message: "Forbidden" }, 403), 403],
    [json({ message: "Lecture impossible" }, 500), 500],
    [new Response("<html>", { status: 200 }), 200],
  ])(
    "erreur ou corps illisible : indisponible, jamais « aucune marque »",
    async (res, code) => {
      await expect(readPaymentVoid(res)).resolves.toEqual({
        status: "unavailable",
        httpStatus: code,
      });
    },
  );
});

const order = (id: string) => ({
  ord_id: id,
  ord_cst_id: "1",
  ord_date: "2026-11-18T10:00:00Z",
  ord_total_ttc: "50.00",
  ord_is_pay: "1",
  ord_ords_id: "3",
  customerName: "Client Essai",
});

function renderTable(ids: string[]) {
  return render(
    <MemoryRouter>
      <OrdersTable
        orders={ids.map(order) as never}
        permissions={{ canValidate: false } as never}
        currentPage={1}
        totalPages={1}
        onPageChange={() => {}}
      />
    </MemoryRouter>,
  );
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

describe("OrdersTable : paiement annulé ou remboursé", () => {
  it("badge sur la ligne concernée, une seule demande pour la page", async () => {
    fetchMock.mockResolvedValueOnce(
      json({
        enabled: true,
        voids: [
          {
            orderId: "ORD-ESSAI-2",
            state: "cancelled",
            label: "Paiement annulé",
            checkedAt: null,
            source: "manual",
          },
        ],
      }),
    );
    renderTable(["ORD-ESSAI-1", "ORD-ESSAI-2", "ORD-ESSAI-3"]);
    const badge = await screen.findByTestId("payment-void-badge");
    expect(badge.textContent).toBe("Paiement annulé");
    expect(badge.closest("tr")?.textContent).toContain("ORD-ESSAI-2");
    expect(screen.getAllByTestId("payment-void-badge")).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      `/api/admin/orders/billing/payment-voids?ids=${encodeURIComponent(
        "ORD-ESSAI-1,ORD-ESSAI-2,ORD-ESSAI-3",
      )}`,
    );
  });

  it("erreur : avertissement « État d'encaissement indisponible »", async () => {
    fetchMock.mockResolvedValueOnce(json({ message: "boom" }, 500));
    renderTable(["ORD-ESSAI-1"]);
    expect((await screen.findByRole("alert")).textContent).toContain(
      "État d'encaissement indisponible (HTTP 500)",
    );
    expect(screen.queryByTestId("payment-void-badge")).toBeNull();
  });

  it("drapeau éteint : ni badge ni avertissement", async () => {
    fetchMock.mockResolvedValueOnce(json({ enabled: false, voids: [] }));
    renderTable(["ORD-ESSAI-1"]);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByTestId("payment-void-badge")).toBeNull();
  });
});

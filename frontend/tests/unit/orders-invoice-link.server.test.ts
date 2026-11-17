/**
 * Mandat BM — lien « Télécharger la facture (PDF) » de l'espace client.
 *
 * getOrderInvoice lit GET /api/orders/:id/invoice avec le cookie du client et
 * rend le numéro de facture, ou null (pas encore émise, drapeau éteint,
 * erreur journalisée) : la page n'affiche le lien que si la facture existe.
 * getOrderDetails expose `shippedAt` (badge « Expédiée le … »).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getOrderDetails, getOrderInvoice } from "~/services/orders.server";
import { logger } from "~/utils/logger";

vi.mock("~/utils/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), log: vi.fn(), debug: vi.fn() },
}));

const COOKIE = "connect.sid=s%3Asession-de-test";
const request = new Request("http://localhost/account/orders/ORD-1", {
  headers: { Cookie: COOKIE },
});
const fetchMock = vi.fn();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(logger.error).mockReset();
});

describe("getOrderInvoice", () => {
  it("rend le numéro de facture, cookie du client transmis", async () => {
    fetchMock.mockResolvedValueOnce(
      json({
        invoice: { invoiceNumber: "F2026-000001", issuedAt: "2026-11-17" },
      }),
    );
    await expect(
      getOrderInvoice({ orderId: "ORD-1", request }),
    ).resolves.toEqual({
      invoiceNumber: "F2026-000001",
      issuedAt: "2026-11-17",
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/api\/orders\/ORD-1\/invoice$/);
    expect(init.headers.Cookie).toBe(COOKIE);
  });

  it("pas encore de facture : null, sans erreur", async () => {
    fetchMock.mockResolvedValueOnce(json({ invoice: null }));
    await expect(
      getOrderInvoice({ orderId: "ORD-1", request }),
    ).resolves.toBeNull();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("backend en erreur ou injoignable : null, erreur journalisée", async () => {
    fetchMock.mockResolvedValueOnce(json({}, 500));
    await expect(
      getOrderInvoice({ orderId: "ORD-1", request }),
    ).resolves.toBeNull();
    fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    await expect(
      getOrderInvoice({ orderId: "ORD-1", request }),
    ).resolves.toBeNull();
    expect(logger.error).toHaveBeenCalledTimes(2);
  });
});

describe("getOrderDetails — date d'expédition", () => {
  it("expose ord_date_ship en shippedAt", async () => {
    fetchMock.mockResolvedValueOnce(
      json({
        success: true,
        data: {
          ord_id: "ORD-1",
          ord_ords_id: "4",
          ord_total_ttc: "109.90",
          ord_is_pay: "1",
          ord_date_ship: "2026-11-17T17:00:00Z",
          ord_tracking: "6A12345678901",
          lines: [],
        },
      }),
    );
    const order = await getOrderDetails({
      orderId: "ORD-1",
      userId: "81500",
      request,
    });
    expect(order).toMatchObject({
      shippedAt: "2026-11-17T17:00:00Z",
      trackingNumber: "6A12345678901",
    });
  });
});

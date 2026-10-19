/**
 * Supplément après rupture, depuis la fiche commande admin.
 *
 * Une pièce payée est en rupture chez le fournisseur et un équivalent plus cher
 * est disponible : la fiche appelle POST /api/admin/orders/:orderId/supplements
 * (OrdersService.createSupplementOrder, qui porte toutes les règles : commande
 * payée, équivalent vendable, jamais à perte, création par create_order_atomic)
 * et affiche le lien de paiement à transmettre au client. Aucun mail n'est
 * envoyé.
 *
 * Ce test verrouille :
 * - l'action relaie la demande en nombres, avec le cookie de session ;
 * - elle renvoie le supplément créé (commande, montant, lien de paiement) ;
 * - un refus du backend (vente à perte, supplément déjà créé…) est affiché tel quel ;
 * - le formulaire n'existe que pour une commande payée et non annulée.
 *
 * Identifiants fictifs : aucune donnée client.
 *
 * @see frontend/app/routes/admin.orders.$orderId.tsx
 * @see backend/src/modules/orders/controllers/order-actions.controller.ts (createSupplementOrder)
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import OrderDetailPage, { action } from "~/routes/admin.orders.$orderId";

const { requireUser } = vi.hoisted(() => ({ requireUser: vi.fn() }));
vi.mock("~/auth/unified.server", () => ({ requireUser }));

const PARENT = "ORD-1758000000000-123";
const CHILD = "ORD-1758000000001-456";
const LINE = `${PARENT}-L001`;
const COOKIE = "connect.sid=s%3Asession-de-test";
const PAY = `https://example.test/api/paybox/redirect?orderId=${CHILD}`;
const CREATED = {
  success: true,
  orderId: CHILD,
  parentOrderId: PARENT,
  totalTtc: 40,
  unitTtc: 20,
  quantity: 2,
  paymentUrl: PAY,
};
const FIELDS = {
  intent: "createSupplement",
  lineId: LINE,
  pieceId: "2002",
  quantity: "2",
  confirmedPurchaseHt: "35.5",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const fetchMock = vi.fn();

function runAction(fields: Record<string, string>) {
  return action({
    request: new Request(`http://localhost/admin/orders/${PARENT}`, {
      method: "POST",
      body: new URLSearchParams(fields),
      headers: { Cookie: COOKIE },
    }),
    params: { orderId: PARENT },
    context: {},
  } as never);
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  requireUser.mockResolvedValue({ level: 9 });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("admin.orders.$orderId action — createSupplement", () => {
  it("relaie la demande au backend, en nombres, avec le cookie de session", async () => {
    fetchMock.mockResolvedValueOnce(json(CREATED, 201));

    await runAction(FIELDS);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      `http://127.0.0.1:3000/api/admin/orders/${PARENT}/supplements`,
    );
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      Cookie: COOKIE,
      "Content-Type": "application/json",
    });
    expect(JSON.parse(init.body)).toEqual({
      lineId: LINE,
      pieceId: 2002,
      quantity: 2,
      confirmedPurchaseHt: 35.5,
    });
  });

  it("renvoie le supplément créé : commande, montant, lien de paiement", async () => {
    fetchMock.mockResolvedValueOnce(json(CREATED, 201));

    await expect(runAction(FIELDS)).resolves.toMatchObject({
      success: true,
      supplement: { orderId: CHILD, totalTtc: 40, paymentUrl: PAY },
    });
  });

  it("affiche le refus du backend tel quel", async () => {
    const refus =
      "Vente à perte refusée pour la pièce 2002 : vente HT 30, achat HT en base 28, achat HT confirmé 35.5.";
    fetchMock.mockResolvedValueOnce(
      json({ statusCode: 409, message: refus }, 409),
    );

    const result = (await runAction(FIELDS)) as { data?: { error?: string } };

    expect(result.data?.error).toBe(refus);
  });
});

const PAID_ORDER = {
  ord_id: PARENT,
  ord_cst_id: "81500",
  ord_date: "2026-10-01T10:00:00.000Z",
  ord_amount_ttc: "63.00",
  ord_shipping_fee_ttc: "9.90",
  ord_total_ttc: "72.90",
  ord_is_pay: "1",
  ord_date_pay: "2026-10-01T10:05:00.000Z",
  ord_ords_id: "3",
  orderLines: [
    {
      orl_id: LINE,
      orl_pg_name: "Plaquettes de frein",
      orl_pm_name: "MARQUE-A",
      orl_art_ref: "REF-A1",
      orl_art_quantity: "2",
      orl_art_price_sell_unit_ttc: "31.50",
      orl_art_price_sell_ttc: "63.00",
    },
  ],
};

function renderPage(
  order: Record<string, unknown>,
  routeAction: (args: {
    request: Request;
  }) => Promise<unknown> = async () => ({}),
) {
  const Stub = createRoutesStub([
    {
      path: "/admin/orders/:orderId",
      Component: OrderDetailPage,
      HydrateFallback: () => null,
      loader: () => ({ order }),
      action: routeAction,
    },
  ]);
  return render(<Stub initialEntries={[`/admin/orders/${PARENT}`]} />);
}

describe("admin.orders.$orderId — formulaire de supplément", () => {
  it("proposé sur une commande payée et non annulée", async () => {
    renderPage(PAID_ORDER);

    expect(
      await screen.findByRole("button", { name: /Supplément après rupture/ }),
    ).toBeTruthy();
  });

  it.each([
    ["non payée", { ord_is_pay: "0", ord_date_pay: undefined }],
    ["annulée", { ord_ords_id: "2" }],
  ])("absent d'une commande %s", async (_cas, override) => {
    renderPage({ ...PAID_ORDER, ...override });

    await screen.findByText("Actions");
    expect(
      screen.queryByRole("button", { name: /Supplément après rupture/ }),
    ).toBeNull();
  });

  it("envoie la ligne, l'équivalent, la quantité et l'achat HT, puis affiche le lien de paiement", async () => {
    let envoye: Record<string, FormDataEntryValue> = {};
    renderPage(PAID_ORDER, async ({ request }) => {
      envoye = Object.fromEntries(await request.formData());
      return {
        success: true,
        message: `Supplément ${CHILD} créé`,
        supplement: CREATED,
      };
    });

    fireEvent.click(
      await screen.findByRole("button", { name: /Supplément après rupture/ }),
    );
    expect(
      (screen.getByLabelText(/Ligne en rupture/) as HTMLSelectElement).value,
    ).toBe(LINE);
    expect((screen.getByLabelText(/Quantité/) as HTMLInputElement).value).toBe(
      "2",
    );
    fireEvent.change(screen.getByLabelText(/Pièce équivalente/), {
      target: { value: "2002" },
    });
    fireEvent.change(screen.getByLabelText(/Achat HT unitaire confirmé/), {
      target: { value: "35.5" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Créer le supplément" }),
    );

    expect(await screen.findByDisplayValue(PAY)).toBeTruthy();
    expect(envoye).toEqual(FIELDS);
    expect(screen.getByRole("link", { name: CHILD }).getAttribute("href")).toBe(
      `/admin/orders/${CHILD}`,
    );
  });
});

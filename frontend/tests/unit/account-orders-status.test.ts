import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ORDER_LINE_STATUS_LABEL, OrderStatus } from "@repo/domain-commerce";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getOrderDetails, getUserOrders } from "~/services/orders.server";
import {
  ORDER_STATUS_OPTIONS,
  getLineStatusLabel,
  getStatusLabel,
} from "~/utils/orders.utils";

vi.mock("~/utils/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), log: vi.fn(), debug: vi.fn() },
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function stubFetchJson(body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => body,
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const request = new Request("http://localhost/account/orders");

// Espace client : les statuts affichés sont ceux de la base, jamais un libellé
// déduit ni un statut par défaut.
describe("statuts de commande (espace client)", () => {
  it("le filtre propose exactement les statuts réels 1 à 5", () => {
    expect(ORDER_STATUS_OPTIONS.map(({ value }) => value)).toEqual(
      Object.values(OrderStatus),
    );
    expect(ORDER_STATUS_OPTIONS).toEqual([
      { value: "1", label: "En cours de traitement" },
      { value: "2", label: "Annulée" },
      { value: "3", label: "Attente frais de port" },
      { value: "4", label: "Frais de port reçu" },
      { value: "5", label: "Payée — En préparation" },
    ]);
  });

  it("un code absent ou hors liste n'invente pas de statut", () => {
    expect(getStatusLabel("")).toBe("Statut inconnu");
    expect(getStatusLabel("6")).toBe("Statut inconnu");
  });
});

describe("getLineStatusLabel", () => {
  it("reprend le libellé de la table des statuts de ligne", () => {
    expect(getLineStatusLabel("1")).toBe(ORDER_LINE_STATUS_LABEL["1"]);
    expect(getLineStatusLabel("5")).toBe("Pièce disponible");
    expect(getLineStatusLabel("91")).toBe("Proposition d'équivalence");
    expect(getLineStatusLabel(94)).toBe(ORDER_LINE_STATUS_LABEL["94"]);
  });

  it("renvoie null quand le code est absent ou inconnu", () => {
    for (const code of [null, undefined, "", " ", "0", "7", "95", "abc"]) {
      expect(getLineStatusLabel(code)).toBeNull();
    }
  });
});

describe("getUserOrders — lecture de la réponse du backend", () => {
  it("garde le code de statut, lit ord_is_pay et la pagination du backend", async () => {
    const fetchMock = stubFetchJson({
      data: [
        {
          ord_id: "ORD-TEST-1",
          ord_ords_id: "5",
          ord_is_pay: "1",
          ord_date_pay: "2026-01-02 10:00:00",
          ord_total_ttc: "42.50",
          ord_date: "2026-01-01 09:00:00",
        },
        {
          ord_id: "ORD-TEST-2",
          ord_ords_id: "2",
          ord_is_pay: "0",
          ord_total_ttc: "10.00",
          ord_date: "2026-01-03 09:00:00",
        },
        { ord_id: "ORD-TEST-3", ord_total_ttc: "1.00" },
      ],
      pagination: { page: 2, limit: 10, total: 23, totalPages: 3 },
    });

    const result = await getUserOrders({
      userId: "u-test",
      page: 2,
      status: "5",
      year: 2026,
      request,
    });

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("page=2");
    expect(url).toContain("status=5");
    expect(url).toContain("year=2026");

    expect(result.orders.map((o) => [o.status, o.isPaid])).toEqual([
      ["5", true],
      ["2", false],
      [null, false],
    ]);
    expect(result.orders[0].datePay).toBe("2026-01-02 10:00:00");
    expect(result.pagination).toEqual({
      currentPage: 2,
      totalPages: 3,
      totalCount: 23,
    });
    expect(result.total).toBe(23);
  });
});

describe("getOrderDetails — statut propre à chaque ligne", () => {
  it("ne recopie jamais le statut de la commande sur une ligne", async () => {
    stubFetchJson({
      success: true,
      data: {
        ord_id: "ORD-TEST-1",
        ord_ords_id: "5",
        ord_is_pay: "1",
        ord_total_ttc: "42.50",
        lines: [
          { orl_id: "L1", orl_orls_id: "6", orl_art_quantity: "1" },
          { orl_id: "L2", orl_art_quantity: "1" },
        ],
      },
    });

    const order = await getOrderDetails({
      orderId: "ORD-TEST-1",
      userId: "u-test",
      request,
    });

    expect(order?.status).toBe("5");
    expect(order?.isPaid).toBe(true);
    expect(order?.lines.map((line) => line.status)).toEqual(["6", null]);
    expect(order?.canReturn).toBe(false);
  });
});

// Ces pages ne pointent vers aucune route inexistante (suivi, avis, retour,
// catalogue « /products ») : elles tombaient toutes sur la page 404.
describe("espace client commandes — pas de lien vers une route inexistante", () => {
  const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../app");
  const PAGES = [
    "routes/account.orders.tsx",
    "routes/account_.orders.$orderId.tsx",
  ];

  it.each(PAGES)("%s", (page) => {
    const source = readFileSync(join(APP_DIR, page), "utf8");
    expect(source).not.toMatch(/\/(track|review|return)["`]/);
    expect(source).not.toMatch(/["`]\/products["`/?]/);
  });
});

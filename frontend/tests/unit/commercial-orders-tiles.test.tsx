/**
 * Tuiles de /commercial/orders — complément n° 1 au mandat BN.
 *
 * Verrouille :
 * - les tuiles viennent du serveur (GET /api/legacy-orders/stats?period=…),
 *   jamais d'un calcul sur les 25 lignes de la page ;
 * - la période est transmise ; une valeur inconnue retombe sur « all » ;
 * - sans `canSeeFinancials`, aucun appel n'est fait ;
 * - un échec s'affiche « indisponible », jamais en zéros ;
 * - impayées (< 30 j), abandonnées (≥ 30 j), annulées et montants exclus
 *   sont affichés ; une payée puis annulée est hors chiffre d'affaires ;
 * - tuile et filtre « Payées non traitées depuis plus de 24 h » (complément
 *   du 18/11) : nombre, âge de la plus ancienne, liste de la plus ancienne à
 *   la plus récente avec l'âge en jours. Données inventées.
 *
 * Identifiants fictifs, sauf 15114950 (montant aberrant relevé, sans donnée client).
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  OrdersTiles,
  PAID_UNPROCESSED_QUEUE,
  PaidUnprocessedList,
  parseTilesPeriod,
  type OrderTilesData,
  type PaidUnprocessedData,
} from "~/components/orders/OrdersTiles";
import { loader } from "~/routes/commercial.orders._index";

const { getOptionalUser } = vi.hoisted(() => ({ getOptionalUser: vi.fn() }));
vi.mock("~/auth/unified.server", () => ({ getOptionalUser }));

const COOKIE = "connect.sid=s%3Asession-de-test";

const TILES: OrderTilesData = {
  period: "all",
  periodStart: null,
  computedAt: "2026-11-17T18:00:00.000Z",
  rowsRead: 1707,
  paid: { orders: 653, revenue: 84137.78, averageBasket: 128.85 },
  monthRevenue: 176.32,
  unpaid: { orders: 0, amount: 0 },
  abandoned: { orders: 1045, amount: 243523.2, afterDays: 30 },
  cancelled: { orders: 8, paidOrders: 6, paidAmount: 1149.09 },
  excluded: {
    thresholdTtc: 1500,
    orders: [
      {
        ordId: "900001",
        ordDate: "2026-03-02T09:00:00.000Z",
        totalTtc: "1600.00",
        isPaid: true,
        reason: "amount_above_threshold",
      },
      {
        ordId: "15114950",
        ordDate: "2025-07-20T14:01:54.950Z",
        totalTtc: "99999999999999.99",
        isPaid: false,
        reason: "amount_above_threshold",
      },
    ],
  },
  paidUnprocessed: {
    afterHours: 24,
    captureStateRead: false,
    orders: 0,
    list: [],
  },
};

const QUEUE: PaidUnprocessedData = {
  afterHours: 24,
  captureStateRead: false,
  orders: 3,
  list: [
    {
      ordId: "ORD-TEST-0001",
      ordDate: "2026-11-07T14:42:18.587Z",
      paidAt: "2026-11-07T14:47:02.847Z",
      paidAtSource: "ord_date_pay",
      totalTtc: "42.20",
      ageDays: 10,
      linesActive: 1,
      linesWithSupplier: 0,
      linesOrderedFromSupplier: 0,
      reason: "supplier_missing",
    },
    {
      ordId: "ORD-TEST-0002",
      ordDate: "2026-11-12T09:00:00.000Z",
      paidAt: "2026-11-12T09:00:00.000Z",
      paidAtSource: "ord_date",
      totalTtc: "18.90",
      ageDays: 5,
      linesActive: 2,
      linesWithSupplier: 2,
      linesOrderedFromSupplier: 1,
      reason: "supplier_order_missing",
    },
    {
      ordId: "ORD-TEST-0003",
      ordDate: "2026-11-15T09:00:00.000Z",
      paidAt: "2026-11-15T09:10:00.000Z",
      paidAtSource: "ord_date_pay",
      totalTtc: "75.00",
      ageDays: 2,
      linesActive: 0,
      linesWithSupplier: 0,
      linesOrderedFromSupplier: 0,
      reason: "no_active_line",
    },
  ],
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const fetchMock = vi.fn();

function routeFetch(opts: {
  canSeeFinancials: boolean;
  stats?: () => Response;
}) {
  fetchMock.mockImplementation(async (input: string) => {
    const url = String(input);
    if (url.includes("/auth/user-permissions/")) {
      return json({ canSeeFinancials: opts.canSeeFinancials });
    }
    if (url.includes("/api/legacy-orders/stats")) {
      return opts.stats ? opts.stats() : json({ data: { tiles: TILES } });
    }
    if (url.includes("/api/legacy-orders?")) {
      return json({
        data: [{ ord_id: "1", ord_total_ttc: "4695.65" }],
        pagination: { total: 659 },
      });
    }
    throw new Error(`fetch inattendu: ${url}`);
  });
}

function runLoader(search = "") {
  return loader({
    request: new Request(`http://localhost/commercial/orders${search}`, {
      headers: { Cookie: COOKIE },
    }),
    params: {},
    context: {},
  } as never) as Promise<any>;
}

const statsCalls = () =>
  fetchMock.mock.calls
    .map(([u]) => String(u))
    .filter((u) => u.includes("/api/legacy-orders/stats"));

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  getOptionalUser.mockResolvedValue({
    id: "u1",
    level: 7,
    email: "staff@example.test",
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

describe("loader /commercial/orders — tuiles serveur", () => {
  it("lit les tuiles du serveur (toute la base), pas la page affichée", async () => {
    routeFetch({ canSeeFinancials: true });
    const result = await runLoader();
    expect(statsCalls()).toEqual([
      "http://127.0.0.1:3000/api/legacy-orders/stats?period=all",
    ]);
    expect(result.tiles).toEqual({ status: "ok", period: "all", data: TILES });
    expect(result).not.toHaveProperty("stats");
    // La somme de la page (4 695,65 €) n'apparaît nulle part.
    expect(JSON.stringify(result.tiles)).not.toContain("4695.65");
  });

  it("transmet la période ; une valeur inconnue retombe sur all", async () => {
    routeFetch({ canSeeFinancials: true });
    await runLoader("?period=month");
    await runLoader("?period=week");
    expect(statsCalls()).toEqual([
      "http://127.0.0.1:3000/api/legacy-orders/stats?period=month",
      "http://127.0.0.1:3000/api/legacy-orders/stats?period=all",
    ]);
    expect(parseTilesPeriod("year")).toBe("year");
    expect(parseTilesPeriod(null)).toBe("all");
  });

  it("sans canSeeFinancials : aucun appel aux statistiques", async () => {
    routeFetch({ canSeeFinancials: false });
    const result = await runLoader();
    expect(statsCalls()).toEqual([]);
    expect(result.tiles).toEqual({ status: "forbidden", period: "all" });
  });

  it("échec du calcul : « indisponible », jamais des zéros", async () => {
    routeFetch({
      canSeeFinancials: true,
      stats: () => json({ message: "boom" }, 500),
    });
    const result = await runLoader();
    expect(result.tiles).toEqual({ status: "unavailable", period: "all" });
    expect(result.orders).toHaveLength(1);
  });
});

describe("<OrdersTiles />", () => {
  it("affiche impayées, abandonnées, annulées et le montant exclu", () => {
    render(
      <OrdersTiles
        tiles={{ status: "ok", period: "all", data: TILES }}
        onPeriodChange={() => {}}
      />,
    );
    expect(screen.getByTestId("tile-orders").textContent).toContain("653");
    expect(screen.getByTestId("tile-unpaid").textContent).toContain(
      "0 commande de moins de 30 jours",
    );
    expect(screen.getByTestId("tile-abandoned").textContent).toContain(
      "1045 commandes non payées depuis 30 jours ou plus",
    );
    // Tuile « Annulées » : montant des payées puis annulées, hors CA.
    const cancelled = screen.getByTestId("tile-cancelled").textContent ?? "";
    expect(cancelled).toContain("Annulées");
    expect(cancelled).toMatch(/1\s?149,09\s?€/);
    expect(cancelled).toContain(
      "6 commandes payées puis annulées, hors chiffre d'affaires (8 annulations au total)",
    );
    expect(screen.getByTestId("tile-revenue").textContent).not.toMatch(
      /1\s?149,09/,
    );
    expect(screen.queryByTestId("tiles-paid-cancelled")).toBeNull();
    const excluded = screen.getByTestId("tiles-excluded").textContent ?? "";
    expect(excluded).toContain("15114950");
    expect(excluded).toContain("2025-07-20");
    expect(excluded).toContain("rien n'est corrigé en base");
    // Seuil 1 500 € : une commande payée exclue reste listée, marquée payée.
    expect(excluded).toContain("2 commandes exclues");
    expect(excluded).toMatch(/1\s?500,00\s?€ TTC/);
    expect(excluded).toContain("n° 900001 du 2026-03-02 : 1600.00 € TTC");
    expect(excluded).toContain("(payée)");
    // Le montant aberrant n'entre dans aucune tuile.
    for (const id of ["tile-revenue", "tile-unpaid", "tile-abandoned"]) {
      expect(screen.getByTestId(id).textContent).not.toMatch(/99\s?999/);
    }
  });

  it("indisponible : message explicite, aucun chiffre", () => {
    render(
      <OrdersTiles
        tiles={{ status: "unavailable", period: "month" }}
        onPeriodChange={() => {}}
      />,
    );
    expect(screen.getByTestId("tiles-unavailable").textContent).toContain(
      "Indicateurs indisponibles",
    );
    expect(screen.queryByTestId("tile-revenue")).toBeNull();
  });
});

describe("Payées non traitées depuis plus de 24 h", () => {
  it("tuile : nombre et âge de la plus ancienne ; lien qui active le filtre", () => {
    render(
      <MemoryRouter>
        <OrdersTiles
          tiles={{
            status: "ok",
            period: "all",
            data: { ...TILES, paidUnprocessed: QUEUE },
          }}
          onPeriodChange={() => {}}
          queueHref={`?queue=${PAID_UNPROCESSED_QUEUE}`}
        />
      </MemoryRouter>,
    );
    const tile = screen.getByTestId("tile-paid-unprocessed").textContent ?? "";
    expect(tile).toContain("Payées non traitées depuis plus de 24 h");
    expect(tile).toContain("3");
    expect(tile).toContain("La plus ancienne attend depuis 10 jours");
    const link = screen.getByTestId("tile-paid-unprocessed-link");
    expect(link.getAttribute("href")).toBe("/?queue=payees-non-traitees");
    expect(link.getAttribute("aria-pressed")).toBe("false");
  });

  it("tuile à zéro : aucune commande en attente", () => {
    render(
      <OrdersTiles
        tiles={{ status: "ok", period: "all", data: TILES }}
        onPeriodChange={() => {}}
      />,
    );
    expect(screen.getByTestId("tile-paid-unprocessed").textContent).toContain(
      "Aucune commande en attente",
    );
  });

  it("filtre : de la plus ancienne à la plus récente, âge en jours, lien vers la commande", () => {
    render(
      <MemoryRouter>
        <PaidUnprocessedList
          queue={QUEUE}
          basePath="/commercial/orders"
          clearHref="/commercial/orders"
        />
      </MemoryRouter>,
    );
    const list = screen.getByTestId("paid-unprocessed-list");
    expect(list.textContent).toContain(
      "3 commandes payées non traitées depuis plus de 24 h",
    );
    const rows = screen.getAllByTestId("paid-unprocessed-row");
    expect(rows.map((r) => within(r).getByRole("link").textContent)).toEqual([
      "ORD-TEST-0001",
      "ORD-TEST-0002",
      "ORD-TEST-0003",
    ]);
    expect(rows[0].textContent).toContain("2026-11-07");
    expect(rows[0].textContent).toContain("10 jours");
    expect(rows[0].textContent).toContain("fournisseur non confirmé");
    expect(rows[0].textContent).toContain("0/1 fournisseur, 0/1 commandée");
    expect(rows[1].textContent).toContain("(date de commande)");
    expect(rows[1].textContent).toContain("pas de commande fournisseur");
    expect(rows[2].textContent).toContain("2 jours");
    expect(rows[2].textContent).toContain("aucune ligne active");
    expect(within(rows[0]).getByRole("link").getAttribute("href")).toBe(
      "/commercial/orders/ORD-TEST-0001",
    );
    expect(
      screen.getByTestId("paid-unprocessed-clear").getAttribute("href"),
    ).toBe("/commercial/orders");
    // L'état d'encaissement de BM n'existe pas encore : c'est dit.
    expect(list.textContent).toContain(
      "n'est pas encore enregistré par le site",
    );
  });

  it("filtre vide : message explicite", () => {
    render(
      <MemoryRouter>
        <PaidUnprocessedList
          queue={{ ...QUEUE, orders: 0, list: [], captureStateRead: true }}
          basePath="/commercial/orders"
          clearHref="/commercial/orders"
        />
      </MemoryRouter>,
    );
    const list = screen.getByTestId("paid-unprocessed-list").textContent ?? "";
    expect(list).toContain("Aucune commande payée en attente de traitement.");
    expect(list).not.toContain("n'est pas encore enregistré");
  });
});

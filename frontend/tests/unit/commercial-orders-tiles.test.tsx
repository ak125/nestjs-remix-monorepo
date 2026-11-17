/**
 * Tuiles de /commercial/orders — complément n° 1 au mandat BN.
 *
 * Verrouille :
 * - les tuiles viennent du serveur (GET /api/legacy-orders/stats?period=…),
 *   jamais d'un calcul sur les 25 lignes de la page ;
 * - la période est transmise ; une valeur inconnue retombe sur « all » ;
 * - sans `canSeeFinancials`, aucun appel n'est fait ;
 * - un échec s'affiche « indisponible », jamais en zéros ;
 * - impayées (< 30 j), abandonnées (≥ 30 j) et montants exclus sont affichés.
 *
 * Identifiants fictifs, sauf 15114950 (montant aberrant relevé, sans donnée client).
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  OrdersTiles,
  parseTilesPeriod,
  type OrderTilesData,
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
  paid: { orders: 659, revenue: 85286.87, averageBasket: 129.42 },
  monthRevenue: 176.32,
  unpaid: { orders: 0, amount: 0 },
  abandoned: { orders: 1045, amount: 243523.2, afterDays: 30 },
  cancelled: { orders: 8, paidOrders: 6, paidAmount: 500 },
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
  it("affiche impayées, abandonnées, payées annulées et le montant exclu", () => {
    render(
      <OrdersTiles
        tiles={{ status: "ok", period: "all", data: TILES }}
        onPeriodChange={() => {}}
      />,
    );
    expect(screen.getByTestId("tile-orders").textContent).toContain("659");
    expect(screen.getByTestId("tile-unpaid").textContent).toContain(
      "0 commande de moins de 30 jours",
    );
    expect(screen.getByTestId("tile-abandoned").textContent).toContain(
      "1045 commandes non payées depuis 30 jours ou plus",
    );
    expect(screen.getByTestId("tiles-paid-cancelled").textContent).toContain(
      "6 commandes payées puis annulées",
    );
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

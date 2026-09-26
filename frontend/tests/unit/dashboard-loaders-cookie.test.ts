/**
 * Les routes `api/dashboard` exigent une session d'équipe et une permission
 * par route (`backend/tests/unit/dashboard-routes-authz.test.ts`). Les loaders
 * de l'espace commercial qui les appellent doivent donc transmettre le cookie
 * de session de la requête entrante, sans quoi l'API répond 403.
 *
 * Un commercial (niveau 3) lit les commandes récentes sans avoir accès aux
 * statistiques globales : le tableau de bord commercial doit afficher les
 * premières même quand les secondes lui sont refusées.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loader as layoutLoader } from "~/routes/commercial";
import { loader as dashboardLoader } from "~/routes/commercial._index";
import { loader as shippingLoader } from "~/routes/commercial.shipping._index";
import { loader as shippingCreateLoader } from "~/routes/commercial.shipping.create._index";
import { loader as trackingLoader } from "~/routes/commercial.shipping.tracking._index";
import { loader as advancedSearchLoader } from "~/routes/commercial.vehicles.advanced-search";

const { getOptionalUser, requireUser } = vi.hoisted(() => ({
  getOptionalUser: vi.fn(),
  requireUser: vi.fn(),
}));
vi.mock("~/auth/unified.server", () => ({ getOptionalUser, requireUser }));

const COOKIE = "connect.sid=s%3Asession-de-test";
const STAFF = { level: 3, firstName: "Test", lastName: "Commercial" };

type AnyLoader = (args: any) => Promise<unknown>;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function stubFetch(respond: (url: string) => Response = () => json({})) {
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, _init?: RequestInit) =>
      respond(String(input)),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function run(loader: AnyLoader, path: string) {
  return loader({
    request: new Request(`http://localhost${path}`, {
      headers: { Cookie: COOKIE },
    }),
    context: {},
    params: {},
  });
}

/** Cookie sent with each call to `api/dashboard`, by URL. */
function dashboardCookies(fetchMock: ReturnType<typeof stubFetch>) {
  return fetchMock.mock.calls
    .filter(([input]) => String(input).includes("/api/dashboard/"))
    .map(([input, init]) => ({
      url: new URL(String(input)).pathname,
      cookie: new Headers(init?.headers).get("Cookie"),
    }));
}

beforeEach(() => {
  vi.unstubAllGlobals();
  getOptionalUser.mockReset().mockResolvedValue(STAFF);
  requireUser.mockReset().mockResolvedValue(STAFF);
});

describe("espace commercial — appels à api/dashboard avec la session", () => {
  it.each<[string, AnyLoader, string, string[]]>([
    ["layout", layoutLoader, "/commercial/orders", ["/api/dashboard/stats"]],
    [
      "tableau de bord",
      dashboardLoader,
      "/commercial",
      ["/api/dashboard/stats", "/api/dashboard/orders/recent"],
    ],
    [
      "expéditions",
      shippingLoader,
      "/commercial/shipping",
      ["/api/dashboard/orders/recent"],
    ],
    [
      "création d'expédition",
      shippingCreateLoader,
      "/commercial/shipping/create",
      ["/api/dashboard/orders/recent"],
    ],
    [
      "suivi des expéditions",
      trackingLoader,
      "/commercial/shipping/tracking",
      ["/api/dashboard/shipments"],
    ],
    [
      "recherche avancée véhicules",
      advancedSearchLoader,
      "/commercial/vehicles/advanced-search",
      ["/api/dashboard/stats"],
    ],
  ])(
    "%s : transmet le cookie de session",
    async (_name, loader, path, urls) => {
      const fetchMock = stubFetch();
      await run(loader, path);
      const calls = dashboardCookies(fetchMock);
      expect(calls.map((c) => c.url).sort()).toEqual([...urls].sort());
      for (const call of calls) expect(call.cookie).toBe(COOKIE);
    },
  );
});

describe("tableau de bord commercial — statistiques refusées", () => {
  it("affiche les commandes récentes quand les statistiques répondent 403", async () => {
    stubFetch((url) =>
      url.includes("/api/dashboard/stats")
        ? json({ statusCode: 403, message: "Forbidden resource" }, 403)
        : json({
            orders: [
              {
                id: "1",
                orderNumber: "CMD-1",
                customerName: "Client",
                status: "en_cours",
                total: 10,
                date: "2026-09-24",
                isPaid: false,
              },
            ],
          }),
    );

    const result = (await run(dashboardLoader, "/commercial")) as {
      dashboardData: {
        orders: { totalOrders: number; recentOrders: Array<{ id: string }> };
      };
    };

    expect(result.dashboardData.orders.recentOrders.map((o) => o.id)).toEqual([
      "1",
    ]);
    expect(result.dashboardData.orders.totalOrders).toBe(0);
  });
});

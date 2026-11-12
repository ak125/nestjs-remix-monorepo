import { cleanup, render, screen } from "@testing-library/react";
import { type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SeoHubObservability, {
  loader,
} from "~/routes/admin.seo-hub.observability";

/**
 * Écran SEO Observability — lecture des sources (2026-11-12).
 *
 * 1. GA4 : la courbe et les totaux viennent de la série quotidienne calculée
 *    par l'API sur toutes les lignes (`daily`, `totals`, `totals_scope`), et
 *    non plus d'un échantillon de lignes ré-agrégé dans le navigateur.
 * 2. Une source en échec (HTTP non-2xx ou corps `{ error }`) n'est pas une
 *    source vide : pas de 0, pas de « aucune donnée ».
 * 3. `conversions` = événements clés GA4, tous canaux — jamais présenté comme
 *    des commandes.
 */

const state = vi.hoisted(() => ({ data: {} as unknown }));

// vi.mock is hoisted by Vitest's transformer (runs before imports at runtime).
vi.mock("react-router", () => ({
  useLoaderData: () => state.data,
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
  Link: ({ to, children }: { to: string; children: ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  LineChart: ({ data, children }: { data: unknown; children: ReactNode }) => (
    <div data-testid="line-chart" data-series={JSON.stringify(data)}>
      {children}
    </div>
  ),
  Line: ({ name }: { name: string }) => <span data-testid="line">{name}</span>,
  CartesianGrid: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));
vi.mock("~/utils/internal-api.server", () => ({
  getInternalApiUrl: () => "http://backend.test",
}));
vi.mock("~/utils/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));
vi.mock("~/utils/meta-helpers", () => ({ createNoIndexMeta: vi.fn() }));

type Reply = { status?: number; body?: unknown; raw?: string };

const HEALTH_OK = {
  monitoring_enabled: true,
  readiness: { gsc: { ready: true }, ga4: { ready: true } },
  gsc_site_url: "sc-domain:example.test",
  ga4_property: "properties/0",
};
const GSC_EMPTY = {
  rows: [],
  rows_scope: { exhaustive: false, limit: 200, returned: 0, truncated: false },
  daily: [],
  coverage: null,
  totals: { clicks: 0, impressions: 0, ctr: 0, avg_position: 0 },
};
const GA4_OK = {
  from: "2026-10-01",
  to: "2026-10-08",
  rows: [
    {
      date: "2026-10-01",
      page: "https://www.automecanik.com/a",
      channel: "direct",
      sessions: 1,
      conversions: 0,
      bounce_rate: null,
      avg_session_duration: null,
    },
  ],
  rows_scope: {
    grain: "date_page_channel",
    exhaustive: false,
    limit: 1000,
    returned: 1,
    truncated: false,
  },
  daily: [
    { date: "2026-10-01", sessions: 1200, conversions: 2 },
    { date: "2026-10-02", sessions: 1300, conversions: 1 },
    { date: "2026-10-04", sessions: 900, conversions: 0 },
  ],
  totals: { sessions: 3400, conversions: 3 },
  totals_scope: {
    grain: "date",
    channels: "all",
    exhaustive: true,
    rows_read: 4321,
    days_present: 3,
    last_data_date: "2026-10-04",
  },
};

const fetchMock = vi.fn();

/** Réponses par source ; une source non citée répond son cas nominal vide. */
function backendReplies(overrides: Record<string, Reply | "network"> = {}) {
  const nominal: Record<string, Reply> = {
    "credentials/health": { body: HEALTH_OK },
    "timeseries/gsc": { body: GSC_EMPTY },
    "timeseries/ga4": { body: GA4_OK },
    "timeseries/cwv": { body: { rows: [] } },
    runs: { body: { rows: [] } },
  };
  fetchMock.mockImplementation(async (input: string) => {
    const key = Object.keys(nominal).find((k) =>
      input.includes(`/api/admin/seo-monitoring/${k}`),
    );
    if (!key) throw new Error(`appel inattendu : ${input}`);
    const reply = overrides[key] ?? nominal[key];
    if (reply === "network") throw new TypeError("fetch failed");
    return new Response(reply.raw ?? JSON.stringify(reply.body ?? {}), {
      status: reply.status ?? 200,
      headers: { "Content-Type": "application/json" },
    });
  });
}

const runLoader = (search = "?days=7") =>
  loader({
    request: new Request(
      `https://www.automecanik.com/admin/seo-hub/observability${search}`,
    ),
    params: {},
    context: {},
  } as unknown as Parameters<typeof loader>[0]);

async function renderScreen(overrides: Record<string, Reply | "network"> = {}) {
  backendReplies(overrides);
  state.data = await runLoader();
  return render(<SeoHubObservability />);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-08T12:00:00Z"));
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("loader SEO Observability — lecture des sources", () => {
  it("GA4 nominal : série quotidienne, totaux et portée de l'API transmis tels quels, sans l'échantillon de lignes", async () => {
    backendReplies();
    const data = await runLoader();

    expect(data.ga4Daily).toEqual(GA4_OK.daily);
    expect(data.ga4Totals).toEqual({ sessions: 3400, conversions: 3 });
    expect(data.ga4Scope).toEqual(GA4_OK.totals_scope);
    expect(data.unavailable).toEqual([]);
    expect(data.error).toBeNull();
    expect(data).not.toHaveProperty("ga4Rows");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://backend.test/api/admin/seo-monitoring/timeseries/ga4?from=2026-10-01&to=2026-10-08",
      expect.anything(),
    );
  });

  it.each([
    ["panne serveur", { status: 500 }, "HTTP 500"],
    ["permission refusée", { status: 403 }, "HTTP 403"],
    [
      "corps { error } en HTTP 200",
      { body: { error: "statement timeout", rows: [] } },
      "statement timeout",
    ],
    ["corps illisible", { raw: "<html>502</html>" }, "réponse illisible"],
    ["corps inattendu", { body: [] }, "réponse inattendue"],
    [
      "réponse sans série ni portée (ancien format)",
      { body: { rows: [], totals: { sessions: 12, conversions: 1 } } },
      "réponse sans série quotidienne, totaux ou portée",
    ],
    [
      "réponse sans totaux",
      { body: { daily: [], totals_scope: GA4_OK.totals_scope } },
      "réponse sans série quotidienne, totaux ou portée",
    ],
  ])(
    "GA4 en échec (%s) → aucun total, source déclarée indisponible",
    async (_label, reply, reason) => {
      backendReplies({ "timeseries/ga4": reply as Reply });
      const data = await runLoader();

      expect(data.ga4Totals).toBeNull();
      expect(data.ga4Daily).toEqual([]);
      expect(data.ga4Scope).toBeNull();
      expect(data.unavailable).toEqual([{ source: "GA4", reason }]);
      // les autres sources restent lues
      expect(data.gscTotals).toEqual(GSC_EMPTY.totals);
      expect(data.health).toEqual(HEALTH_OK);
    },
  );

  it("GSC en échec ({ error } en HTTP 200) → pas de totaux à zéro", async () => {
    backendReplies({
      "timeseries/gsc": { body: { error: "relation absente", rows: [] } },
    });
    const data = await runLoader();

    expect(data.gscTotals).toBeNull();
    expect(data.unavailable).toEqual([
      { source: "GSC", reason: "relation absente" },
    ]);
    expect(data.ga4Totals).toEqual({ sessions: 3400, conversions: 3 });
  });

  it("fenêtre sans donnée GA4 : zéro légitime, source disponible", async () => {
    backendReplies({
      "timeseries/ga4": {
        body: {
          rows: [],
          daily: [],
          totals: { sessions: 0, conversions: 0 },
          totals_scope: {
            grain: "date",
            channels: "all",
            exhaustive: true,
            rows_read: 0,
            days_present: 0,
            last_data_date: null,
          },
        },
      },
    });
    const data = await runLoader();

    expect(data.ga4Totals).toEqual({ sessions: 0, conversions: 0 });
    expect(data.unavailable).toEqual([]);
  });

  it("backend injoignable → erreur globale, aucun total", async () => {
    backendReplies({ "timeseries/cwv": "network" });
    const data = await runLoader();

    expect(data.error).toBe("Erreur connexion backend SEO Monitoring");
    expect(data.ga4Totals).toBeNull();
    expect(data.gscTotals).toBeNull();
    expect(data.ga4Daily).toEqual([]);
  });
});

describe("écran SEO Observability — GA4", () => {
  const ga4Series = () =>
    JSON.parse(
      screen.getByTestId("line-chart").getAttribute("data-series") ?? "[]",
    );

  it("nominal : totaux de l'API, libellés « événements clés » et « tous canaux », aucun mot « conversions »", async () => {
    const { container } = await renderScreen();

    expect(screen.getByText("Sessions & événements clés (GA4)")).toBeTruthy();
    expect(screen.getByText("3 400")).toBeTruthy();
    expect(
      screen.getByText(
        "3 événements clés · tous canaux · dernier jour 2026-10-04",
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(/un événement clé GA4 n'est pas une commande payée/),
    ).toBeTruthy();
    expect(screen.getByText(/3 jours avec données/)).toBeTruthy();
    expect(screen.getAllByTestId("line").map((l) => l.textContent)).toEqual([
      "Sessions",
      "Événements clés",
    ]);
    expect(container.textContent).not.toMatch(/conversions/i);
    expect(screen.queryByText("Sources indisponibles")).toBeNull();
    expect(screen.queryByText("Données GA4 partielles")).toBeNull();
  });

  it("courbe : un point par jour de la fenêtre, jour sans donnée à null, jamais 0", async () => {
    await renderScreen();

    expect(ga4Series()).toEqual([
      { date: "2026-10-01", sessions: 1200, conversions: 2 },
      { date: "2026-10-02", sessions: 1300, conversions: 1 },
      { date: "2026-10-03", sessions: null, conversions: null },
      { date: "2026-10-04", sessions: 900, conversions: 0 },
      { date: "2026-10-05", sessions: null, conversions: null },
      { date: "2026-10-06", sessions: null, conversions: null },
      { date: "2026-10-07", sessions: null, conversions: null },
      { date: "2026-10-08", sessions: null, conversions: null },
    ]);
  });

  it("GA4 en échec : « — » et « GA4 indisponible », pas de zéro ni de « aucune donnée »", async () => {
    await renderScreen({
      "timeseries/ga4": { body: { error: "statement timeout", rows: [] } },
    });

    expect(screen.getByText("Sources indisponibles")).toBeTruthy();
    expect(screen.getByText("statement timeout")).toBeTruthy();
    expect(screen.getByText("GA4 indisponible")).toBeTruthy();
    expect(
      screen.getByText("GA4 indisponible : la série n'a pas pu être lue."),
    ).toBeTruthy();
    expect(screen.queryByText(/Aucune donnée GA4 ingérée/)).toBeNull();
    expect(screen.queryByText(/événements clés · tous canaux/)).toBeNull();
    expect(screen.queryByTestId("line-chart")).toBeNull();
  });

  it("fenêtre vide : « aucune donnée » et zéro affichés, sans alerte d'indisponibilité", async () => {
    await renderScreen({
      "timeseries/ga4": {
        body: {
          rows: [],
          daily: [],
          totals: { sessions: 0, conversions: 0 },
          totals_scope: {
            grain: "date",
            channels: "all",
            exhaustive: true,
            rows_read: 0,
            days_present: 0,
            last_data_date: null,
          },
        },
      },
    });

    expect(
      screen.getByText("Aucune donnée GA4 ingérée sur cette fenêtre."),
    ).toBeTruthy();
    expect(screen.getByText("0 événements clés · tous canaux")).toBeTruthy();
    expect(screen.queryByText("Sources indisponibles")).toBeNull();
    expect(screen.queryByText("GA4 indisponible")).toBeNull();
  });

  it("borne de lecture atteinte : alerte « Données GA4 partielles » avec le dernier jour complet", async () => {
    await renderScreen({
      "timeseries/ga4": {
        body: {
          ...GA4_OK,
          totals_scope: {
            ...GA4_OK.totals_scope,
            exhaustive: false,
            rows_read: 200000,
          },
        },
      },
    });

    expect(screen.getByText("Données GA4 partielles")).toBeTruthy();
    expect(
      screen.getByText(/s'arrêtent au 2026-10-04/, { exact: false }),
    ).toBeTruthy();
  });
});

describe("écran SEO Observability — autres sources en échec", () => {
  it("GSC en échec : « — » et « GSC indisponible », pas de 0.00%", async () => {
    const { container } = await renderScreen({
      "timeseries/gsc": { status: 500 },
    });

    expect(screen.getAllByText("GSC indisponible")).toHaveLength(2);
    expect(screen.getByText("HTTP 500")).toBeTruthy();
    expect(container.textContent).not.toContain("0.00%");
  });

  it("journal des runs en échec : « — », pas « 0 run »", async () => {
    await renderScreen({
      runs: { body: { error: "permission denied", rows: [] } },
    });

    expect(screen.getByText("Runs indisponibles")).toBeTruthy();
    expect(screen.getByText("permission denied")).toBeTruthy();
    expect(screen.queryByText("event_log fetchers")).toBeNull();
  });

  it("état des credentials illisible : signalé indisponible, pas « Configuration requise »", async () => {
    await renderScreen({ "credentials/health": { status: 503 } });

    expect(screen.getByText("Sources indisponibles")).toBeTruthy();
    expect(screen.getByText(/État des credentials/)).toBeTruthy();
    expect(screen.queryByText("Configuration requise")).toBeNull();
  });

  it("credentials absents (réponse lue) : « Configuration requise » toujours affichée", async () => {
    await renderScreen({
      "credentials/health": {
        body: {
          ...HEALTH_OK,
          readiness: {
            gsc: { ready: true },
            ga4: { ready: false, reason: "GA4_PROPERTY_ID manquant" },
          },
        },
      },
    });

    expect(screen.getByText("Configuration requise")).toBeTruthy();
    expect(screen.queryByText("Sources indisponibles")).toBeNull();
  });
});

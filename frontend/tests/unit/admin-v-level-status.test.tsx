/**
 * Lot A V-Level (2026-11-04) — loader et rendu de /admin/v-level-status.
 * Une réponse HTTP réussie n'est acceptée que si l'enveloppe et ses totaux
 * sont cohérents ; zéro mesuré, source vide, dénominateur nul et lecture
 * impossible restent distincts à l'écran.
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import VLevelStatusPage, { loader } from "~/routes/admin.v-level-status";

vi.mock("~/utils/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

const fetchMock = vi.fn();

function stats(overrides: Record<string, unknown> = {}) {
  return {
    contract: "vlevel-global-stats.v2",
    source: { keywords: "__seo_keywords", catalogue: "pieces_gamme" },
    read: {
      startedAt: "2026-11-04T22:00:00.000Z",
      completedAt: "2026-11-04T22:00:01.000Z",
      pageSize: 1000,
      keywordPages: 15,
      cataloguePages: 11,
    },
    keywords: {
      total: 13978,
      byLevel: { V1: 0, V2: 123, V3: 587, V4: 9029, V5: 1201, V6: 0 },
      classified: 10940,
      unclassified: 3038,
      unexpectedLevel: 0,
      unexpectedLevelValues: [],
      withoutCatalogueGamme: 0,
    },
    gammes: {
      catalogueTotal: 9719,
      withClassification: 25,
      g1Total: 34,
      g1WithV2: 4,
    },
    freshness: {
      upTo7Days: 0,
      from7To30Days: 0,
      over30Days: 13978,
      unknownOrInvalid: 0,
    },
    dates: {
      latestCollectedAt: "2026-06-18T17:22:16.000Z",
      latestUpdatedAt: "2026-06-18T17:22:16.000Z",
    },
    ...overrides,
  };
}

function apiResponds(status: number, body: unknown) {
  fetchMock.mockResolvedValueOnce(
    new Response(typeof body === "string" ? body : JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

const runLoader = () =>
  loader({
    request: new Request("https://www.automecanik.com/admin/v-level-status", {
      headers: { Cookie: "connect.sid=s%3Atest" },
    }),
    params: {},
    context: {},
  } as never);

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => cleanup());

describe("loader — validation du contrat", () => {
  it("accepte une enveloppe valide et transmet le cookie de session", async () => {
    apiResponds(200, { success: true, data: stats(), timestamp: "x" });
    const res = await runLoader();
    expect(res.error).toBeNull();
    expect(res.stats?.keywords.total).toBe(13978);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Cookie).toBe(
      "connect.sid=s%3Atest",
    );
    expect(init.method ?? "GET").toBe("GET");
  });

  it.each([
    [
      "ancien contrat (gamme_seo_metrics)",
      { totalGammes: 0, distribution: {} },
    ],
    ["data null", null],
    [
      "identité rompue (total ≠ classés + sans niveau + inattendus)",
      stats({
        keywords: { ...stats().keywords, total: 14000 },
      }),
    ],
    [
      "tranches de fraîcheur ≠ total",
      stats({
        freshness: {
          upTo7Days: 0,
          from7To30Days: 0,
          over30Days: 1000,
          unknownOrInvalid: 0,
        },
      }),
    ],
    ["G1 avec V2 > G1", stats({ gammes: { ...stats().gammes, g1WithV2: 35 } })],
    ["compteur négatif", stats({ gammes: { ...stats().gammes, g1Total: -1 } })],
  ])("HTTP 200 mais %s → indisponible", async (_label, data) => {
    apiResponds(200, { success: true, data });
    const res = await runLoader();
    expect(res.stats).toBeNull();
    expect(res.error?.title).toBe("Indicateurs indisponibles");
    expect(res.error?.detail).toMatch(/incomplète ou incohérente/);
  });

  it("success:false → indisponible", async () => {
    apiResponds(200, { success: false, data: stats() });
    const res = await runLoader();
    expect(res.stats).toBeNull();
  });

  it("HTTP 500 → indisponible avec le statut", async () => {
    apiResponds(500, { message: "Indicateurs V-Level indisponibles" });
    const res = await runLoader();
    expect(res.stats).toBeNull();
    expect(res.error?.detail).toMatch(/HTTP 500/);
  });

  it("HTTP 403 → session administrateur requise", async () => {
    apiResponds(403, {});
    const res = await runLoader();
    expect(res.error?.detail).toBe("Session administrateur requise.");
  });

  it("corps non JSON → indisponible", async () => {
    apiResponds(200, "<html>oops</html>");
    const res = await runLoader();
    expect(res.error?.detail).toBe("Réponse du serveur illisible.");
  });

  it("serveur injoignable → indisponible", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    const res = await runLoader();
    expect(res.error?.detail).toBe("Serveur injoignable.");
  });
});

function renderWith(loaderData: unknown) {
  const Stub = createRoutesStub([
    {
      path: "/admin/v-level-status",
      Component: VLevelStatusPage,
      loader: () => loaderData,
    },
  ]);
  render(<Stub initialEntries={["/admin/v-level-status"]} />);
}

describe("rendu — états distincts", () => {
  it("nominal : libellés, unités, dénominateur et dates séparées", async () => {
    renderWith({ stats: stats(), error: null });
    expect(
      await screen.findByText("Mots-clés enregistrés"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/ni véhicules uniques, ni audience/),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Répartition des mots-clés par niveau"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/motorisations/)).toBeNull();
    expect(screen.getByText(/Autres mots-clés du groupe/)).toBeInTheDocument();
    expect(screen.getByText(/Famille enregistrée/)).toBeInTheDocument();
    expect(
      screen.getByText(
        /Pourcentages calculés sur les 10\s940 mots-clés classés/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Dernière collecte enregistrée"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Dernière modification des mots-clés"),
    ).toBeInTheDocument();
    expect(screen.getByText("Indicateurs lus le")).toBeInTheDocument();
    expect(screen.getByText("Date inconnue ou invalide")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Actualiser les indicateurs" }),
    ).toBeEnabled();
    expect(document.body.textContent).not.toMatch(/NaN|Infinity/);
  });

  it("G1 sans V2 sur un périmètre lu : 0 % légitime", async () => {
    renderWith({
      stats: stats({ gammes: { ...stats().gammes, g1WithV2: 0 } }),
      error: null,
    });
    expect(
      await screen.findByText(/0 gammes G1 sur 34 ont au moins un mot-clé V2/),
    ).toBeInTheDocument();
    expect(screen.getByText(/^0\s?%$/)).toBeInTheDocument();
  });

  it("source vide et dénominateurs nuls : état vide, « Non applicable », dates inconnues", async () => {
    const empty = stats({
      keywords: {
        total: 0,
        byLevel: { V1: 0, V2: 0, V3: 0, V4: 0, V5: 0, V6: 0 },
        classified: 0,
        unclassified: 0,
        unexpectedLevel: 0,
        unexpectedLevelValues: [],
        withoutCatalogueGamme: 0,
      },
      gammes: {
        catalogueTotal: 0,
        withClassification: 0,
        g1Total: 0,
        g1WithV2: 0,
      },
      freshness: {
        upTo7Days: 0,
        from7To30Days: 0,
        over30Days: 0,
        unknownOrInvalid: 0,
      },
      dates: { latestCollectedAt: null, latestUpdatedAt: null },
    });
    renderWith({ stats: empty, error: null });
    expect(
      await screen.findByText("Aucun mot-clé enregistré."),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Non applicable").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Inconnue")).toHaveLength(2);
    expect(document.body.textContent).not.toMatch(/NaN|Infinity/);
  });

  it("niveaux inattendus et gammes hors catalogue : anomalie signalée", async () => {
    renderWith({
      stats: stats({
        keywords: {
          ...stats().keywords,
          unclassified: 3036,
          unexpectedLevel: 2,
          unexpectedLevelValues: [
            { value: "v2", count: 1 },
            { value: "", count: 1 },
          ],
          withoutCatalogueGamme: 5,
        },
      }),
      error: null,
    });
    expect(await screen.findByText("Anomalies signalées")).toBeInTheDocument();
    expect(screen.getByText(/\(chaîne vide\)/)).toBeInTheDocument();
    expect(screen.getByText(/sans gamme joignable/)).toBeInTheDocument();
  });

  it("indisponible : alerte, aucune valeur, réessai possible", async () => {
    renderWith({
      stats: null,
      error: {
        title: "Indicateurs indisponibles",
        detail: "Le serveur n'a pas pu lire les indicateurs (HTTP 500).",
      },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Indicateurs indisponibles",
    );
    expect(screen.queryByText("Mots-clés enregistrés")).toBeNull();
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeEnabled();
  });
});

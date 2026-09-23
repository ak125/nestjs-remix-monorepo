/**
 * R8 — le code pays `tnc_code` (« D » / « F ») n'est JAMAIS rendu comme un type mine.
 *
 * Fait mesuré (lecture seule) : `build_vehicle_page_payload` calcule
 * `mine_codes = jsonb_agg(DISTINCT tnc_code)` ; `tnc_code` ne prend que deux valeurs,
 * « D » (numérotation KBA) et « F » (Mines/CNIT) : c'est le PAYS de la numérotation,
 * pas un numéro. Les vrais numéros sont dans `cnit_codes` (`tnc_cnit`), déjà exposés.
 * Avant ce correctif, la ligne « Type mine / CNIT » et la réponse FAQ (FAQPage JSON-LD)
 * préfixaient les numéros par « D, F / ».
 *
 * Ce fichier verrouille :
 *  - le transform RPC → LoaderData ne propage plus `mine_codes` (ni son formatage) ;
 *  - le rendu réel de la route (tableau + FAQ + JSON-LD + bouton copier) n'affiche que
 *    `cnit_codes_formatted`, inchangé ;
 *  - un payload qui ne porterait QUE `mine_codes` ne fait plus apparaître ni la ligne
 *    ni la question carte grise ;
 *  - la ROUTE seule, indépendamment du transform : un LoaderData injecté tel quel qui
 *    porterait encore `mine_codes_formatted` (champ retiré du type) n'est pas rendu.
 *    Sans ce bloc, revenir sur la seule route resterait masqué par le transform.
 */

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { transformRpcToLoaderData } from "~/components/vehicle/r8/r8-transform";
import VehicleDetailPage from "~/routes/constructeurs.$brand.$model.$type";

const PARAMS = {
  brand: "renault-140",
  model: "clio-iii-140004",
  type: "1-5-dci-34189.html",
};

/** Payload RPC R8 minimal, forme `build_vehicle_page_payload`. */
function makeRpc(
  overrides: { mine_codes?: string[]; cnit_codes?: string[] } = {},
) {
  return {
    vehicle: {
      marque_id: 140,
      marque_alias: "renault",
      marque_name: "RENAULT",
      modele_id: 140004,
      modele_alias: "clio-iii",
      modele_name: "Clio III",
      type_id: 34189,
      type_alias: "1-5-dci",
      type_name: "1.5 dCi",
      type_power_ps: "90",
      type_body: "Berline",
      type_fuel: "Diesel",
      type_month_from: "06",
      type_year_from: "2005",
      type_month_to: null,
      type_year_to: null,
    },
    motor_codes: ["K9K 766"],
    mine_codes: ["D", "F"],
    cnit_codes: ["M10RENVP000A123", "3333161"],
    catalog: { families: [] },
    popular_parts: [],
    seo_validation: { is_indexable: true },
    ...overrides,
  };
}

function renderRoute(rpc: ReturnType<typeof makeRpc>) {
  return renderLoaderData(transformRpcToLoaderData(rpc, PARAMS));
}

/** Rend la route avec un LoaderData fourni tel quel (sans passer par le transform). */
function renderLoaderData(loaderData: unknown) {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: VehicleDetailPage,
      loader: () => loaderData,
    },
  ]);
  return render(<Stub initialEntries={["/"]} />);
}

/** Cellule de valeur de la ligne « Type mine / CNIT » (null si la ligne est absente). */
function typeMineCell(): HTMLElement | null {
  const label = screen.queryByText("Type mine / CNIT");
  if (!label) return null;
  const row = label.closest("tr");
  return (row?.querySelectorAll("td")[1] as HTMLElement | undefined) ?? null;
}

function faqJsonLd(container: HTMLElement): {
  mainEntity: Array<{ name: string; acceptedAnswer: { text: string } }>;
} {
  const scripts = Array.from(
    container.querySelectorAll('script[type="application/ld+json"]'),
  ).map((s) => JSON.parse(s.textContent || "{}"));
  const faq = scripts.find((s) => s["@type"] === "FAQPage");
  expect(faq).toBeDefined();
  return faq;
}

const CARTE_GRISE_Q =
  "Comment trouver le type mine ou CNIT sur ma carte grise ?";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("R8 transform — `mine_codes` (tnc_code = pays D/F) n'est plus propagé", () => {
  it("ne produit ni `mine_codes` ni `mine_codes_formatted` ; `cnit_codes_formatted` inchangé", () => {
    const data = transformRpcToLoaderData(makeRpc(), PARAMS);
    expect(data.vehicle).not.toHaveProperty("mine_codes");
    expect(data.vehicle).not.toHaveProperty("mine_codes_formatted");
    expect(data.vehicle.cnit_codes).toEqual(["M10RENVP000A123", "3333161"]);
    expect(data.vehicle.cnit_codes_formatted).toBe("M10RENVP000A123, 3333161");
  });
});

describe("R8 route — rendu réel : seuls les numéros `tnc_cnit` sont affichés", () => {
  it("ligne « Type mine / CNIT » = numéros CNIT seuls, sans préfixe « D, F / »", async () => {
    renderRoute(makeRpc());
    await screen.findByText("Type mine / CNIT");
    const cell = typeMineCell();
    expect(cell?.textContent).toBe("M10RENVP000A123, 3333161");
    expect(cell?.textContent).not.toMatch(/\bD\b|\bF\b/);
  });

  it("réponse FAQ carte grise (texte + FAQPage JSON-LD) = numéros CNIT seuls", async () => {
    const { container } = renderRoute(makeRpc());
    await screen.findByText("Type mine / CNIT");
    const faq = faqJsonLd(container);
    const q = faq.mainEntity.find((e) => e.name === CARTE_GRISE_Q);
    expect(q).toBeDefined();
    expect(q!.acceptedAnswer.text).toContain(
      "les codes connus sont : M10RENVP000A123, 3333161. ",
    );
    expect(q!.acceptedAnswer.text).not.toContain("D, F");
  });

  it("bouton « Copier » : copie les numéros CNIT seuls", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    renderRoute(makeRpc());
    await screen.findByText("Type mine / CNIT");
    const button = typeMineCell()?.querySelector("button");
    expect(button).toBeTruthy();
    await act(async () => {
      fireEvent.click(button!);
    });
    expect(writeText).toHaveBeenCalledWith("M10RENVP000A123, 3333161");
  });

  it("page « D seul » : les numéros restent affichés, le code pays « D » disparaît", async () => {
    renderRoute(makeRpc({ mine_codes: ["D"], cnit_codes: ["0603AAA"] }));
    await screen.findByText("Type mine / CNIT");
    expect(typeMineCell()?.textContent).toBe("0603AAA");
  });

  it("payload portant SEULEMENT `mine_codes` : ni ligne ni question carte grise", async () => {
    const { container } = renderRoute(
      makeRpc({ mine_codes: ["F"], cnit_codes: [] }),
    );
    await waitFor(() =>
      expect(screen.getByText("Questions fréquentes")).toBeTruthy(),
    );
    expect(screen.queryByText("Type mine / CNIT")).toBeNull();
    const faq = faqJsonLd(container);
    expect(faq.mainEntity.map((e) => e.name)).not.toContain(CARTE_GRISE_Q);
  });
});

describe("R8 route seule — un LoaderData qui porterait encore `mine_codes_formatted` n'est pas rendu", () => {
  /**
   * LoaderData « legacy » injecté directement dans la route : il réintroduit
   * `mine_codes` / `mine_codes_formatted` (retirés du type `VehicleData`) pour
   * vérifier que la route elle-même ne les lit plus, indépendamment du transform.
   */
  function legacyLoaderData(vehicleOverrides: Record<string, unknown>) {
    const data = transformRpcToLoaderData(makeRpc(), PARAMS);
    return {
      ...data,
      vehicle: {
        ...data.vehicle,
        mine_codes: ["D", "F"],
        mine_codes_formatted: "D, F",
        ...vehicleOverrides,
      },
    };
  }

  it("cellule, bouton « Copier » et FAQPage JSON-LD = numéros CNIT seuls", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    const { container } = renderLoaderData(legacyLoaderData({}));
    await screen.findByText("Type mine / CNIT");
    const cell = typeMineCell();
    expect(cell?.textContent).toBe("M10RENVP000A123, 3333161");

    const faq = faqJsonLd(container);
    const q = faq.mainEntity.find((e) => e.name === CARTE_GRISE_Q);
    expect(q!.acceptedAnswer.text).toContain(
      "les codes connus sont : M10RENVP000A123, 3333161. ",
    );
    expect(q!.acceptedAnswer.text).not.toContain("D, F");

    await act(async () => {
      fireEvent.click(cell!.querySelector("button")!);
    });
    expect(writeText).toHaveBeenCalledWith("M10RENVP000A123, 3333161");
  });

  it("`mine_codes_formatted` seul (aucun numéro CNIT) : ni ligne ni question carte grise", async () => {
    const { container } = renderLoaderData(
      legacyLoaderData({
        mine_codes: ["F"],
        mine_codes_formatted: "F",
        cnit_codes: [],
        cnit_codes_formatted: "",
      }),
    );
    await waitFor(() =>
      expect(screen.getByText("Questions fréquentes")).toBeTruthy(),
    );
    expect(screen.queryByText("Type mine / CNIT")).toBeNull();
    const faq = faqJsonLd(container);
    expect(faq.mainEntity.map((e) => e.name)).not.toContain(CARTE_GRISE_Q);
  });
});

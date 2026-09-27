/** Regression du contrat SQL : tnc_code contient le pays, tnc_cnit les identifiants.
 * Les agregats melangent les origines : ne pas qualifier tous les numeros de CNIT. */

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
  overrides: { mine_codes?: string[]; cnit_codes?: string[] | null } = {},
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
      HydrateFallback: () => null,
      loader: () => loaderData,
    },
  ]);
  return render(<Stub initialEntries={["/"]} />);
}

/** Cellule de valeur de la ligne « Références d’identification » (null si la ligne est absente). */
function identificationCell(): HTMLElement | null {
  const label = screen.queryByText("Références d’identification");
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

const IDENTIFICATION_Q =
  "Quels codes d’identification sont associés à cette motorisation ?";

const clipboardDescriptor = Object.getOwnPropertyDescriptor(
  navigator,
  "clipboard",
);
afterEach(() => {
  vi.restoreAllMocks();
  if (clipboardDescriptor)
    Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
  else Reflect.deleteProperty(navigator, "clipboard");
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
  it("ligne « Références d’identification » = numéros du catalogue, sans préfixe « D, F / »", async () => {
    renderRoute(makeRpc());
    await screen.findByText("Références d’identification");
    const cell = identificationCell();
    expect(cell?.textContent).toBe("M10RENVP000A123, 3333161");
    expect(cell?.textContent).not.toMatch(/\bD\b|\bF\b/);
  });

  it("réponse FAQ identification (texte + FAQPage JSON-LD) = numéros du catalogue", async () => {
    const { container } = renderRoute(makeRpc());
    await screen.findByText("Références d’identification");
    const faq = faqJsonLd(container);
    const q = faq.mainEntity.find((e) => e.name === IDENTIFICATION_Q);
    expect(q).toBeDefined();
    expect(q!.acceptedAnswer.text).toContain(
      "sont : M10RENVP000A123, 3333161.",
    );
    expect(q!.acceptedAnswer.text).not.toContain("D, F");
    expect(q!.acceptedAnswer.text).not.toMatch(/CNIT|D\.2|carte grise/i);
    expect(container.textContent).toContain(q!.acceptedAnswer.text);
  });

  it("bouton « Copier » : copie les numéros du catalogue", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    renderRoute(makeRpc());
    await screen.findByText("Références d’identification");
    const button = identificationCell()?.querySelector("button");
    expect(button).toBeTruthy();
    await act(async () => {
      fireEvent.click(button!);
    });
    expect(writeText).toHaveBeenCalledWith("M10RENVP000A123, 3333161");
  });

  it("page « D seul » : les numéros restent affichés, le code pays « D » disparaît", async () => {
    renderRoute(makeRpc({ mine_codes: ["D"], cnit_codes: ["0603AAA"] }));
    await screen.findByText("Références d’identification");
    expect(identificationCell()?.textContent).toBe("0603AAA");
  });

  it.each([[], null, undefined])(
    "sans identifiants (%s), n’affiche ni ligne ni question malgré le pays",
    async (codes) => {
      const { container } = renderRoute(
        makeRpc({ mine_codes: ["F"], cnit_codes: codes }),
      );
      await waitFor(() =>
        expect(screen.getByText("Questions fréquentes")).toBeTruthy(),
      );
      expect(screen.queryByText("Références d’identification")).toBeNull();
      expect(screen.queryByText("Type mine / CNIT")).toBeNull();
      const faq = faqJsonLd(container);
      expect(faq.mainEntity.map((e) => e.name)).not.toContain(IDENTIFICATION_Q);
    },
  );
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

  it("cellule, bouton « Copier » et FAQPage JSON-LD = numéros du catalogue", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    const { container } = renderLoaderData(legacyLoaderData({}));
    await screen.findByText("Références d’identification");
    const cell = identificationCell();
    expect(cell?.textContent).toBe("M10RENVP000A123, 3333161");

    const faq = faqJsonLd(container);
    const q = faq.mainEntity.find((e) => e.name === IDENTIFICATION_Q);
    expect(q!.acceptedAnswer.text).toContain(
      "sont : M10RENVP000A123, 3333161.",
    );
    expect(q!.acceptedAnswer.text).not.toContain("D, F");
    expect(q!.acceptedAnswer.text).not.toMatch(/CNIT|D\.2|carte grise/i);
    expect(container.textContent).toContain(q!.acceptedAnswer.text);

    await act(async () => {
      fireEvent.click(cell!.querySelector("button")!);
    });
    expect(writeText).toHaveBeenCalledWith("M10RENVP000A123, 3333161");
  });

  it("`mine_codes_formatted` seul (aucun numéro CNIT) : ni ligne ni question d’identification", async () => {
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
    expect(screen.queryByText("Références d’identification")).toBeNull();
    expect(screen.queryByText("Type mine / CNIT")).toBeNull();
    const faq = faqJsonLd(container);
    expect(faq.mainEntity.map((e) => e.name)).not.toContain(IDENTIFICATION_Q);
  });
});

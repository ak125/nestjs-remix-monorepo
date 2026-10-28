import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DiagnosticWizard } from "~/components/diagnostic-wizard/DiagnosticWizard";

vi.mock("~/services/api/enhanced-vehicle.api", () => ({
  enhancedVehicleApi: {
    getBrands: vi.fn().mockResolvedValue([]),
    getModels: vi.fn().mockResolvedValue([]),
  },
}));

const key = "diag-wizard-draft";
const response = (data: unknown) => ({ ok: true, json: async () => data });
const symptomsFor = (system: string) =>
  `/api/diagnostic-engine/symptoms?system=${system}`;
let requests: string[];

beforeEach(() => {
  localStorage.clear();
  requests = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      requests.push(url);
      if (url === "/api/diagnostic-engine/wizard-steps") return response({});
      if (url === "/api/seo/funnel/event") return response({});
      if (url === "/api/diagnostic-engine/systems")
        return response({
          success: true,
          systems: [
            { slug: "freinage", label: "Freinage", description: null },
            {
              slug: "refroidissement",
              label: "Refroidissement",
              description: null,
            },
          ],
        });
      if (url === symptomsFor("refroidissement"))
        return response({
          success: true,
          symptoms: [
            {
              slug: "surchauffe-moteur",
              label: "Surchauffe moteur",
              description: null,
              urgency: "haute",
            },
          ],
        });
      throw new Error(`Unexpected request ${url}`);
    }),
  );
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  window.history.replaceState({}, "", "/");
  vi.unstubAllGlobals();
});

function open(search: string, draft?: Record<string, unknown>) {
  if (draft)
    localStorage.setItem(
      key,
      JSON.stringify({
        step: 2,
        vehicle: { brand: "", model: "" },
        symptomSlugs: [],
        savedAt: Date.now(),
        ...draft,
      }),
    );
  window.history.replaceState({}, "", `/diagnostic-auto${search}`);
  render(<DiagnosticWizard />);
}

describe("OBD links while code reading is on standby", () => {
  it("announces the standby for a ?dtc= link without reading the code", async () => {
    open("?dtc=p0300");
    const notice = await screen.findByText(
      "La lecture des codes défaut (OBD) est en pause.",
    );
    expect(notice.closest("[role=status]")?.textContent).toContain(
      "le code P0300 n’a pas été analysé",
    );
    expect(requests.some((url) => /dtc|analyze/i.test(url))).toBe(false);

    fireEvent.click(
      screen.getByRole("button", { name: "Continuer avec les symptômes" }),
    );
    expect(
      screen.queryByText("La lecture des codes défaut (OBD) est en pause."),
    ).toBeNull();
    expect(screen.getByRole("button", { name: /Suivant/ })).not.toBeNull();
  });

  it("does not echo a value that is not a fault code", async () => {
    open("?dtc=%3Cb%3Ex%3C%2Fb%3E");
    const notice = await screen.findByText(
      "La lecture des codes défaut (OBD) est en pause.",
    );
    expect(notice.closest("[role=status]")?.textContent).not.toContain(
      "n’a pas été analysé",
    );
  });
});

describe("category links open the matching system or ask for a choice", () => {
  it("opens the cooling system for ?cluster=refroidissement", async () => {
    open("?cluster=refroidissement", { systemScope: "freinage" });
    expect(
      (
        await screen.findByRole("radio", { name: /Refroidissement/ })
      ).getAttribute("aria-checked"),
    ).toBe("true");
    await screen.findByRole("checkbox", { name: /Surchauffe moteur/ });
    expect(requests).toContain(symptomsFor("refroidissement"));
    expect(requests).not.toContain(symptomsFor("freinage"));
  });

  it("asks for a choice instead of opening braking for an ambiguous category", async () => {
    open("?cluster=moteur", {});
    expect(
      await screen.findByText(/ne correspond pas à un seul système/),
    ).not.toBeNull();
    await screen.findByText(
      "Choisissez d’abord le système concerné ci-dessus.",
    );
    for (const radio of screen.getAllByRole("radio"))
      expect(radio.getAttribute("aria-checked")).toBe("false");
    expect(requests.some((url) => url.includes("/symptoms"))).toBe(false);
    expect(
      screen
        .getByRole("button", { name: /Lancer le diagnostic/ })
        .hasAttribute("disabled"),
    ).toBe(true);
  });

  it("does not preselect braking when no category is given", async () => {
    open("", {});
    await screen.findByText(
      "Choisissez d’abord le système concerné ci-dessus.",
    );
    expect(screen.getByText("Système à choisir — Symptômes")).not.toBeNull();
    expect(requests.some((url) => url.includes("/symptoms"))).toBe(false);
  });

  it("clears a stored system the engine no longer offers instead of replacing it", async () => {
    open("", { systemScope: "ancien-systeme" });
    await screen.findByText(/ne correspond pas à un seul système/);
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem(key) ?? "{}")).not.toHaveProperty(
        "systemScope",
      ),
    );
    expect(requests.some((url) => url.includes("/symptoms"))).toBe(false);
  });
});

describe("symptom links", () => {
  it("says a ?symptome= link is not applied rather than guessing a system", async () => {
    open("?symptome=bruit-freinage");
    expect(
      await screen.findByText(/Le symptôme indiqué par le lien n’est pas/),
    ).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Suivant/ }));
    await screen.findByText(
      "Choisissez d’abord le système concerné ci-dessus.",
    );
    expect(requests.some((url) => url.includes("/symptoms"))).toBe(false);
  });
});

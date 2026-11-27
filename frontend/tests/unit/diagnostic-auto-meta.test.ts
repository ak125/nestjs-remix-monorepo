/**
 * Mandat GF — /diagnostic-auto : l'en-tête et les données structurées ne
 * promettent pas ce que la page ne fait pas (constat F06). La lecture des codes
 * OBD est en pause dans l'outil (corps de la page) ; aucun chiffre ni qualité
 * non mesurés dans l'en-tête. Robots et canonique inchangés.
 */
import { describe, expect, it, vi } from "vitest";

import { meta } from "~/routes/diagnostic-auto._index";

vi.mock("~/services/api/enhanced-vehicle.api", () => ({
  enhancedVehicleApi: {
    getBrands: vi.fn().mockResolvedValue([]),
    getModels: vi.fn().mockResolvedValue([]),
  },
}));

type MetaEntry = Record<string, unknown>;
const entries = (meta as unknown as (a: unknown) => MetaEntry[])({
  loaderData: { faq: [], featured: [] },
});

const titleOf = () => String(entries.find((e) => "title" in e)?.title);
const nameOf = (name: string) =>
  String(entries.find((e) => e.name === name)?.content);
const propOf = (property: string) =>
  String(entries.find((e) => e.property === property)?.content);
const howTo = () =>
  entries
    .map((e) => e["script:ld+json"] as Record<string, unknown> | undefined)
    .find((ld) => ld?.["@type"] === "HowTo") as {
    description: string;
    step: { name: string; text: string }[];
  };

const head = () => [
  titleOf(),
  nameOf("description"),
  propOf("og:title"),
  propOf("og:description"),
];

describe("diagnostic-auto._index meta — promesse fidèle à l'outil (mandat GF)", () => {
  it("title de 60 caractères au plus, marque comprise", () => {
    expect(titleOf()).toBe(
      "Diagnostic panne voiture gratuit par symptôme | AutoMecanik",
    );
    expect(titleOf().length).toBeLessThanOrEqual(60);
  });

  it("description entre 120 et 155 caractères", () => {
    const d = nameOf("description");
    expect(d.length).toBeGreaterThanOrEqual(120);
    expect(d.length).toBeLessThanOrEqual(155);
  });

  it("og:title reprend le title sans la marque", () => {
    expect(propOf("og:title")).toBe(titleOf().replace(/ \| AutoMecanik$/, ""));
  });

  it("l'en-tête ne promet ni lecture ni décodage de codes OBD", () => {
    for (const text of head()) expect(text).not.toMatch(/OBD|code|décod/i);
  });

  it("l'en-tête n'affirme ni chiffre ni qualité non mesurés", () => {
    for (const text of head()) {
      expect(text).not.toMatch(/\d/);
      expect(text).not.toMatch(/expert/i);
    }
  });

  it("le HowTo ne propose pas d'entrer un code dans l'outil", () => {
    const steps = howTo().step;
    for (const s of steps) {
      expect(s.text).not.toMatch(/entrez le code|diagnostic ciblé/i);
    }
    expect(steps[2].text).toContain(
      "Notre outil n'interprète pas encore ces codes",
    );
  });

  it("robots et canonique inchangés", () => {
    expect(nameOf("robots")).toBe("index, follow");
    expect(
      entries.filter((e) => e.rel === "canonical").map((e) => e.href),
    ).toEqual(["https://www.automecanik.com/diagnostic-auto"]);
  });
});

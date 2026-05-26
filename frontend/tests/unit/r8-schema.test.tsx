import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import {
  buildR8CanonicalUrls,
  generateVehicleSchema,
} from "~/components/vehicle/r8/r8-schema";
import { BreadcrumbSection } from "~/components/vehicle/r8/sections/BreadcrumbSection";
import { type LoaderData, type VehicleData } from "~/components/vehicle/r8/r8.types";

afterEach(() => cleanup());

// Fixture = Renault Safrane I 2.1 TD (URL réelle remontée par GSC le 2026-05-23)
const vehicleFixture: VehicleData = {
  marque_id: 140,
  marque_alias: "renault",
  marque_name: "Renault",
  marque_name_meta: "Renault",
  marque_name_meta_title: "Renault",
  marque_logo: "renault.png",
  marque_relfollow: 1,
  modele_id: 140082,
  modele_alias: "safrane-i",
  modele_name: "Safrane I",
  modele_name_meta: "Safrane I",
  modele_relfollow: 1,
  type_id: 3766,
  type_alias: "2-1-td",
  type_name: "2.1 TD",
  type_name_meta: "2.1 TD",
  type_power_ps: "88",
  type_body: "Berline",
  type_fuel: "Diesel",
  type_month_from: "01",
  type_year_from: "1993",
  type_month_to: "12",
  type_year_to: "1996",
  type_relfollow: 1,
  power: "88 ch",
  date: "1993-2000",
};

const breadcrumbFixture: LoaderData["breadcrumb"] = {
  brand: "Renault",
  model: "Safrane I",
  type: "2.1 TD",
};

describe("buildR8CanonicalUrls", () => {
  it("produit les 5 URLs canoniques au format attendu", () => {
    const urls = buildR8CanonicalUrls(vehicleFixture);
    expect(urls).toEqual({
      home: "https://www.automecanik.com/",
      constructeurs: "https://www.automecanik.com/constructeurs",
      brand: "https://www.automecanik.com/constructeurs/renault-140.html",
      model:
        "https://www.automecanik.com/constructeurs/renault-140/safrane-i-140082.html",
      type: "https://www.automecanik.com/constructeurs/renault-140/safrane-i-140082/2-1-td-3766.html",
    });
  });

  it("toutes les URLs sont absolues HTTPS", () => {
    const urls = buildR8CanonicalUrls(vehicleFixture);
    for (const url of Object.values(urls)) {
      expect(url.startsWith("https://www.automecanik.com/")).toBe(true);
    }
  });
});

describe("generateVehicleSchema — BreadcrumbList", () => {
  const schema = generateVehicleSchema(vehicleFixture, breadcrumbFixture);
  const breadcrumbNode = schema["@graph"].find(
    (n) => (n as { "@type": string })["@type"] === "BreadcrumbList",
  ) as { itemListElement: Array<Record<string, unknown>> };

  it("expose un nœud BreadcrumbList dans @graph", () => {
    expect(breadcrumbNode).toBeDefined();
    expect(breadcrumbNode.itemListElement).toHaveLength(5);
  });

  it("tous les itemListElement (positions 1-5) ont position, name et item", () => {
    for (const li of breadcrumbNode.itemListElement) {
      expect(li["@type"]).toBe("ListItem");
      expect(typeof li.position).toBe("number");
      expect(typeof li.name).toBe("string");
      expect((li.name as string).length).toBeGreaterThan(0);
      expect(typeof li.item).toBe("string");
      expect((li.item as string).startsWith("https://")).toBe(true);
    }
  });

  it("position 5 (type) référence l'URL canonique de la page courante — régression GSC", () => {
    const last = breadcrumbNode.itemListElement[4];
    expect(last.position).toBe(5);
    expect(last.item).toBe(
      "https://www.automecanik.com/constructeurs/renault-140/safrane-i-140082/2-1-td-3766.html",
    );
  });

  it("positions ordonnées 1..5 sans trou", () => {
    expect(
      breadcrumbNode.itemListElement.map((li) => li.position),
    ).toEqual([1, 2, 3, 4, 5]);
  });

  it("chaque URL est imbriquée dans la précédente (cohérence hiérarchique)", () => {
    const items = breadcrumbNode.itemListElement.map(
      (li) => li.item as string,
    );
    expect(items[2].startsWith(items[1])).toBe(true);
    expect(items[3].startsWith(items[2].replace(/\.html$/, ""))).toBe(true);
    expect(items[4].startsWith(items[3].replace(/\.html$/, ""))).toBe(true);
  });
});

describe("BreadcrumbSection — structural guard (single SoT, JSON-LD only)", () => {
  it("le DOM ne contient AUCUN attribut microdata Schema.org (BreadcrumbList = JSON-LD only)", () => {
    const { container } = render(
      <BreadcrumbSection
        vehicle={vehicleFixture}
        breadcrumb={breadcrumbFixture}
      />,
    );

    // Garde anti-régression : interdit le retour de la dual-surface qui a causé
    // les incidents GSC 2026-05-23 et 2026-05-26 (PR #729 + alert suivante).
    // Le BreadcrumbList structuré est émis EXCLUSIVEMENT via JSON-LD
    // (generateVehicleSchema → Remix meta script:ld+json).
    expect(container.querySelectorAll("[itemscope]")).toHaveLength(0);
    expect(container.querySelectorAll("[itemtype]")).toHaveLength(0);
    expect(container.querySelectorAll("[itemprop]")).toHaveLength(0);
  });

  it("le rendu visuel reste intact : 5 niveaux navigables, page courante mise en évidence", () => {
    const { container, getByText } = render(
      <BreadcrumbSection
        vehicle={vehicleFixture}
        breadcrumb={breadcrumbFixture}
      />,
    );

    // 4 liens cliquables (Accueil, Constructeurs, Renault, Safrane I) + 1 page courante non-clickable
    expect(container.querySelectorAll("a")).toHaveLength(4);

    // Page courante = type, non clickable, en gras
    const current = getByText(/2\.1 TD\s*88\s*ch/);
    expect(current.closest("a")).toBeNull();
    expect(current.className).toContain("font-semibold");
  });
});

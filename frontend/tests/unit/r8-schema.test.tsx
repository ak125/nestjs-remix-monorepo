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
  // ADR-084 : les niveaux `constructeurs` (index → 404) et `model` (2-seg → 410)
  // ont été retirés. Le fil d'ariane R8 est désormais Accueil → Marque → Véhicule.
  it("produit les 3 URLs canoniques au format attendu (home, brand, type)", () => {
    const urls = buildR8CanonicalUrls(vehicleFixture);
    expect(urls).toEqual({
      home: "https://www.automecanik.com/",
      brand: "https://www.automecanik.com/constructeurs/renault-140.html",
      type: "https://www.automecanik.com/constructeurs/renault-140/safrane-i-140082/2-1-td-3766.html",
    });
  });

  it("n'expose PLUS d'URL niveau-modèle (2-seg) ni d'index /constructeurs — anti-régression ADR-084", () => {
    const urls = buildR8CanonicalUrls(vehicleFixture) as Record<string, string>;
    expect(urls.model).toBeUndefined();
    expect(urls.constructeurs).toBeUndefined();
    // Aucune URL émise ne doit être l'URL modèle 2-seg (qui renvoie 410).
    for (const url of Object.values(urls)) {
      expect(url).not.toBe(
        "https://www.automecanik.com/constructeurs/renault-140/safrane-i-140082.html",
      );
    }
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

  it("expose un nœud BreadcrumbList dans @graph (3 items : Accueil → Marque → Véhicule)", () => {
    expect(breadcrumbNode).toBeDefined();
    expect(breadcrumbNode.itemListElement).toHaveLength(3);
  });

  it("tous les itemListElement (positions 1-3) ont position, name et item", () => {
    for (const li of breadcrumbNode.itemListElement) {
      expect(li["@type"]).toBe("ListItem");
      expect(typeof li.position).toBe("number");
      expect(typeof li.name).toBe("string");
      expect((li.name as string).length).toBeGreaterThan(0);
      expect(typeof li.item).toBe("string");
      expect((li.item as string).startsWith("https://")).toBe(true);
    }
  });

  it("position 3 (type) référence l'URL canonique de la page courante — régression GSC", () => {
    const last = breadcrumbNode.itemListElement[2];
    expect(last.position).toBe(3);
    expect(last.item).toBe(
      "https://www.automecanik.com/constructeurs/renault-140/safrane-i-140082/2-1-td-3766.html",
    );
  });

  it("positions ordonnées 1..3 sans trou", () => {
    expect(
      breadcrumbNode.itemListElement.map((li) => li.position),
    ).toEqual([1, 2, 3]);
  });

  it("aucun item ne pointe vers l'URL modèle 2-seg (410) ni l'index /constructeurs (404) — ADR-084", () => {
    const items = breadcrumbNode.itemListElement.map((li) => li.item as string);
    expect(items).not.toContain(
      "https://www.automecanik.com/constructeurs/renault-140/safrane-i-140082.html",
    );
    expect(items).not.toContain("https://www.automecanik.com/constructeurs");
    expect(items).not.toContain("https://www.automecanik.com/constructeurs/");
  });

  it("la hiérarchie reste cohérente : Véhicule imbriqué dans Marque", () => {
    const items = breadcrumbNode.itemListElement.map(
      (li) => li.item as string,
    );
    // items[0]=Accueil, items[1]=Marque, items[2]=Véhicule
    expect(items[2].startsWith(items[1].replace(/\.html$/, ""))).toBe(true);
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
    expect(container.querySelectorAll("[itemscope]")).toHaveLength(0);
    expect(container.querySelectorAll("[itemtype]")).toHaveLength(0);
    expect(container.querySelectorAll("[itemprop]")).toHaveLength(0);
  });

  it("rendu visuel : Accueil → Marque cliquables (2 liens) + page courante non-clickable — ADR-084", () => {
    const { container, getByText } = render(
      <BreadcrumbSection
        vehicle={vehicleFixture}
        breadcrumb={breadcrumbFixture}
      />,
    );

    // 2 liens cliquables (Accueil, Renault) — niveaux "Constructeurs" (404) et
    // "Modèle" (410) retirés. + 1 page courante (type) non-clickable.
    expect(container.querySelectorAll("a")).toHaveLength(2);

    // Aucun lien ne pointe vers l'URL modèle 2-seg (410).
    const hrefs = Array.from(container.querySelectorAll("a")).map((a) =>
      a.getAttribute("href"),
    );
    expect(hrefs).not.toContain(
      "/constructeurs/renault-140/safrane-i-140082.html",
    );
    expect(hrefs).not.toContain("/constructeurs");

    // Page courante = type, non clickable, en gras
    const current = getByText(/2\.1 TD\s*88\s*ch/);
    expect(current.closest("a")).toBeNull();
    expect(current.className).toContain("font-semibold");
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  OrderLineVehicle,
  OrderVehicleCheckCard,
  orderLinePosition,
  readOrderVehicleCheck,
} from "~/components/orders/OrderVehicleCheckCard";

/** Mandat BN — carte prête à brancher sur /commercial/orders/<commande>. */

const stored = {
  version: 1,
  customer_reference: "AB-123-CD",
  purchase_vehicle: {
    type_id: 33300,
    brand: "Renault",
    model: "Clio III",
    engine: "1.5 dCi",
    source: "vehicle_context",
  },
  line_type_ids: [33300],
  captured_at: "2026-11-17T18:00:00.000Z",
};

describe("readOrderVehicleCheck", () => {
  it("null / absent : rien d'enregistré", () => {
    expect(readOrderVehicleCheck(null)).toBeNull();
    expect(readOrderVehicleCheck(undefined)).toBeNull();
  });

  it("lit la forme version 1 (objet ou chaîne JSON)", () => {
    const expected = {
      customerReference: "AB-123-CD",
      purchaseVehicle: { typeId: 33300, label: "Renault Clio III 1.5 dCi" },
      lineTypeIds: [33300],
      lines: [],
      capturedAt: "2026-11-17T18:00:00.000Z",
    };
    expect(readOrderVehicleCheck(stored)).toEqual(expected);
    expect(readOrderVehicleCheck(JSON.stringify(stored))).toEqual(expected);
  });

  it("forme inconnue : invalid, pas de devinette", () => {
    expect(readOrderVehicleCheck({ version: 2 })).toBe("invalid");
    expect(readOrderVehicleCheck("{oops")).toBe("invalid");
    expect(readOrderVehicleCheck([1])).toBe("invalid");
  });
});

describe("OrderVehicleCheckCard", () => {
  it("affiche la référence client et le véhicule d'achat", () => {
    render(<OrderVehicleCheckCard vehicleCheck={stored} />);
    expect(screen.getByText("AB-123-CD")).toBeTruthy();
    expect(screen.getByText(/Renault Clio III 1\.5 dCi/)).toBeTruthy();
    expect(screen.getByText(/type_id 33300/)).toBeTruthy();
  });

  it("référence vide : « Non fournie »", () => {
    render(
      <OrderVehicleCheckCard
        vehicleCheck={{ ...stored, customer_reference: null }}
      />,
    );
    expect(screen.getByText("Non fournie")).toBeTruthy();
  });

  it("aucune donnée : message explicite", () => {
    render(<OrderVehicleCheckCard vehicleCheck={null} />);
    expect(
      screen.getByText(/Aucune immatriculation, VIN ou référence fournie/),
    ).toBeTruthy();
  });
});

/** Mandat CK — véhicule de chaque ligne, sous le produit. */
describe("OrderLineVehicle", () => {
  const withLines = {
    ...stored,
    lines: [
      { position: 1, product_id: "1", type_id: 33300, source: "page" },
      {
        position: 2,
        product_id: "2",
        type_id: 9045,
        source: "selected_vehicle",
      },
      { position: 3, product_id: "3", type_id: null, source: null },
    ],
  };

  it("rang de ligne lu depuis orl_id", () => {
    expect(orderLinePosition("ORD-1763-L001")).toBe(1);
    expect(orderLinePosition("ORD-1763-L012")).toBe(12);
    expect(orderLinePosition("12345")).toBeNull();
    expect(orderLinePosition(null)).toBeNull();
  });

  it("ligne ajoutée depuis la page véhicule : véhicule, provenance et page", () => {
    render(
      <OrderLineVehicle
        vehicleCheck={withLines}
        lineId="ORD-1-L001"
        websiteUrl="/pieces/disque-de-frein-82/renault-140/clio-iii-140004/1-5-dci-33300.html"
      />,
    );
    expect(screen.getByText(/Renault Clio III 1\.5 dCi/)).toBeTruthy();
    expect(screen.getByText(/véhicule de la page d'ajout/)).toBeTruthy();
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe(
      "/pieces/disque-de-frein-82/renault-140/clio-iii-140004/1-5-dci-33300.html",
    );
  });

  it("ligne ajoutée hors page véhicule : véhicule choisi par le client", () => {
    render(
      <OrderLineVehicle
        vehicleCheck={withLines}
        lineId="ORD-1-L002"
        websiteUrl="/recherche?q=disque"
      />,
    );
    expect(screen.getByText(/type_id 9045/)).toBeTruthy();
    expect(screen.getByText(/véhicule choisi par le client/)).toBeTruthy();
  });

  it("ligne sans véhicule, ou commande antérieure : la ligne le dit", () => {
    const { unmount } = render(
      <OrderLineVehicle vehicleCheck={withLines} lineId="ORD-1-L003" />,
    );
    expect(
      screen.getByText("Aucun véhicule connu pour cette ligne"),
    ).toBeTruthy();
    unmount();
    render(<OrderLineVehicle vehicleCheck={null} lineId="ORD-1-L001" />);
    expect(
      screen.getByText("Aucun véhicule connu pour cette ligne"),
    ).toBeTruthy();
  });

  it("page d'ajout hors site : affichée en texte, jamais en lien", () => {
    render(
      <OrderLineVehicle
        vehicleCheck={withLines}
        lineId="ORD-1-L001"
        // eslint-disable-next-line no-script-url -- valeur hostile testée : jamais rendue en lien
        websiteUrl="javascript:alert(1)"
      />,
    );
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText(/javascript:alert\(1\)/)).toBeTruthy();
  });
});

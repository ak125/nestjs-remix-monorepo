import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  OrderVehicleCheckCard,
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

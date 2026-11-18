import { describe, expect, it } from "vitest";
import { resolveAddToCartVehicle } from "~/components/cart/cart-utils";

// Mandat CK : chaque ajout au panier rattache le véhicule connu à la ligne,
// y compris depuis la recherche ou la fiche produit.
describe("resolveAddToCartVehicle — véhicule rattaché à un ajout", () => {
  it("page véhicule : le véhicule de la page prime sur le véhicule choisi", () => {
    expect(resolveAddToCartVehicle(18376, { type_id: 9045 })).toEqual({
      typeId: 18376,
      vehicleSource: "page",
    });
  });

  it("recherche ou fiche produit : le véhicule choisi par le client est rattaché", () => {
    expect(resolveAddToCartVehicle(undefined, { type_id: 9045 })).toEqual({
      typeId: 9045,
      vehicleSource: "selected_vehicle",
    });
    expect(resolveAddToCartVehicle(null, { type_id: "9045" })).toEqual({
      typeId: 9045,
      vehicleSource: "selected_vehicle",
    });
  });

  it("aucun véhicule connu : rien n'est inventé", () => {
    expect(resolveAddToCartVehicle(undefined, null)).toEqual({});
    expect(resolveAddToCartVehicle(0, { type_id: "" })).toEqual({});
    expect(resolveAddToCartVehicle(Number.NaN, { type_id: "abc" })).toEqual({});
  });
});

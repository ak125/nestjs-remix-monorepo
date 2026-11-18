import { describe, expect, it } from "vitest";
import {
  COMPATIBILITY_NOTICE,
  cartMatchesVehicleCatalogue,
  compatibilityNotice,
} from "~/components/checkout/compatibility-notice";

// Mandat CK : plus de fausse promesse de compatibilité dans le tunnel.
const clio = {
  type_id: 33300,
  marque_name: "Renault",
  modele_name: "Clio III",
  type_name: "1.5 dCi",
};

describe("compatibilityNotice — mention du tunnel", () => {
  it("tous les articles viennent de la page catalogue du véhicule : « selon le catalogue »", () => {
    const items = [
      { type_id: 33300, vehicle_source: "page" },
      { type_id: 33300 }, // ligne antérieure au mandat CK
    ];
    expect(cartMatchesVehicleCatalogue(clio, items)).toBe(true);
    expect(compatibilityNotice(clio, items)).toBe(
      "Compatible avec Renault Clio III 1.5 dCi selon le catalogue ; nous vérifions avec votre immatriculation avant l'envoi",
    );
    expect(compatibilityNotice(clio, items, { withVehicle: false })).toBe(
      "Compatible selon le catalogue ; nous vérifions avec votre immatriculation avant l'envoi",
    );
  });

  it("un article ajouté depuis la recherche : mention prudente", () => {
    const items = [
      { type_id: 33300, vehicle_source: "page" },
      { type_id: 33300, vehicle_source: "selected_vehicle" },
    ];
    expect(compatibilityNotice(clio, items)).toBe(COMPATIBILITY_NOTICE);
  });

  it("un article d'un autre véhicule ou sans véhicule : mention prudente", () => {
    expect(
      compatibilityNotice(clio, [{ type_id: 33300 }, { type_id: 9045 }]),
    ).toBe(COMPATIBILITY_NOTICE);
    expect(compatibilityNotice(clio, [{ type_id: 33300 }, {}])).toBe(
      COMPATIBILITY_NOTICE,
    );
  });

  it("aucun véhicule choisi ou panier vide : mention prudente", () => {
    expect(compatibilityNotice(null, [{ type_id: 33300 }])).toBe(
      COMPATIBILITY_NOTICE,
    );
    expect(compatibilityNotice(clio, [])).toBe(COMPATIBILITY_NOTICE);
  });
});

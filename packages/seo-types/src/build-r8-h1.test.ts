import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildR8H1Emitted } from "./build-r8-h1.js";

/**
 * GOLDEN byte-parity avec le H1 émis par HeroSection.tsx:16 :
 *   `${marque} ${modele} ${type} ${powerPs} ch de ${yearFrom} à ${yearTo || "aujourd'hui"}`
 * Les valeurs attendues sont figées depuis le template ACTUEL (pré-rewire). Si le builder
 * les reproduit, brancher le frontend dessus ne change aucun byte rendu.
 */
describe("buildR8H1Emitted — byte-parity HeroSection.tsx:16", () => {
  it("yearTo présent", () => {
    assert.strictEqual(
      buildR8H1Emitted({
        marqueName: "Renault",
        modeleName: "Clio III",
        typeName: "1.5 dCi",
        typePowerPs: "85",
        typeYearFrom: "2005",
        typeYearTo: "2012",
      }),
      "Renault Clio III 1.5 dCi 85 ch de 2005 à 2012",
    );
  });

  it("yearTo null → aujourd'hui", () => {
    assert.strictEqual(
      buildR8H1Emitted({
        marqueName: "Renault",
        modeleName: "Clio III",
        typeName: "1.5 dCi",
        typePowerPs: "85",
        typeYearFrom: "2005",
        typeYearTo: null,
      }),
      "Renault Clio III 1.5 dCi 85 ch de 2005 à aujourd'hui",
    );
  });

  it('yearTo "" (falsy, sémantique ||) → aujourd\'hui, identique à null', () => {
    assert.strictEqual(
      buildR8H1Emitted({
        marqueName: "Renault",
        modeleName: "Clio III",
        typeName: "1.5 dCi",
        typePowerPs: "85",
        typeYearFrom: "2005",
        typeYearTo: "",
      }),
      "Renault Clio III 1.5 dCi 85 ch de 2005 à aujourd'hui",
    );
  });

  it("yearTo absent (undefined) → aujourd'hui", () => {
    assert.strictEqual(
      buildR8H1Emitted({
        marqueName: "Peugeot",
        modeleName: "208",
        typeName: "1.2 PureTech",
        typePowerPs: "100",
        typeYearFrom: "2019",
      }),
      "Peugeot 208 1.2 PureTech 100 ch de 2019 à aujourd'hui",
    );
  });

  it("inputs numériques interpolés comme la source (String coercion)", () => {
    assert.strictEqual(
      buildR8H1Emitted({
        marqueName: "BMW",
        modeleName: "Série 3",
        typeName: "320d",
        typePowerPs: 130,
        typeYearFrom: 2008,
        typeYearTo: 2014,
      }),
      "BMW Série 3 320d 130 ch de 2008 à 2014",
    );
  });
});

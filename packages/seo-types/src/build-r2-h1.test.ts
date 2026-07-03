import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildR2H1Emitted } from "./build-r2-h1.js";

/**
 * GOLDEN byte-parity avec le H1 émis par PiecesHeader.tsx:115-121 :
 *   [gamme.name, marque?.toUpperCase(), modele?.toUpperCase(), enrichedTypeLabel, finalText]
 *     .map(p => p ?? "").join(" ")
 *
 * Valeurs figées calculées à la main depuis les helpers ACTUELS (inchangés) :
 *  - finalText = SEO_PRICE_VARIATIONS[(typeId+pgId)%7] quand compSwitch2 vide
 *    (idx : ["à prix imbattables",1:"pas cher",2:"à petit prix",3:"économique",
 *     4:"à prix réduit",5:"à tarif avantageux",6:"au meilleur prix"])
 *  - enrichTypeNameForHeadings : no-op si type_name non ambigu ; sinon ajoute
 *    "${power} ch" (fuel implicite via HDi/TDI/… non répété).
 */
describe("buildR2H1Emitted — byte-parity PiecesHeader.tsx:115-121", () => {
  it("type non ambigu (no-op enrich) + rotation prix idx 0", () => {
    assert.strictEqual(
      buildR2H1Emitted({
        gammeName: "Disque de frein",
        marque: "Renault",
        modele: "Clio III",
        typeName: "GTI",
        typePowerPs: "85",
        typeFuel: "Essence",
        ctx: { typeId: 0, pgId: 0 }, // (0+0)%7 = 0 → "à prix imbattables"
        compSwitch2: [],
      }),
      "Disque de frein RENAULT CLIO III GTI à prix imbattables",
    );
  });

  it("type ambigu + fuel implicite (HDi) → enrichi '110 ch' + rotation idx 2", () => {
    assert.strictEqual(
      buildR2H1Emitted({
        gammeName: "Filtre à huile",
        marque: "Peugeot",
        modele: "308",
        typeName: "1.6 HDi",
        typePowerPs: "110",
        typeFuel: "Diesel",
        ctx: { typeId: 1, pgId: 1 }, // (1+1)%7 = 2 → "à petit prix"
        compSwitch2: [],
      }),
      "Filtre à huile PEUGEOT 308 1.6 HDi 110 ch à petit prix",
    );
  });

  it('marque undefined → collapse "" (double espace), JAMAIS "undefined"', () => {
    const out = buildR2H1Emitted({
      gammeName: "Filtre à huile",
      marque: undefined,
      modele: "308",
      typeName: "1.6 HDi",
      typePowerPs: "110",
      typeFuel: "Diesel",
      ctx: { typeId: 1, pgId: 1 },
      compSwitch2: [],
    });
    assert.ok(
      !out.includes("undefined"),
      "ne doit jamais contenir 'undefined'",
    );
    assert.strictEqual(
      out,
      "Filtre à huile  308 1.6 HDi 110 ch à petit prix", // double espace après "huile"
    );
  });

  it("compSwitch2 prioritaire sur la rotation prix", () => {
    assert.strictEqual(
      buildR2H1Emitted({
        gammeName: "Kit distribution",
        marque: "Renault",
        modele: "Clio III",
        typeName: "GTI",
        typePowerPs: "85",
        ctx: { typeId: 0, pgId: 0 }, // selectFromPool(pool,ctx,2) avec pool=1 → idx 0
        compSwitch2: ["synchroniser la distribution"],
      }),
      "Kit distribution RENAULT CLIO III GTI synchroniser la distribution",
    );
  });

  it("type ambigu + fuel NON implicite → fuel ajouté ('Essence 140 ch')", () => {
    assert.strictEqual(
      buildR2H1Emitted({
        gammeName: "Amortisseur",
        marque: "Renault",
        modele: "Megane",
        typeName: "2.0",
        typePowerPs: "140",
        typeFuel: "Essence",
        ctx: { typeId: 3, pgId: 4 }, // (3+4)%7 = 0 → "à prix imbattables"
        compSwitch2: [],
      }),
      "Amortisseur RENAULT MEGANE 2.0 Essence 140 ch à prix imbattables",
    );
  });
});

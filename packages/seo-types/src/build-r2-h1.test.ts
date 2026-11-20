import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildR2CleanH1,
  buildR2H1Emitted,
  buildR2H1VehicleLabel,
  resolveR2H1Level,
  type R2H1Vehicle,
} from "./build-r2-h1.js";

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

/**
 * H1 R2 propre (mandat EN, format validé par Marwane le 2026-11-20 à 23:01) :
 * gamme + marque + modèle + version en noms d'affichage ; puissance seulement
 * si un autre type servi donne le même H1 ; sinon libellé complet du titre.
 * Données : `auto_type` relevé le 2026-11-20 (modèle 113009, MINI PACEMAN R61).
 */
describe("H1 R2 propre — mandat EN", () => {
  const paceman = (
    typeId: string,
    typeName: string,
    typeNameMeta: string,
    powerPs: string,
    fuel: string,
  ): R2H1Vehicle => ({
    typeId,
    marqueName: "MINI",
    modeleName: "PACEMAN (R61)",
    modeleNameMeta: "PACEMAN (R61)",
    typeName,
    typeNameMeta,
    powerPs,
    fuel,
  });
  const d20 = paceman(
    "53236",
    "Cooper D ALL4",
    "2.0 Cooper D ALL4",
    "112",
    "Diesel",
  );
  const d16 = paceman(
    "58881",
    "Cooper D ALL4",
    "1.6 Cooper D ALL4",
    "112",
    "Diesel",
  );
  const c120 = paceman("74084", "Cooper", "1.6 Cooper", "120", "Essence");
  const c122 = paceman("58868", "Cooper", "1.6 Cooper", "122", "Essence");
  const all4a = paceman(
    "74085",
    "Cooper ALL4",
    "Cooper ALL4",
    "122",
    "Essence",
  );
  const all4b = paceman(
    "74086",
    "Cooper ALL4",
    "Cooper ALL4",
    "122",
    "Essence",
  );

  it("niveau 0 : noms d'affichage, casse des noms, sans puissance", () => {
    assert.strictEqual(resolveR2H1Level(d20, [d16, c120, c122]), 0);
    assert.strictEqual(
      buildR2CleanH1("Plaquette de frein", d20, 0),
      "Plaquette de frein Mini Paceman (R61) 2.0 Cooper D ALL4",
    );
    assert.strictEqual(
      buildR2CleanH1("Plaquette de frein", d16, 0),
      "Plaquette de frein Mini Paceman (R61) 1.6 Cooper D ALL4",
    );
  });

  it("niveau 1 : même version, puissances distinctes → puissance ajoutée", () => {
    assert.strictEqual(resolveR2H1Level(c120, [c122, d20]), 1);
    assert.strictEqual(
      buildR2CleanH1("Plaquette de frein", c120, 1),
      "Plaquette de frein Mini Paceman (R61) 1.6 Cooper 120 ch",
    );
    // Le voisin n'est pas passé (pas de pièces dans la gamme) : niveau 0.
    assert.strictEqual(resolveR2H1Level(c120, [d20]), 0);
  });

  it("niveau 2 : puissance insuffisante → libellé du titre, code moteur", () => {
    assert.strictEqual(resolveR2H1Level(all4a, [all4b]), 2);
    assert.strictEqual(
      buildR2CleanH1("Plaquette de frein", all4a, 2, {
        motorCode: "N16 B16 A",
        rawNames: false,
      }),
      "Plaquette de frein Mini Paceman (R61) Cooper ALL4 Essence 122 ch N16 B16 A",
    );
  });

  it("niveau 2, noms bruts : modèle et type tels qu'en base, casse des noms", () => {
    const tdi: R2H1Vehicle = {
      typeId: "294",
      marqueName: "VOLKSWAGEN",
      modeleName: "PASSAT VII B7",
      modeleNameMeta: "PASSAT VII",
      typeName: "2.0  TDI",
      typeNameMeta: "2.0 TDI",
      powerPs: "140",
      fuel: "Diesel",
    };
    assert.strictEqual(
      buildR2H1VehicleLabel(tdi, 2, { motorCode: "", rawNames: true }),
      // Carburant implicite (TDI) non répété, comme dans le titre #2212.
      "Volkswagen Passat VII B7 2.0 TDI 140 ch",
    );
    // Les noms bruts ne valent qu'au niveau 2.
    assert.strictEqual(
      buildR2H1VehicleLabel(tdi, 0, { motorCode: "", rawNames: true }),
      "Volkswagen Passat VII 2.0 TDI",
    );
  });

  it("casse et espaces seuls ne distinguent pas deux H1", () => {
    // Cas construit : seul « 1 » est fictif.
    const upper = {
      ...d16,
      typeId: "1",
      typeNameMeta: "1.6 COOPER D  ALL4",
      powerPs: "116",
    };
    assert.strictEqual(resolveR2H1Level(d16, [upper]), 1);
  });

  it("le type de la page est ignoré parmi les voisins", () => {
    assert.strictEqual(resolveR2H1Level(d20, [d20]), 0);
  });
});

import { describe, it, expect } from "vitest";
import {
  sanitizePurchaseGuideForR1,
  buildProofData,
} from "~/utils/r1-builders";
import { buildR1MicroBlock } from "~/utils/r1-reusable-content";
import type { GammePagePurchaseGuideData } from "~/types/gamme-page-contract.types";

// ─── sanitizePurchaseGuideForR1 ──────────────────────────────────

describe("sanitizePurchaseGuideForR1", () => {
  it("ne passe jamais symptoms, howToChoose, risk, timing", () => {
    const raw = {
      id: 1,
      pgId: "pg-1",
      intro: { title: "t", role: "r", syncParts: [] },
      risk: {
        title: "Risque",
        explanation: "Exp",
        consequences: ["C1"],
        costRange: "100-200€",
        conclusion: "Conc",
      },
      timing: { title: "Timing", years: "3", km: "60000", note: "n" },
      arguments: [{ title: "Arg1", content: "C1", icon: "wrench" }],
      symptoms: ["Vibrations au freinage"],
      howToChoose: "Choisir en fonction du diamètre",
      h1Override: "Disque de frein pas cher",
      antiMistakes: ["Erreur 1"],
      faq: [{ question: "Q ?", answer: "A avec assez de texte ici." }],
    } as GammePagePurchaseGuideData;

    const result = sanitizePurchaseGuideForR1(raw);

    expect(result).toBeDefined();
    // R1 fields present
    expect(result!.h1Override).toBe("Disque de frein pas cher");
    expect(result!.compatErrors).toEqual(["Erreur 1"]); // renamed from antiMistakes
    expect(result!.faq).toHaveLength(1);
    expect(result!.arguments).toHaveLength(1);

    // R3/R5 fields NOT present (compile-time guarantee + runtime check)
    const keys = Object.keys(result!);
    expect(keys).not.toContain("symptoms");
    expect(keys).not.toContain("howToChoose");
    expect(keys).not.toContain("risk");
    expect(keys).not.toContain("timing");
    expect(keys).not.toContain("intro");
  });

  it("renomme antiMistakes → compatErrors", () => {
    const raw = {
      id: 1,
      pgId: "pg-1",
      intro: { title: "t", role: "r", syncParts: [] },
      risk: {
        title: "",
        explanation: "",
        consequences: [],
        costRange: "",
        conclusion: "",
      },
      timing: { title: "", years: "", km: "", note: "" },
      arguments: [],
      antiMistakes: ["Ne pas confondre AV et AR"],
    } as GammePagePurchaseGuideData;

    const result = sanitizePurchaseGuideForR1(raw)!;
    expect(result.compatErrors).toEqual(["Ne pas confondre AV et AR"]);
  });

  it("retourne undefined si input null", () => {
    expect(sanitizePurchaseGuideForR1(null)).toBeUndefined();
    expect(sanitizePurchaseGuideForR1(undefined)).toBeUndefined();
  });
});

// ─── buildProofData ──────────────────────────────────────────────

describe("buildProofData", () => {
  it("periodeRange vide si yearSpan > 40 et count < 50", () => {
    const result = buildProofData({
      motorItems: Array.from({ length: 10 }, (_, i) => ({
        marque_name: "Peugeot",
        modele_name: "308",
        type_name: `1.6 HDi ${i}`,
        link: `/pieces/peugeot/308/${i}`,
      })),
      equipNames: ["Bosch"],
      allYears: [1980, 2024], // span=44, count=10 < 50
    });

    expect(result.periodeRange).toBe("");
  });

  it("periodeRange formaté si conditions valides", () => {
    const result = buildProofData({
      motorItems: Array.from({ length: 100 }, (_, i) => ({
        marque_name: "Renault",
        modele_name: "Clio",
        type_name: `1.5 dCi ${i}`,
        link: `/pieces/renault/clio/${i}`,
      })),
      equipNames: ["Valeo", "Bosch"],
      allYears: [2005, 2006, 2010, 2020, 2024],
    });

    expect(result.periodeRange).toBe("2005 – 2024");
  });

  it("topMarques déduplique et cap à 3", () => {
    const result = buildProofData({
      motorItems: [
        { marque_name: "Peugeot", modele_name: "308", type_name: "1.6", link: "/a" },
        { marque_name: "Peugeot", modele_name: "208", type_name: "1.2", link: "/b" },
        { marque_name: "Renault", modele_name: "Clio", type_name: "1.5", link: "/c" },
        { marque_name: "Volkswagen", modele_name: "Golf", type_name: "2.0", link: "/d" },
        { marque_name: "BMW", modele_name: "Série 3", type_name: "2.0d", link: "/e" },
      ],
      equipNames: [],
      allYears: [2020],
    });

    expect(result.topMarques).toHaveLength(3);
    // Peugeot appears first (most common)
    expect(result.topMarques[0]).toBe("Peugeot");
    // No duplicates
    expect(new Set(result.topMarques).size).toBe(result.topMarques.length);
  });

  it("uses motorisationsCount from backend when provided", () => {
    const result = buildProofData({
      motorItems: [
        { marque_name: "Peugeot", modele_name: "308", type_name: "1.6", link: "/a" },
      ],
      equipNames: [],
      allYears: [],
      motorisationsCount: 500,
    });

    expect(result.motorisationsCount).toBe(500);
  });
});

// ─── buildR1MicroBlock ───────────────────────────────────────────

describe("buildR1MicroBlock", () => {
  it("intro contient gammeName", () => {
    const block = buildR1MicroBlock({
      gammeName: "Disque de frein",
      familleName: "Freinage",
      alias: "disque-de-frein",
    });

    expect(block.intro.toLowerCase()).toContain("disque de frein");
  });

  it("bullets uses topMotorCodes si disponibles", () => {
    const block = buildR1MicroBlock({
      gammeName: "Kit d'embrayage",
      familleName: "Transmission",
      alias: "kit-embrayage",
      proofs: {
        topMarques: ["Peugeot"],
        topEquipementiers: ["Valeo"],
        periodeRange: "2010 – 2024",
        motorisationsCount: 200,
        topMotorCodes: ["DV6ATED4", "K9K", "EP6"],
      },
    });

    const motorCodeBullet = block.bullets.find((b) =>
      b.includes("DV6ATED4"),
    );
    expect(motorCodeBullet).toBeDefined();
  });

  it("bullets uses topEquipementiers si ≥2", () => {
    const block = buildR1MicroBlock({
      gammeName: "Plaquette de frein",
      familleName: "Freinage",
      alias: "plaquette-frein",
      proofs: {
        topMarques: ["Peugeot", "Renault"],
        topEquipementiers: ["Bosch", "TRW", "Brembo"],
        periodeRange: "2010 – 2024",
        motorisationsCount: 150,
        topMotorCodes: [],
      },
    });

    const equipBullet = block.bullets.find((b) => b.includes("Bosch"));
    expect(equipBullet).toBeDefined();
  });

  it("generates 3 cards (guide, conseils, reference)", () => {
    const block = buildR1MicroBlock({
      gammeName: "Amortisseur",
      familleName: "Suspension",
      alias: "amortisseur",
    });

    expect(block.cards).toHaveLength(3);
    expect(block.cards.map((c) => c.id)).toEqual([
      "guide",
      "conseils",
      "reference",
    ]);
    expect(block.cards[0].href).toContain("amortisseur");
  });
});

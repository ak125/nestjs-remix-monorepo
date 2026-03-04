import { describe, it, expect } from "vitest";
import {
  buildR1SectionPack,
  type R1SectionPack,
} from "~/utils/r1-section-pack";
import type { R1PurchaseGuideData } from "~/utils/r1-builders";

const SELECTOR_FAQ = [
  { question: "Mon véhicule n'apparaît pas ?", answer: "Essayez de rechercher par marque et modèle exact." },
  { question: "Comment être sûr de la compatibilité ?", answer: "Sélectionnez votre véhicule exact dans le sélecteur." },
  { question: "Quels sont les délais de livraison ?", answer: "24 à 48h en France métropolitaine pour les commandes avant 15h." },
  { question: "Où trouver le CNIT de mon véhicule ?", answer: "Le CNIT figure sur votre certificat d'immatriculation." },
  { question: "Mon modèle a plusieurs motorisations ?", answer: "Vérifiez le code moteur sur votre carte grise case D.2." },
];

const BASE_OPTS = {
  proofData: null,
  gammeName: "disque de frein",
  familleName: "Freinage",
  gammeId: 402,
  selectorFaq: SELECTOR_FAQ,
};

describe("buildR1SectionPack", () => {
  it("pipeline field non-vide → source='prompt'", () => {
    const pgd: R1PurchaseGuideData = {
      microSeoBlock: "Trouvez votre disque de frein compatible.",
      h1Override: "Disque de frein pas cher",
      heroSubtitle: "Livraison rapide",
    };
    const pack = buildR1SectionPack({ ...BASE_OPTS, purchaseGuideData: pgd });

    expect(pack.sections.buyArgs.source).toBe("prompt");
    expect(pack.sections.buyArgs.data.microSeoBlock).toBe(pgd.microSeoBlock);
    expect(pack.sections.hero.source).toBe("prompt");
  });

  it("pipeline field vide → source='fallback'", () => {
    const pgd: R1PurchaseGuideData = {
      microSeoBlock: "",
      h1Override: null,
      heroSubtitle: null,
    };
    const pack = buildR1SectionPack({ ...BASE_OPTS, purchaseGuideData: pgd });

    expect(pack.sections.buyArgs.source).toBe("fallback");
    expect(pack.sections.hero.source).toBe("fallback");
  });

  it("proofData → source='api' pour kpiCoverage", () => {
    const proofData = {
      topMarques: ["Peugeot", "Renault"],
      topEquipementiers: ["Bosch"],
      motorisationsCount: 150,
      modelsCount: 30,
      periodeRange: "2005 – 2024",
      topMotorCodes: ["DV6ATED4"],
    };
    const pack = buildR1SectionPack({
      ...BASE_OPTS,
      purchaseGuideData: undefined,
      proofData,
    });

    expect(pack.sections.kpiCoverage.source).toBe("api");
    expect(pack.sections.kpiCoverage.data).toBe(proofData);
  });

  it("FAQ ≥3 valides → source='prompt', items pipeline", () => {
    const pipelineFaq = [
      { question: "Comment vérifier mon disque de frein ?", answer: "Mesurez l'épaisseur avec un pied à coulisse et comparez avec le minimum." },
      { question: "Faut-il changer les plaquettes avec les disques ?", answer: "Oui, il est recommandé de les changer ensemble pour un freinage optimal." },
      { question: "Quelle est la durée de vie d'un disque ?", answer: "En moyenne 60 000 à 80 000 km selon votre style de conduite." },
    ];
    const pack = buildR1SectionPack({
      ...BASE_OPTS,
      purchaseGuideData: { faq: pipelineFaq },
    });

    expect(pack.sections.faq.source).toBe("prompt");
    expect(pack.sections.faq.data).toHaveLength(3);
    expect(pack.sections.faq.data[0].question).toContain("disque de frein");
  });

  it("FAQ <3 valides → source='fallback', items selectorFaq", () => {
    const pipelineFaq = [
      { question: "Courte ?", answer: "Trop courte" }, // answer < 20 chars
      { question: "Valide question ici ?", answer: "Réponse valide avec assez de caractères pour passer." },
    ];
    const pack = buildR1SectionPack({
      ...BASE_OPTS,
      purchaseGuideData: { faq: pipelineFaq },
    });

    expect(pack.sections.faq.source).toBe("fallback");
    // Fallback uses selectorFaq
    expect(pack.sections.faq.data.length).toBeGreaterThanOrEqual(3);
  });

  it("pas de mix pipeline+fallback dans un même champ", () => {
    const pgd: R1PurchaseGuideData = {
      microSeoBlock: "Pipeline SEO block",
      compatErrors: ["Erreur 1", "Erreur 2"],
      safeTableRows: [
        { element: "Custom row", howToCheck: "Custom check" },
      ],
    };
    const pack = buildR1SectionPack({ ...BASE_OPTS, purchaseGuideData: pgd });

    // Each section has exactly one source, never mixed
    for (const [, section] of Object.entries(pack.sections)) {
      expect(["prompt", "api", "fallback"]).toContain(
        (section as { source: string }).source,
      );
    }

    // compatErrors has pipeline data → source=prompt
    expect(pack.sections.compatErrors.source).toBe("prompt");
    expect(pack.sections.compatErrors.data).toEqual(pgd.compatErrors);

    // safeTable has pipeline data → source=prompt
    expect(pack.sections.safeTable.source).toBe("prompt");
  });

  it("compatErrors family-aware quand pipeline vide", () => {
    const pack = buildR1SectionPack({
      ...BASE_OPTS,
      purchaseGuideData: undefined,
    });

    expect(pack.sections.compatErrors.source).toBe("fallback");
    // freinage family → should mention "épaisseur" or "disque"
    expect(pack.sections.compatErrors.data.length).toBe(4);
    expect(
      pack.sections.compatErrors.data.some((e) =>
        e.toLowerCase().includes("épaisseur") || e.toLowerCase().includes("disque"),
      ),
    ).toBe(true);
  });

  it("safeTable family-aware quand pipeline vide", () => {
    const pack = buildR1SectionPack({
      ...BASE_OPTS,
      purchaseGuideData: undefined,
    });

    expect(pack.sections.safeTable.source).toBe("fallback");
    // 2 common + 2 freinage-specific = 4 rows
    expect(pack.sections.safeTable.data).toHaveLength(4);
    expect(
      pack.sections.safeTable.data.some((r) =>
        r.element.toLowerCase().includes("diamètre"),
      ),
    ).toBe(true);
  });
});

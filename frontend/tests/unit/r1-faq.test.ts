import { describe, it, expect } from "vitest";
import { resolveR1Faq, normalizeFaqKey } from "~/utils/r1-faq-merge";
import { validateFaqItems, isValidFaqItem } from "~/utils/faq-validator";

const FALLBACK_FAQ = [
  { question: "Mon véhicule n'apparaît pas ?", answer: "Essayez de rechercher par marque et modèle exact." },
  { question: "Comment être sûr de la compatibilité ?", answer: "Sélectionnez votre véhicule exact dans le sélecteur." },
  { question: "Quels sont les délais de livraison ?", answer: "24 à 48h en France métropolitaine pour les commandes avant 15h." },
  { question: "Où trouver le CNIT de mon véhicule ?", answer: "Le CNIT figure sur votre certificat d'immatriculation." },
];

// ─── resolveR1Faq ─────────────────────────────────────────────────

describe("resolveR1Faq", () => {
  it("pipeline 5 items valides → retourne pipeline, source=prompt", () => {
    const pipeline = [
      { question: "Comment vérifier mon disque ?", answer: "Mesurez l'épaisseur avec un pied à coulisse et comparez." },
      { question: "Faut-il changer par paire ?", answer: "Oui, toujours remplacer les deux disques du même essieu." },
      { question: "Quelle durée de vie moyenne ?", answer: "En moyenne 60 000 à 80 000 km selon la conduite." },
      { question: "Les disques ventilés sont-ils meilleurs ?", answer: "Les disques ventilés évacuent mieux la chaleur, recommandés en usage intensif." },
      { question: "Comment reconnaître un disque usé ?", answer: "Vérifiez le sillon d'usure et les marques sur la surface de frottement." },
    ];
    const result = resolveR1Faq(pipeline, FALLBACK_FAQ);

    expect(result.source).toBe("prompt");
    expect(result.items).toHaveLength(5);
    expect(result.items[0].question).toContain("disque");
  });

  it("pipeline 2 items valides → retourne fallback, source=fallback", () => {
    const pipeline = [
      { question: "Question valide ici ?", answer: "Réponse assez longue pour passer la validation." },
      { question: "Autre question valide ?", answer: "Autre réponse assez longue pour passer la validation." },
    ];
    const result = resolveR1Faq(pipeline, FALLBACK_FAQ);

    expect(result.source).toBe("fallback");
    expect(result.items.length).toBe(FALLBACK_FAQ.length);
  });

  it("pipeline null → retourne fallback", () => {
    const result = resolveR1Faq(null, FALLBACK_FAQ);

    expect(result.source).toBe("fallback");
    expect(result.items).toHaveLength(FALLBACK_FAQ.length);
  });

  it("pipeline items malformés (>110 chars, <20 chars) → filtrés avant comptage", () => {
    const pipeline = [
      { question: "Q".repeat(111) + "?", answer: "Réponse valide avec assez de caractères pour passer." },
      { question: "Bonne question ?", answer: "Court" },
      { question: "Question valide et correcte ?", answer: "Réponse assez longue pour être valide ici." },
    ];
    // Only 1 valid after filtering → fallback
    const result = resolveR1Faq(pipeline, FALLBACK_FAQ);
    expect(result.source).toBe("fallback");
  });

  it("respects custom minPipelineItems threshold", () => {
    const pipeline = [
      { question: "Question unique valide ?", answer: "Réponse assez longue pour être valide ici." },
    ];
    const result = resolveR1Faq(pipeline, FALLBACK_FAQ, 1);
    expect(result.source).toBe("prompt");
    expect(result.items).toHaveLength(1);
  });
});

// ─── normalizeFaqKey ──────────────────────────────────────────────

describe("normalizeFaqKey", () => {
  it("normalizes accents and case", () => {
    expect(normalizeFaqKey("Où trouver le CNIT ?")).toBe(
      normalizeFaqKey("ou trouver le cnit ?"),
    );
  });

  it("strips punctuation except spaces", () => {
    expect(normalizeFaqKey("C'est quoi, un disque?")).toBe("cest quoi un disque");
  });
});

// ─── validateFaqItems ─────────────────────────────────────────────

describe("validateFaqItems", () => {
  it("rejette question > 110 chars", () => {
    const items = [
      { question: "A".repeat(111) + "?", answer: "Réponse valide avec assez de caractères." },
    ];
    expect(validateFaqItems(items)).toHaveLength(0);
  });

  it("rejette réponse < 20 chars", () => {
    const items = [
      { question: "Question valide ?", answer: "Trop court" },
    ];
    expect(validateFaqItems(items)).toHaveLength(0);
  });

  it("rejette question sans '?'", () => {
    const items = [
      { question: "Question sans point d'interrogation", answer: "Réponse valide avec assez de caractères." },
    ];
    expect(validateFaqItems(items)).toHaveLength(0);
  });

  it("rejette double interrogatif", () => {
    const items = [
      { question: "Comment changer quand remplacer les disques ?", answer: "Réponse valide avec assez de caractères pour le test." },
    ];
    // "Comment" + "Quand" = double interrogative
    expect(isValidFaqItem(items[0])).toBe(false);
  });

  it("déduplique par question lowercase", () => {
    const items = [
      { question: "Comment vérifier mon disque ?", answer: "Mesurez l'épaisseur et comparez avec le minimum." },
      { question: "comment vérifier mon disque ?", answer: "Autre réponse identique pour tester la dédup." },
    ];
    expect(validateFaqItems(items)).toHaveLength(1);
  });

  it("cap à maxItems", () => {
    const items = Array.from({ length: 10 }, (_, i) => ({
      question: `Question numéro ${i + 1} valide ?`,
      answer: `Réponse numéro ${i + 1} avec assez de caractères pour la validation.`,
    }));
    expect(validateFaqItems(items, 4)).toHaveLength(4);
    expect(validateFaqItems(items)).toHaveLength(6); // default max = 6
  });
});

/**
 * Générateur de micro-bloc R1 universel.
 * 120-180 mots visibles. Seul gammeName/familleName varient sur 220 gammes.
 * Zéro keyword stuffing — texte utile centré sur la sélection véhicule.
 */

export interface R1MicroBlockInput {
  gammeName: string; // ex: "Disque de frein"
  familleName: string; // ex: "Freinage"
  alias: string; // ex: "disque-frein"
}

export interface R1Card {
  id: "guide" | "conseils" | "reference";
  label: string;
  description: string;
  href: string;
}

export interface R1MicroBlock {
  title: string;
  intro: string;
  bullets: string[];
  carteGriseTip: string;
  safetyAlert: string;
  cards: R1Card[];
}

export function buildR1MicroBlock(input: R1MicroBlockInput): R1MicroBlock {
  const { gammeName, alias } = input;
  const lower = gammeName.toLowerCase();

  return {
    title: `Bien choisir vos ${lower}`,
    intro: `Pour rouler en toute sécurité, sélectionnez des ${lower} compatibles avec votre véhicule. Voici les points clés pour ne pas vous tromper.`,
    bullets: [
      `Utilisez le sélecteur ci-dessus : entrez votre marque, modèle et motorisation pour n'afficher que les ${lower} compatibles.`,
      "Chaque version d'un même modèle peut nécessiter un montage différent — vérifiez bien votre motorisation exacte.",
      "En cas de doute, reportez-vous à votre carte grise (case D.2) pour identifier le code moteur.",
    ],
    carteGriseTip:
      "Le champ D.2 de votre carte grise indique le type-variante-version (TVV). Le numéro VIN (case E) permet une identification précise auprès de nos experts.",
    safetyAlert: `Ne montez jamais des ${lower} non compatibles. Un mauvais choix peut compromettre votre sécurité et celle des autres usagers de la route.`,
    cards: [
      {
        id: "guide",
        label: "Guide d'achat",
        description: "Critères de choix, budget et marques recommandées.",
        href: `/blog-pieces-auto/guide-achat/${alias}`,
      },
      {
        id: "conseils",
        label: "Conseils entretien",
        description:
          "Quand et comment entretenir pour prolonger la durée de vie.",
        href: `/blog-pieces-auto/conseils/${alias}`,
      },
      {
        id: "reference",
        label: "Fiche technique",
        description: "Normes OE, spécifications et définitions techniques.",
        href: `/reference-auto/${alias}`,
      },
    ],
  };
}

/**
 * Générateur de micro-bloc R1 universel.
 * 120-180 mots visibles. Seul gammeName/familleName varient sur 220 gammes.
 * Zéro keyword stuffing — texte utile centré sur la sélection véhicule.
 *
 * v2: micro-preuves injectées depuis les données loader (marques, périodes,
 *     équipementiers, codes moteur) pour remplacer ~30% du template générique.
 */

export interface R1Proofs {
  /** Top 3 marques auto couvertes (ex: ["Peugeot", "Renault", "Volkswagen"]) */
  topMarques: string[];
  /** Noms équipementiers (ex: ["Bosch", "Valeo", "TRW"]) */
  topEquipementiers: string[];
  /** Plage d'années couverte (ex: "2003 – 2024") */
  periodeRange: string;
  /** Nombre total de véhicules compatibles */
  vehicleCount: number;
  /** Codes moteur les plus fréquents (ex: ["DV6ATED4", "K9K"]) */
  topMotorCodes: string[];
}

export interface R1MicroBlockInput {
  gammeName: string; // ex: "Disque de frein"
  familleName: string; // ex: "Freinage"
  alias: string; // ex: "disque-frein"
  proofs?: R1Proofs;
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

/** Formate une liste en "A, B et C" */
function formatList(items: string[], max = 3): string {
  const slice = items.slice(0, max);
  if (slice.length <= 1) return slice[0] || "";
  return `${slice.slice(0, -1).join(", ")} et ${slice[slice.length - 1]}`;
}

export function buildR1MicroBlock(input: R1MicroBlockInput): R1MicroBlock {
  const { gammeName, alias, proofs } = input;
  const lower = gammeName.toLowerCase();

  // ── Intro ──
  // Template si pas de preuves, data-driven sinon
  let intro: string;
  if (proofs && proofs.vehicleCount > 0) {
    const marquesText =
      proofs.topMarques.length > 0
        ? ` (${formatList(proofs.topMarques)}…)`
        : "";
    const periodeText = proofs.periodeRange
      ? `, de ${proofs.periodeRange}`
      : "";
    intro =
      `${proofs.vehicleCount} véhicules couverts${marquesText}${periodeText}. ` +
      `Sélectionnez votre motorisation exacte pour n'afficher que les ${lower} compatibles.`;
  } else {
    intro = `Pour rouler en toute sécurité, sélectionnez des ${lower} compatibles avec votre véhicule. Voici les points clés pour ne pas vous tromper.`;
  }

  // ── Bullets ──
  const bullets: string[] = [];

  // Bullet 1 : sélecteur (toujours présent)
  bullets.push(
    `Utilisez le sélecteur ci-dessus : entrez votre marque, modèle et motorisation pour n'afficher que les ${lower} compatibles.`,
  );

  // Bullet 2 : montage différent + code moteur si dispo
  if (proofs?.topMotorCodes && proofs.topMotorCodes.length > 0) {
    bullets.push(
      `Chaque version peut nécessiter un montage différent — les codes moteur les plus courants sont ${formatList(proofs.topMotorCodes, 3)}.`,
    );
  } else {
    bullets.push(
      `Attention : deux motorisations proches (ex : 1.6 HDi 90 ch vs 110 ch) utilisent souvent des ${lower} différent(e)s. Vérifiez votre motorisation exacte.`,
    );
  }

  // Bullet 3 : équipementiers si dispo, sinon carte grise fallback
  if (proofs?.topEquipementiers && proofs.topEquipementiers.length >= 2) {
    bullets.push(
      `Nos ${lower} proviennent d'équipementiers de référence : ${formatList(proofs.topEquipementiers, 4)}.`,
    );
  } else {
    bullets.push(
      "En cas de doute, reportez-vous à votre carte grise (case D.2) pour identifier le code moteur.",
    );
  }

  return {
    title: `Bien choisir vos ${lower}`,
    intro,
    bullets,
    carteGriseTip:
      "Repérez le code D.2 sur votre carte grise : il identifie votre motorisation exacte. En cas de doute, notre équipe vérifie la compatibilité avant expédition.",
    safetyAlert: `Un doute sur vos ${lower} ? Contactez-nous avec votre VIN ou CNIT — nous vérifions la compatibilité gratuitement avant expédition.`,
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

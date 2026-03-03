/**
 * R1 family-aware defaults — differentiated fallbacks per automotive family.
 * Eliminates thin/duplicate content across 221 gammes.
 */

export type FamilyKey =
  | "freinage"
  | "moteur"
  | "suspension"
  | "transmission"
  | "electrique"
  | "climatisation"
  | "generic";

const FAMILY_MARKERS: Record<Exclude<FamilyKey, "generic">, string[]> = {
  freinage: ["frein", "disque", "plaquette", "etrier", "abs", "tambour"],
  moteur: [
    "moteur",
    "injecteur",
    "distribution",
    "lubrification",
    "turbo",
    "joint de culasse",
    "filtre a huile",
    "pompe a huile",
  ],
  suspension: [
    "suspension",
    "amortisseur",
    "coupelle",
    "ressort",
    "barre stabilisatrice",
    "rotule",
    "bras de suspension",
    "silent bloc",
  ],
  transmission: [
    "embrayage",
    "cardan",
    "boite",
    "transmission",
    "volant moteur",
    "soufflet",
  ],
  electrique: [
    "alternateur",
    "batterie",
    "demarreur",
    "electrique",
    "bougie",
    "bobine",
  ],
  climatisation: [
    "climatisation",
    "compresseur",
    "condenseur",
    "evaporateur",
    "filtre d'habitacle",
    "filtre habitacle",
  ],
};

/** Normalize string for family matching (strip accents, lowercase). */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Infer automotive family from gamme name + famille name. */
export function inferFamilyKey(
  gammeName: string,
  familleName?: string,
): FamilyKey {
  const haystack = norm(`${gammeName} ${familleName || ""}`);
  for (const [family, markers] of Object.entries(FAMILY_MARKERS)) {
    if (markers.some((m) => haystack.includes(norm(m)))) {
      return family as FamilyKey;
    }
  }
  return "generic";
}

/** 4 compat errors differentiated by family. */
export function getDefaultCompatErrors(
  gammeName: string,
  familyKey: FamilyKey,
): string[] {
  const lower = gammeName.toLowerCase();

  const familySpecific: Record<FamilyKey, string> = {
    freinage: `Ignorer l'épaisseur minimale ou le diamètre du disque pour votre montage`,
    moteur: `Ne pas vérifier le code moteur exact gravé sur le bloc`,
    suspension: `Confondre les versions sport et confort (hauteurs différentes)`,
    transmission: `Ignorer le type de volant moteur (simple masse vs bi-masse)`,
    electrique: `Ne pas vérifier l'ampérage et la puissance requis par le véhicule`,
    climatisation: `Omettre de vérifier le type de réfrigérant (R134a vs R1234yf)`,
    generic: `Ne pas vérifier la compatibilité exacte véhicule/moteur avant commande`,
  };

  return [
    `Confondre deux motorisations proches (vérifiez la motorisation exacte)`,
    familySpecific[familyKey],
    `Se fier uniquement au modèle sans vérifier le type exact de ${lower}`,
    `Commander sans comparer la référence OE du constructeur`,
  ];
}

interface SafeRow {
  element: string;
  howToCheck: string;
}

const COMMON_ROWS: SafeRow[] = [
  {
    element: "Montage / version véhicule",
    howToCheck: "Sélectionner son véhicule — le filtre adapte automatiquement",
  },
  {
    element: "Référence OE constructeur",
    howToCheck: "Comparer avec la fiche produit avant commande",
  },
];

const FAMILY_ROWS: Record<FamilyKey, SafeRow[]> = {
  freinage: [
    {
      element: "Diamètre et épaisseur du disque",
      howToCheck:
        "Vérifier les cotes sur la fiche produit vs préconisation constructeur",
    },
    {
      element: "Montage par paire (essieu)",
      howToCheck: "Toujours remplacer les 2 côtés du même essieu simultanément",
    },
  ],
  moteur: [
    {
      element: "Code moteur exact",
      howToCheck: "Vérifier sur le bloc moteur ou via le VIN",
    },
    {
      element: "Version Euro / norme antipollution",
      howToCheck: "Vérifier la date de première immatriculation",
    },
  ],
  suspension: [
    {
      element: "Hauteur et course d'amortissement",
      howToCheck: "Comparer les cotes avec le montage d'origine",
    },
    {
      element: "Version sport ou confort",
      howToCheck: "Vérifier la configuration d'origine du véhicule",
    },
  ],
  transmission: [
    {
      element: "Type de volant moteur",
      howToCheck: "Vérifier si bi-masse ou simple masse avant commande",
    },
    {
      element: "Kit complet ou pièce seule",
      howToCheck: "Vérifier si le kit inclut butée et guide",
    },
  ],
  electrique: [
    {
      element: "Ampérage et puissance",
      howToCheck: "Vérifier les caractéristiques électriques du véhicule",
    },
    {
      element: "Connectique et fixation",
      howToCheck: "Comparer le nombre de broches et le type de fixation",
    },
  ],
  climatisation: [
    {
      element: "Type de réfrigérant",
      howToCheck: "Vérifier R134a ou R1234yf selon le véhicule",
    },
    {
      element: "Raccords et fixations",
      howToCheck: "Comparer le type de raccords avec le montage d'origine",
    },
  ],
  generic: [
    {
      element: "Échange standard (si applicable)",
      howToCheck: "Vérifier la mention + conditions de garantie",
    },
    {
      element: "Conditions de retour",
      howToCheck: "Consulter la politique retour avant montage",
    },
  ],
};

/** 4 safe-table rows differentiated by family (2 common + 2 specific). */
export function getDefaultSafeTableRows(familyKey: FamilyKey): SafeRow[] {
  return [...COMMON_ROWS, ...FAMILY_ROWS[familyKey]];
}

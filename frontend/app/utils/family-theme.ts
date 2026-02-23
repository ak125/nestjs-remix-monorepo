/**
 * Source unique de verite pour les themes visuels par famille/gamme.
 *
 * Remplace toutes les maps couleur dupliquees dans les routes et composants.
 * Approche baseColor : chaque famille a une couleur de base + gradient,
 * les variantes (bg, fg, accent, etc.) sont derivees via COLOR_VARIANTS.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FamilyTheme {
  /** Gradient Tailwind pour heros/headers : "from-red-600 to-rose-700" */
  gradient: string;
  /** Background clair pour cartes/sections : "bg-red-50" */
  bg: string;
  /** Texte sur fond clair : "text-red-700" */
  fg: string;
  /** Texte fort (titres sur fond clair) : "text-red-800" */
  fgStrong: string;
  /** Couleur accent (dots, indicateurs) : "bg-red-500" */
  accent: string;
  /** Bordure standard (cartes) : "border-red-300" */
  border: string;
  /** Bordure accent (top border) : "border-t-red-500" */
  borderAccent: string;
  /** Style badge complet : "bg-red-100 text-red-800" */
  badge: string;
}

export interface EnergyTheme {
  bg: string;
  fg: string;
}

// ---------------------------------------------------------------------------
// Table de derivation stable (Tailwind-safe, ~15 couleurs de base)
// ---------------------------------------------------------------------------

const COLOR_VARIANTS: Record<string, Omit<FamilyTheme, "gradient">> = {
  red: {
    bg: "bg-red-50",
    fg: "text-red-700",
    fgStrong: "text-red-800",
    accent: "bg-red-500",
    border: "border-red-300",
    borderAccent: "border-t-red-500",
    badge: "bg-red-100 text-red-800",
  },
  orange: {
    bg: "bg-orange-50",
    fg: "text-orange-700",
    fgStrong: "text-orange-800",
    accent: "bg-orange-500",
    border: "border-orange-300",
    borderAccent: "border-t-orange-500",
    badge: "bg-orange-100 text-orange-800",
  },
  amber: {
    bg: "bg-amber-50",
    fg: "text-amber-700",
    fgStrong: "text-amber-900",
    accent: "bg-amber-500",
    border: "border-amber-300",
    borderAccent: "border-t-amber-500",
    badge: "bg-amber-100 text-amber-900",
  },
  yellow: {
    bg: "bg-yellow-50",
    fg: "text-yellow-700",
    fgStrong: "text-yellow-900",
    accent: "bg-yellow-500",
    border: "border-yellow-300",
    borderAccent: "border-t-yellow-500",
    badge: "bg-yellow-100 text-yellow-900",
  },
  lime: {
    bg: "bg-lime-50",
    fg: "text-lime-700",
    fgStrong: "text-lime-800",
    accent: "bg-lime-500",
    border: "border-lime-300",
    borderAccent: "border-t-lime-500",
    badge: "bg-lime-100 text-lime-800",
  },
  green: {
    bg: "bg-green-50",
    fg: "text-green-700",
    fgStrong: "text-green-800",
    accent: "bg-green-500",
    border: "border-green-300",
    borderAccent: "border-t-green-500",
    badge: "bg-green-100 text-green-800",
  },
  emerald: {
    bg: "bg-emerald-50",
    fg: "text-emerald-700",
    fgStrong: "text-emerald-800",
    accent: "bg-emerald-500",
    border: "border-emerald-300",
    borderAccent: "border-t-emerald-500",
    badge: "bg-emerald-100 text-emerald-800",
  },
  teal: {
    bg: "bg-teal-50",
    fg: "text-teal-700",
    fgStrong: "text-teal-800",
    accent: "bg-teal-500",
    border: "border-teal-300",
    borderAccent: "border-t-teal-500",
    badge: "bg-teal-100 text-teal-800",
  },
  cyan: {
    bg: "bg-cyan-50",
    fg: "text-cyan-700",
    fgStrong: "text-cyan-800",
    accent: "bg-cyan-500",
    border: "border-cyan-300",
    borderAccent: "border-t-cyan-500",
    badge: "bg-cyan-100 text-cyan-800",
  },
  sky: {
    bg: "bg-sky-50",
    fg: "text-sky-700",
    fgStrong: "text-sky-800",
    accent: "bg-sky-500",
    border: "border-sky-300",
    borderAccent: "border-t-sky-500",
    badge: "bg-sky-100 text-sky-800",
  },
  blue: {
    bg: "bg-blue-50",
    fg: "text-blue-700",
    fgStrong: "text-blue-800",
    accent: "bg-blue-500",
    border: "border-blue-300",
    borderAccent: "border-t-blue-500",
    badge: "bg-blue-100 text-blue-800",
  },
  indigo: {
    bg: "bg-indigo-50",
    fg: "text-indigo-700",
    fgStrong: "text-indigo-800",
    accent: "bg-indigo-500",
    border: "border-indigo-300",
    borderAccent: "border-t-indigo-500",
    badge: "bg-indigo-100 text-indigo-800",
  },
  violet: {
    bg: "bg-violet-50",
    fg: "text-violet-700",
    fgStrong: "text-violet-800",
    accent: "bg-violet-500",
    border: "border-violet-300",
    borderAccent: "border-t-violet-500",
    badge: "bg-violet-100 text-violet-800",
  },
  purple: {
    bg: "bg-purple-50",
    fg: "text-purple-700",
    fgStrong: "text-purple-800",
    accent: "bg-purple-500",
    border: "border-purple-300",
    borderAccent: "border-t-purple-500",
    badge: "bg-purple-100 text-purple-800",
  },
  fuchsia: {
    bg: "bg-fuchsia-50",
    fg: "text-fuchsia-700",
    fgStrong: "text-fuchsia-800",
    accent: "bg-fuchsia-500",
    border: "border-fuchsia-300",
    borderAccent: "border-t-fuchsia-500",
    badge: "bg-fuchsia-100 text-fuchsia-800",
  },
  pink: {
    bg: "bg-pink-50",
    fg: "text-pink-700",
    fgStrong: "text-pink-800",
    accent: "bg-pink-500",
    border: "border-pink-300",
    borderAccent: "border-t-pink-500",
    badge: "bg-pink-100 text-pink-800",
  },
  rose: {
    bg: "bg-rose-50",
    fg: "text-rose-700",
    fgStrong: "text-rose-800",
    accent: "bg-rose-500",
    border: "border-rose-300",
    borderAccent: "border-t-rose-500",
    badge: "bg-rose-100 text-rose-800",
  },
  slate: {
    bg: "bg-slate-100",
    fg: "text-slate-700",
    fgStrong: "text-slate-800",
    accent: "bg-slate-600",
    border: "border-slate-300",
    borderAccent: "border-t-slate-600",
    badge: "bg-slate-100 text-slate-800",
  },
  gray: {
    bg: "bg-gray-50",
    fg: "text-gray-700",
    fgStrong: "text-gray-800",
    accent: "bg-gray-500",
    border: "border-gray-400",
    borderAccent: "border-t-gray-500",
    badge: "bg-gray-100 text-gray-800",
  },
  zinc: {
    bg: "bg-zinc-50",
    fg: "text-zinc-700",
    fgStrong: "text-zinc-800",
    accent: "bg-zinc-500",
    border: "border-zinc-400",
    borderAccent: "border-t-zinc-500",
    badge: "bg-zinc-100 text-zinc-800",
  },
};

// ---------------------------------------------------------------------------
// Source de verite par famille (ID → baseColor + gradient)
// Gradients repris de hierarchy.api.ts
// ---------------------------------------------------------------------------

interface FamilyDef {
  baseColor: string;
  gradient: string;
}

const FAMILY_THEMES_BY_ID: Record<string, FamilyDef> = {
  // === MECANIQUE & MOTEUR ===
  "1": { baseColor: "blue", gradient: "from-blue-500 to-blue-700" }, // Filtration
  "2": { baseColor: "red", gradient: "from-red-600 to-rose-700" }, // Freinage
  "3": { baseColor: "slate", gradient: "from-slate-600 to-slate-800" }, // Distribution
  "4": { baseColor: "yellow", gradient: "from-yellow-400 to-amber-600" }, // Electrique/Allumage
  "10": { baseColor: "orange", gradient: "from-orange-600 to-red-700" }, // Moteur
  "14": { baseColor: "lime", gradient: "from-lime-500 to-green-600" }, // Alimentation
  "16": { baseColor: "rose", gradient: "from-rose-600 to-pink-700" }, // Turbo
  "19": { baseColor: "green", gradient: "from-emerald-600 to-green-700" }, // Embrayage

  // === TRAIN ROULANT ===
  "5": { baseColor: "emerald", gradient: "from-emerald-500 to-teal-600" }, // Train avant
  "6": { baseColor: "purple", gradient: "from-purple-600 to-violet-700" }, // Amortisseur
  "12": { baseColor: "teal", gradient: "from-teal-600 to-cyan-700" }, // Transmission
  "15": { baseColor: "violet", gradient: "from-violet-600 to-purple-800" }, // Support moteur

  // === SYSTEMES ELECTRONIQUES ===
  "7": { baseColor: "indigo", gradient: "from-indigo-500 to-blue-700" }, // Eclairage
  "13": { baseColor: "amber", gradient: "from-amber-600 to-orange-700" }, // Capteurs

  // === CONFORT & HABITACLE ===
  "8": { baseColor: "cyan", gradient: "from-cyan-400 to-blue-600" }, // Refroidissement
  "17": { baseColor: "sky", gradient: "from-sky-400 to-cyan-600" }, // Climatisation
  "18": { baseColor: "fuchsia", gradient: "from-fuchsia-500 to-pink-600" }, // Accessoires

  // === STRUCTURE & CARROSSERIE ===
  "9": { baseColor: "pink", gradient: "from-pink-500 to-rose-600" }, // Carrosserie
  "11": { baseColor: "gray", gradient: "from-gray-700 to-neutral-800" }, // Echappement

  // === COULEURS SUPPLEMENTAIRES (ID 20-50) ===
  "20": { baseColor: "blue", gradient: "from-blue-400 to-indigo-600" },
  "21": { baseColor: "green", gradient: "from-green-400 to-emerald-600" },
  "22": { baseColor: "red", gradient: "from-red-400 to-rose-600" },
  "23": { baseColor: "purple", gradient: "from-purple-400 to-fuchsia-600" },
  "24": { baseColor: "yellow", gradient: "from-yellow-300 to-orange-500" },
  "25": { baseColor: "cyan", gradient: "from-cyan-300 to-teal-600" },
  "26": { baseColor: "indigo", gradient: "from-indigo-400 to-purple-700" },
  "27": { baseColor: "lime", gradient: "from-lime-400 to-green-700" },
  "28": { baseColor: "amber", gradient: "from-amber-400 to-yellow-700" },
  "29": { baseColor: "rose", gradient: "from-rose-400 to-red-700" },
  "30": { baseColor: "teal", gradient: "from-teal-400 to-cyan-700" },
  "31": { baseColor: "violet", gradient: "from-violet-400 to-purple-700" },
  "32": { baseColor: "sky", gradient: "from-sky-300 to-blue-700" },
  "33": { baseColor: "emerald", gradient: "from-emerald-400 to-teal-700" },
  "34": { baseColor: "orange", gradient: "from-orange-400 to-red-600" },
  "35": { baseColor: "pink", gradient: "from-pink-400 to-fuchsia-700" },
  "36": { baseColor: "slate", gradient: "from-slate-400 to-gray-700" },
  "37": { baseColor: "zinc", gradient: "from-zinc-500 to-slate-700" },
  "38": { baseColor: "gray", gradient: "from-neutral-500 to-gray-700" },
  "39": { baseColor: "slate", gradient: "from-stone-500 to-slate-700" },
  "40": { baseColor: "red", gradient: "from-red-500 to-orange-700" },
  "41": { baseColor: "blue", gradient: "from-blue-300 to-cyan-600" },
  "42": { baseColor: "green", gradient: "from-green-300 to-lime-600" },
  "43": { baseColor: "purple", gradient: "from-purple-300 to-violet-600" },
  "44": { baseColor: "yellow", gradient: "from-yellow-200 to-amber-600" },
  "45": { baseColor: "pink", gradient: "from-pink-300 to-rose-600" },
  "46": { baseColor: "indigo", gradient: "from-indigo-300 to-blue-600" },
  "47": { baseColor: "teal", gradient: "from-teal-300 to-emerald-600" },
  "48": { baseColor: "orange", gradient: "from-orange-300 to-red-600" },
  "49": { baseColor: "fuchsia", gradient: "from-fuchsia-300 to-pink-600" },
  "50": { baseColor: "cyan", gradient: "from-cyan-200 to-teal-600" },
};

// ---------------------------------------------------------------------------
// Mapping par mot-cle (normalise, sans accents)
// ---------------------------------------------------------------------------

const KEYWORD_TO_FAMILY_ID: Record<string, string> = {
  // Mecanique & Moteur
  filtration: "1",
  filtre: "1",
  filtres: "1",
  freinage: "2",
  frein: "2",
  distribution: "3",
  courroie: "3",
  galet: "3",
  poulie: "3",
  chaine: "3",
  electrique: "4",
  allumage: "4",
  batterie: "4",
  prechauffage: "4",
  moteur: "10",
  bloc: "10",
  alimentation: "14",
  carburant: "14",
  essence: "14",
  diesel: "14",
  turbo: "16",
  compresseur: "16",
  embrayage: "19",
  volant: "19",

  // Train roulant
  train: "5",
  direction: "5",
  cremaillere: "5",
  liaison: "5",
  amortisseur: "6",
  suspension: "6",
  ressort: "6",
  transmission: "12",
  boite: "12",
  differentiel: "12",
  support: "15",
  silent: "15",
  tampon: "15",

  // Electronique
  eclairage: "7",
  phare: "7",
  feu: "7",
  capteur: "13",
  sonde: "13",
  calculateur: "13",

  // Confort
  refroidissement: "8",
  radiateur: "8",
  eau: "8",
  climatisation: "17",
  clim: "17",
  condenseur: "17",
  accessoire: "18",
  interieur: "18",
  equipement: "18",

  // Structure
  carrosserie: "9",
  aile: "9",
  pare: "9",
  capot: "9",
  echappement: "11",
  silencieux: "11",
  pot: "11",

  // Autres
  lubrifiant: "13",
  huile: "13",
  liquide: "8",
  pneumatique: "11",
  pneu: "11",
  roue: "11",
  vitrage: "17",
};

// ---------------------------------------------------------------------------
// Default theme (fallback gris neutre)
// ---------------------------------------------------------------------------

const DEFAULT_THEME: FamilyTheme = {
  gradient: "from-gray-500 to-gray-700",
  bg: "bg-gray-50",
  fg: "text-gray-700",
  fgStrong: "text-gray-800",
  accent: "bg-gray-400",
  border: "border-gray-300",
  borderAccent: "border-t-gray-400",
  badge: "bg-gray-100 text-gray-800",
};

// ---------------------------------------------------------------------------
// Fallback palette pour hash (couleurs distinctes)
// ---------------------------------------------------------------------------

const HASH_PALETTE: string[] = [
  "blue",
  "green",
  "red",
  "purple",
  "yellow",
  "cyan",
  "pink",
  "indigo",
  "lime",
  "amber",
];

// ---------------------------------------------------------------------------
// Cache interne
// ---------------------------------------------------------------------------

const themeCache = new Map<string, FamilyTheme>();

// ---------------------------------------------------------------------------
// API publique
// ---------------------------------------------------------------------------

function buildTheme(def: FamilyDef): FamilyTheme {
  const variants = COLOR_VARIANTS[def.baseColor];
  if (!variants) return { ...DEFAULT_THEME, gradient: def.gradient };
  return { ...variants, gradient: def.gradient };
}

function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Retourne le theme visuel complet pour une famille/gamme.
 *
 * Accepte un ID (number | string) ou un nom de famille.
 * Recherche : ID exact → mot-cle dans le nom → hash fallback.
 */
export function getFamilyTheme(idOrName: string | number): FamilyTheme {
  const key = String(idOrName);

  // Cache hit
  const cached = themeCache.get(key);
  if (cached) return cached;

  let theme: FamilyTheme;

  // 1. Lookup par ID exact
  const byId = FAMILY_THEMES_BY_ID[key];
  if (byId) {
    theme = buildTheme(byId);
    themeCache.set(key, theme);
    return theme;
  }

  // 2. Lookup par mot-cle dans le nom
  const normalized = normalize(key);
  for (const [keyword, familyId] of Object.entries(KEYWORD_TO_FAMILY_ID)) {
    if (normalized.includes(keyword)) {
      const def = FAMILY_THEMES_BY_ID[familyId];
      if (def) {
        theme = buildTheme(def);
        themeCache.set(key, theme);
        return theme;
      }
    }
  }

  // 3. Fallback hash → couleur consistante
  const hash =
    typeof idOrName === "number" ? idOrName : parseInt(key, 10) || key.length;
  const baseColor = HASH_PALETTE[Math.abs(hash) % HASH_PALETTE.length];
  const fallbackGradient =
    FAMILY_THEMES_BY_ID[String((Math.abs(hash) % 19) + 1)]?.gradient ||
    DEFAULT_THEME.gradient;

  theme = buildTheme({ baseColor, gradient: fallbackGradient });
  themeCache.set(key, theme);
  return theme;
}

/**
 * Retourne le theme pour un type d'energie vehicule.
 */
export function getEnergyTheme(energy: string): EnergyTheme {
  const map: Record<string, EnergyTheme> = {
    diesel: { bg: "bg-gray-700", fg: "text-white" },
    essence: { bg: "bg-red-600", fg: "text-white" },
    hybride: { bg: "bg-green-600", fg: "text-white" },
    electrique: { bg: "bg-blue-500", fg: "text-white" },
    gpl: { bg: "bg-amber-500", fg: "text-white" },
  };
  return map[energy.toLowerCase()] || { bg: "bg-gray-500", fg: "text-white" };
}

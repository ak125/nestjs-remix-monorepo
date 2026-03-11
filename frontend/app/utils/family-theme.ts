/**
 * Themes visuels par famille/gamme.
 *
 * Approche baseColor : chaque famille a une couleur de base + gradient,
 * les variantes (bg, fg, accent, etc.) sont derivees via COLOR_VARIANTS.
 * Les données famille viennent de FAMILY_REGISTRY (@repo/database-types).
 */
import { FAMILY_REGISTRY, findFamilyIdByKeyword } from "@repo/database-types";

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
// FamilyDef type (pour buildTheme)
// ---------------------------------------------------------------------------

interface FamilyDef {
  baseColor: string;
  gradient: string;
}

// Construit FAMILY_THEMES_BY_ID depuis FAMILY_REGISTRY (source unique)
const FAMILY_THEMES_BY_ID: Record<string, FamilyDef> = Object.fromEntries(
  Object.entries(FAMILY_REGISTRY).map(([id, meta]) => [
    id,
    { baseColor: meta.baseColor, gradient: meta.gradient },
  ]),
);

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

  // 2. Lookup par mot-cle via FAMILY_REGISTRY
  const foundId = findFamilyIdByKeyword(key);
  if (foundId) {
    const def = FAMILY_THEMES_BY_ID[String(foundId)];
    if (def) {
      theme = buildTheme(def);
      themeCache.set(key, theme);
      return theme;
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

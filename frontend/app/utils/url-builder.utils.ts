/**
 * URL Builder Utilities
 * Fonctions pour construire des URLs cohérentes avec le backend
 */

/**
 * Normalise un alias pour correspondre au format backend
 * Ex: "Alfa Roméo" → "alfa-romeo"
 * Ex: "Rolls-Royce" → "rolls-royce"
 * Ex: "BMW série 3" → "bmw-serie-3"
 */
export function normalizeAlias(alias: string): string {
  if (!alias) return "";
  return alias
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Supprime accents (é → e, à → a)
    .replace(/[^a-z0-9\s-]/g, "") // Supprime caractères spéciaux
    .replace(/\s+/g, "-") // Espaces → tirets
    .replace(/-+/g, "-") // Tirets multiples → simple
    .replace(/^-|-$/g, "") // Supprime tirets début/fin
    .trim();
}

/**
 * Interface pour les liens "Voir aussi"
 */
export interface VoirAussiLinks {
  gammeUrl: string; // /pieces/plaquette-de-frein-402.html
  constructeurUrl: string; // /constructeurs/citroen-46.html
  modeleUrl: string; // /constructeurs/citroen-46/berlingo-ii-46007.html
  catalogueUrl: string; // /pieces
}

/**
 * Vérifie si une URL interne est valide
 * Note: Validation permissive pour éviter les faux positifs
 * (ex: "berlingo-ii" contient "ii" mais est valide)
 */
export function isValidInternalUrl(url: string): boolean {
  if (!url) return false;
  if (url.includes("undefined")) return false;
  if (url.includes("null")) return false;
  // URL interne doit commencer par /
  return url.startsWith("/");
}

/**
 * Normalizes a type_alias for URL construction.
 * Handles null, undefined, empty strings, literal "null", and generic "type" fallbacks.
 * Uses type_name (slugified) as fallback, NOT the type_id (to avoid "28495-28495.html")
 *
 * @param alias - The raw type_alias from database
 * @param typeName - The type_name to use as fallback (will be slugified)
 * @returns A safe string for URL construction
 */
export function normalizeTypeAlias(
  alias: string | null | undefined,
  typeName: string | null | undefined,
): string {
  // Handle null, undefined, empty, literal "null" string, or generic "type"
  if (!alias || alias.trim() === "" || alias === "null" || alias === "type") {
    // Fallback to slugified type_name
    if (typeName && typeName.trim() !== "") {
      return normalizeAlias(typeName);
    }
    return "type"; // Ultimate fallback
  }
  return alias;
}

/**
 * Constructs a vehicle type URL segment: "{alias}-{id}"
 * @example buildTypeSlug({ type_alias: null, type_name: "2.0 16V", type_id: 28495 }) => "2-0-16v-28495"
 * @example buildTypeSlug({ type_alias: "gti", type_id: 28495 }) => "gti-28495"
 */
export function buildTypeSlug(type: {
  type_alias?: string | null;
  type_name?: string | null;
  type_id: number | string;
}): string {
  const alias = normalizeTypeAlias(type.type_alias, type.type_name);
  return `${alias}-${type.type_id}`;
}

/**
 * Interface pour un item de breadcrumb
 */
export interface BreadcrumbItem {
  label: string;
  href?: string;
  current?: boolean; // 🆕 Marque la page courante (pas de lien cliquable)
}

/**
 * Construit les items de breadcrumb pour la page pièces
 * @param gamme - Données de la gamme (id, name, alias)
 * @param vehicle - Données du véhicule
 * @param currentUrl - 🆕 URL canonique de la page courante (pour Schema.org)
 * @returns Tableau d'items pour le composant Breadcrumbs
 */
export function buildPiecesBreadcrumbs(
  gamme: { id: number; name: string; alias: string },
  vehicle: {
    marque: string;
    modele: string;
    type: string;
    typeName?: string;
    marqueId: number;
    modeleId: number;
    typeId: number;
    marqueAlias?: string;
    modeleAlias?: string;
    typeAlias?: string;
  },
  currentUrl?: string, // 🆕 URL de la page courante pour Schema.org
): BreadcrumbItem[] {
  const marqueAlias = vehicle.marqueAlias || normalizeAlias(vehicle.marque);
  const modeleAlias = vehicle.modeleAlias || normalizeAlias(vehicle.modele);
  const typeAlias = normalizeTypeAlias(
    vehicle.typeAlias,
    vehicle.typeName || vehicle.type,
  );

  return [
    { label: "Accueil", href: "/" },
    {
      label: gamme.name,
      href: `/pieces/${gamme.alias}-${gamme.id}.html`,
    },
    {
      label: `Pièces ${vehicle.marque}`,
      href: `/constructeurs/${marqueAlias}-${vehicle.marqueId}.html`,
    },
    {
      label: `${vehicle.modele} ${vehicle.typeName || vehicle.type}`,
      href: `/constructeurs/${marqueAlias}-${vehicle.marqueId}/${modeleAlias}-${vehicle.modeleId}/${typeAlias}-${vehicle.typeId}.html`,
    },
    {
      label: `${gamme.name} ${vehicle.marque} ${vehicle.modele}`,
      href: currentUrl, // 🆕 URL canonique pour Schema.org (pas cliquable visuellement)
      current: true, // 🆕 Marquer comme page courante
    },
  ];
}

/**
 * Construit les URLs pour la section "Voir aussi"
 * Utilise les alias normalisés du véhicule
 */
export function buildVoirAussiLinks(
  gamme: { alias: string; id: number },
  vehicle: {
    marque: string;
    marqueId: number;
    marqueAlias?: string;
    modele: string;
    modeleId: number;
    modeleAlias?: string;
    typeAlias?: string;
    typeName?: string;
    typeId: number;
  },
): VoirAussiLinks {
  // Utiliser les alias existants ou les normaliser
  const marqueAlias = vehicle.marqueAlias || normalizeAlias(vehicle.marque);
  const modeleAlias = vehicle.modeleAlias || normalizeAlias(vehicle.modele);
  const typeAlias = normalizeTypeAlias(vehicle.typeAlias, vehicle.typeName);

  return {
    gammeUrl: `/pieces/${gamme.alias}-${gamme.id}.html`,
    constructeurUrl: `/constructeurs/${marqueAlias}-${vehicle.marqueId}.html`,
    modeleUrl: `/constructeurs/${marqueAlias}-${vehicle.marqueId}/${modeleAlias}-${vehicle.modeleId}/${typeAlias}-${vehicle.typeId}.html`,
    catalogueUrl: "/#catalogue",
  };
}

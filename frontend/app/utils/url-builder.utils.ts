/**
 * URL Builder Utilities
 * Fonctions pour construire des URLs cohérentes avec le backend
 */

// Alias normalization is owned by the shared SoT package (ADR-062).
// Imported for local use AND re-exported so existing callers keep working.
import {
  detectMalformedSegment,
  normalizeAlias,
  normalizeTypeAlias,
} from "@repo/seo-url-contract";
export { normalizeAlias, normalizeTypeAlias };

/** Build a canonical gamme destination only from a usable alias and ID. */
export function buildGammeUrl(
  pgAlias: string | null | undefined,
  pgId: number | null | undefined,
): string | undefined {
  if (typeof pgId !== "number" || !Number.isSafeInteger(pgId) || pgId <= 0) {
    return undefined;
  }
  const alias = normalizeAlias(pgAlias);
  const segment = `${alias}-${pgId}`;
  if (!alias || detectMalformedSegment(segment)) return undefined;
  return `/pieces/${segment}.html`;
}

const isPositiveId = (id: unknown): id is number =>
  typeof id === "number" && Number.isSafeInteger(id) && id > 0;

/**
 * Build the gamme destination for one motorisation, in the segment order of
 * the canonical R2 path. Returns undefined unless brand, model and
 * motorisation each carry a usable alias and ID: callers keep the gamme URL.
 * A type alias is never derived from the engine name here, since that
 * derivation differs from most catalogue aliases ("1.2 16V" → "12-16v").
 */
export function buildGammeVehicleUrl(
  pgAlias: string | null | undefined,
  pgId: number | null | undefined,
  vehicle: {
    brandAlias?: string;
    brandId?: number;
    modelAlias?: string;
    modelId?: number;
    typeAlias?: string;
    typeName?: string;
    typeId?: number;
  },
): string | undefined {
  const gammeUrl = buildGammeUrl(pgAlias, pgId);
  const { brandId, modelId, typeId } = vehicle;
  if (
    !gammeUrl ||
    !vehicle.typeAlias?.trim() ||
    !isPositiveId(brandId) ||
    !isPositiveId(modelId) ||
    !isPositiveId(typeId)
  ) {
    return undefined;
  }
  const segments = [
    `${normalizeAlias(vehicle.brandAlias)}-${brandId}`,
    `${normalizeAlias(vehicle.modelAlias)}-${modelId}`,
    buildTypeSlug({
      type_alias: vehicle.typeAlias,
      type_name: vehicle.typeName,
      type_id: typeId,
    }),
  ];
  if (segments.some((segment) => detectMalformedSegment(segment))) {
    return undefined;
  }
  return `${gammeUrl.slice(0, -".html".length)}/${segments.join("/")}.html`;
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
 * Constructs a vehicle type URL segment: "{alias}-{id}"
 * @example buildTypeSlug({ type_alias: null, type_name: "2.0 16V", type_id: 28495 }) => "2-0-16v-28495"
 * @example buildTypeSlug({ type_alias: "gti", type_id: 28495 }) => "gti-28495"
 */
export function buildTypeSlug(type: {
  type_alias?: string | null;
  type_name?: string | null;
  type_id: number | string;
}): string {
  const alias = normalizeTypeAlias(
    type.type_alias,
    type.type_name,
    type.type_id,
  );
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

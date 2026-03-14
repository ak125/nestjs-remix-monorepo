/**
 * 🔗 URL Builder Utilities
 *
 * Fonctions centralisées pour la construction d'URLs SEO-friendly
 * Utilisées par les services SEO, gamme, pièces, etc.
 *
 * @author Assistant
 * @version 1.0.0
 */

/**
 * Normalise un alias pour l'URL
 * - Convertit en minuscules
 * - Remplace les espaces par des tirets
 * - Supprime les caractères spéciaux
 * - Gère les accents
 */
export function normalizeAlias(alias: string): string {
  if (!alias) return '';

  return alias
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Supprime les accents
    .replace(/[^a-z0-9\s-]/g, '') // Garde lettres, chiffres, espaces, tirets
    .replace(/\s+/g, '-') // Espaces -> tirets
    .replace(/-+/g, '-') // Tirets multiples -> tiret unique
    .replace(/^-|-$/g, '') // Supprime tirets début/fin
    .trim();
}

/**
 * Normalise un type_alias pour la construction d'URLs.
 * Gère NULL, undefined, chaîne vide, "null" littéral, et fallback "type".
 * Utilise type_name (slugifié) comme fallback pour éviter les URLs "28495-28495.html".
 */
export function normalizeTypeAlias(
  alias: string | null | undefined,
  typeName: string | null | undefined,
): string {
  if (!alias || alias.trim() === '' || alias === 'null' || alias === 'type') {
    if (typeName && typeName.trim() !== '') {
      return normalizeAlias(typeName);
    }
    return 'type';
  }
  return alias;
}

/**
 * Construit un segment d'URL pour un type véhicule: "{alias}-{id}"
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
 * Construit un slug avec ID
 * Format: {alias}-{id}
 */
export function buildSlug(alias: string, id: number | string): string {
  const cleanAlias = normalizeAlias(String(alias));
  return `${cleanAlias}-${id}`;
}

/**
 * Construit une URL de gamme
 * Format: /pieces/{pg_alias}-{pg_id}.html
 */
export function buildGammeUrl(pgAlias: string, pgId: number): string {
  const cleanAlias = normalizeAlias(pgAlias);
  return `/pieces/${cleanAlias}-${pgId}.html`;
}

/**
 * Construit une URL de pièce pour un véhicule
 * Format: /pieces/{gamme_alias}-{gamme_id}/{marque_alias}-{marque_id}/{modele_alias}-{modele_id}/{type_alias}-{type_id}.html
 */
export function buildPieceVehicleUrl(
  gammeAlias: string,
  gammeId: number,
  marqueAlias: string,
  marqueId: number,
  modeleAlias: string,
  modeleId: number,
  typeAlias: string | null | undefined,
  typeId: number,
  typeName?: string | null,
): string {
  return `/pieces/${normalizeAlias(gammeAlias)}-${gammeId}/${normalizeAlias(marqueAlias)}-${marqueId}/${normalizeAlias(modeleAlias)}-${modeleId}/${normalizeTypeAlias(typeAlias, typeName)}-${typeId}.html`;
}

/**
 * Construit une URL de pièce pour un véhicule (version raw/simplifiée)
 * Prend des objets avec alias et id
 */
export function buildPieceVehicleUrlRaw(
  gamme: { alias: string; id: number },
  marque: { alias: string; id: number },
  modele: { alias: string; id: number },
  type: { alias: string; id: number },
): string {
  return buildPieceVehicleUrl(
    gamme.alias,
    gamme.id,
    marque.alias,
    marque.id,
    modele.alias,
    modele.id,
    type.alias,
    type.id,
  );
}

/**
 * Construit une URL de constructeur/marque
 * Format: /constructeurs/{marque_alias}-{marque_id}.html
 */
export function buildConstructeurUrl(
  marqueAlias: string,
  marqueId: number,
): string {
  const cleanAlias = normalizeAlias(marqueAlias);
  return `/constructeurs/${cleanAlias}-${marqueId}.html`;
}

/**
 * Construit une URL de type de véhicule pour un constructeur
 * Format: /constructeurs/{marque_alias}-{marque_id}/{modele_alias}-{modele_id}/{type_alias}-{type_id}.html
 */
export function buildConstructeurTypeUrl(
  marqueAlias: string,
  marqueId: number,
  modeleAlias: string,
  modeleId: number,
  typeAlias: string | null | undefined,
  typeId: number,
  typeName?: string | null,
): string {
  return `/constructeurs/${normalizeAlias(marqueAlias)}-${marqueId}/${normalizeAlias(modeleAlias)}-${modeleId}/${normalizeTypeAlias(typeAlias, typeName)}-${typeId}.html`;
}

/**
 * Construit une URL de modèle pour un constructeur
 * Format: /constructeurs/{marque_alias}-{marque_id}/{modele_alias}-{modele_id}.html
 */
export function buildConstructeurModeleUrl(
  marqueAlias: string,
  marqueId: number,
  modeleAlias: string,
  modeleId: number,
): string {
  return `/constructeurs/${normalizeAlias(marqueAlias)}-${marqueId}/${normalizeAlias(modeleAlias)}-${modeleId}.html`;
}

/**
 * Extrait l'ID d'un slug
 * @example extractIdFromSlug('plaquette-de-frein-402') => 402
 */
export function extractIdFromSlug(slug: string): number | null {
  if (!slug) return null;
  const match = slug.match(/-(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Extrait l'alias d'un slug (sans l'ID)
 * @example extractAliasFromSlug('plaquette-de-frein-402') => 'plaquette-de-frein'
 */
export function extractAliasFromSlug(slug: string): string {
  if (!slug) return '';
  return slug.replace(/-\d+$/, '');
}

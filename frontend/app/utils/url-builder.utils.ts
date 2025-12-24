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
  if (!alias) return '';
  return alias
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Supprime accents (é → e, à → a)
    .replace(/[^a-z0-9\s-]/g, '')    // Supprime caractères spéciaux
    .replace(/\s+/g, '-')            // Espaces → tirets
    .replace(/-+/g, '-')             // Tirets multiples → simple
    .replace(/^-|-$/g, '')           // Supprime tirets début/fin
    .trim();
}

/**
 * Interface pour les liens "Voir aussi"
 */
export interface VoirAussiLinks {
  gammeUrl: string;        // /pieces/plaquette-de-frein-402.html
  constructeurUrl: string; // /constructeurs/citroen-46.html
  modeleUrl: string;       // /constructeurs/citroen-46/berlingo-ii-46007.html
  catalogueUrl: string;    // /pieces
}

/**
 * Vérifie si une URL interne est valide
 * Note: Validation permissive pour éviter les faux positifs
 * (ex: "berlingo-ii" contient "ii" mais est valide)
 */
export function isValidInternalUrl(url: string): boolean {
  if (!url) return false;
  if (url.includes('undefined')) return false;
  // URL interne doit commencer par /
  return url.startsWith('/');
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
    typeId: number;
  }
): VoirAussiLinks {
  // Utiliser les alias existants ou les normaliser
  const marqueAlias = vehicle.marqueAlias || normalizeAlias(vehicle.marque);
  const modeleAlias = vehicle.modeleAlias || normalizeAlias(vehicle.modele);
  const typeAlias = vehicle.typeAlias || 'type';

  return {
    gammeUrl: `/pieces/${gamme.alias}-${gamme.id}.html`,
    constructeurUrl: `/constructeurs/${marqueAlias}-${vehicle.marqueId}.html`,
    modeleUrl: `/constructeurs/${marqueAlias}-${vehicle.marqueId}/${modeleAlias}-${vehicle.modeleId}/${typeAlias}-${vehicle.typeId}.html`,
    catalogueUrl: '/#catalogue',
  };
}

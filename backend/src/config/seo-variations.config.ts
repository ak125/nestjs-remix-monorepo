/**
 * 🔄 Configuration centralisée des variations SEO
 *
 * Utilisée par DynamicSeoV4UltimateService
 * pour garantir la cohérence des variations marketing.
 *
 * Formule de rotation : (typeId + pgId + offset) % variations.length
 * Cette formule garantit une distribution déterministe et reproductible.
 */

/**
 * Variations pour #PrixPasCher#
 * 7 variations marketing pour le prix
 */
export const SEO_PRICE_VARIATIONS = [
  'à prix imbattables',
  'pas cher',
  'à petit prix',
  'économique',
  'à prix réduit',
  'à tarif avantageux',
  'au meilleur prix',
] as const;

/**
 * Variations pour #VousPropose#
 * 5 variations de présentation
 */
export const SEO_PROPOSE_VARIATIONS = [
  'vous propose',
  'vous offre',
  'met à disposition',
  'vous recommande',
  'vous présente',
] as const;

// Types exportés pour TypeScript
export type PriceVariation = (typeof SEO_PRICE_VARIATIONS)[number];
export type ProposeVariation = (typeof SEO_PROPOSE_VARIATIONS)[number];

/**
 * Sélectionne une variation par rotation déterministe
 *
 * @param variations - Array de variations possibles
 * @param typeId - ID du type véhicule
 * @param pgId - ID de la gamme (optionnel, default 0)
 * @param offset - Décalage supplémentaire (optionnel, default 0)
 * @returns La variation sélectionnée
 *
 * @example
 * // typeId=9045, pgId=4 → index=(9045+4) % 7 = 2 → "à petit prix"
 * selectVariation(SEO_PRICE_VARIATIONS, 9045, 4)
 */
export function selectVariation<T>(
  variations: readonly T[],
  typeId: number,
  pgId: number = 0,
  offset: number = 0,
): T {
  const index = (typeId + pgId + offset) % variations.length;
  return variations[index];
}

/**
 * Variante de sélection qui retourne aussi l'index
 * Utile pour le debugging et les tests
 */
export function selectVariationWithIndex<T>(
  variations: readonly T[],
  typeId: number,
  pgId: number = 0,
  offset: number = 0,
): { value: T; index: number } {
  const index = (typeId + pgId + offset) % variations.length;
  return { value: variations[index], index };
}

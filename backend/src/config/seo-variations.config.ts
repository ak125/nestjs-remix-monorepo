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

// ─────────────────────────────────────────────────────────────────────────────
// ADR-022 Pilier 2b — R8 Vehicle/Motorisation variation pools
//
// Sizing rationale : pool sizes chosen as PRIMES (7, 11, 13) or coprime-safe
// values so that `typeId % N` yields maximum distinct residues across sibling
// motorisations of a given model. Avoided N=8, 9, 10, 12 which share factors
// with common sibling counts (Clio III = 18 types, Renault brand = ~100 types
// per generation). See audit report: Phase B.1 baseline.
//
// Per-slot OFFSET provides salting to keep slots independent : slot_1 offset 0,
// slot_2 offset 100, slot_3 offset 200, etc. — ensures same type_id gets
// different picks per slot.
//
// Editorial ownership : modifications via PR signed commits (G3). Pattern
// aligned with R1-R6 existing SEO_PRICE_VARIATIONS / SEO_PROPOSE_VARIATIONS.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Variations pour l'intro motorisation (bloc S_IDENTITY + S_SEO_INTRO).
 * Size = 7 (prime, max distribution sur 18 siblings Clio III).
 * Placeholders : {brand} {model} {type} {power} {fuel} {year_from} {year_to}
 */
export const SEO_R8_INTRO_VARIATIONS = [
  "La {brand} {model} {type} {power} ch {fuel} a été produite de {year_from} à {year_to}. Cette fiche regroupe l'ensemble des pièces compatibles.",
  "Moteur {type} équipe la {brand} {model} avec {power} ch {fuel}. Sélectionnez parmi notre catalogue les pièces d'origine et équivalentes homologuées.",
  'Équipée du bloc {type} ({power} ch {fuel}), votre {brand} {model} dispose de nombreuses familles de pièces référencées et garanties.',
  'Retrouvez dans cette fiche la liste complète des pièces compatibles avec votre {brand} {model} {type} {power} ch, produite à partir de {year_from}.',
  'Votre {brand} {model} {type} {power} ch {fuel} mérite des pièces de qualité. Consultez notre sélection spécifique pour cette motorisation.',
  "Cette {brand} {model} motorisation {type} de {power} ch ({fuel}) bénéficie d'un catalogue pièces d'origine et compatibles auprès d'équipementiers reconnus.",
  'Fiche technique et pièces compatibles pour la {brand} {model} {type} ({power} ch {fuel}), années {year_from}-{year_to}.',
] as const;

/**
 * Variations pour différenciation motorisation vs sœurs (bloc S_VARIANT_DIFFERENCE).
 * Size = 11 (prime, meilleure distribution sur grands modèles >50 types).
 * Placeholders : {brand} {model} {type} {power} {fuel} {engine_code} {families_count}
 */
export const SEO_R8_VARIANT_HIGHLIGHT_VARIATIONS = [
  'Cette motorisation {type} {power} ch se distingue des autres versions par sa puissance et son catalogue spécifique.',
  'La version {type} {power} ch {fuel} possède certaines pièces propres à cette motorisation (turbo, injecteurs, calculateur).',
  'Attention : les pièces de la {type} {power} ch ne sont pas toujours interchangeables avec les autres motorisations du même modèle.',
  'Les {families_count} familles de pièces référencées pour cette {type} {power} ch incluent des composants spécifiques à la version {fuel}.',
  'Dans la gamme {brand} {model}, la {type} {power} ch se reconnaît à ses caractéristiques moteur distinctes.',
  "Cette déclinaison {type} {power} ch {fuel} adresse un profil d'usage spécifique — adaptez votre choix de pièces en conséquence.",
  "La motorisation {type} ({power} ch) bénéficie d'un catalogue pièces auto segmenté par famille technique, distinct des autres versions.",
  'Certains composants (courroie, embrayage, distribution) diffèrent pour la {type} {power} ch — vérifiez la compatibilité avant commande.',
  'Parmi les versions {brand} {model}, la {type} {power} ch présente des besoins entretien et pièces propres à cette motorisation {fuel}.',
  'Fiabilité et entretien spécifiques à la {type} {power} ch : ce bloc regroupe les pièces et conseils adaptés à votre motorisation.',
  'La {type} de {power} ch ({fuel}) partage certaines pièces avec les autres motorisations, mais comporte aussi des éléments dédiés.',
] as const;

/**
 * Variations pour l'accès au catalogue familles pièces (bloc S_CATALOG_ACCESS).
 * Size = 7 (prime).
 * Placeholders : {brand} {model} {type} {families_count}
 */
export const SEO_R8_CATALOG_ACCESS_VARIATIONS = [
  'Parcourez les {families_count} familles de pièces compatibles avec votre {brand} {model} {type} classées par usage.',
  '{families_count} familles de pièces référencées pour cette motorisation — naviguez par catégorie ci-dessous.',
  'Catalogue complet {brand} {model} {type} organisé en {families_count} familles : freinage, moteur, filtration, transmission, etc.',
  'Choisissez parmi {families_count} familles de pièces détachées pour votre {brand} {model} {type}, chacune accompagnée de références compatibles.',
  'Toutes les familles de pièces pour {brand} {model} {type} regroupées ci-dessous — {families_count} catégories techniques distinctes.',
  'Votre {brand} {model} {type} est couverte par {families_count} familles de pièces, du freinage à la carrosserie.',
  'Explorez les {families_count} catégories de pièces compatibles {brand} {model} {type} — sélectionnez celle correspondant à votre besoin.',
] as const;

/**
 * Variations d'amorce FAQ (bloc S_FAQ_DEDICATED).
 * Size = 7 (prime).
 * Placeholders : {brand} {model} {type}
 */
export const SEO_R8_FAQ_OPENING_VARIATIONS = [
  'Questions fréquentes sur les pièces {brand} {model} {type} — compatibilité, entretien, référencement.',
  'Les interrogations les plus courantes concernant votre {brand} {model} {type} sont traitées ci-dessous.',
  "FAQ dédiée à la motorisation {brand} {model} {type} : compatibilité pièces, conseils entretien, signes d'usure.",
  'Voici les réponses aux questions les plus posées par les propriétaires de {brand} {model} {type}.',
  "Conseils pratiques et questions fréquentes pour l'entretien de votre {brand} {model} {type}.",
  "Aide à l'achat et FAQ motorisation {brand} {model} {type} — retrouvez les réponses aux questions essentielles.",
  'Section dédiée aux questions fréquentes autour de votre {brand} {model} {type} : pièces, entretien, garanties.',
] as const;

/**
 * Variations trust signals (bloc S_TRUST — atténue boilerplate).
 * Size = 5 (stable, bloc moins différenciant par nature).
 * Placeholders : {brand} {model}
 */
export const SEO_R8_TRUST_SIGNAL_VARIATIONS = [
  'AutoMecanik garantit la conformité des pièces {brand} {model} avec les standards constructeur, livrées sous 24-48h.',
  'Toutes les pièces {brand} {model} sont vérifiées, référencées par équipementier reconnu, expédiées rapidement partout en France.',
  'Commandez vos pièces {brand} {model} en toute confiance : garantie constructeur, paiement sécurisé, retours acceptés 30 jours.',
  "Notre équipe sélectionne pour {brand} {model} des pièces d'origine et compatibles validées, avec livraison express.",
  'Qualité OEM et compatibles pour {brand} {model} — stock professionnel, assistance téléphonique, expédition 24h ouvrées.',
] as const;

export type R8IntroVariation = (typeof SEO_R8_INTRO_VARIATIONS)[number];
export type R8VariantHighlight =
  (typeof SEO_R8_VARIANT_HIGHLIGHT_VARIATIONS)[number];
export type R8CatalogAccessVariation =
  (typeof SEO_R8_CATALOG_ACCESS_VARIATIONS)[number];
export type R8FaqOpeningVariation =
  (typeof SEO_R8_FAQ_OPENING_VARIATIONS)[number];
export type R8TrustSignalVariation =
  (typeof SEO_R8_TRUST_SIGNAL_VARIATIONS)[number];

/**
 * Slot offsets for R8 variation rotation. Different offset per slot ensures
 * that the same type_id picks independent variants across slots (salting).
 */
export const R8_SLOT_OFFSETS = {
  INTRO: 0,
  VARIANT_HIGHLIGHT: 100,
  CATALOG_ACCESS: 200,
  FAQ_OPENING: 300,
  TRUST_SIGNAL: 400,
} as const;

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

/**
 * 🏷️ Meta Tags Generators
 * 
 * Templates de meta tags optimisés pour le CTR par type de page.
 * Utilise des variables dynamiques et des formules éprouvées.
 */

export interface MetaTagsResult {
  title: string;
  description: string;
  keywords?: string[];
}

/**
 * 📦 Génère les meta tags pour une page gamme de produits
 * 
 * @example
 * generateGammeMeta({
 *   name: 'Plaquettes de frein',
 *   count: 3542,
 *   minPrice: 12.90,
 *   maxPrice: 89.90,
 *   brand: 'Bosch'
 * })
 */
export interface GammeMetaOptions {
  /** Nom de la gamme */
  name: string;
  /** Nombre de produits */
  count?: number;
  /** Prix minimum */
  minPrice?: number;
  /** Prix maximum */
  maxPrice?: number;
  /** Marque principale (optionnel) */
  brand?: string;
  /** Marque de véhicule (optionnel) */
  vehicleBrand?: string;
  /** Modèle de véhicule (optionnel) */
  vehicleModel?: string;
  /** Année (optionnel) */
  year?: number;
  /** En stock */
  inStock?: boolean;
  /** En promotion */
  onSale?: boolean;
}

export function generateGammeMeta(options: GammeMetaOptions): MetaTagsResult {
  const {
    name,
    count,
    minPrice,
    maxPrice,
    brand,
    vehicleBrand,
    vehicleModel,
    inStock = true,
    onSale = false,
  } = options;

  // Templates de titre (max 60 caractères)
  const titleTemplates = [
    // Avec véhicule spécifique
    vehicleBrand && vehicleModel
      ? `${name} ${vehicleBrand} ${vehicleModel} | Pas Cher & Livraison Rapide`
      : null,
    // Avec marque produit
    brand
      ? `${name} ${brand} | Prix Discount -${onSale ? '30' : '20'}% | Stock Disponible`
      : null,
    // Avec prix
    minPrice && maxPrice
      ? `${name} dès ${minPrice.toFixed(2)}€ | ${count ? `${count}+ ` : ''}Pièces Auto`
      : null,
    // Générique optimisé
    `${name} Pas Cher | Qualité OEM | Livraison 24-48h`,
  ].filter(Boolean);

  const title = titleTemplates[0] || `${name} | Automecanik`;

  // Templates de description (max 155 caractères)
  const descTemplates = [
    // Avec véhicule
    vehicleBrand && vehicleModel
      ? `${name} pour ${vehicleBrand} ${vehicleModel}. ${count ? `${count}+ références` : 'Large choix'}, qualité garantie. ${inStock ? '✓ En stock' : ''} ${onSale ? '✓ Promo' : ''} ✓ Livraison rapide.`
      : null,
    // Avec marque
    brand
      ? `${name} ${brand} au meilleur prix. ${count ? `${count} produits` : 'Grand choix'} en stock. Qualité OEM, garantie 2 ans. Livraison 24-48h.`
      : null,
    // Avec prix
    minPrice && maxPrice
      ? `${name} de ${minPrice.toFixed(2)}€ à ${maxPrice.toFixed(2)}€. ${count ? `${count}+ références` : 'Large sélection'} en stock. Paiement sécurisé, livraison express.`
      : null,
    // Générique
    `${name} de qualité professionnelle au meilleur prix. ${count ? `${count}+ produits` : 'Large choix'} en stock. Garantie 2 ans, livraison 24-48h partout en France.`,
  ].filter(Boolean);

  const description = descTemplates[0] || `${name} - Automecanik`;

  // Keywords
  const keywords = [
    name.toLowerCase(),
    `${name.toLowerCase()} pas cher`,
    `${name.toLowerCase()} discount`,
    vehicleBrand ? `${name.toLowerCase()} ${vehicleBrand.toLowerCase()}` : null,
    vehicleModel ? `${name.toLowerCase()} ${vehicleBrand?.toLowerCase()} ${vehicleModel.toLowerCase()}` : null,
    brand ? `${name.toLowerCase()} ${brand.toLowerCase()}` : null,
    `achat ${name.toLowerCase()}`,
    `prix ${name.toLowerCase()}`,
  ].filter(Boolean) as string[];

  return {
    title: truncateTitle(title),
    description: truncateDescription(description),
    keywords,
  };
}

/**
 * 🔧 Génère les meta tags pour une page pièce spécifique
 * 
 * @example
 * generatePieceMeta({
 *   name: 'Plaquettes de frein avant',
 *   reference: 'PLQ-FR-402-AV',
 *   price: 42.90,
 *   originalPrice: 54.90,
 *   brand: 'Bosch',
 *   vehicleBrand: 'Renault',
 *   vehicleModel: 'Clio III',
 *   vehicleMotor: '1.5 dCi'
 * })
 */
export interface PieceMetaOptions {
  /** Nom de la pièce */
  name: string;
  /** Référence */
  reference?: string;
  /** Prix actuel */
  price: number;
  /** Prix original (barré) */
  originalPrice?: number;
  /** Marque de la pièce */
  brand?: string;
  /** Marque du véhicule */
  vehicleBrand: string;
  /** Modèle du véhicule */
  vehicleModel: string;
  /** Motorisation */
  vehicleMotor?: string;
  /** En stock */
  inStock?: boolean;
  /** Garantie (années) */
  warranty?: number;
}

export function generatePieceMeta(options: PieceMetaOptions): MetaTagsResult {
  const {
    name,
    reference,
    price,
    originalPrice,
    brand,
    vehicleBrand,
    vehicleModel,
    vehicleMotor,
    inStock = true,
    warranty = 2,
  } = options;

  const discount = originalPrice ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;
  const priceStr = price.toFixed(2).replace('.', ',');

  // Titre optimisé (max 60 caractères)
  const titleTemplates = [
    // Avec motorisation
    vehicleMotor
      ? `${name} ${vehicleBrand} ${vehicleModel} ${vehicleMotor} - ${priceStr}€`
      : null,
    // Avec marque pièce
    brand
      ? `${name} ${brand} ${vehicleBrand} ${vehicleModel} ${discount > 0 ? `-${discount}%` : ''}`
      : null,
    // Avec réduction
    discount > 10
      ? `${name} ${vehicleBrand} ${vehicleModel} -${discount}% | ${priceStr}€`
      : null,
    // Standard
    `${name} ${vehicleBrand} ${vehicleModel} | Dès ${priceStr}€`,
  ].filter(Boolean);

  const title = titleTemplates[0] || `${name} ${vehicleBrand} ${vehicleModel}`;

  // Description (max 155 caractères)
  const descTemplates = [
    // Avec tout
    brand && vehicleMotor
      ? `${name} ${brand} pour ${vehicleBrand} ${vehicleModel} ${vehicleMotor}. ${inStock ? '✓ En stock' : 'Délai court'}, ${priceStr}€ ${discount > 0 ? `(-${discount}%)` : ''}. Garantie ${warranty} ans.`
      : null,
    // Sans motorisation
    brand
      ? `${name} ${brand} compatible ${vehicleBrand} ${vehicleModel}. Prix: ${priceStr}€ ${discount > 0 ? `(économie ${discount}%)` : ''}. ${inStock ? 'Stock immédiat' : 'Livraison rapide'}, garantie ${warranty} ans.`
      : null,
    // Standard
    `${name} pour ${vehicleBrand} ${vehicleModel}. Qualité OEM, ${priceStr}€. ${inStock ? '✓ Disponible' : '✓ Commande'}, livraison 24-48h. Garantie ${warranty} ans.`,
  ].filter(Boolean);

  const description = descTemplates[0] || `${name} pour ${vehicleBrand} ${vehicleModel}`;

  // Keywords
  const keywords = [
    `${name.toLowerCase()} ${vehicleBrand.toLowerCase()} ${vehicleModel.toLowerCase()}`,
    vehicleMotor ? `${name.toLowerCase()} ${vehicleBrand.toLowerCase()} ${vehicleModel.toLowerCase()} ${vehicleMotor.toLowerCase()}` : null,
    brand ? `${name.toLowerCase()} ${brand.toLowerCase()}` : null,
    reference ? reference.toLowerCase() : null,
    `prix ${name.toLowerCase()} ${vehicleBrand.toLowerCase()}`,
    `acheter ${name.toLowerCase()} ${vehicleBrand.toLowerCase()}`,
  ].filter(Boolean) as string[];

  return {
    title: truncateTitle(title),
    description: truncateDescription(description),
    keywords,
  };
}

/**
 * 🚗 Génère les meta tags pour une page marque/modèle
 * 
 * @example
 * generateMarqueMeta({
 *   brand: 'Renault',
 *   model: 'Clio III',
 *   gamme: 'Plaquettes de frein',
 *   productsCount: 127,
 *   minPrice: 12.90
 * })
 */
export interface MarqueMetaOptions {
  /** Marque véhicule */
  brand: string;
  /** Modèle (optionnel) */
  model?: string;
  /** Motorisation (optionnel) */
  motor?: string;
  /** Gamme de pièces */
  gamme?: string;
  /** Nombre de produits */
  productsCount?: number;
  /** Prix minimum */
  minPrice?: number;
  /** Période (ex: "2005-2012") */
  period?: string;
}

export function generateMarqueMeta(options: MarqueMetaOptions): MetaTagsResult {
  const { brand, model, motor, gamme, productsCount, minPrice, period } = options;

  // Construire le nom complet du véhicule
  const vehicleName = [brand, model, motor].filter(Boolean).join(' ');

  // Titre
  const titleTemplates = [
    // Gamme spécifique
    gamme && model
      ? `${gamme} ${brand} ${model} ${motor || ''} | ${productsCount || 'Pièces'}`
      : null,
    // Modèle seul
    model
      ? `Pièces Auto ${brand} ${model} ${motor || ''} | Catalogue Complet`
      : null,
    // Marque seule
    `Pièces Détachées ${brand} | ${productsCount ? `${productsCount}+ ` : ''}Références`,
  ].filter(Boolean);

  const title = titleTemplates[0] || `Pièces ${brand}`;

  // Description
  const descTemplates = [
    // Avec gamme et modèle
    gamme && model
      ? `${gamme} pour ${vehicleName}${period ? ` (${period})` : ''}. ${productsCount ? `${productsCount} produits` : 'Large choix'} ${minPrice ? `dès ${minPrice.toFixed(2)}€` : ''}. Qualité OEM, livraison rapide.`
      : null,
    // Modèle seul
    model
      ? `Catalogue complet de pièces auto pour ${vehicleName}. ${productsCount ? `${productsCount}+ références` : 'Toutes les pièces'} en stock. Prix compétitifs, garantie constructeur.`
      : null,
    // Marque seule
    `Pièces détachées ${brand} au meilleur prix. ${productsCount ? `${productsCount}+ produits` : 'Large gamme'} disponibles. Qualité OEM, livraison 24-48h partout en France.`,
  ].filter(Boolean);

  const description = descTemplates[0] || `Pièces auto ${brand}`;

  // Keywords
  const keywords = [
    gamme ? `${gamme.toLowerCase()} ${brand.toLowerCase()}` : `pièces ${brand.toLowerCase()}`,
    model ? `${gamme?.toLowerCase() || 'pièces'} ${brand.toLowerCase()} ${model.toLowerCase()}` : null,
    motor ? `${brand.toLowerCase()} ${model?.toLowerCase()} ${motor.toLowerCase()}` : null,
    `catalogue ${brand.toLowerCase()}`,
    `prix pièces ${brand.toLowerCase()}`,
  ].filter(Boolean) as string[];

  return {
    title: truncateTitle(title),
    description: truncateDescription(description),
    keywords,
  };
}

/**
 * 🔍 Génère les meta tags pour une page de recherche
 */
export interface SearchMetaOptions {
  query: string;
  resultsCount: number;
  filters?: Record<string, any>;
}

export function generateSearchMeta(options: SearchMetaOptions): MetaTagsResult {
  const { query, resultsCount, filters } = options;

  const hasFilters = filters && Object.keys(filters).length > 0;
  const filtersSummary = hasFilters
    ? Object.entries(filters)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ')
    : '';

  const title = `Recherche "${query}" | ${resultsCount} résultat${resultsCount > 1 ? 's' : ''}`;

  const description = `${resultsCount} pièce${resultsCount > 1 ? 's' : ''} trouvée${resultsCount > 1 ? 's' : ''} pour "${query}"${hasFilters ? ` (${filtersSummary})` : ''}. Qualité garantie, livraison rapide.`;

  return {
    title: truncateTitle(title),
    description: truncateDescription(description),
    keywords: [query.toLowerCase()],
  };
}

/**
 * ✂️ Tronque le titre à 60 caractères max
 */
function truncateTitle(title: string, maxLength: number = 60): string {
  if (title.length <= maxLength) return title;
  return title.substring(0, maxLength - 3) + '...';
}

/**
 * ✂️ Tronque la description à 155 caractères max
 */
function truncateDescription(description: string, maxLength: number = 155): string {
  if (description.length <= maxLength) return description;
  return description.substring(0, maxLength - 3) + '...';
}

/**
 * 📝 Génère les meta tags par défaut (fallback)
 */
export function generateDefaultMeta(): MetaTagsResult {
  return {
    title: 'Pièces Auto Pas Cher | Automecanik - Qualité OEM Garantie',
    description:
      'Pièces détachées auto de qualité OEM au meilleur prix. Large catalogue en stock, livraison 24-48h, garantie 2 ans. Paiement sécurisé.',
    keywords: [
      'pièces auto',
      'pièces détachées',
      'auto pas cher',
      'qualité oem',
      'livraison rapide',
    ],
  };
}

/**
 * 🎨 Formatte les meta tags pour Remix Meta Function
 */
export function formatMetaForRemix(meta: MetaTagsResult) {
  return [
    { title: meta.title },
    { name: 'description', content: meta.description },
    ...(meta.keywords ? [{ name: 'keywords', content: meta.keywords.join(', ') }] : []),
  ];
}

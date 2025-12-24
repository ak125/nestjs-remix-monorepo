/**
 * 🎯 Types pour la route pièces véhicule
 * Extrait de pieces.$gamme.$marque.$modele.$type[.]html.tsx
 */

// ✅ Type pour les paramètres URL avec validation obligatoire des IDs
export interface UrlParamWithId {
  alias: string;
  id: number; // Toujours requis, jamais 0
}

// ✅ Type pour validation des IDs de véhicule
export interface ValidatedVehicleIds {
  marqueId: number;
  modeleId: number;
  typeId: number;
  source: 'url' | 'api' | 'fallback'; // Pour tracer l'origine
}

export interface VehicleData {
  marque: string;
  modele: string;
  type: string;
  typeName?: string; // Nom complet avec puissance et années (ex: "3.0 TDI 240 ch de 2009 à 2010")
  typeId: number;
  marqueId: number;
  modeleId: number;
  marqueAlias?: string; // Alias de la marque pour les couleurs
  modeleAlias?: string; // Alias du modèle pour l'URL
  typeAlias?: string; // Alias du type/motorisation pour l'URL breadcrumb
  modelePic?: string; // Photo du modèle
  // 🔧 Codes moteur et types mines (depuis batch-loader vehicleInfo)
  motorCodes?: string[];
  motorCodesFormatted?: string;
  mineCodes?: string[];
  mineCodesFormatted?: string;
  cnitCodes?: string[];
  cnitCodesFormatted?: string;
  // 📊 Specs techniques supplementaires
  typePowerPs?: number;
  typePowerKw?: number;
  typeFuel?: string;
  typeBody?: string;
  typeCylinderCm3?: number;
  // 📅 Dates de production (pour JSON-LD vehicleModelDate)
  typeDateStart?: string;
  typeDateEnd?: string;
}

export interface GammeData {
  id: number;
  name: string;
  alias: string;
  description: string;
  image?: string;
  famille?: FamilleData; // Famille pour gradient dynamique
}

export interface PieceData {
  id: number;
  name: string;
  price: number;
  priceFormatted: string;
  brand: string;
  stock: string;
  reference: string;
  oemRef?: string; // Référence OEM constructeur (ex: "1109 91")
  matchKind?: number; // 0=direct, 1=OEM équip, 2=OEM constr, 3-4=équivalences croisées
  quality?: string;
  stars?: number;
  side?: string;
  delaiLivraison?: number;
  description?: string;
  image?: string; // URL de l'image depuis Supabase rack-images
  images?: string[]; // Galerie d'images
  marque_id?: number; // ID de la marque équipementier
  marque_logo?: string; // Nom du fichier logo (ex: "bosch.webp")
  url?: string; // URL de la fiche produit
}

export interface SEOEnrichedContent {
  h1: string;
  h2Sections: string[];
  longDescription: string;
  technicalSpecs: string[];
  compatibilityNotes: string;
  installationTips: string[];
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  schema?: boolean;
}

export interface BlogArticle {
  id: string;
  title: string;
  excerpt: string;
  slug: string;
  image?: string;
  date: string;
  readTime: number;
}

export interface GuideContent {
  title: string;
  content: string;
  tips: string[];
  warnings?: string[];
}

export interface CrossSellingGamme {
  PG_ID: number;
  PG_NAME: string;
  PG_ALIAS: string;
  PG_IMAGE?: string;
}

/**
 * 🔧 Données OEM constructeur
 * Références OEM pour SEO et affichage
 */
export interface OemRefsData {
  vehicleMarque: string;
  oemRefs: string[];
  count: number;
}

export interface CompatibilityInfo {
  engines: string[];
  years: string;
  notes: string[];
}

export interface PerformanceInfo {
  loadTime: number;
  source: string;
  cacheHit: boolean;
}

export interface SEOInfo {
  title: string;
  h1: string;
  description: string;
}

export interface CatalogueItem {
  name: string;
  link: string;
  image: string;
  description: string;
  meta_description: string;
  sort?: number;
}

export interface CatalogueMameFamille {
  title: string;
  items: CatalogueItem[];
}

export interface FamilleData {
  mf_id: number;
  mf_name: string;
  mf_pic: string;
}

export interface LoaderData {
  vehicle: VehicleData;
  vehicleDetails?: any; // Détails complets du véhicule
  gamme: GammeData;
  pieces: PieceData[];
  count: number;
  minPrice: number;
  maxPrice: number;
  prixPasCherText?: string; // Texte dynamique "pas cher"
  
  // Contenu enrichi V5
  seoContent: SEOEnrichedContent;
  faqItems: FAQItem[];
  relatedArticles: BlogArticle[];
  buyingGuide: GuideContent;
  compatibilityInfo: CompatibilityInfo;
  
  // Sections cross-selling et blog
  crossSellingGammes: CrossSellingGamme[];
  blogArticle?: BlogArticle;
  
  // Catalogue famille
  catalogueMameFamille?: CatalogueMameFamille;
  famille?: FamilleData;
  
  // 🔧 Références OEM constructeur
  oemRefs?: OemRefsData;
  oemRefsSeo?: string[];
  
  seo: SEOInfo;
  performance: PerformanceInfo;
}

// Types pour les filtres
export interface PiecesFilters {
  brands: string[];
  priceRange: "all" | "low" | "medium" | "high";
  quality: "all" | "OES" | "AFTERMARKET" | "Echange Standard" | string; // Support des valeurs API dynamiques
  availability: "all" | "stock" | "order";
  searchText: string;
  minNote?: number; // Filtre par note minimale sur 10 (calculée depuis nb_stars)
  position?: "all" | string; // Filtre par position (Avant/Arrière, Gauche/Droite, etc.)
}

export type SortBy = "name" | "price-asc" | "price-desc" | "brand";

export type ViewMode = "grid" | "list" | "comparison";

export interface PriceHistory {
  currentPrice: number;
  previousPrice?: number;
  trend?: 'up' | 'down' | 'stable';
}

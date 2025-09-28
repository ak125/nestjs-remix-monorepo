// 🎯 TYPES PARTAGÉS V5 MODULAIRE
// Types extraits pour la modularité

export interface VehicleData {
  marque: string;
  modele: string;
  type: string;
  typeId: number;
  marqueId: number;
  modeleId: number;
}

export interface GammeData {
  id: number;
  name: string;
  alias: string;
  description: string;
  image?: string;
}

export interface PieceData {
  id: number;
  name: string;
  price: number;
  priceFormatted: string;
  brand: string;
  stock: string;
  reference: string;
  quality?: string;
  stars?: number;
  side?: string;
  delaiLivraison?: number;
  description?: string;
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

export interface LoaderData {
  vehicle: VehicleData;
  gamme: GammeData;
  pieces: PieceData[];
  count: number;
  minPrice: number;
  maxPrice: number;
  
  // V5 - Contenu enrichi
  seoContent: SEOEnrichedContent;
  faqItems: FAQItem[];
  relatedArticles: BlogArticle[];
  buyingGuide: GuideContent;
  compatibilityInfo: {
    engines: string[];
    years: string;
    notes: string[];
  };
  
  seo: {
    title: string;
    h1: string;
    description: string;
  };
  performance: {
    loadTime: number;
    source: string;
    cacheHit: boolean;
  };
}
/**
 * Interfaces partagées pour le module blog
 * Évite les dépendances circulaires entre services
 */

export interface BlogSection {
  level: number;
  title: string;
  content: string;
  anchor: string;
  cta_anchor?: string | null; // Texte du bouton CTA
  cta_link?: string | null;   // URL du bouton CTA
  wall?: string | null;       // Image de la section
}

export interface BlogArticle {
  id: string;
  type: 'advice' | 'guide' | 'constructeur' | 'glossaire';
  title: string;
  slug: string;
  pg_alias?: string | null; // Alias de la gamme (pieces_gamme.pg_alias) pour URL legacy
  excerpt: string;
  content: string;
  h1?: string;
  h2?: string;
  keywords: string[];
  tags: string[];
  publishedAt: string;
  updatedAt?: string;
  viewsCount: number;
  readingTime?: number;
  sections: BlogSection[];
  legacy_id: number;
  legacy_table: string;
  cta_anchor?: string | null; // Texte du bouton CTA principal
  cta_link?: string | null;   // URL du bouton CTA principal
  relatedArticles?: BlogArticle[]; // Articles croisés (sidebar "On vous propose")
  compatibleVehicles?: any[]; // Véhicules compatibles (à implémenter)
  seo_data?: {
    meta_title: string;
    meta_description: string;
    keywords?: string[];
  };
}

export interface BlogSearchResult {
  query: string;
  type: 'all' | 'advice' | 'guide' | 'constructeur' | 'glossaire';
  results: BlogArticle[];
  total: number;
  page?: number;
  limit?: number;
}

export interface BlogDashboard {
  featured?: BlogArticle[];
  recent?: BlogArticle[];
  popular?: BlogArticle[];
  categories?: any[];
  stats?: any;
  overview?: {
    totalArticles: number;
    totalViews: number;
    totalAdvice: number;
    totalGuides: number;
  };
  byType?: {
    [key: string]: {
      total: number;
      views: number;
      avgViews: number;
    };
  };
  lastUpdated: string;
  success: boolean;
}

/**
 * Interfaces partagées pour le module blog
 * Évite les dépendances circulaires entre services
 */

export interface BlogSection {
  level: number;
  title: string;
  content: string;
  anchor: string;
}

export interface BlogArticle {
  id: string;
  type: 'advice' | 'guide' | 'constructeur' | 'glossaire';
  title: string;
  slug: string;
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

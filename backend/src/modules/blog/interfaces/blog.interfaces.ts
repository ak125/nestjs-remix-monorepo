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
  cta_link?: string | null; // URL du bouton CTA
  wall?: string | null; // Image de la section
}

export interface BlogArticle {
  id: string;
  type: 'advice' | 'guide' | 'constructeur' | 'glossaire';
  title: string;
  slug: string;
  pg_alias?: string | null; // Alias de la gamme (pieces_gamme.pg_alias) pour URL legacy
  pg_id?: number | null; // ID de la gamme (pieces_gamme.pg_id) pour récupérer SEO switches et conseils
  ba_pg_id?: string | null; // ID de gamme (string) depuis __blog_advice - pour catégorisation frontend
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
  h2Count?: number;
  h3Count?: number;
  featuredImage?: string | null; // URL de l'image d'en-tête (ex: /uploads/blog/articles/20.jpg)
  sections: BlogSection[];
  legacy_id: number;
  legacy_table: string;
  source?: 'manual' | 'auto';
  cta_anchor?: string | null; // Texte du bouton CTA principal
  cta_link?: string | null; // URL du bouton CTA principal
  relatedArticles?: BlogArticle[]; // Articles croisés (sidebar "On vous propose")
  compatibleVehicles?: Record<string, unknown>[]; // Véhicules compatibles (à implémenter)
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
  [key: string]: unknown;
  featured?: BlogArticle[];
  recent?: BlogArticle[];
  popular?: BlogArticle[];
  categories?: Array<{ name: string; count: number; [key: string]: unknown }>;
  stats?: Record<string, unknown>;
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

/** Raw row from __blog_advice */
export interface BaRow {
  ba_id: number;
  ba_title?: string;
  ba_alias?: string;
  ba_h1?: string;
  ba_h2?: string;
  ba_content?: string;
  ba_preview?: string;
  ba_descrip?: string;
  ba_keywords?: string;
  ba_create?: string;
  ba_update?: string;
  ba_visit?: string;
  ba_pg_id?: string;
  ba_cta_anchor?: string | null;
  ba_cta_link?: string | null;
  pg_alias?: string;
  [key: string]: unknown;
}

/** Raw row from __blog_advice_h2 */
export interface BaH2Row {
  ba2_id: number;
  ba2_ba_id: number;
  ba2_h2?: string;
  ba2_content?: string;
  ba2_cta_anchor?: string | null;
  ba2_cta_link?: string | null;
  ba2_wall?: string | null;
  [key: string]: unknown;
}

/** Raw row from __blog_advice_h3 */
export interface BaH3Row {
  ba3_id: number;
  ba3_ba_id: number;
  ba3_ba2_id?: number;
  ba3_h3?: string;
  ba3_content?: string;
  ba3_cta_anchor?: string | null;
  ba3_cta_link?: string | null;
  ba3_wall?: string | null;
  [key: string]: unknown;
}

/** Raw row from __blog_guide */
export interface BgRow {
  bg_id: number;
  bg_title?: string;
  bg_alias?: string;
  bg_h1?: string;
  bg_h2?: string;
  bg_content?: string;
  bg_preview?: string;
  bg_descrip?: string;
  bg_keywords?: string;
  bg_meta_title?: string;
  bg_meta_description?: string;
  bg_create?: string;
  bg_update?: string;
  bg_visit?: string;
  [key: string]: unknown;
}

/** Raw row from __blog_constructeur (joined with __blog_site_marque) */
export interface BcRow {
  bc_id: number;
  bsm_id: number;
  bsm_marque_id: string;
  bc_alias?: string;
  bc_constructeur?: string;
  bc_h1?: string;
  bc_h2?: string;
  bc_content?: string;
  bc_preview?: string;
  bc_descrip?: string;
  bc_keywords?: string;
  bc_create?: string;
  bc_update?: string;
  bc_visit?: string;
  [key: string]: unknown;
}

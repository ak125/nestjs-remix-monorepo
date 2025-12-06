/**
 * Types et interfaces pour l'architecture de sitemaps scalable
 */

import { SitemapImage } from './sitemap-image.interface';

export enum SitemapType {
  INDEX = 'index', // Index maître
  SUB_INDEX = 'sub-index', // Sous-index (catégorie)
  FINAL = 'final', // Sitemap final avec URLs
}

export enum ShardingStrategy {
  NONE = 'none', // Pas de sharding
  ALPHABETIC = 'alphabetic', // A-M, N-Z
  NUMERIC = 'numeric', // 0-10k, 10k-20k
  TEMPORAL = 'temporal', // 2025, 2024, 2023
  MIXED = 'mixed', // Combinaison
}

export enum SitemapCategory {
  STATIC = 'static',
  CATALOG = 'catalog',
  PRODUCTS = 'products',
  BLOG = 'blog',
  CONTENT = 'content',
}

export interface ShardFilter {
  type: 'alphabetic' | 'numeric' | 'temporal' | 'custom' | 'offset';
  pattern?: string | RegExp;
  range?: { min: number; max: number };
  year?: number;
  customFn?: (item: any) => boolean;
  // Sharding par offset (pour les IDs stockés comme strings)
  offset?: number;
  limit?: number;
}

export interface ShardConfig {
  name: string;
  path: string;
  filter: ShardFilter;
  estimatedCount: number;
}

export interface SitemapConfig {
  name: string;
  type: SitemapType;
  category?: SitemapCategory;
  path: string;
  children?: string[];
  sharding?: ShardingStrategy;
  shards?: ShardConfig[];
  changefreq?:
    | 'always'
    | 'hourly'
    | 'daily'
    | 'weekly'
    | 'monthly'
    | 'yearly'
    | 'never';
  priority?: number;
  cacheTTL?: number; // En secondes
}

/**
 * Interface pour les liens hreflang alternatifs
 */
export interface HreflangLink {
  hreflang: string; // Code langue: 'fr', 'en', 'es', 'de', 'x-default'
  href: string; // URL complète de la variante
}

export interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: number;
  alternates?: HreflangLink[]; // Liens hreflang pour variantes linguistiques
  images?: SitemapImage[]; // Images du produit/contenu
}

export interface SitemapIndexEntry {
  loc: string;
  lastmod: string;
}

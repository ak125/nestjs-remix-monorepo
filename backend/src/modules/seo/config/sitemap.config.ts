import {
  SitemapConfig,
  SitemapType,
  SitemapCategory,
  ShardingStrategy,
} from '../interfaces/sitemap-config.interface';

/**
 * Configuration centralisée de tous les sitemaps
 * Architecture hiérarchique: Index Maître → Sous-Indexes → Sitemaps Finaux
 */
export const SITEMAP_CONFIGS: SitemapConfig[] = [
  // ============================================================================
  // NIVEAU 1: INDEX MAÎTRE
  // ============================================================================
  {
    name: 'master-index',
    type: SitemapType.INDEX,
    path: '/sitemap-index.xml',
    children: ['static-index', 'dynamic-index'],
    cacheTTL: 3600, // 1h
  },

  // ============================================================================
  // NIVEAU 2: SOUS-INDEX STATIQUE
  // ============================================================================
  {
    name: 'static-index',
    type: SitemapType.SUB_INDEX,
    category: SitemapCategory.STATIC,
    path: '/sitemap-static.xml',
    children: ['pages'],
    cacheTTL: 86400, // 24h
  },

  {
    name: 'pages',
    type: SitemapType.FINAL,
    category: SitemapCategory.STATIC,
    path: '/sitemap-pages.xml',
    changefreq: 'monthly',
    priority: 0.8,
    cacheTTL: 604800, // 7 jours
  },

  // ============================================================================
  // NIVEAU 2: SOUS-INDEX DYNAMIQUE
  // ============================================================================
  {
    name: 'dynamic-index',
    type: SitemapType.SUB_INDEX,
    path: '/sitemap-dynamic.xml',
    children: ['catalog-index', 'blog-index', 'products-index'],
    cacheTTL: 1800, // 30min
  },

  // ============================================================================
  // NIVEAU 3: CATALOGUE (avec sharding)
  // ============================================================================
  {
    name: 'catalog-index',
    type: SitemapType.SUB_INDEX,
    category: SitemapCategory.CATALOG,
    path: '/sitemap-catalog-index.xml',
    children: [
      'constructeurs',
      'modeles-a-m',
      'modeles-n-z',
      'types-0-10000',
      'types-10001-20000',
      'types-20001-30000',
      'types-30001-40000',
      'types-40001-48918',
    ],
    cacheTTL: 3600, // 1h
  },

  // Constructeurs (pas de sharding)
  {
    name: 'constructeurs',
    type: SitemapType.FINAL,
    category: SitemapCategory.CATALOG,
    path: '/sitemap-constructeurs.xml',
    changefreq: 'weekly',
    priority: 0.8,
    cacheTTL: 7200, // 2h
  },

  // Modèles (sharding alphabétique A-M)
  {
    name: 'modeles-a-m',
    type: SitemapType.FINAL,
    category: SitemapCategory.CATALOG,
    path: '/sitemap-modeles-a-m.xml',
    sharding: ShardingStrategy.ALPHABETIC,
    shards: [
      {
        name: 'a-m',
        path: '/sitemap-modeles-a-m.xml',
        filter: {
          type: 'alphabetic',
          pattern: '^[a-mA-M]',
        },
        estimatedCount: 2900,
      },
    ],
    changefreq: 'weekly',
    priority: 0.7,
    cacheTTL: 7200, // 2h
  },

  // Modèles (sharding alphabétique N-Z)
  {
    name: 'modeles-n-z',
    type: SitemapType.FINAL,
    category: SitemapCategory.CATALOG,
    path: '/sitemap-modeles-n-z.xml',
    sharding: ShardingStrategy.ALPHABETIC,
    shards: [
      {
        name: 'n-z',
        path: '/sitemap-modeles-n-z.xml',
        filter: {
          type: 'alphabetic',
          pattern: '^[n-zN-Z0-9]',
        },
        estimatedCount: 2845,
      },
    ],
    changefreq: 'weekly',
    priority: 0.7,
    cacheTTL: 7200, // 2h
  },

  // Types (sharding numérique 0-10000)
  {
    name: 'types-0-10000',
    type: SitemapType.FINAL,
    category: SitemapCategory.CATALOG,
    path: '/sitemap-types-0-10000.xml',
    sharding: ShardingStrategy.NUMERIC,
    shards: [
      {
        name: '0-10000',
        path: '/sitemap-types-0-10000.xml',
        filter: { type: 'numeric', range: { min: 0, max: 10000 } },
        estimatedCount: 10000,
      },
    ],
    changefreq: 'monthly',
    priority: 0.5,
    cacheTTL: 14400, // 4h
  },

  // Types (sharding numérique 10001-20000)
  {
    name: 'types-10001-20000',
    type: SitemapType.FINAL,
    category: SitemapCategory.CATALOG,
    path: '/sitemap-types-10001-20000.xml',
    sharding: ShardingStrategy.NUMERIC,
    shards: [
      {
        name: '10001-20000',
        path: '/sitemap-types-10001-20000.xml',
        filter: { type: 'numeric', range: { min: 10001, max: 20000 } },
        estimatedCount: 10000,
      },
    ],
    changefreq: 'monthly',
    priority: 0.5,
    cacheTTL: 14400, // 4h
  },

  // Types (sharding numérique 20001-30000)
  {
    name: 'types-20001-30000',
    type: SitemapType.FINAL,
    category: SitemapCategory.CATALOG,
    path: '/sitemap-types-20001-30000.xml',
    sharding: ShardingStrategy.NUMERIC,
    shards: [
      {
        name: '20001-30000',
        path: '/sitemap-types-20001-30000.xml',
        filter: { type: 'numeric', range: { min: 20001, max: 30000 } },
        estimatedCount: 10000,
      },
    ],
    changefreq: 'monthly',
    priority: 0.5,
    cacheTTL: 14400, // 4h
  },

  // Types (sharding numérique 30001-40000)
  {
    name: 'types-30001-40000',
    type: SitemapType.FINAL,
    category: SitemapCategory.CATALOG,
    path: '/sitemap-types-30001-40000.xml',
    sharding: ShardingStrategy.NUMERIC,
    shards: [
      {
        name: '30001-40000',
        path: '/sitemap-types-30001-40000.xml',
        filter: { type: 'numeric', range: { min: 30001, max: 40000 } },
        estimatedCount: 10000,
      },
    ],
    changefreq: 'monthly',
    priority: 0.5,
    cacheTTL: 14400, // 4h
  },

  // Types (sharding numérique 40001-48918)
  {
    name: 'types-40001-48918',
    type: SitemapType.FINAL,
    category: SitemapCategory.CATALOG,
    path: '/sitemap-types-40001-48918.xml',
    sharding: ShardingStrategy.NUMERIC,
    shards: [
      {
        name: '40001-48918',
        path: '/sitemap-types-40001-48918.xml',
        filter: { type: 'numeric', range: { min: 40001, max: 48918 } },
        estimatedCount: 8918,
      },
    ],
    changefreq: 'monthly',
    priority: 0.5,
    cacheTTL: 14400, // 4h
  },

  // ============================================================================
  // NIVEAU 3: BLOG (sharding temporel)
  // ============================================================================
  {
    name: 'blog-index',
    type: SitemapType.SUB_INDEX,
    category: SitemapCategory.BLOG,
    path: '/sitemap-blog-index.xml',
    children: ['blog-2025', 'blog-2024', 'blog-2023', 'blog-archive'],
    cacheTTL: 3600, // 1h
  },

  {
    name: 'blog-2025',
    type: SitemapType.FINAL,
    category: SitemapCategory.BLOG,
    path: '/sitemap-blog-2025.xml',
    sharding: ShardingStrategy.TEMPORAL,
    shards: [
      {
        name: '2025',
        path: '/sitemap-blog-2025.xml',
        filter: { type: 'temporal', year: 2025 },
        estimatedCount: 25,
      },
    ],
    changefreq: 'weekly',
    priority: 0.9,
    cacheTTL: 1800, // 30min (contenu récent)
  },

  {
    name: 'blog-2024',
    type: SitemapType.FINAL,
    category: SitemapCategory.BLOG,
    path: '/sitemap-blog-2024.xml',
    sharding: ShardingStrategy.TEMPORAL,
    shards: [
      {
        name: '2024',
        path: '/sitemap-blog-2024.xml',
        filter: { type: 'temporal', year: 2024 },
        estimatedCount: 30,
      },
    ],
    changefreq: 'monthly',
    priority: 0.7,
    cacheTTL: 7200, // 2h
  },

  {
    name: 'blog-2023',
    type: SitemapType.FINAL,
    category: SitemapCategory.BLOG,
    path: '/sitemap-blog-2023.xml',
    sharding: ShardingStrategy.TEMPORAL,
    shards: [
      {
        name: '2023',
        path: '/sitemap-blog-2023.xml',
        filter: { type: 'temporal', year: 2023 },
        estimatedCount: 20,
      },
    ],
    changefreq: 'yearly',
    priority: 0.5,
    cacheTTL: 86400, // 24h (archives)
  },

  {
    name: 'blog-archive',
    type: SitemapType.FINAL,
    category: SitemapCategory.BLOG,
    path: '/sitemap-blog-archive.xml',
    sharding: ShardingStrategy.TEMPORAL,
    shards: [
      {
        name: 'archive',
        path: '/sitemap-blog-archive.xml',
        filter: {
          type: 'custom',
          customFn: (article) =>
            new Date(article.ba_date || article.bg_date).getFullYear() < 2023,
        },
        estimatedCount: 11,
      },
    ],
    changefreq: 'never',
    priority: 0.3,
    cacheTTL: 604800, // 7 jours (quasi-statique)
  },

  // ============================================================================
  // NIVEAU 3: PRODUITS (sharding par niveau)
  // ============================================================================
  {
    name: 'products-index',
    type: SitemapType.SUB_INDEX,
    category: SitemapCategory.PRODUCTS,
    path: '/sitemap-products-index.xml',
    children: ['products-niveau1', 'products-niveau2'],
    cacheTTL: 3600, // 1h
  },

  {
    name: 'products-niveau1',
    type: SitemapType.FINAL,
    category: SitemapCategory.PRODUCTS,
    path: '/sitemap-products-niveau1.xml',
    changefreq: 'weekly',
    priority: 0.8,
    cacheTTL: 7200, // 2h
  },

  {
    name: 'products-niveau2',
    type: SitemapType.FINAL,
    category: SitemapCategory.PRODUCTS,
    path: '/sitemap-products-niveau2.xml',
    changefreq: 'weekly',
    priority: 0.7,
    cacheTTL: 7200, // 2h
  },
];

/**
 * Helper pour trouver une config par nom
 */
export function getSitemapConfig(name: string): SitemapConfig | undefined {
  return SITEMAP_CONFIGS.find((config) => config.name === name);
}

/**
 * Helper pour trouver une config par path
 */
export function getSitemapConfigByPath(path: string): SitemapConfig | undefined {
  return SITEMAP_CONFIGS.find((config) => config.path === path);
}

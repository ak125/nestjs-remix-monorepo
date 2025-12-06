import {
  SitemapConfig,
  SitemapType,
  SitemapCategory,
  ShardingStrategy,
} from '../interfaces/sitemap-config.interface';

/**
 * Configuration centralisÃ©e de tous les sitemaps
 * Architecture hiÃ©rarchique: Index MaÃ®tre â†’ Sous-Indexes â†’ Sitemaps Finaux
 */
export const SITEMAP_CONFIGS: SitemapConfig[] = [
  // ============================================================================
  // NIVEAU 1: INDEX MAÃŽTRE
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
    // pieces-index réactivé: 714k URLs depuis __sitemap_p_link (SANS filtre de stock)
    children: ['catalog-index', 'blog-index', 'products-index', 'pieces-index'],
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
      // Types: un seul sitemap pour tous les types (temporaire)
      'types-all',
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

  // ModÃ¨les (sharding alphabÃ©tique A-M)
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

  // ModÃ¨les (sharding alphabÃ©tique N-Z)
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

  // Types/Motorisations depuis __sitemap_motorisation (~12,756 URLs prÃ©-calculÃ©es)
  // Source: table PHP d'origine avec URLs validÃ©es
  {
    name: 'types-all',
    type: SitemapType.FINAL,
    category: SitemapCategory.CATALOG,
    path: '/sitemap-types-all.xml',
    sharding: ShardingStrategy.NUMERIC,
    shards: [
      {
        name: 'all',
        path: '/sitemap-types-all.xml',
        filter: { type: 'offset', offset: 0, limit: 15000 },
        estimatedCount: 12756,
      },
    ],
    changefreq: 'monthly',
    priority: 0.7,
    cacheTTL: 21600, // 6h
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
    cacheTTL: 1800, // 30min (contenu rÃ©cent)
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

  // ============================================================================
  // NIVEAU 3: PIÈCES PRÉ-CALCULÉES (depuis __sitemap_p_link - ~714k URLs SANS filtre stock)
  // Sharding par tranches de 50,000 URLs (limite Google)
  // Stratégie: TOUTES les URLs, priority/changefreq ajustés selon map_has_item
  // ============================================================================
  {
    name: 'pieces-index',
    type: SitemapType.SUB_INDEX,
    category: SitemapCategory.CATALOG,
    path: '/sitemap-pieces-index.xml',
    children: [
      'pieces-0-50000',
      'pieces-50001-100000',
      'pieces-100001-150000',
      'pieces-150001-200000',
      'pieces-200001-250000',
      'pieces-250001-300000',
      'pieces-300001-350000',
      'pieces-350001-400000',
      'pieces-400001-450000',
      'pieces-450001-500000',
      'pieces-500001-550000',
      'pieces-550001-600000',
      'pieces-600001-650000',
      'pieces-650001-700000',
      'pieces-700001-750000',
    ],
    cacheTTL: 3600, // 1h
  },

  // Pièces shards (50k URLs chacun) - Catégorie CATALOG pour utiliser fetchPiecesFromSitemapPLink
  {
    name: 'pieces-0-50000',
    type: SitemapType.FINAL,
    category: SitemapCategory.CATALOG,
    path: '/sitemap-pieces-0-50000.xml',
    sharding: ShardingStrategy.NUMERIC,
    shards: [
      {
        name: '0-50000',
        path: '/sitemap-pieces-0-50000.xml',
        filter: { type: 'numeric', range: { min: 0, max: 50000 } },
        estimatedCount: 50000,
      },
    ],
    changefreq: 'weekly',
    priority: 0.6,
    cacheTTL: 14400, // 4h
  },
  {
    name: 'pieces-50001-100000',
    type: SitemapType.FINAL,
    category: SitemapCategory.CATALOG,
    path: '/sitemap-pieces-50001-100000.xml',
    sharding: ShardingStrategy.NUMERIC,
    shards: [
      {
        name: '50001-100000',
        path: '/sitemap-pieces-50001-100000.xml',
        filter: { type: 'numeric', range: { min: 50001, max: 100000 } },
        estimatedCount: 50000,
      },
    ],
    changefreq: 'weekly',
    priority: 0.6,
    cacheTTL: 14400,
  },
  {
    name: 'pieces-100001-150000',
    type: SitemapType.FINAL,
    category: SitemapCategory.CATALOG,
    path: '/sitemap-pieces-100001-150000.xml',
    sharding: ShardingStrategy.NUMERIC,
    shards: [
      {
        name: '100001-150000',
        path: '/sitemap-pieces-100001-150000.xml',
        filter: { type: 'numeric', range: { min: 100001, max: 150000 } },
        estimatedCount: 50000,
      },
    ],
    changefreq: 'weekly',
    priority: 0.6,
    cacheTTL: 14400,
  },
  {
    name: 'pieces-150001-200000',
    type: SitemapType.FINAL,
    category: SitemapCategory.CATALOG,
    path: '/sitemap-pieces-150001-200000.xml',
    sharding: ShardingStrategy.NUMERIC,
    shards: [
      {
        name: '150001-200000',
        path: '/sitemap-pieces-150001-200000.xml',
        filter: { type: 'numeric', range: { min: 150001, max: 200000 } },
        estimatedCount: 50000,
      },
    ],
    changefreq: 'weekly',
    priority: 0.6,
    cacheTTL: 14400,
  },
  {
    name: 'pieces-200001-250000',
    type: SitemapType.FINAL,
    category: SitemapCategory.CATALOG,
    path: '/sitemap-pieces-200001-250000.xml',
    sharding: ShardingStrategy.NUMERIC,
    shards: [
      {
        name: '200001-250000',
        path: '/sitemap-pieces-200001-250000.xml',
        filter: { type: 'numeric', range: { min: 200001, max: 250000 } },
        estimatedCount: 50000,
      },
    ],
    changefreq: 'weekly',
    priority: 0.6,
    cacheTTL: 14400,
  },
  {
    name: 'pieces-250001-300000',
    type: SitemapType.FINAL,
    category: SitemapCategory.CATALOG,
    path: '/sitemap-pieces-250001-300000.xml',
    sharding: ShardingStrategy.NUMERIC,
    shards: [
      {
        name: '250001-300000',
        path: '/sitemap-pieces-250001-300000.xml',
        filter: { type: 'numeric', range: { min: 250001, max: 300000 } },
        estimatedCount: 50000,
      },
    ],
    changefreq: 'weekly',
    priority: 0.6,
    cacheTTL: 14400,
  },
  {
    name: 'pieces-300001-350000',
    type: SitemapType.FINAL,
    category: SitemapCategory.CATALOG,
    path: '/sitemap-pieces-300001-350000.xml',
    sharding: ShardingStrategy.NUMERIC,
    shards: [
      {
        name: '300001-350000',
        path: '/sitemap-pieces-300001-350000.xml',
        filter: { type: 'numeric', range: { min: 300001, max: 350000 } },
        estimatedCount: 50000,
      },
    ],
    changefreq: 'weekly',
    priority: 0.6,
    cacheTTL: 14400,
  },
  {
    name: 'pieces-350001-400000',
    type: SitemapType.FINAL,
    category: SitemapCategory.CATALOG,
    path: '/sitemap-pieces-350001-400000.xml',
    sharding: ShardingStrategy.NUMERIC,
    shards: [
      {
        name: '350001-400000',
        path: '/sitemap-pieces-350001-400000.xml',
        filter: { type: 'numeric', range: { min: 350001, max: 400000 } },
        estimatedCount: 50000,
      },
    ],
    changefreq: 'weekly',
    priority: 0.6,
    cacheTTL: 14400,
  },
  {
    name: 'pieces-400001-450000',
    type: SitemapType.FINAL,
    category: SitemapCategory.CATALOG,
    path: '/sitemap-pieces-400001-450000.xml',
    sharding: ShardingStrategy.NUMERIC,
    shards: [
      {
        name: '400001-450000',
        path: '/sitemap-pieces-400001-450000.xml',
        filter: { type: 'numeric', range: { min: 400001, max: 450000 } },
        estimatedCount: 50000,
      },
    ],
    changefreq: 'weekly',
    priority: 0.6,
    cacheTTL: 14400,
  },
  {
    name: 'pieces-450001-500000',
    type: SitemapType.FINAL,
    category: SitemapCategory.CATALOG,
    path: '/sitemap-pieces-450001-500000.xml',
    sharding: ShardingStrategy.NUMERIC,
    shards: [
      {
        name: '450001-500000',
        path: '/sitemap-pieces-450001-500000.xml',
        filter: { type: 'numeric', range: { min: 450001, max: 500000 } },
        estimatedCount: 50000,
      },
    ],
    changefreq: 'weekly',
    priority: 0.6,
    cacheTTL: 14400,
  },
  // Nouveaux shards pour 714k URLs (500k-750k)
  {
    name: 'pieces-500001-550000',
    type: SitemapType.FINAL,
    category: SitemapCategory.CATALOG,
    path: '/sitemap-pieces-500001-550000.xml',
    sharding: ShardingStrategy.NUMERIC,
    shards: [
      {
        name: '500001-550000',
        path: '/sitemap-pieces-500001-550000.xml',
        filter: { type: 'numeric', range: { min: 500001, max: 550000 } },
        estimatedCount: 50000,
      },
    ],
    changefreq: 'weekly',
    priority: 0.6,
    cacheTTL: 14400,
  },
  {
    name: 'pieces-550001-600000',
    type: SitemapType.FINAL,
    category: SitemapCategory.CATALOG,
    path: '/sitemap-pieces-550001-600000.xml',
    sharding: ShardingStrategy.NUMERIC,
    shards: [
      {
        name: '550001-600000',
        path: '/sitemap-pieces-550001-600000.xml',
        filter: { type: 'numeric', range: { min: 550001, max: 600000 } },
        estimatedCount: 50000,
      },
    ],
    changefreq: 'weekly',
    priority: 0.6,
    cacheTTL: 14400,
  },
  {
    name: 'pieces-600001-650000',
    type: SitemapType.FINAL,
    category: SitemapCategory.CATALOG,
    path: '/sitemap-pieces-600001-650000.xml',
    sharding: ShardingStrategy.NUMERIC,
    shards: [
      {
        name: '600001-650000',
        path: '/sitemap-pieces-600001-650000.xml',
        filter: { type: 'numeric', range: { min: 600001, max: 650000 } },
        estimatedCount: 50000,
      },
    ],
    changefreq: 'weekly',
    priority: 0.6,
    cacheTTL: 14400,
  },
  {
    name: 'pieces-650001-700000',
    type: SitemapType.FINAL,
    category: SitemapCategory.CATALOG,
    path: '/sitemap-pieces-650001-700000.xml',
    sharding: ShardingStrategy.NUMERIC,
    shards: [
      {
        name: '650001-700000',
        path: '/sitemap-pieces-650001-700000.xml',
        filter: { type: 'numeric', range: { min: 650001, max: 700000 } },
        estimatedCount: 50000,
      },
    ],
    changefreq: 'weekly',
    priority: 0.6,
    cacheTTL: 14400,
  },
  {
    name: 'pieces-700001-750000',
    type: SitemapType.FINAL,
    category: SitemapCategory.CATALOG,
    path: '/sitemap-pieces-700001-750000.xml',
    sharding: ShardingStrategy.NUMERIC,
    shards: [
      {
        name: '700001-750000',
        path: '/sitemap-pieces-700001-750000.xml',
        filter: { type: 'numeric', range: { min: 700001, max: 750000 } },
        estimatedCount: 14336, // 714336 - 700000
      },
    ],
    changefreq: 'weekly',
    priority: 0.6,
    cacheTTL: 14400,
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
export function getSitemapConfigByPath(
  path: string,
): SitemapConfig | undefined {
  return SITEMAP_CONFIGS.find((config) => config.path === path);
}

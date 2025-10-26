# 🏗️ Architecture Sitemaps Scalable - Sharding Logique + Temporel

**Date:** 25 octobre 2025  
**Objectif:** Architecture évolutive jusqu'à 1M+ URLs  
**Stratégie:** Index maître → Sous-indexes → Sitemaps finaux

---

## 📐 Architecture Hiérarchique

```
┌─────────────────────────────────────────────────────────────┐
│                  /sitemap-index.xml                         │
│              (Index Maître Principal)                       │
│         Liste uniquement des sous-indexes                   │
└─────────────────┬───────────────────────────────────────────┘
                  │
        ┌─────────┴─────────────────────────────┐
        │                                       │
┌───────▼────────┐                    ┌────────▼───────┐
│  Static Index  │                    │  Dynamic Index │
│ /sitemap-      │                    │ /sitemap-      │
│  static.xml    │                    │  dynamic.xml   │
└───────┬────────┘                    └────────┬───────┘
        │                                      │
        │                              ┌───────┴──────────────────┬─────────────────┐
        │                              │                          │                 │
┌───────▼────────┐          ┌──────────▼──────────┐   ┌─────────▼────────┐  ┌─────▼──────┐
│  /sitemap-     │          │ /sitemap-           │   │ /sitemap-        │  │ /sitemap-  │
│   pages.xml    │          │  catalog-index.xml  │   │  blog-index.xml  │  │ content-   │
│                │          │                     │   │                  │  │ index.xml  │
│ • Homepage     │          └──────────┬──────────┘   └─────────┬────────┘  └─────┬──────┘
│ • About        │                     │                        │                 │
│ • Contact      │          ┌──────────┴──────────┬─────────────┼─────────────────┘
│ • Legal        │          │                     │             │
└────────────────┘  ┌───────▼───────┐   ┌─────────▼─────┐  ┌───▼───────────┐
                    │ Constructeurs │   │    Modèles    │  │  Blog 2025    │
                    │  Index        │   │    Index      │  │  /sitemap-    │
                    └───────┬───────┘   └───────┬───────┘  │   blog-       │
                            │                   │          │   2025.xml    │
                    ┌───────┴───────┐   ┌───────┴───────┐  └───────────────┘
                    │               │   │               │
            ┌───────▼────┐  ┌───────▼────┐  ┌────▼─────┐
            │ /sitemap-  │  │ /sitemap-  │  │/sitemap- │
            │ construct- │  │ modeles-   │  │ modeles- │
            │ eurs.xml   │  │ a-m.xml    │  │ n-z.xml  │
            │            │  │            │  │          │
            │ 117 URLs   │  │ ~2800 URLs │  │~2900 URLs│
            └────────────┘  └────────────┘  └──────────┘
```

---

## 🎯 Principes de l'Architecture

### 1. **Séparation Statique vs Dynamique**

#### Index Statique (`/sitemap-static.xml`)
- Contenu qui change rarement (< 1×/mois)
- Pages institutionnelles
- CGV, mentions légales, etc.
- **Avantage:** Peut être mis en cache très longtemps

#### Index Dynamique (`/sitemap-dynamic.xml`)
- Contenu mis à jour fréquemment
- Catalogue produits
- Blog, actualités
- **Avantage:** Refresh ciblé sans régénérer le statique

---

### 2. **Sharding Logique par Type de Contenu**

```typescript
enum SitemapCategory {
  STATIC = 'static',      // Pages fixes
  CATALOG = 'catalog',    // Catalogue auto (marques, modèles, types)
  PRODUCTS = 'products',  // Pièces détachées
  BLOG = 'blog',          // Contenu éditorial
  CONTENT = 'content',    // Autres contenus
}
```

Chaque catégorie a son propre **sous-index** qui liste ses sitemaps.

---

### 3. **Sharding Temporel**

#### Pour le Blog
```
/sitemap-blog-index.xml
├── /sitemap-blog-2025.xml      (articles 2025)
├── /sitemap-blog-2024.xml      (articles 2024)
├── /sitemap-blog-2023.xml      (articles 2023)
└── /sitemap-blog-archive.xml   (< 2023)
```

**Avantages:**
- Articles récents (2025) changent souvent → refresh fréquent
- Archives (< 2023) statiques → cache permanent
- Google priorise automatiquement les sitemaps récents

#### Pour les Produits
```
/sitemap-catalog-index.xml
├── /sitemap-constructeurs-a-m.xml   (Alfa → Mercedes)
├── /sitemap-constructeurs-n-z.xml   (Nissan → Volvo)
├── /sitemap-modeles-recent.xml      (modèles < 5 ans)
├── /sitemap-modeles-archive.xml     (modèles > 5 ans)
└── /sitemap-types-{shard}.xml       (divisé en tranches de 40k)
```

---

### 4. **Sharding Alphabétique**

Pour les grands volumes (modèles, types):

```typescript
interface AlphabeticShard {
  name: string;
  pattern: string;
  estimatedCount: number;
}

const shards: AlphabeticShard[] = [
  { name: 'a-e', pattern: '^[a-eA-E]', estimatedCount: 12000 },
  { name: 'f-m', pattern: '^[f-mF-M]', estimatedCount: 15000 },
  { name: 'n-s', pattern: '^[n-sN-S]', estimatedCount: 14000 },
  { name: 't-z', pattern: '^[t-zT-Z]', estimatedCount: 10000 },
];
```

---

## 🗂️ Structure Complète Proposée

```xml
<!-- /sitemap-index.xml - Index Maître -->
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  
  <!-- Sous-index statique -->
  <sitemap>
    <loc>https://automecanik.com/sitemap-static.xml</loc>
    <lastmod>2025-01-15T00:00:00Z</lastmod>
  </sitemap>
  
  <!-- Sous-index dynamique -->
  <sitemap>
    <loc>https://automecanik.com/sitemap-dynamic.xml</loc>
    <lastmod>2025-10-25T21:30:00Z</lastmod>
  </sitemap>
  
</sitemapindex>

<!-- /sitemap-static.xml - Sous-index Statique -->
<sitemapindex>
  <sitemap>
    <loc>https://automecanik.com/sitemap-pages.xml</loc>
    <lastmod>2025-01-15T00:00:00Z</lastmod>
  </sitemap>
</sitemapindex>

<!-- /sitemap-dynamic.xml - Sous-index Dynamique -->
<sitemapindex>
  
  <!-- Sous-index catalogue -->
  <sitemap>
    <loc>https://automecanik.com/sitemap-catalog-index.xml</loc>
    <lastmod>2025-10-25T21:30:00Z</lastmod>
  </sitemap>
  
  <!-- Sous-index blog -->
  <sitemap>
    <loc>https://automecanik.com/sitemap-blog-index.xml</loc>
    <lastmod>2025-10-25T20:00:00Z</lastmod>
  </sitemap>
  
  <!-- Sous-index produits -->
  <sitemap>
    <loc>https://automecanik.com/sitemap-products-index.xml</loc>
    <lastmod>2025-10-25T19:00:00Z</lastmod>
  </sitemap>
  
</sitemapindex>

<!-- /sitemap-catalog-index.xml - Sous-index Catalogue -->
<sitemapindex>
  
  <!-- Constructeurs -->
  <sitemap>
    <loc>https://automecanik.com/sitemap-constructeurs.xml</loc>
    <lastmod>2025-10-20T00:00:00Z</lastmod>
  </sitemap>
  
  <!-- Modèles (sharding alphabétique) -->
  <sitemap>
    <loc>https://automecanik.com/sitemap-modeles-a-m.xml</loc>
    <lastmod>2025-10-25T12:00:00Z</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://automecanik.com/sitemap-modeles-n-z.xml</loc>
    <lastmod>2025-10-25T12:00:00Z</lastmod>
  </sitemap>
  
  <!-- Types (sharding numérique par tranches) -->
  <sitemap>
    <loc>https://automecanik.com/sitemap-types-0-10000.xml</loc>
    <lastmod>2025-10-25T12:00:00Z</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://automecanik.com/sitemap-types-10001-20000.xml</loc>
    <lastmod>2025-10-25T12:00:00Z</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://automecanik.com/sitemap-types-20001-30000.xml</loc>
    <lastmod>2025-10-25T12:00:00Z</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://automecanik.com/sitemap-types-30001-40000.xml</loc>
    <lastmod>2025-10-25T12:00:00Z</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://automecanik.com/sitemap-types-40001-48918.xml</loc>
    <lastmod>2025-10-25T12:00:00Z</lastmod>
  </sitemap>
  
</sitemapindex>

<!-- /sitemap-blog-index.xml - Sous-index Blog -->
<sitemapindex>
  
  <!-- Sharding temporel -->
  <sitemap>
    <loc>https://automecanik.com/sitemap-blog-2025.xml</loc>
    <lastmod>2025-10-25T20:00:00Z</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://automecanik.com/sitemap-blog-2024.xml</loc>
    <lastmod>2025-01-01T00:00:00Z</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://automecanik.com/sitemap-blog-2023.xml</loc>
    <lastmod>2024-01-01T00:00:00Z</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://automecanik.com/sitemap-blog-archive.xml</loc>
    <lastmod>2023-01-01T00:00:00Z</lastmod>
  </sitemap>
  
</sitemapindex>

<!-- /sitemap-products-index.xml - Sous-index Produits -->
<sitemapindex>
  
  <!-- Gammes par niveau -->
  <sitemap>
    <loc>https://automecanik.com/sitemap-products-niveau1.xml</loc>
    <lastmod>2025-10-25T19:00:00Z</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://automecanik.com/sitemap-products-niveau2.xml</loc>
    <lastmod>2025-10-25T19:00:00Z</lastmod>
  </sitemap>
  
</sitemapindex>
```

---

## 💾 Implémentation Code

### Structure des Interfaces

```typescript
// backend/src/modules/seo/interfaces/sitemap-config.interface.ts

export enum SitemapType {
  INDEX = 'index',           // Index maître
  SUB_INDEX = 'sub-index',   // Sous-index (catégorie)
  FINAL = 'final',           // Sitemap final avec URLs
}

export enum ShardingStrategy {
  NONE = 'none',             // Pas de sharding
  ALPHABETIC = 'alphabetic', // A-M, N-Z
  NUMERIC = 'numeric',       // 0-10k, 10k-20k
  TEMPORAL = 'temporal',     // 2025, 2024, 2023
  MIXED = 'mixed',           // Combinaison
}

export interface SitemapConfig {
  name: string;
  type: SitemapType;
  category: SitemapCategory;
  sharding?: ShardingStrategy;
  shards?: ShardConfig[];
  changefreq?: string;
  priority?: number;
  cacheTTL?: number; // En secondes
}

export interface ShardConfig {
  name: string;
  path: string;
  filter: ShardFilter;
  estimatedCount: number;
}

export interface ShardFilter {
  type: 'alphabetic' | 'numeric' | 'temporal' | 'custom';
  pattern?: string | RegExp;
  range?: { min: number; max: number };
  year?: number;
  customFn?: (item: any) => boolean;
}

export enum SitemapCategory {
  STATIC = 'static',
  CATALOG = 'catalog',
  PRODUCTS = 'products',
  BLOG = 'blog',
  CONTENT = 'content',
}
```

### Configuration Centralisée

```typescript
// backend/src/modules/seo/config/sitemap.config.ts

export const SITEMAP_CONFIG: SitemapConfig[] = [
  // ============================================
  // INDEX MAÎTRE
  // ============================================
  {
    name: 'master-index',
    type: SitemapType.INDEX,
    category: null,
    path: '/sitemap-index.xml',
    children: ['static', 'dynamic'],
    cacheTTL: 3600, // 1h
  },

  // ============================================
  // SOUS-INDEX STATIQUE
  // ============================================
  {
    name: 'static',
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

  // ============================================
  // SOUS-INDEX DYNAMIQUE
  // ============================================
  {
    name: 'dynamic',
    type: SitemapType.SUB_INDEX,
    category: null,
    path: '/sitemap-dynamic.xml',
    children: ['catalog-index', 'blog-index', 'products-index'],
    cacheTTL: 1800, // 30min
  },

  // ============================================
  // CATALOGUE (avec sharding)
  // ============================================
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
  
  // Constructeurs
  {
    name: 'constructeurs',
    type: SitemapType.FINAL,
    category: SitemapCategory.CATALOG,
    path: '/sitemap-constructeurs.xml',
    changefreq: 'weekly',
    priority: 0.8,
    cacheTTL: 7200, // 2h
  },

  // Modèles (sharding alphabétique)
  {
    name: 'modeles',
    type: SitemapType.FINAL,
    category: SitemapCategory.CATALOG,
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
      {
        name: 'n-z',
        path: '/sitemap-modeles-n-z.xml',
        filter: {
          type: 'alphabetic',
          pattern: '^[n-zN-Z]',
        },
        estimatedCount: 2845,
      },
    ],
    changefreq: 'weekly',
    priority: 0.7,
    cacheTTL: 7200, // 2h
  },

  // Types (sharding numérique)
  {
    name: 'types',
    type: SitemapType.FINAL,
    category: SitemapCategory.CATALOG,
    sharding: ShardingStrategy.NUMERIC,
    shards: [
      {
        name: '0-10000',
        path: '/sitemap-types-0-10000.xml',
        filter: { type: 'numeric', range: { min: 0, max: 10000 } },
        estimatedCount: 10000,
      },
      {
        name: '10001-20000',
        path: '/sitemap-types-10001-20000.xml',
        filter: { type: 'numeric', range: { min: 10001, max: 20000 } },
        estimatedCount: 10000,
      },
      {
        name: '20001-30000',
        path: '/sitemap-types-20001-30000.xml',
        filter: { type: 'numeric', range: { min: 20001, max: 30000 } },
        estimatedCount: 10000,
      },
      {
        name: '30001-40000',
        path: '/sitemap-types-30001-40000.xml',
        filter: { type: 'numeric', range: { min: 30001, max: 40000 } },
        estimatedCount: 10000,
      },
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

  // ============================================
  // BLOG (sharding temporel)
  // ============================================
  {
    name: 'blog-index',
    type: SitemapType.SUB_INDEX,
    category: SitemapCategory.BLOG,
    path: '/sitemap-blog-index.xml',
    children: ['blog-2025', 'blog-2024', 'blog-2023', 'blog-archive'],
    cacheTTL: 3600, // 1h
  },
  
  {
    name: 'blog',
    type: SitemapType.FINAL,
    category: SitemapCategory.BLOG,
    sharding: ShardingStrategy.TEMPORAL,
    shards: [
      {
        name: '2025',
        path: '/sitemap-blog-2025.xml',
        filter: { type: 'temporal', year: 2025 },
        estimatedCount: 25,
      },
      {
        name: '2024',
        path: '/sitemap-blog-2024.xml',
        filter: { type: 'temporal', year: 2024 },
        estimatedCount: 30,
      },
      {
        name: '2023',
        path: '/sitemap-blog-2023.xml',
        filter: { type: 'temporal', year: 2023 },
        estimatedCount: 20,
      },
      {
        name: 'archive',
        path: '/sitemap-blog-archive.xml',
        filter: {
          type: 'custom',
          customFn: (article) => new Date(article.date).getFullYear() < 2023,
        },
        estimatedCount: 11,
      },
    ],
    changefreq: 'weekly',
    priority: 0.8,
    cacheTTL: 3600, // 1h pour 2025, plus long pour archives
  },

  // ============================================
  // PRODUITS
  // ============================================
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
```

### Service de Génération Générique

```typescript
// backend/src/modules/seo/services/sitemap-generator.service.ts

@Injectable()
export class SitemapGeneratorService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly cache: CacheService,
    private readonly logger: Logger,
  ) {}

  /**
   * Génère un sitemap selon sa configuration
   */
  async generateSitemap(configName: string): Promise<string> {
    const config = SITEMAP_CONFIG.find((c) => c.name === configName);
    
    if (!config) {
      throw new NotFoundException(`Sitemap config '${configName}' not found`);
    }

    // Vérifier le cache
    const cacheKey = `sitemap:${configName}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      this.logger.log(`✅ Cache hit for ${configName}`);
      return cached;
    }

    // Générer selon le type
    let xml: string;
    
    switch (config.type) {
      case SitemapType.INDEX:
        xml = await this.generateIndex(config);
        break;
      
      case SitemapType.SUB_INDEX:
        xml = await this.generateSubIndex(config);
        break;
      
      case SitemapType.FINAL:
        xml = await this.generateFinalSitemap(config);
        break;
      
      default:
        throw new Error(`Unknown sitemap type: ${config.type}`);
    }

    // Mettre en cache
    if (config.cacheTTL) {
      await this.cache.set(cacheKey, xml, config.cacheTTL);
    }

    return xml;
  }

  /**
   * Génère un index (liste de sous-indexes)
   */
  private async generateIndex(config: SitemapConfig): Promise<string> {
    const entries = [];

    for (const childName of config.children) {
      const childConfig = SITEMAP_CONFIG.find((c) => c.name === childName);
      
      if (childConfig) {
        entries.push({
          loc: `https://automecanik.com${childConfig.path}`,
          lastmod: new Date().toISOString(),
        });
      }
    }

    return this.buildSitemapIndexXml(entries);
  }

  /**
   * Génère un sous-index (liste de sitemaps finaux)
   */
  private async generateSubIndex(config: SitemapConfig): Promise<string> {
    const entries = [];

    for (const childName of config.children) {
      const childConfig = SITEMAP_CONFIG.find((c) => c.name === childName);
      
      if (childConfig) {
        entries.push({
          loc: `https://automecanik.com${childConfig.path}`,
          lastmod: await this.getLastModified(childName),
        });
      }
    }

    return this.buildSitemapIndexXml(entries);
  }

  /**
   * Génère un sitemap final avec URLs
   */
  private async generateFinalSitemap(config: SitemapConfig): Promise<string> {
    // Si sharding, générer tous les shards
    if (config.sharding && config.shards) {
      // Cette méthode ne devrait pas être appelée directement
      // Chaque shard a son propre endpoint
      throw new Error('Use shard-specific endpoint');
    }

    // Sinon, générer le sitemap complet
    const urls = await this.fetchUrls(config);
    return this.buildSitemapXml(urls, config);
  }

  /**
   * Récupère les URLs selon la configuration
   */
  private async fetchUrls(
    config: SitemapConfig,
    shard?: ShardConfig,
  ): Promise<SitemapEntry[]> {
    switch (config.category) {
      case SitemapCategory.STATIC:
        return this.fetchStaticPages();
      
      case SitemapCategory.CATALOG:
        if (config.name === 'constructeurs') {
          return this.fetchConstructeurs();
        } else if (config.name === 'modeles') {
          return this.fetchModeles(shard);
        } else if (config.name === 'types') {
          return this.fetchTypes(shard);
        }
        break;
      
      case SitemapCategory.BLOG:
        return this.fetchBlogArticles(shard);
      
      case SitemapCategory.PRODUCTS:
        return this.fetchProducts(shard);
    }

    return [];
  }

  /**
   * Génère XML pour index/sub-index
   */
  private buildSitemapIndexXml(entries: { loc: string; lastmod: string }[]): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map((entry) => `  <sitemap>
    <loc>${entry.loc}</loc>
    <lastmod>${entry.lastmod}</lastmod>
  </sitemap>`).join('\n')}
</sitemapindex>`;
  }

  /**
   * Génère XML pour sitemap final
   */
  private buildSitemapXml(urls: SitemapEntry[], config: SitemapConfig): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => {
  let xml = `  <url>
    <loc>${url.loc}</loc>
    <lastmod>${url.lastmod}</lastmod>`;
  
  if (config.changefreq) {
    xml += `\n    <changefreq>${config.changefreq}</changefreq>`;
  }
  
  if (config.priority) {
    xml += `\n    <priority>${config.priority}</priority>`;
  }
  
  xml += '\n  </url>';
  return xml;
}).join('\n')}
</urlset>`;
  }
}
```

---

## 📊 Comparaison Architecture

| Critère | Architecture Actuelle | Architecture Scalable |
|---------|----------------------|----------------------|
| **Niveaux hiérarchie** | 1 (flat) | 3 (index → sub-index → final) |
| **Sharding** | ❌ Non | ✅ Logique + Temporel |
| **Cache granulaire** | ❌ Tout ou rien | ✅ Par sitemap (TTL différents) |
| **Scalabilité** | 100k URLs max | 1M+ URLs |
| **Refresh sélectif** | ❌ Régénère tout | ✅ Refresh ciblé (ex: blog 2025) |
| **Performance Google** | Moyenne | Optimale |
| **Maintenance** | Moyenne | Excellente |

---

## 🚀 Avantages de l'Architecture Scalable

### 1. **Performance**
- ✅ Cache différencié (7j pour archives vs 30min pour actuel)
- ✅ Génération parallèle possible
- ✅ Refresh sélectif (blog 2025 sans toucher archives)

### 2. **Scalabilité**
- ✅ Supporte 1M+ URLs sans problème
- ✅ Ajout de nouvelles catégories facile
- ✅ Sharding automatique si dépassement 50k

### 3. **SEO**
- ✅ Google crawle plus intelligemment (priorité aux récents)
- ✅ lastmod précis par sous-index
- ✅ Découverte rapide du nouveau contenu

### 4. **Maintenance**
- ✅ Configuration centralisée
- ✅ Logs détaillés par sitemap
- ✅ Monitoring granulaire

---

## 📋 Plan de Migration

### Phase 1: Implémentation de Base
- [ ] Créer interfaces TypeScript
- [ ] Implémenter configuration centralisée
- [ ] Service de génération générique
- [ ] Système de cache avec TTL différenciés

### Phase 2: Sharding
- [ ] Implémenter sharding alphabétique (modèles)
- [ ] Implémenter sharding numérique (types)
- [ ] Implémenter sharding temporel (blog)

### Phase 3: Optimisations
- [ ] Génération parallèle (Promise.all)
- [ ] Compression gzip automatique
- [ ] Monitoring Prometheus

### Phase 4: Déploiement
- [ ] Tests en staging
- [ ] Migration progressive (A/B testing)
- [ ] Monitoring Google Search Console

---

**🎯 Cette architecture est prête pour supporter la croissance du site jusqu'à 1M+ URLs !**

/**
 * Centralized Cache TTL Configuration
 * Source of truth for all cache durations across the application.
 *
 * This file resolves the cache fragmentation issue identified in the architecture audit.
 * All services should import TTL values from here instead of hardcoding them.
 *
 * @see CLAUDE.md - Cache fragmentation issue
 * @see .spec/00-canon/architecture.md
 */

export enum CacheTTL {
  // Base durations (seconds)
  ONE_MINUTE = 60,
  FIVE_MINUTES = 300,
  TEN_MINUTES = 600,
  FIFTEEN_MINUTES = 900,
  THIRTY_MINUTES = 1800,
  ONE_HOUR = 3600,
  TWO_HOURS = 7200,
  FOUR_HOURS = 14400,
  SIX_HOURS = 21600,
  ONE_DAY = 86400,
  SEVEN_DAYS = 604800,
}

/**
 * Périmètres de génération de cache (A3, plan massdoc 2026-09-02).
 *
 * Une génération = un entier Redis (`cache:gen:{scope}`, sans expiration)
 * que les consommateurs lisent pour composer leurs clés et que le chemin
 * d'activation pricing incrémente (`CacheService.bumpGeneration`). Un bump
 * rend toutes les entrées de la génération précédente inatteignables en O(1)
 * — elles expirent par leur TTL. Levier gouverné : déclaré ici, journalisé au
 * bump. NO-GO `clearByPattern()` (Redis KEYS, O(N) bloquant).
 */
export type CacheGenerationScope = 'catalog';

export const CACHE_GENERATIONS: Record<
  CacheGenerationScope,
  { key: string; description: string }
> = {
  catalog: {
    key: 'cache:gen:catalog',
    description:
      'Données dérivées du catalogue (compatibilité TecDoc, prix/dispo affichés) — bump à chaque activation pricing (cadence d’import), jamais par expiration',
  },
};

export interface CacheStrategy {
  ttl: number;
  prefix: string;
  description: string;
  adaptive?: boolean;
  /**
   * Jeton de version STATIQUE (code) : à bumper quand la FORME de la valeur
   * cachée change (nouveau champ, payload brut au lieu de réponse construite…).
   * Fait partie de la clé → l'ancienne forme devient inatteignable au déploiement.
   */
  keyVersion?: string;
  /**
   * Périmètre de génération RUNTIME (Redis) : à déclarer quand la DONNÉE
   * dérive d'un import / d'une activation. Fait partie de la clé via
   * `getCacheKey(strategy, id, generation)`.
   */
  generation?: CacheGenerationScope;
}

/**
 * All cache strategies organized by domain.
 * Import this in your service instead of hardcoding TTL values.
 *
 * @example
 * import { CACHE_STRATEGIES, getCacheKey } from '@/config/cache-ttl.config';
 * const strategy = CACHE_STRATEGIES.VEHICLES.BRANDS;
 * this.cacheService.set(getCacheKey(strategy, brandId), data, strategy.ttl);
 */
export const CACHE_STRATEGIES = {
  // ═══════════════════════════════════════════════════════════════
  // AUTHENTICATION & SESSION
  // ═══════════════════════════════════════════════════════════════
  AUTH: {
    RESET_TOKEN: {
      ttl: CacheTTL.ONE_HOUR,
      prefix: 'reset_token:',
      description: 'Password reset tokens',
    },
    LOGIN_ATTEMPTS: {
      ttl: CacheTTL.FIFTEEN_MINUTES,
      prefix: 'login_attempts:',
      description: 'Brute force prevention',
    },
    USER_PROFILE: {
      ttl: CacheTTL.THIRTY_MINUTES,
      prefix: 'user:',
      description: 'User profile data',
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // CATALOG & PRODUCTS (quasi-static, longer TTL)
  // ═══════════════════════════════════════════════════════════════
  CATALOG: {
    GAMME_RPC: {
      ttl: CacheTTL.ONE_HOUR,
      prefix: 'gamme:rpc:',
      description: 'Gamme RPC data - hourly refresh',
    },
    GAMME_STALE: {
      ttl: CacheTTL.ONE_DAY,
      prefix: 'gamme:rpc:v2:stale:',
      description: 'Stale fallback for resilience',
    },
    GAMME_PRICE_PREVIEW: {
      ttl: CacheTTL.ONE_HOUR,
      prefix: 'gamme:price-preview:',
      description: 'Gamme price preview',
    },
    GAMME_PAGE: {
      ttl: CacheTTL.ONE_HOUR,
      prefix: 'gamme:page:',
      description: 'Gamme page data',
    },
    GAMME_SEO: {
      ttl: CacheTTL.ONE_HOUR,
      prefix: 'gamme:seo:',
      description: 'Gamme SEO metadata',
    },
    FAMILIES: {
      ttl: CacheTTL.TWO_HOURS,
      prefix: 'catalog:families',
      description: 'Product families - semi-static',
    },
    BRANDS: {
      ttl: CacheTTL.TWO_HOURS,
      prefix: 'catalog:brands',
      description: 'Brand list',
    },
    PIECES: {
      ttl: CacheTTL.THIRTY_MINUTES,
      prefix: 'catalog:pieces',
      description: 'Piece/part listings - dynamic',
    },
    HOMEPAGE: {
      ttl: CacheTTL.FIVE_MINUTES,
      prefix: 'homepage:',
      description: 'Homepage data',
    },
    SUPPLIERS: {
      ttl: CacheTTL.THIRTY_MINUTES,
      prefix: 'suppliers:',
      description: 'Suppliers list',
    },
    MANUFACTURERS: {
      ttl: CacheTTL.ONE_HOUR,
      prefix: 'manufacturers:',
      description: 'Manufacturers list',
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // VEHICLES
  // ═══════════════════════════════════════════════════════════════
  VEHICLES: {
    BRANDS: {
      ttl: CacheTTL.ONE_HOUR,
      prefix: 'vehicles:brands:',
      description: 'Vehicle brands',
    },
    MODELS: {
      ttl: CacheTTL.ONE_HOUR,
      prefix: 'vehicles:models:',
      description: 'Vehicle models',
    },
    TYPES: {
      ttl: CacheTTL.ONE_HOUR,
      prefix: 'vehicles:types:',
      description: 'Vehicle types/variants',
    },
    SEARCH: {
      ttl: CacheTTL.THIRTY_MINUTES,
      prefix: 'vehicles:search:',
      description: 'Vehicle search results',
    },
    ENGINE_DATA: {
      ttl: CacheTTL.TWO_HOURS,
      prefix: 'vehicles:engine:',
      description: 'Engine specifications',
    },
    PIECES: {
      ttl: CacheTTL.THIRTY_MINUTES,
      prefix: 'vehicle:pieces:',
      description: 'Vehicle parts compatibility',
    },
    COMPAT: {
      ttl: CacheTTL.ONE_HOUR,
      prefix: 'vehicle:compat:',
      description: 'Vehicle compatibility data',
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // BLOG & CONTENT (popularity-adaptive)
  // ═══════════════════════════════════════════════════════════════
  BLOG: {
    HOT: {
      ttl: CacheTTL.FIVE_MINUTES,
      prefix: 'blog:hot:',
      adaptive: true,
      description: 'Popular articles (>1000 views)',
    },
    WARM: {
      ttl: CacheTTL.THIRTY_MINUTES,
      prefix: 'blog:warm:',
      adaptive: true,
      description: 'Medium articles (100-1000 views)',
    },
    COLD: {
      ttl: CacheTTL.TWO_HOURS,
      prefix: 'blog:cold:',
      adaptive: true,
      description: 'Low-traffic articles (<100 views)',
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // SEARCH
  // ═══════════════════════════════════════════════════════════════
  SEARCH: {
    GENERAL: {
      ttl: CacheTTL.FIVE_MINUTES,
      prefix: 'search:',
      description: 'General search results',
    },
    POPULAR: {
      ttl: CacheTTL.ONE_HOUR,
      prefix: 'search:popular:',
      description: 'Popular/trending queries',
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // DASHBOARD & ANALYTICS
  // ═══════════════════════════════════════════════════════════════
  ANALYTICS: {
    DASHBOARD: {
      ttl: CacheTTL.FIVE_MINUTES,
      prefix: 'dashboard:stats',
      description: 'Dashboard statistics',
    },
    STOCK: {
      ttl: CacheTTL.ONE_MINUTE,
      prefix: 'stock:available',
      description: 'Real-time stock levels',
    },
    SEO_STATS: {
      ttl: CacheTTL.ONE_HOUR,
      prefix: 'seo:stats',
      description: 'SEO KPIs',
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // SITEMAP
  // ═══════════════════════════════════════════════════════════════
  SITEMAP: {
    MASTER: {
      ttl: CacheTTL.ONE_HOUR,
      prefix: 'sitemap:master',
      description: 'Master sitemap index',
    },
    STATIC: {
      ttl: CacheTTL.ONE_DAY,
      prefix: 'sitemap:static',
      description: 'Static pages (rarely change)',
    },
    DYNAMIC: {
      ttl: CacheTTL.THIRTY_MINUTES,
      prefix: 'sitemap:dynamic',
      description: 'Dynamic content',
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // ORDERS
  // ═══════════════════════════════════════════════════════════════
  ORDERS: {
    ENRICHED: {
      ttl: CacheTTL.FIVE_MINUTES,
      prefix: 'orders:enriched:',
      description: 'Enriched orders with relations',
    },
    RECENT: {
      ttl: 180,
      prefix: 'orders:recent:',
      description: 'Recent orders (3 min)',
    },
    COUNT: {
      ttl: 120,
      prefix: 'orders:count:',
      description: 'Order count (2 min)',
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // LAYOUT & NAVIGATION
  // ═══════════════════════════════════════════════════════════════
  LAYOUT: {
    FOOTER: {
      ttl: CacheTTL.TEN_MINUTES,
      prefix: 'layout:footer:',
      description: 'Footer data',
    },
    MENU: {
      ttl: CacheTTL.TEN_MINUTES,
      prefix: 'layout:menu:',
      description: 'Navigation menus',
    },
    SOCIAL: {
      ttl: CacheTTL.ONE_HOUR,
      prefix: 'layout:social:',
      description: 'Social share data',
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // CONFIG
  // ═══════════════════════════════════════════════════════════════
  CONFIG: {
    DATABASE: {
      ttl: CacheTTL.ONE_HOUR,
      prefix: 'config:db:',
      description: 'Database config values',
    },
    METADATA: {
      ttl: CacheTTL.THIRTY_MINUTES,
      prefix: 'config:meta:',
      description: 'Enhanced metadata',
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // EXTERNAL SOURCES
  // ═══════════════════════════════════════════════════════════════
  EXTERNAL: {
    TECDOC: {
      ttl: CacheTTL.ONE_DAY,
      prefix: 'ext:tecdoc:',
      description: 'TecDoc linkages',
    },
    PL24: {
      ttl: CacheTTL.SIX_HOURS,
      prefix: 'ext:pl24:',
      description: 'Partslink24 results',
    },
    SCRAPE: {
      ttl: CacheTTL.ONE_HOUR,
      prefix: 'ext:scrape:',
      description: 'Web scraping results',
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // USERS
  // ═══════════════════════════════════════════════════════════════
  USERS: {
    COUNT: {
      ttl: CacheTTL.TEN_MINUTES,
      prefix: 'users:count:',
      description: 'User count stats',
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // INVOICES & PROMO
  // ═══════════════════════════════════════════════════════════════
  INVOICES: {
    LIST: {
      ttl: CacheTTL.FIVE_MINUTES,
      prefix: 'invoices:',
      description: 'Invoice lists',
    },
  },
  PROMO: {
    DEFAULT: {
      ttl: CacheTTL.THIRTY_MINUTES,
      prefix: 'promo:',
      description: 'Promotional data',
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // RM (page R2 gamme × véhicule) — A2 2026-09-02
  // Toute entrée est stockée au `limit` canonique, jamais par limit.
  // ═══════════════════════════════════════════════════════════════
  // Clé = `{prefix}{keyVersion}:g{génération}:{id}` (A3) — génération lue
  // dans Redis `cache:gen:catalog`, bumpée à l'activation pricing.
  RM: {
    PAGE_V2: {
      ttl: CacheTTL.ONE_HOUR,
      prefix: 'rm:page-v2:',
      // v1 (2026-09-02, A3) : première version explicite de la forme cachée
      // (RmPageCompleteV2Response entière au limit canonique).
      keyVersion: 'v1',
      generation: 'catalog',
      description:
        'rm_get_page_complete_v2 — résultat plein (classification ok)',
    },
    PAGE_V2_EMPTY: {
      ttl: CacheTTL.FIFTEEN_MINUTES,
      prefix: 'rm:page-v2:',
      keyVersion: 'v1',
      generation: 'catalog',
      description:
        'rm_get_page_complete_v2 — 0 produit (classification empty) : population soft-404, TTL court',
    },
    ALTERNATIVES: {
      ttl: CacheTTL.ONE_DAY,
      prefix: 'alt:',
      // v1 → v2 (PR #633) : purge des entrées vides de l'ère .from() RLS-bypass.
      // v2 → v3 (2026-05-19) : purge des entrées vides de l'ère clé publishable
      //   tournée (chaque RPC rendait 'Invalid API key', caché vide 5 min).
      // v3 → v4 (2026-09-02, A2) : la valeur change de forme — payload RPC brut
      //   au limit canonique (tranché à la lecture) au lieu de la réponse construite.
      keyVersion: 'v4',
      generation: 'catalog',
      description:
        'get_soft_404_alternatives — dérivé de compatibilité TecDoc, stable entre imports catalogue',
    },
    ALTERNATIVES_ERROR: {
      ttl: 30,
      prefix: 'alt:',
      keyVersion: 'v4',
      generation: 'catalog',
      description:
        'get_soft_404_alternatives — échec RPC : réponse vide à TTL court, anti-poisoning (incident 2026-05-19)',
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // KEYWORD PLAN (admin batch R1, 0-LLM)
  // ═══════════════════════════════════════════════════════════════
  KEYWORD_PLAN: {
    R1_TOP_VEHICLES: {
      ttl: CacheTTL.ONE_DAY,
      prefix: 'r1kp:top-vehicles:',
      description:
        'Top véhicules par gamme (RPC get_alternative_vehicles_for_gamme, clé = pgId seul) — compatibilité TecDoc, stable entre imports',
    },
  },
} as const;

/**
 * Adaptive TTL strategies based on data characteristics.
 */
export const AdaptiveTTL = {
  /**
   * Get TTL based on content popularity (view count).
   */
  byPopularity(viewCount: number): number {
    if (viewCount > 1000) return CacheTTL.FIVE_MINUTES; // Hot
    if (viewCount > 100) return CacheTTL.THIRTY_MINUTES; // Warm
    return CacheTTL.TWO_HOURS; // Cold
  },

  /**
   * Get TTL based on data update frequency.
   */
  byUpdateFrequency(
    frequency: 'realtime' | 'hourly' | 'daily' | 'weekly',
  ): number {
    const map = {
      realtime: CacheTTL.ONE_MINUTE,
      hourly: CacheTTL.FIVE_MINUTES,
      daily: CacheTTL.THIRTY_MINUTES,
      weekly: CacheTTL.TWO_HOURS,
    };
    return map[frequency];
  },

  /**
   * Get TTL based on payload size (larger = longer cache).
   */
  bySize(sizeBytes: number): number {
    if (sizeBytes > 100_000) return CacheTTL.TWO_HOURS;
    if (sizeBytes > 10_000) return CacheTTL.ONE_HOUR;
    return CacheTTL.THIRTY_MINUTES;
  },
};

/**
 * Helper to get full cache key with prefix.
 */
export function getCacheKey(
  strategy: CacheStrategy,
  id: string,
  generation?: number,
): string {
  const version = strategy.keyVersion ? `${strategy.keyVersion}:` : '';
  const gen = generation === undefined ? '' : `g${generation}:`;
  return `${strategy.prefix}${version}${gen}${id}`;
}

/**
 * Helper to get TTL in milliseconds (for some cache libraries).
 */
export function getTTLMs(strategy: CacheStrategy): number {
  return strategy.ttl * 1000;
}

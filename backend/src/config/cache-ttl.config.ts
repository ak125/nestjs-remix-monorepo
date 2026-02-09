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

export interface CacheStrategy {
  ttl: number;
  prefix: string;
  description: string;
  adaptive?: boolean;
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
export function getCacheKey(strategy: CacheStrategy, id: string): string {
  return `${strategy.prefix}${id}`;
}

/**
 * Helper to get TTL in milliseconds (for some cache libraries).
 */
export function getTTLMs(strategy: CacheStrategy): number {
  return strategy.ttl * 1000;
}

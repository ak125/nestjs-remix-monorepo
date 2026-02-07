/**
 * External Compatibility Verification - Types, Interfaces & Constants
 *
 * Shared across all external-compatibility specialist services.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface VehicleInfo {
  brand: string;
  model: string;
  year?: number;
  ktypnr?: number;
  engine_code?: string;
}

export interface ExternalVerificationResult {
  source: string;
  url: string;
  compatible: boolean | null;
  confidence: number;
  extractedData: {
    oem_refs?: string[];
    compatible_vehicles?: string[];
    price_range?: { min: number; max: number };
    alternatives?: string[];
  };
  screenshot?: string;
  duration_ms: number;
  error?: string;
  timestamp: string;
}

export interface CompatibilityComparisonResult {
  internal_result: {
    compatible: boolean;
    confidence: number;
    source: string;
  };
  external_results: ExternalVerificationResult[];
  consensus: 'confirmed' | 'divergent' | 'inconclusive' | 'partial';
  consensus_confidence: number;
  recommendation: {
    action: 'proceed' | 'verify' | 'diagnostic';
    redirect_url?: string;
    message: string;
    message_detail?: string;
  };
  // NEVER block - always allow purchase with appropriate warnings
  can_purchase: boolean;
  purchase_warning?: string;
  verification_timestamp: string;
}

export interface ExternalVerifyOptions {
  sources?: (
    | 'partlink'
    | 'catcar'
    | 'infocars'
    | 'oscaro'
    | 'partslink24'
    | 'autodoc'
    | 'tecdoc'
  )[];
  timeout?: number;
  screenshots?: boolean;
  parallel?: boolean;
  /** Phase 6: Use weighted consensus algorithm */
  useWeightedConsensus?: boolean;
}

// ============================================================================
// PHASE 6: WEIGHTED CONSENSUS TYPES
// ============================================================================

export interface WeightedConsensusResult {
  consensus: 'confirmed' | 'divergent' | 'partial' | 'inconclusive';
  confidence: number;
  weightedScore: number;
  sourceBreakdown: Array<{
    source: string;
    weight: number;
    compatible: boolean | null;
    contribution: number;
  }>;
}

export interface OemCrossValidationResult {
  validated: Array<{
    ref: string;
    normalizedRef: string;
    occurrenceCount: number;
    sources: string[];
    confidence: number;
  }>;
  hasConflicts: boolean;
  primaryOem: string | null;
  conflictDetails?: string[];
}

// ============================================================================
// PARTSLINK24 SPECIFIC TYPES
// ============================================================================

/** PartLink24 OEM part reference extracted from catalog */
export interface PartLink24OemPart {
  /** OEM reference (e.g., "5Q0 615 301 F") */
  oem_ref: string;
  /** Part description (e.g., "Disque de frein (ventilé)") */
  description: string;
  /** Quantity per vehicle (e.g., 2 for brake discs) */
  quantity: number;
  /** Additional info extracted */
  notes?: string;
}

/** PartLink24 catalog navigation path */
export interface PartLink24NavigationPath {
  brand: string;
  model: string;
  year: number;
  variant?: string;
  group: string;
  subgroup?: string;
}

/** PartLink24 catalog extraction result */
export interface PartLink24CatalogResult {
  success: boolean;
  navigation: PartLink24NavigationPath;
  parts: PartLink24OemPart[];
  screenshot?: string;
  duration_ms: number;
  error?: string;
  timestamp: string;
}

// ============================================================================
// SOURCE CONFIGURATIONS
// ============================================================================

export interface SourceConfig {
  name: string;
  baseUrl: string;
  searchUrlPattern: string;
  waitForText?: string;
  extractScript: string;
  enabled: boolean;
  requiresAuth?: boolean;
  loginUrl?: string;
  authFields?: {
    accountIdSelector?: string;
    usernameSelector?: string;
    passwordSelector?: string;
    submitSelector?: string;
  };
  /** Confidential source - not logged, not exposed in API responses */
  confidential?: boolean;
  /** Supports license plate lookup */
  supportsImmatriculation?: boolean;
  /** URL pattern for immatriculation search */
  immatriculationUrlPattern?: string;

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE 6: Multi-Source Aggregation
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Reliability weight for consensus calculation (0-1)
   * Higher = more authoritative source
   *
   * Guidelines:
   * - 1.00: Official OEM catalog (TecDoc)
   * - 0.95: Authenticated OEM catalogs (PartLink24)
   * - 0.75-0.85: Quality parts databases (PartLink, CatCar)
   * - 0.60-0.70: Commercial aggregators (Oscaro, Autodoc)
   * - 0.50: Unknown/unverified sources
   */
  reliabilityWeight?: number;

  /**
   * Source type for categorization
   */
  sourceType?:
    | 'official_catalog'
    | 'oem_authenticated'
    | 'parts_database'
    | 'commercial'
    | 'aggregator';

  /**
   * Supports direct KType number lookup
   */
  supportsKtypnr?: boolean;

  /**
   * Rate limit: max requests per minute
   */
  rateLimit?: number;

  /**
   * Retry configuration
   */
  retryConfig?: {
    maxRetries: number;
    backoffMs: number;
  };
}

// ============================================================================
// PHASE 6: RELIABILITY WEIGHTS FOR WEIGHTED CONSENSUS
// ============================================================================

/**
 * Source reliability weights for weighted consensus calculation
 * Based on data quality, update frequency, and authority
 */
export const SOURCE_RELIABILITY_WEIGHTS: Record<string, number> = {
  tecdoc: 1.0, // Authoritative - Official TecDoc database
  partslink24: 0.95, // OEM catalog, authenticated, high quality
  partlink: 0.75, // Good coverage, parts database
  catcar: 0.7, // Parts database
  infocars: 0.65, // Compatibility matrix
  oscaro: 0.6, // Commercial aggregator (confidential)
  autodoc: 0.55, // Commercial aggregator (confidential)
};

// ============================================================================
// PHASE 6: CACHE TTL CONFIGURATION (seconds)
// ============================================================================

/**
 * Cache TTL per data type and source
 * Higher TTL for authoritative sources, lower for volatile data
 */
export const CACHE_TTL_CONFIG: Record<string, number> = {
  // TecDoc linkages - very stable, 24h
  'ext:tecdoc': 86400,

  // PartLink24 OEM data - stable, 12h
  'ext:pl24': 43200,

  // Generic scraping results - 30 minutes
  'ext:scrape': 1800,

  // Immatriculation lookup - 24h (vehicle data rarely changes)
  'ext:immat': 86400,

  // Default fallback
  default: 1800,
};

/**
 * Cache key prefixes for external verification
 */
export const CACHE_KEY_PREFIXES = {
  tecdoc: 'ext:tecdoc',
  partslink24: 'ext:pl24',
  scrape: 'ext:scrape',
  immat: 'ext:immat',
};

export const SOURCE_CONFIGS: Record<string, SourceConfig> = {
  partlink: {
    name: 'PartLink',
    baseUrl: 'https://www.partlink.fr',
    searchUrlPattern: '/recherche?q={ref}',
    waitForText: 'Résultats',
    extractScript: `() => {
      const vehicles = Array.from(document.querySelectorAll('.vehicle-compatibility, .compatible-vehicle, [data-compatible]'))
        .map(el => el.textContent?.trim())
        .filter(Boolean);
      const oemRefs = Array.from(document.querySelectorAll('.oem-ref, .reference-oe, [data-oem]'))
        .map(el => el.textContent?.trim())
        .filter(Boolean);
      const priceEl = document.querySelector('.price, .prix, [data-price]');
      const price = priceEl ? parseFloat(priceEl.textContent?.replace(/[^0-9.,]/g, '').replace(',', '.') || '0') : null;
      return { vehicles, oemRefs, price, found: vehicles.length > 0 || oemRefs.length > 0 };
    }`,
    enabled: true,
    // Phase 6
    reliabilityWeight: 0.75,
    sourceType: 'parts_database',
    rateLimit: 30,
    retryConfig: { maxRetries: 2, backoffMs: 1000 },
  },
  catcar: {
    name: 'CatCar',
    baseUrl: 'https://www.catcar.info',
    searchUrlPattern: '/search/{brand}/{model}',
    waitForText: 'Pièces',
    extractScript: `() => {
      const parts = Array.from(document.querySelectorAll('.part-item, .piece, [data-part]'))
        .map(el => ({
          ref: el.querySelector('.ref, .reference')?.textContent?.trim(),
          name: el.querySelector('.name, .nom')?.textContent?.trim(),
        }))
        .filter(p => p.ref);
      const vehicles = Array.from(document.querySelectorAll('.vehicle-list li, .vehicule'))
        .map(el => el.textContent?.trim())
        .filter(Boolean);
      return { parts, vehicles, found: parts.length > 0 };
    }`,
    enabled: true,
    // Phase 6
    reliabilityWeight: 0.7,
    sourceType: 'parts_database',
    rateLimit: 20,
    retryConfig: { maxRetries: 2, backoffMs: 1000 },
  },
  infocars: {
    name: 'Info-Cars',
    baseUrl: 'https://www.info-cars.fr',
    searchUrlPattern: '/catalogue/{ref}',
    waitForText: 'Compatibilité',
    extractScript: `() => {
      const matrix = Array.from(document.querySelectorAll('.compatibility-matrix tr, .compat-row'))
        .map(row => ({
          vehicle: row.querySelector('.vehicle, td:first-child')?.textContent?.trim(),
          compatible: row.querySelector('.status, td:last-child')?.textContent?.includes('✓') ||
                     row.classList.contains('compatible'),
        }))
        .filter(r => r.vehicle);
      return { matrix, found: matrix.length > 0 };
    }`,
    enabled: true,
    // Phase 6
    reliabilityWeight: 0.65,
    sourceType: 'parts_database',
    rateLimit: 30,
    retryConfig: { maxRetries: 2, backoffMs: 1000 },
  },
  oscaro: {
    name: 'Oscaro',
    baseUrl: 'https://www.oscaro.com',
    searchUrlPattern: '/recherche?q={ref}',
    waitForText: 'produit',
    extractScript: `() => {
      const products = Array.from(document.querySelectorAll('.product-item, .product-card'))
        .map(el => ({
          name: el.querySelector('.product-name, .title')?.textContent?.trim(),
          price: parseFloat(el.querySelector('.price')?.textContent?.replace(/[^0-9.,]/g, '').replace(',', '.') || '0'),
          ref: el.querySelector('.reference')?.textContent?.trim(),
        }))
        .filter(p => p.name);
      const minPrice = products.length ? Math.min(...products.map(p => p.price)) : null;
      const maxPrice = products.length ? Math.max(...products.map(p => p.price)) : null;
      return { products, priceRange: minPrice && maxPrice ? { min: minPrice, max: maxPrice } : null, found: products.length > 0 };
    }`,
    enabled: true, // Activé - source confidentielle pour comparaison prix
    confidential: true, // NE PAS logger, NE PAS exposer dans API
    supportsImmatriculation: true,
    immatriculationUrlPattern: '/garage/vehicule/{immat}',
    // Phase 6
    reliabilityWeight: 0.6,
    sourceType: 'commercial',
    rateLimit: 20,
    retryConfig: { maxRetries: 1, backoffMs: 2000 },
  },

  // Autodoc - Source confidentielle pour prix et recherche par immatriculation
  autodoc: {
    name: 'Autodoc',
    baseUrl: 'https://www.autodoc.fr',
    searchUrlPattern: '/recherche?keyword={ref}',
    waitForText: 'résultat',
    extractScript: `() => {
      const products = Array.from(document.querySelectorAll('.product-item, .product-card, [data-testid="product"]'))
        .map(el => ({
          name: el.querySelector('.product-title, .title, h3')?.textContent?.trim(),
          price: parseFloat(el.querySelector('.price, .product-price, [data-testid="price"]')?.textContent?.replace(/[^0-9.,]/g, '').replace(',', '.') || '0'),
          ref: el.querySelector('.reference, .article-number, [data-testid="ref"]')?.textContent?.trim(),
          brand: el.querySelector('.brand, .manufacturer')?.textContent?.trim(),
        }))
        .filter(p => p.name && p.price > 0);
      const minPrice = products.length ? Math.min(...products.map(p => p.price)) : null;
      const maxPrice = products.length ? Math.max(...products.map(p => p.price)) : null;
      return {
        products,
        priceRange: minPrice && maxPrice ? { min: minPrice, max: maxPrice } : null,
        found: products.length > 0,
        count: products.length
      };
    }`,
    enabled: true, // Activé - source confidentielle
    confidential: true, // NE PAS logger, NE PAS exposer dans API
    supportsImmatriculation: true,
    immatriculationUrlPattern: '/garage/immatriculation/{immat}',
    // Phase 6
    reliabilityWeight: 0.55,
    sourceType: 'aggregator',
    rateLimit: 15,
    retryConfig: { maxRetries: 1, backoffMs: 2000 },
  },

  // PartLink24 - Source authentifiée (OEM data)
  partslink24: {
    name: 'PartLink24',
    baseUrl: 'https://www.partslink24.com',
    loginUrl: '/partslink24/user/login.do',
    searchUrlPattern:
      '/partslink24/launchpad.do?action=search&searchTerm={ref}',
    waitForText: 'Résultats',
    requiresAuth: true,
    authFields: {
      accountIdSelector: 'input[name="accountId"], #accountId',
      usernameSelector: 'input[name="userName"], #userName',
      passwordSelector: 'input[name="password"], #password',
      submitSelector:
        'button[type="submit"], input[type="submit"], .login-button',
    },
    extractScript: `() => {
      // Extract vehicle compatibility data from PartLink24
      const vehicles = Array.from(document.querySelectorAll('.vehicle-row, .compatible-vehicle, .vehicleInfo, [data-vehicle]'))
        .map(el => el.textContent?.trim())
        .filter(Boolean);
      const oemRefs = Array.from(document.querySelectorAll('.oem-reference, .ref-oe, .partNumber, [data-oem]'))
        .map(el => el.textContent?.trim())
        .filter(Boolean);
      const priceEl = document.querySelector('.price, .prix, .priceValue');
      const price = priceEl ? parseFloat(priceEl.textContent?.replace(/[^0-9.,]/g, '').replace(',', '.') || '0') : null;
      // Check for compatibility indicators
      const compatibilityIndicator = document.querySelector('.compatibility-status, .fitment-info');
      const isCompatible = compatibilityIndicator?.textContent?.toLowerCase().includes('compatible') ||
                          compatibilityIndicator?.classList.contains('compatible') ||
                          vehicles.length > 0;
      return {
        vehicles,
        oemRefs,
        price,
        found: vehicles.length > 0 || oemRefs.length > 0,
        isCompatible: vehicles.length > 0 ? isCompatible : null
      };
    }`,
    enabled: true,
    // Phase 6
    reliabilityWeight: 0.95,
    sourceType: 'oem_authenticated',
    supportsKtypnr: true,
    rateLimit: 30,
    retryConfig: { maxRetries: 3, backoffMs: 1000 },
  },

  // TecDoc - Placeholder for future official API integration
  // Note: Requires TecDoc API subscription
  tecdoc: {
    name: 'TecDoc',
    baseUrl: 'https://webservice.tecalliance.services/pegasus-3-0',
    searchUrlPattern: '', // Uses API, not URL
    waitForText: '',
    extractScript: `() => ({ found: false })`, // Placeholder - uses API
    enabled: false, // Disabled until API key is configured
    requiresAuth: true,
    // Phase 6
    reliabilityWeight: 1.0, // Authoritative source
    sourceType: 'official_catalog',
    supportsKtypnr: true,
    rateLimit: 60,
    retryConfig: { maxRetries: 3, backoffMs: 1000 },
  },
};

// ============================================================================
// SHARED UTILITIES
// ============================================================================

export { sleep } from '../../../utils/promise-helpers';

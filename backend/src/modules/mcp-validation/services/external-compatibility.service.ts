import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChromeDevToolsClientService, ScrapingResult } from './chrome-devtools-client.service';
import { CacheService } from '../../../cache/cache.service';

/**
 * External Compatibility Verification Service
 *
 * Enriches compatibility verification by scraping external sources:
 * - PartLink: https://partlink.fr
 * - CatCar: https://catcar.info
 * - Info-Cars: https://info-cars.fr
 *
 * CRITICAL: This service NEVER blocks sales.
 * On divergence, it returns recommendations for diagnostic instead.
 *
 * AI-COS Axiome: The AI doesn't create truth, it verifies against multiple sources.
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
  sources?: ('partlink' | 'catcar' | 'infocars' | 'oscaro' | 'partslink24' | 'autodoc' | 'tecdoc')[];
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

interface SourceConfig {
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
  sourceType?: 'official_catalog' | 'oem_authenticated' | 'parts_database' | 'commercial' | 'aggregator';

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
const SOURCE_RELIABILITY_WEIGHTS: Record<string, number> = {
  tecdoc: 1.0,       // Authoritative - Official TecDoc database
  partslink24: 0.95, // OEM catalog, authenticated, high quality
  partlink: 0.75,    // Good coverage, parts database
  catcar: 0.70,      // Parts database
  infocars: 0.65,    // Compatibility matrix
  oscaro: 0.60,      // Commercial aggregator (confidential)
  autodoc: 0.55,     // Commercial aggregator (confidential)
};

// ============================================================================
// PHASE 6: CACHE TTL CONFIGURATION (seconds)
// ============================================================================

/**
 * Cache TTL per data type and source
 * Higher TTL for authoritative sources, lower for volatile data
 */
const CACHE_TTL_CONFIG: Record<string, number> = {
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
const CACHE_KEY_PREFIXES = {
  tecdoc: 'ext:tecdoc',
  partslink24: 'ext:pl24',
  scrape: 'ext:scrape',
  immat: 'ext:immat',
};

const SOURCE_CONFIGS: Record<string, SourceConfig> = {
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
    reliabilityWeight: 0.70,
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
    reliabilityWeight: 0.60,
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
    searchUrlPattern: '/partslink24/launchpad.do?action=search&searchTerm={ref}',
    waitForText: 'Résultats',
    requiresAuth: true,
    authFields: {
      accountIdSelector: 'input[name="accountId"], #accountId',
      usernameSelector: 'input[name="userName"], #userName',
      passwordSelector: 'input[name="password"], #password',
      submitSelector: 'button[type="submit"], input[type="submit"], .login-button',
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
// SERVICE
// ============================================================================

@Injectable()
export class ExternalCompatibilityService {
  private readonly logger = new Logger(ExternalCompatibilityService.name);
  private readonly enabledSources: string[];
  private readonly defaultTimeout: number;

  // PartLink24 credentials (from env)
  private readonly partslink24Credentials: {
    accountId: string;
    username: string;
    password: string;
  } | null;
  private partslink24Authenticated = false;

  constructor(
    private readonly chromeClient: ChromeDevToolsClientService,
    private readonly configService: ConfigService,
    @Optional() private readonly cacheService?: CacheService,
  ) {
    // Parse enabled sources from env
    const sourcesEnv = this.configService.get<string>('EXTERNAL_SOURCES_ENABLED', 'partlink,catcar');
    this.enabledSources = sourcesEnv.split(',').map((s) => s.trim().toLowerCase());

    this.defaultTimeout = this.configService.get<number>('EXTERNAL_SCRAPE_TIMEOUT', 15000);

    // Load PartLink24 credentials if available
    const accountId = this.configService.get<string>('PARTSLINK24_ACCOUNT_ID');
    const username = this.configService.get<string>('PARTSLINK24_USERNAME');
    const password = this.configService.get<string>('PARTSLINK24_PASSWORD');

    if (accountId && username && password) {
      this.partslink24Credentials = { accountId, username, password };
      this.logger.log('PartLink24 credentials configured');
    } else {
      this.partslink24Credentials = null;
      this.logger.warn('PartLink24 credentials not configured - source will be skipped');
    }

    this.logger.log(`External sources enabled: ${this.enabledSources.join(', ')}`);
  }

  /**
   * Verify compatibility across multiple external sources
   *
   * CRITICAL: Never blocks sales - returns recommendations for diagnostic instead
   */
  async verifyCompatibilityExternal(
    pieceRef: string,
    vehicleInfo: VehicleInfo,
    internalResult: { compatible: boolean; confidence: number },
    options?: ExternalVerifyOptions,
  ): Promise<CompatibilityComparisonResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    // Determine which sources to use
    const sourcesToUse = options?.sources || (this.enabledSources as ExternalVerifyOptions['sources']);
    const timeout = options?.timeout || this.defaultTimeout;
    const takeScreenshots = options?.screenshots ?? false;

    this.logger.log(`Verifying piece ${pieceRef} for ${vehicleInfo.brand} ${vehicleInfo.model}`);

    // Fetch from all sources (parallel or sequential)
    const externalResults: ExternalVerificationResult[] = [];

    if (options?.parallel !== false) {
      // Parallel execution
      const promises = sourcesToUse!.map((source) =>
        this.scrapeSource(source, pieceRef, vehicleInfo, timeout, takeScreenshots),
      );
      const results = await Promise.allSettled(promises);

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          externalResults.push(result.value);
        }
      }
    } else {
      // Sequential execution
      for (const source of sourcesToUse!) {
        const result = await this.scrapeSource(source, pieceRef, vehicleInfo, timeout, takeScreenshots);
        if (result) {
          externalResults.push(result);
        }
      }
    }

    // Analyze consensus - Phase 6: Use weighted algorithm if requested
    const useWeighted = options?.useWeightedConsensus !== false; // Default to weighted
    const analysis = useWeighted
      ? this.analyzeConsensusWeighted(internalResult, externalResults)
      : { ...this.analyzeConsensus(internalResult, externalResults), weightedScore: 0, sourceBreakdown: [] };

    // Phase 6: Cross-validate OEM references
    const oemValidation = this.crossValidateOemReferences(externalResults);

    // Build recommendation (NEVER block)
    const recommendation = this.buildRecommendation(analysis, pieceRef, vehicleInfo);

    // Build detailed response
    const response: CompatibilityComparisonResult & {
      weighted_consensus?: WeightedConsensusResult;
      oem_validation?: OemCrossValidationResult;
    } = {
      internal_result: {
        compatible: internalResult.compatible,
        confidence: internalResult.confidence,
        source: 'internal_db',
      },
      external_results: externalResults,
      consensus: analysis.consensus,
      consensus_confidence: analysis.confidence,
      recommendation,
      can_purchase: true, // NEVER block
      purchase_warning: analysis.consensus === 'divergent'
        ? '⚠️ Compatibilité non confirmée à 100%. Vérifiez les références OEM avant achat.'
        : oemValidation.hasConflicts
        ? '⚠️ Références OEM divergentes détectées. Vérifiez la référence exacte pour votre véhicule.'
        : undefined,
      verification_timestamp: timestamp,
    };

    // Include Phase 6 data if weighted consensus was used
    if (useWeighted) {
      response.weighted_consensus = analysis as WeightedConsensusResult;
    }

    if (oemValidation.validated.length > 0) {
      response.oem_validation = oemValidation;
    }

    return response;
  }

  /**
   * Authenticate to PartLink24
   * Called automatically when scraping partslink24 source
   *
   * Handles:
   * - Standard login flow with accountId/username/password
   * - "Session already exists" dialog (confirms to close existing session)
   * - Password change requirement (clicks Cancel to bypass)
   */
  private async authenticatePartLink24(): Promise<boolean> {
    if (!this.partslink24Credentials) {
      this.logger.warn('PartLink24 credentials not available');
      return false;
    }

    if (this.partslink24Authenticated) {
      return true; // Already authenticated in this session
    }

    const config = SOURCE_CONFIGS['partslink24'];
    const loginUrl = config.baseUrl + config.loginUrl;

    try {
      this.logger.log('Authenticating to PartLink24...');

      // 1. Navigate to login page
      const navResult = await this.chromeClient.navigatePage({
        url: loginUrl,
        timeout: 15000,
      });

      if (!navResult.success) {
        throw new Error(`Failed to navigate to login: ${navResult.error}`);
      }

      // 2. Take snapshot to understand the form
      const snapshot = await this.chromeClient.takeSnapshot();

      // 3. Fill account ID (look for the field by label or common patterns)
      await this.chromeClient.fillByLabel('Account ID', this.partslink24Credentials.accountId);
      await this.sleep(200);

      // 4. Fill username
      await this.chromeClient.fillByLabel('User', this.partslink24Credentials.username);
      await this.sleep(200);

      // 5. Fill password
      await this.chromeClient.fillByLabel('Password', this.partslink24Credentials.password);
      await this.sleep(200);

      // 6. Submit login form (click Login button)
      await this.chromeClient.clickByText('Login');
      await this.sleep(2000); // Wait for login to process

      // 7. Handle potential "session already exists" dialog
      const sessionDialogSnapshot = await this.chromeClient.takeSnapshot();
      if (sessionDialogSnapshot.content?.includes('session') || sessionDialogSnapshot.content?.includes('Confirmer')) {
        this.logger.log('Session dialog detected, clicking Confirmer...');
        await this.chromeClient.clickByText('Confirmer');
        await this.sleep(2000);
      }

      // 8. Handle potential password change requirement
      const pwChangeSnapshot = await this.chromeClient.takeSnapshot();
      if (
        pwChangeSnapshot.content?.includes('password') &&
        pwChangeSnapshot.content?.includes('change')
      ) {
        this.logger.log('Password change dialog detected, clicking Cancel...');
        await this.chromeClient.clickByText('Annuler');
        await this.sleep(2000);
      }

      // 9. Verify we're logged in (look for brand menu or welcome message)
      const finalSnapshot = await this.chromeClient.takeSnapshot();
      const isLoggedIn =
        finalSnapshot.content?.includes('Bienvenue') ||
        finalSnapshot.content?.includes('brandMenu') ||
        finalSnapshot.content?.includes('Volkswagen') ||
        finalSnapshot.content?.includes('Mercedes') ||
        finalSnapshot.content?.includes('VIN');

      if (isLoggedIn) {
        this.partslink24Authenticated = true;
        this.logger.log('PartLink24 authentication successful');
        return true;
      }

      this.logger.warn('PartLink24 authentication status uncertain - proceeding anyway');
      this.partslink24Authenticated = true; // Try to continue
      return true;
    } catch (error) {
      this.logger.error(`PartLink24 authentication failed: ${error.message}`);
      return false;
    }
  }

  /** Simple sleep utility */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Scrape a specific source
   */
  private async scrapeSource(
    source: string,
    pieceRef: string,
    vehicleInfo: VehicleInfo,
    timeout: number,
    takeScreenshot: boolean,
  ): Promise<ExternalVerificationResult | null> {
    const config = SOURCE_CONFIGS[source];
    if (!config || !config.enabled) {
      this.logger.debug(`Source ${source} is disabled or not configured`);
      return null;
    }

    // Handle authentication for sources that require it
    if (config.requiresAuth && source === 'partslink24') {
      if (!this.partslink24Credentials) {
        this.logger.debug('PartLink24 requires credentials but none configured');
        return null;
      }
      const authSuccess = await this.authenticatePartLink24();
      if (!authSuccess) {
        this.logger.warn('PartLink24 authentication failed, skipping source');
        return null;
      }
    }

    const startTime = Date.now();

    // Build URL
    let url = config.baseUrl + config.searchUrlPattern;
    url = url.replace('{ref}', encodeURIComponent(pieceRef));
    url = url.replace('{brand}', encodeURIComponent(vehicleInfo.brand));
    url = url.replace('{model}', encodeURIComponent(vehicleInfo.model));

    try {
      const result = await this.chromeClient.scrape<{
        vehicles?: string[];
        oemRefs?: string[];
        price?: number;
        priceRange?: { min: number; max: number };
        found: boolean;
        matrix?: Array<{ vehicle: string; compatible: boolean }>;
        parts?: Array<{ ref: string; name: string }>;
      }>({
        url,
        waitForText: config.waitForText,
        extractScript: config.extractScript,
        timeout,
        takeScreenshot,
        screenshotQuality: 50,
      });

      if (!result.success) {
        return {
          source: config.name,
          url,
          compatible: null,
          confidence: 0,
          extractedData: {},
          error: result.error,
          duration_ms: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        };
      }

      // Parse result
      const data = result.data;
      const hasData = data?.found || false;

      // Determine compatibility from extracted data
      let compatible: boolean | null = null;
      if (data?.matrix) {
        // Check if vehicle is in compatibility matrix
        const vehicleMatch = data.matrix.find(
          (m) =>
            m.vehicle?.toLowerCase().includes(vehicleInfo.brand.toLowerCase()) &&
            m.vehicle?.toLowerCase().includes(vehicleInfo.model.toLowerCase()),
        );
        compatible = vehicleMatch?.compatible ?? null;
      } else if (data?.vehicles && data.vehicles.length > 0) {
        // Check if vehicle is in compatible list
        const vehiclePattern = `${vehicleInfo.brand} ${vehicleInfo.model}`.toLowerCase();
        compatible = data.vehicles.some((v) => v.toLowerCase().includes(vehiclePattern));
      }

      return {
        source: config.name,
        url,
        compatible,
        confidence: hasData ? (compatible !== null ? 0.85 : 0.5) : 0.3,
        extractedData: {
          oem_refs: data?.oemRefs,
          compatible_vehicles: data?.vehicles,
          price_range: data?.priceRange || (data?.price ? { min: data.price, max: data.price } : undefined),
        },
        screenshot: result.screenshot,
        duration_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.warn(`Error scraping ${config.name}: ${error.message}`);
      return {
        source: config.name,
        url,
        compatible: null,
        confidence: 0,
        extractedData: {},
        error: error.message,
        duration_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Analyze consensus between internal and external results
   */
  private analyzeConsensus(
    internalResult: { compatible: boolean; confidence: number },
    externalResults: ExternalVerificationResult[],
  ): { consensus: CompatibilityComparisonResult['consensus']; confidence: number } {
    // Filter successful results
    const validResults = externalResults.filter((r) => r.compatible !== null && !r.error);

    if (validResults.length === 0) {
      return { consensus: 'inconclusive', confidence: internalResult.confidence };
    }

    // Count agreements
    const agreements = validResults.filter((r) => r.compatible === internalResult.compatible).length;
    const disagreements = validResults.filter((r) => r.compatible !== internalResult.compatible).length;
    const total = validResults.length;

    // Calculate weighted confidence
    const avgExternalConfidence =
      validResults.reduce((sum, r) => sum + r.confidence, 0) / validResults.length;

    if (agreements === total) {
      // All sources agree
      return {
        consensus: 'confirmed',
        confidence: Math.min(0.95, (internalResult.confidence + avgExternalConfidence) / 2 + 0.1),
      };
    } else if (disagreements > agreements) {
      // More sources disagree
      return {
        consensus: 'divergent',
        confidence: Math.max(0.3, avgExternalConfidence - 0.2),
      };
    } else if (agreements > 0) {
      // Mixed results
      return {
        consensus: 'partial',
        confidence: (agreements / total) * avgExternalConfidence,
      };
    }

    return { consensus: 'inconclusive', confidence: 0.4 };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 6: WEIGHTED CONSENSUS ALGORITHM
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Analyze consensus using weighted source reliability
   *
   * Phase 6: Multi-Source Aggregation
   * - Uses SOURCE_RELIABILITY_WEIGHTS for each source
   * - Calculates weighted compatibility score
   * - Provides detailed source breakdown
   */
  private analyzeConsensusWeighted(
    internalResult: { compatible: boolean; confidence: number },
    externalResults: ExternalVerificationResult[],
  ): WeightedConsensusResult {
    const validResults = externalResults.filter((r) => r.compatible !== null && !r.error);

    if (validResults.length === 0) {
      return {
        consensus: 'inconclusive',
        confidence: internalResult.confidence,
        weightedScore: 0.5,
        sourceBreakdown: [],
      };
    }

    // Calculate weighted scores
    let totalWeight = 0;
    let compatibleWeight = 0;
    const sourceBreakdown: WeightedConsensusResult['sourceBreakdown'] = [];

    for (const result of validResults) {
      const sourceName = result.source.toLowerCase();
      const weight = SOURCE_RELIABILITY_WEIGHTS[sourceName] || 0.5;

      totalWeight += weight;

      if (result.compatible === internalResult.compatible) {
        compatibleWeight += weight;
      }

      sourceBreakdown.push({
        source: result.source,
        weight,
        compatible: result.compatible,
        contribution: result.compatible === internalResult.compatible ? weight : -weight * 0.5,
      });
    }

    // Calculate weighted score (0-1)
    const weightedScore = totalWeight > 0 ? compatibleWeight / totalWeight : 0.5;

    // Determine consensus based on weighted score
    let consensus: CompatibilityComparisonResult['consensus'];
    let confidence: number;

    if (weightedScore >= 0.7) {
      consensus = 'confirmed';
      confidence = Math.min(0.95, 0.50 + weightedScore * 0.45);
    } else if (weightedScore <= 0.3) {
      consensus = 'divergent';
      confidence = Math.max(0.30, 0.50 - (1 - weightedScore) * 0.30);
    } else {
      consensus = 'partial';
      confidence = 0.40 + weightedScore * 0.30;
    }

    // Adjust confidence based on number of high-reliability sources
    const highReliabilitySources = validResults.filter((r) => {
      const w = SOURCE_RELIABILITY_WEIGHTS[r.source.toLowerCase()] || 0;
      return w >= 0.75;
    });

    if (highReliabilitySources.length >= 2 && consensus === 'confirmed') {
      confidence = Math.min(0.98, confidence + 0.05);
    }

    return {
      consensus,
      confidence,
      weightedScore,
      sourceBreakdown,
    };
  }

  /**
   * Normalize OEM reference for comparison
   * Removes spaces, dashes, and converts to uppercase
   */
  private normalizeOemRef(ref: string): string {
    return ref
      .toUpperCase()
      .replace(/[\s\-_\.]/g, '')
      .trim();
  }

  /**
   * Cross-validate OEM references across multiple sources
   *
   * Phase 6: OEM Cross-Validation
   * - Collects OEM refs from all sources
   * - Normalizes refs for comparison
   * - Identifies primary OEM ref and conflicts
   */
  crossValidateOemReferences(
    externalResults: ExternalVerificationResult[],
  ): OemCrossValidationResult {
    const oemsBySource = new Map<string, string[]>();

    // Collect OEM refs from each source
    for (const result of externalResults) {
      if (result.extractedData.oem_refs && result.extractedData.oem_refs.length > 0) {
        oemsBySource.set(result.source, result.extractedData.oem_refs);
      }
    }

    if (oemsBySource.size === 0) {
      return {
        validated: [],
        hasConflicts: false,
        primaryOem: null,
      };
    }

    // Normalize and count occurrences
    const normalizedOems = new Map<string, {
      original: string;
      sources: string[];
      count: number;
    }>();

    for (const [source, refs] of oemsBySource.entries()) {
      for (const ref of refs) {
        const normalized = this.normalizeOemRef(ref);

        if (normalizedOems.has(normalized)) {
          const entry = normalizedOems.get(normalized)!;
          entry.sources.push(source);
          entry.count++;
        } else {
          normalizedOems.set(normalized, {
            original: ref,
            sources: [source],
            count: 1,
          });
        }
      }
    }

    // Convert to array and sort by count (descending)
    const validated = Array.from(normalizedOems.entries())
      .map(([normalized, data]) => ({
        ref: data.original,
        normalizedRef: normalized,
        occurrenceCount: data.count,
        sources: data.sources,
        confidence: Math.min(0.95, data.count / oemsBySource.size),
      }))
      .sort((a, b) => b.occurrenceCount - a.occurrenceCount);

    // Identify conflicts (different refs from high-reliability sources)
    const conflictDetails: string[] = [];
    const topRefs = validated.filter((v) => v.occurrenceCount >= 2);

    if (topRefs.length > 1) {
      conflictDetails.push(
        `Multiple OEM refs found: ${topRefs.map((r) => r.ref).join(', ')}`,
      );
    }

    // Check if high-reliability sources disagree
    const partslink24Refs = oemsBySource.get('PartLink24') || [];
    const partlinkRefs = oemsBySource.get('PartLink') || [];

    if (partslink24Refs.length > 0 && partlinkRefs.length > 0) {
      const pl24Normalized = new Set(partslink24Refs.map((r) => this.normalizeOemRef(r)));
      const plNormalized = new Set(partlinkRefs.map((r) => this.normalizeOemRef(r)));

      const intersection = [...pl24Normalized].filter((r) => plNormalized.has(r));
      if (intersection.length === 0 && partslink24Refs.length > 0) {
        conflictDetails.push(
          `PartLink24 and PartLink refs do not overlap`,
        );
      }
    }

    return {
      validated,
      hasConflicts: conflictDetails.length > 0,
      primaryOem: validated.length > 0 ? validated[0].ref : null,
      conflictDetails: conflictDetails.length > 0 ? conflictDetails : undefined,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 6: REDIS CACHE LAYER
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create a hash from vehicle info for cache key
   * Ensures consistent cache keys across requests
   */
  private hashVehicle(vehicleInfo: VehicleInfo): string {
    const normalized = [
      vehicleInfo.brand?.toLowerCase().replace(/\s+/g, '-') || '',
      vehicleInfo.model?.toLowerCase().replace(/\s+/g, '-') || '',
      vehicleInfo.year?.toString() || '',
      vehicleInfo.ktypnr?.toString() || '',
      vehicleInfo.engine_code?.toLowerCase() || '',
    ].filter(Boolean).join(':');

    // Simple hash for shorter keys
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(36);
  }

  /**
   * Get cache TTL for a specific source
   */
  private getCacheTtl(source: string): number {
    const sourceLower = source.toLowerCase();

    // Check specific source TTLs
    if (sourceLower === 'tecdoc') {
      return CACHE_TTL_CONFIG['ext:tecdoc'];
    }
    if (sourceLower === 'partslink24') {
      return CACHE_TTL_CONFIG['ext:pl24'];
    }

    // Default scraping TTL
    return CACHE_TTL_CONFIG['ext:scrape'] || CACHE_TTL_CONFIG.default;
  }

  /**
   * Build cache key for external verification
   *
   * Key patterns:
   * - ext:scrape:{source}:{pieceRef}:{vehicleHash}
   * - ext:pl24:{brand}:{model}:{group}
   * - ext:tecdoc:{ktypnr}:{pieceId}
   */
  private getCacheKey(
    source: string,
    pieceRef: string,
    vehicleInfo: VehicleInfo,
  ): string {
    const vehicleHash = this.hashVehicle(vehicleInfo);
    const sourceKey = source.toLowerCase();
    const normalizedRef = pieceRef.replace(/[\s\-]/g, '').toUpperCase();

    return `ext:scrape:${sourceKey}:${normalizedRef}:${vehicleHash}`;
  }

  /**
   * Scrape source with caching layer
   *
   * Phase 6: Caches external scraping results to:
   * - Reduce load on external sources
   * - Improve response times
   * - Respect rate limits
   *
   * @param source - Source to scrape
   * @param pieceRef - Part reference
   * @param vehicleInfo - Vehicle information
   * @param timeout - Request timeout
   * @param takeScreenshot - Whether to capture screenshot
   * @param bypassCache - Force fresh scraping (default: false)
   */
  private async scrapeSourceCached(
    source: string,
    pieceRef: string,
    vehicleInfo: VehicleInfo,
    timeout: number,
    takeScreenshot: boolean,
    bypassCache = false,
  ): Promise<ExternalVerificationResult | null> {
    const cacheKey = this.getCacheKey(source, pieceRef, vehicleInfo);
    const ttl = this.getCacheTtl(source);

    // Try cache first (unless bypass requested)
    if (!bypassCache && this.cacheService) {
      try {
        const cached = await this.cacheService.get<ExternalVerificationResult>(cacheKey);
        if (cached) {
          this.logger.debug(`Cache HIT for ${source}: ${cacheKey}`);
          return {
            ...cached,
            // Mark as cached result
            timestamp: new Date().toISOString(),
          };
        }
        this.logger.debug(`Cache MISS for ${source}: ${cacheKey}`);
      } catch (error) {
        this.logger.warn(`Cache read error for ${cacheKey}: ${error.message}`);
      }
    }

    // Scrape from source
    const result = await this.scrapeSource(source, pieceRef, vehicleInfo, timeout, takeScreenshot);

    // Cache successful results
    if (result && !result.error && this.cacheService) {
      try {
        // Don't cache screenshots to save space
        const toCache = { ...result };
        delete toCache.screenshot;

        await this.cacheService.set(cacheKey, toCache, ttl);
        this.logger.debug(`Cached ${source} result for ${ttl}s: ${cacheKey}`);
      } catch (error) {
        this.logger.warn(`Cache write error for ${cacheKey}: ${error.message}`);
      }
    }

    return result;
  }

  /**
   * Verify compatibility with caching enabled
   *
   * Wrapper around verifyCompatibilityExternal that uses cached scraping
   *
   * @param pieceRef - Part reference
   * @param vehicleInfo - Vehicle information
   * @param internalResult - Result from internal database
   * @param options - Verification options
   */
  async verifyCompatibilityExternalCached(
    pieceRef: string,
    vehicleInfo: VehicleInfo,
    internalResult: { compatible: boolean; confidence: number },
    options?: ExternalVerifyOptions & { bypassCache?: boolean },
  ): Promise<CompatibilityComparisonResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    const bypassCache = options?.bypassCache ?? false;

    // Determine which sources to use
    const sourcesToUse = options?.sources || (this.enabledSources as ExternalVerifyOptions['sources']);
    const timeout = options?.timeout || this.defaultTimeout;
    const takeScreenshots = options?.screenshots ?? false;

    this.logger.log(`Verifying (cached) piece ${pieceRef} for ${vehicleInfo.brand} ${vehicleInfo.model}`);

    // Fetch from all sources with caching
    const externalResults: ExternalVerificationResult[] = [];

    if (options?.parallel !== false) {
      // Parallel execution with caching
      const promises = sourcesToUse!.map((source) =>
        this.scrapeSourceCached(source, pieceRef, vehicleInfo, timeout, takeScreenshots, bypassCache),
      );
      const results = await Promise.allSettled(promises);

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          externalResults.push(result.value);
        }
      }
    } else {
      // Sequential execution with caching
      for (const source of sourcesToUse!) {
        const result = await this.scrapeSourceCached(source, pieceRef, vehicleInfo, timeout, takeScreenshots, bypassCache);
        if (result) {
          externalResults.push(result);
        }
      }
    }

    // Use weighted consensus (Phase 6)
    const analysis = this.analyzeConsensusWeighted(internalResult, externalResults);

    // Cross-validate OEM references (Phase 6)
    const oemValidation = this.crossValidateOemReferences(externalResults);

    // Build recommendation
    const recommendation = this.buildRecommendation(analysis, pieceRef, vehicleInfo);

    return {
      internal_result: {
        compatible: internalResult.compatible,
        confidence: internalResult.confidence,
        source: 'internal_db',
      },
      external_results: externalResults,
      consensus: analysis.consensus,
      consensus_confidence: analysis.confidence,
      recommendation,
      can_purchase: true, // NEVER block
      purchase_warning: analysis.consensus === 'divergent'
        ? '⚠️ Compatibilité non confirmée à 100%. Vérifiez les références OEM avant achat.'
        : oemValidation.hasConflicts
        ? '⚠️ Références OEM divergentes détectées. Vérifiez la référence exacte pour votre véhicule.'
        : undefined,
      verification_timestamp: timestamp,
    };
  }

  /**
   * Clear cache for a specific piece/vehicle combination
   */
  async clearCacheForPiece(pieceRef: string, vehicleInfo?: VehicleInfo): Promise<number> {
    if (!this.cacheService) {
      return 0;
    }

    let pattern: string;
    if (vehicleInfo) {
      const vehicleHash = this.hashVehicle(vehicleInfo);
      const normalizedRef = pieceRef.replace(/[\s\-]/g, '').toUpperCase();
      pattern = `ext:scrape:*:${normalizedRef}:${vehicleHash}`;
    } else {
      const normalizedRef = pieceRef.replace(/[\s\-]/g, '').toUpperCase();
      pattern = `ext:scrape:*:${normalizedRef}:*`;
    }

    return await this.cacheService.clearByPattern(pattern);
  }

  /**
   * Clear all external verification cache
   */
  async clearAllExternalCache(): Promise<number> {
    if (!this.cacheService) {
      return 0;
    }

    return await this.cacheService.clearByPattern('ext:*');
  }

  /**
   * Build recommendation based on analysis
   *
   * CRITICAL: Never recommends blocking - always redirects to diagnostic
   */
  private buildRecommendation(
    analysis: { consensus: CompatibilityComparisonResult['consensus']; confidence: number },
    pieceRef: string,
    vehicleInfo: VehicleInfo,
  ): CompatibilityComparisonResult['recommendation'] {
    const encodedParams = new URLSearchParams({
      ref: pieceRef,
      brand: vehicleInfo.brand,
      model: vehicleInfo.model,
      reason: analysis.consensus,
    }).toString();

    switch (analysis.consensus) {
      case 'confirmed':
        return {
          action: 'proceed',
          message: 'Compatibilité confirmée par sources multiples.',
          message_detail: 'Notre base de données et les sources externes concordent.',
        };

      case 'divergent':
        return {
          action: 'diagnostic',
          redirect_url: `/diagnostic/compatibility-analysis?${encodedParams}`,
          message: 'Informations divergentes détectées.',
          message_detail:
            'Nos sources indiquent des résultats différents. Utilisez notre outil de diagnostic pour une analyse approfondie et des alternatives.',
        };

      case 'partial':
        return {
          action: 'verify',
          redirect_url: `/diagnostic/compatibility-analysis?${encodedParams}`,
          message: 'Vérification recommandée.',
          message_detail:
            'Certaines sources confirment la compatibilité, d\'autres non. Vérifiez les références OEM.',
        };

      case 'inconclusive':
      default:
        return {
          action: 'verify',
          message: 'Vérification impossible via sources externes.',
          message_detail:
            'Les sources externes n\'ont pas pu confirmer. Fiez-vous aux références OEM ou contactez-nous.',
        };
    }
  }

  /**
   * Scrape PartLink specifically
   */
  async scrapePartLink(pieceRef: string): Promise<ExternalVerificationResult | null> {
    return this.scrapeSource('partlink', pieceRef, { brand: '', model: '' }, this.defaultTimeout, false);
  }

  /**
   * Scrape CatCar specifically
   */
  async scrapeCatCar(brand: string, model: string): Promise<ExternalVerificationResult | null> {
    return this.scrapeSource('catcar', '', { brand, model }, this.defaultTimeout, false);
  }

  /**
   * Scrape Info-Cars specifically
   */
  async scrapeInfoCars(pieceRef: string): Promise<ExternalVerificationResult | null> {
    return this.scrapeSource('infocars', pieceRef, { brand: '', model: '' }, this.defaultTimeout, false);
  }

  // ============================================================================
  // PARTSLINK24 CATALOG NAVIGATION (TESTED FLOW)
  // ============================================================================

  /**
   * Scrape PartLink24 via catalog navigation
   *
   * This method uses the tested navigation flow:
   * 1. Login with credentials
   * 2. Navigate: Brand → Model → Year → Variant → Group → Subgroup
   * 3. Extract OEM part numbers
   *
   * @param navigation - Navigation path specifying brand, model, year, variant, group, subgroup
   * @param takeScreenshot - Whether to capture screenshot for audit
   */
  async scrapePartsLink24Catalog(
    navigation: PartLink24NavigationPath,
    takeScreenshot = false,
  ): Promise<PartLink24CatalogResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    try {
      // 1. Authenticate first
      const authSuccess = await this.authenticatePartLink24();
      if (!authSuccess) {
        return {
          success: false,
          navigation,
          parts: [],
          duration_ms: Date.now() - startTime,
          error: 'Authentication failed',
          timestamp,
        };
      }

      // 2. Navigate to brand menu if not already there
      let snapshot = await this.chromeClient.takeSnapshot();
      if (!snapshot.content?.includes(navigation.brand)) {
        // Go to brand menu
        await this.chromeClient.navigatePage({
          url: 'https://www.partslink24.com/partslink24/launchpad/brandMenu.do',
          timeout: 10000,
        });
        await this.sleep(1000);
      }

      // 3. Click on brand (e.g., "Volkswagen")
      this.logger.log(`Navigating to brand: ${navigation.brand}`);
      await this.chromeClient.clickByText(navigation.brand);
      await this.sleep(2000);

      // 4. Select model - look for dropdown or list
      this.logger.log(`Selecting model: ${navigation.model}`);
      snapshot = await this.chromeClient.takeSnapshot();

      // Try to find model in the page content
      if (snapshot.content?.includes(navigation.model)) {
        await this.chromeClient.clickByText(navigation.model);
        await this.sleep(1500);
      } else {
        // Try dropdown selection
        await this.chromeClient.selectByLabel('Modèle', navigation.model);
        await this.sleep(1500);
      }

      // 5. Select year
      this.logger.log(`Selecting year: ${navigation.year}`);
      snapshot = await this.chromeClient.takeSnapshot();

      if (snapshot.content?.includes(String(navigation.year))) {
        await this.chromeClient.clickByText(String(navigation.year));
        await this.sleep(1500);
      } else {
        await this.chromeClient.selectByLabel('Année', String(navigation.year));
        await this.sleep(1500);
      }

      // 6. Select variant if specified
      if (navigation.variant) {
        this.logger.log(`Selecting variant: ${navigation.variant}`);
        await this.chromeClient.clickByText(navigation.variant);
        await this.sleep(1500);
      }

      // 7. Navigate to parts group
      this.logger.log(`Navigating to group: ${navigation.group}`);
      await this.chromeClient.clickByText(navigation.group);
      await this.sleep(2000);

      // 8. Select subgroup if specified
      if (navigation.subgroup) {
        this.logger.log(`Selecting subgroup: ${navigation.subgroup}`);
        await this.chromeClient.clickByText(navigation.subgroup);
        await this.sleep(2000);
      }

      // 9. Extract part data from the page
      const partsData = await this.extractPartsLink24Parts();

      // 10. Take screenshot if requested
      let screenshotData: string | undefined;
      if (takeScreenshot) {
        const screenshotResult = await this.chromeClient.takeScreenshot({
          format: 'jpeg',
          quality: 50,
        });
        screenshotData = screenshotResult.data;
      }

      return {
        success: true,
        navigation,
        parts: partsData,
        screenshot: screenshotData,
        duration_ms: Date.now() - startTime,
        timestamp,
      };
    } catch (error) {
      this.logger.error(`PartLink24 catalog scraping failed: ${error.message}`);
      return {
        success: false,
        navigation,
        parts: [],
        duration_ms: Date.now() - startTime,
        error: error.message,
        timestamp,
      };
    }
  }

  /**
   * Extract OEM part references from PartLink24 parts page
   *
   * Parses the page to extract:
   * - OEM reference (e.g., "5Q0 615 301 F")
   * - Description (e.g., "Disque de frein (ventilé)")
   * - Quantity (e.g., 2)
   */
  private async extractPartsLink24Parts(): Promise<PartLink24OemPart[]> {
    try {
      // Execute extraction script in the page
      const result = await this.chromeClient.evaluateScript<{
        parts: Array<{
          ref: string;
          description: string;
          quantity: number;
          notes?: string;
        }>;
      }>({ function: `() => {
        const parts = [];

        // Strategy 1: Look for table rows with part data
        const rows = document.querySelectorAll('tr, .part-row, .piece-row, [data-part]');
        for (const row of rows) {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 2) {
            // Look for OEM reference pattern (e.g., "5Q0 615 301 F")
            const refPattern = /[A-Z0-9]{3}\\s*[0-9]{3}\\s*[0-9]{3}\\s*[A-Z0-9]{0,2}/;
            const rowText = row.textContent || '';
            const refMatch = rowText.match(refPattern);

            if (refMatch) {
              // Extract quantity (usually a number like "2" or "x2")
              const qtyMatch = rowText.match(/(\\d+)\\s*(x|pcs|pc|pièce)?/i);
              const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;

              // Extract description (text that's not the ref or qty)
              let desc = rowText
                .replace(refMatch[0], '')
                .replace(/\\d+\\s*(x|pcs|pc|pièce)?/gi, '')
                .trim()
                .slice(0, 100);

              parts.push({
                ref: refMatch[0].trim(),
                description: desc || 'Pièce',
                quantity: qty,
              });
            }
          }
        }

        // Strategy 2: Look for specific part number elements
        if (parts.length === 0) {
          const partNumberEls = document.querySelectorAll('.part-number, .ref-oe, .oem-ref, [data-ref]');
          for (const el of partNumberEls) {
            const ref = el.textContent?.trim();
            if (ref && ref.length >= 5) {
              const parent = el.closest('tr, .part-row, .item') || el.parentElement;
              const descEl = parent?.querySelector('.description, .name, .libelle');
              const qtyEl = parent?.querySelector('.quantity, .qty, .qte');

              parts.push({
                ref,
                description: descEl?.textContent?.trim() || 'Pièce',
                quantity: parseInt(qtyEl?.textContent || '1', 10) || 1,
              });
            }
          }
        }

        // Deduplicate by reference
        const seen = new Set();
        return {
          parts: parts.filter(p => {
            if (seen.has(p.ref)) return false;
            seen.add(p.ref);
            return true;
          })
        };
      }` });

      if (!result?.data?.parts) {
        return [];
      }

      return result.data.parts.map((p) => ({
        oem_ref: p.ref,
        description: p.description,
        quantity: p.quantity,
        notes: p.notes,
      }));
    } catch (error) {
      this.logger.warn(`Failed to extract parts: ${error.message}`);
      return [];
    }
  }

  /**
   * Quick lookup: Search PartLink24 for a specific OEM reference
   *
   * Note: Direct reference search may not work on PartLink24.
   * Use scrapePartsLink24Catalog() for reliable results.
   */
  async searchPartsLink24ByRef(oemRef: string): Promise<ExternalVerificationResult | null> {
    // First authenticate
    const authSuccess = await this.authenticatePartLink24();
    if (!authSuccess) {
      return null;
    }

    // Try direct search (may not work)
    return this.scrapeSource(
      'partslink24',
      oemRef,
      { brand: '', model: '' },
      this.defaultTimeout,
      false,
    );
  }

  /**
   * Get OEM parts for a specific vehicle and parts group
   *
   * Convenience method that wraps scrapePartsLink24Catalog with common defaults.
   *
   * @example
   * ```typescript
   * const parts = await service.getOemPartsForVehicle(
   *   'Volkswagen', 'Golf', 2020,
   *   'Roues, Freins', '615-000'
   * );
   * console.log(parts);
   * // [{ oem_ref: '5Q0 615 301 F', description: 'Disque de frein', quantity: 2 }]
   * ```
   */
  async getOemPartsForVehicle(
    brand: string,
    model: string,
    year: number,
    group: string,
    subgroup?: string,
    variant?: string,
  ): Promise<PartLink24OemPart[]> {
    const result = await this.scrapePartsLink24Catalog({
      brand,
      model,
      year,
      variant,
      group,
      subgroup,
    });

    if (!result.success) {
      this.logger.warn(`Failed to get OEM parts: ${result.error}`);
      return [];
    }

    return result.parts;
  }

  /**
   * Get list of enabled sources
   */
  getEnabledSources(): string[] {
    return this.enabledSources;
  }
}

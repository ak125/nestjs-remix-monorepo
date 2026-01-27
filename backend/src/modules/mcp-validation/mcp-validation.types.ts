/**
 * MCP Validation Types - Phase 1: Shadow Mode
 *
 * Types for the MCP validation layer that prevents AI hallucinations
 * on critical data (compatibility, price, stock, references).
 *
 * Principle: L'IA NE CREE PAS LA VERITE (AI-COS Axiome Zero)
 */

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION MODES
// ═══════════════════════════════════════════════════════════════════════════

/** MCP validation mode - progressive enforcement */
export type McpValidationMode =
  | 'shadow' // Phase 1: Run in parallel, no impact
  | 'verification' // Phase 2: Secondary check with warnings
  | 'gatekeeper' // Phase 3: Mandatory gate with fallbacks
  | 'enforcement'; // Phase 4: Block if MCP inconclusive

/** Match status between MCP and direct results */
export type McpMatchStatus =
  | 'match' // Results are identical
  | 'mismatch' // Results differ
  | 'mcp_only' // Only MCP returned a result
  | 'direct_only' // Only direct query returned a result
  | 'error'; // Error during comparison

/** Verification status */
export type McpVerificationStatus =
  | 'verified' // Data confirmed by MCP
  | 'unverified' // Data not confirmed
  | 'inconclusive' // Cannot determine
  | 'rejected' // Explicitly rejected
  | 'timeout' // Verification timed out
  | 'error'; // Error during verification

// ═══════════════════════════════════════════════════════════════════════════
// DATA TYPES FOR VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

/** Types of data that require MCP validation */
export type McpDataType =
  | 'compatibility' // Vehicle-part compatibility (CRITICAL)
  | 'price' // Product pricing (CRITICAL)
  | 'stock' // Stock availability (CRITICAL)
  | 'safety' // Safety gate verification (CRITICAL) - Phase 3
  | 'reference' // OEM/Part references (HIGH)
  | 'vehicle' // Vehicle identity resolution
  | 'diagnostic' // KG diagnostic results
  | 'page_role' // SEO page role resolution
  | 'content'; // Expert content authorization

/** Criticality level */
export type McpCriticality = 'critical' | 'high' | 'medium' | 'low';

/** Data type configuration */
export const MCP_DATA_TYPE_CONFIG: Record<
  McpDataType,
  {
    criticality: McpCriticality;
    cacheMaxAge: number; // Max cache age in seconds (0 = no cache)
    requiresVerification: boolean;
    fallbackAllowed: boolean;
  }
> = {
  compatibility: {
    criticality: 'critical',
    cacheMaxAge: 0, // Never cache compatibility for safety parts
    requiresVerification: true,
    fallbackAllowed: false,
  },
  price: {
    criticality: 'critical',
    cacheMaxAge: 0, // Real-time in checkout context
    requiresVerification: true,
    fallbackAllowed: false,
  },
  stock: {
    criticality: 'critical',
    cacheMaxAge: 300, // 5 minutes for browsing
    requiresVerification: true,
    fallbackAllowed: false,
  },
  safety: {
    criticality: 'critical',
    cacheMaxAge: 0, // Never cache safety - real-time verification required
    requiresVerification: true,
    fallbackAllowed: false, // Fail-safe: block on error
  },
  reference: {
    criticality: 'high',
    cacheMaxAge: 86400, // 24 hours
    requiresVerification: true,
    fallbackAllowed: true,
  },
  vehicle: {
    criticality: 'high',
    cacheMaxAge: 86400, // 24 hours (stable data)
    requiresVerification: true,
    fallbackAllowed: true,
  },
  diagnostic: {
    criticality: 'medium',
    cacheMaxAge: 3600, // 1 hour
    requiresVerification: false,
    fallbackAllowed: true,
  },
  page_role: {
    criticality: 'medium',
    cacheMaxAge: 3600, // 1 hour
    requiresVerification: false,
    fallbackAllowed: true,
  },
  content: {
    criticality: 'low',
    cacheMaxAge: 300, // 5 minutes
    requiresVerification: false,
    fallbackAllowed: true,
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION LOG ENTRY
// ═══════════════════════════════════════════════════════════════════════════

/** MCP validation log entry for audit */
export interface McpValidationLogEntry {
  id?: string;
  request_id: string;
  endpoint: string;
  http_method: string;
  data_type: McpDataType;
  validation_mode: McpValidationMode;

  // Input hashes (for deduplication)
  input_hash: string;
  query_params_hash?: string;

  // Results
  mcp_result_hash?: string;
  direct_result_hash?: string;
  match_status: McpMatchStatus;

  // Metrics
  confidence_score?: number;
  latency_mcp_ms?: number;
  latency_direct_ms?: number;
  latency_total_ms: number;

  // Context
  truth_level?: string;
  source_type?: string;
  cache_status?: 'hit' | 'miss' | 'bypass';

  // Error handling
  error_message?: string;
  error_code?: string;

  // Audit
  user_id?: string;
  session_id?: string;
  ip_hash?: string;
  created_at?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// VERIFICATION RESULT
// ═══════════════════════════════════════════════════════════════════════════

/** Result of MCP verification */
export interface McpVerificationResult<T = unknown> {
  verified: boolean;
  status: McpVerificationStatus;
  data?: T;

  // Confidence
  confidence?: number;
  truth_level?: string;

  // Refusal info
  refusal?: {
    code: string;
    reason: string;
    message_fr: string;
    message_en: string;
    suggested_action?: string;
    escalation?: 'human_review' | 'technical_support' | 'none';
  };

  // Metadata
  source: string;
  verified_at: string;
  cache_status?: 'hit' | 'miss' | 'bypass';
  latency_ms?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// REFUSAL MESSAGES
// ═══════════════════════════════════════════════════════════════════════════

/** Standard refusal messages by data type */
export const MCP_REFUSAL_MESSAGES: Record<
  McpDataType,
  {
    code: string;
    fr: string;
    en: string;
  }
> = {
  compatibility: {
    code: 'COMPAT_NOT_VERIFIED',
    fr: "La compatibilite de cette piece avec votre vehicule n'a pas pu etre confirmee. Verifiez les references constructeur.",
    en: 'The compatibility of this part with your vehicle could not be confirmed. Please verify manufacturer references.',
  },
  price: {
    code: 'PRICE_NOT_VERIFIED',
    fr: "Le prix affiche n'a pas pu etre verifie en temps reel. Veuillez rafraichir la page.",
    en: 'The displayed price could not be verified in real-time. Please refresh the page.',
  },
  stock: {
    code: 'STOCK_NOT_VERIFIED',
    fr: "La disponibilite de cet article n'a pas pu etre confirmee. Contactez-nous pour plus d'informations.",
    en: 'The availability of this item could not be confirmed. Contact us for more information.',
  },
  safety: {
    code: 'SAFETY_NOT_VERIFIED',
    fr: "La verification de securite n'a pas pu etre effectuee. Par mesure de precaution, veuillez contacter le support.",
    en: 'Safety verification could not be completed. As a precaution, please contact support.',
  },
  reference: {
    code: 'REF_NOT_VERIFIED',
    fr: "Cette reference n'a pas pu etre verifiee dans notre catalogue. Verifiez la reference OEM.",
    en: 'This reference could not be verified in our catalog. Please check the OEM reference.',
  },
  vehicle: {
    code: 'VEHICLE_NOT_VERIFIED',
    fr: "Le vehicule n'a pas pu etre identifie de maniere unique. Precisez le modele exact.",
    en: 'The vehicle could not be uniquely identified. Please specify the exact model.',
  },
  diagnostic: {
    code: 'DIAG_INDICATIVE',
    fr: 'Ce diagnostic est fourni a titre indicatif. Consultez un professionnel pour verification.',
    en: 'This diagnosis is indicative only. Consult a professional for verification.',
  },
  page_role: {
    code: 'ROLE_CONFLICT',
    fr: "Le role de cette page n'a pas pu etre determine.",
    en: 'The role of this page could not be determined.',
  },
  content: {
    code: 'CONTENT_NOT_AUTHORIZED',
    fr: "Ce contenu n'est pas autorise pour ce type de page.",
    en: 'This content is not authorized for this page type.',
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// CIRCUIT BREAKER
// ═══════════════════════════════════════════════════════════════════════════

/** Circuit breaker state */
export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

/** Circuit breaker configuration */
export interface CircuitBreakerConfig {
  failureThreshold: number; // Failures before opening (default: 5)
  recoveryTimeout: number; // ms before half-open (default: 60000)
  halfOpenRequests: number; // Test requests in half-open (default: 3)
}

/** Circuit breaker status */
export interface CircuitBreakerStatus {
  state: CircuitBreakerState;
  failureCount: number;
  lastFailure?: Date;
  nextRetry?: Date;
  successCount: number;
}

export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  recoveryTimeout: 60000,
  halfOpenRequests: 3,
};

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION CONTEXT
// ═══════════════════════════════════════════════════════════════════════════

/** Context for MCP validation */
export interface McpValidationContext {
  requestId: string;
  endpoint: string;
  httpMethod: string;
  dataType: McpDataType;
  mode: McpValidationMode;

  // Request context
  userId?: string;
  sessionId?: string;
  ipHash?: string;

  // Business context
  pieceId?: number;
  ktypnr?: number;
  vehicleId?: string;
  gammeId?: number;

  // Cache control
  bypassCache?: boolean;
  checkoutContext?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// DECORATOR OPTIONS
// ═══════════════════════════════════════════════════════════════════════════

/** Options for @McpValidate decorator */
export interface McpValidateOptions {
  dataType: McpDataType;
  mode?: McpValidationMode;
  truthLevel?: 'L1' | 'L2' | 'L3' | 'L4';
  fallbackOnMismatch?: boolean;
  warningThreshold?: number;
  bypassInDev?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// GATEKEEPER TOOLS INTERFACES
// ═══════════════════════════════════════════════════════════════════════════

/** Input for verifyVehicleIdentity tool */
export interface VerifyVehicleInput {
  ktypnr?: number;
  vehicleId?: string;
  brandModelType?: {
    brand: string;
    model: string;
    type: string;
  };
  licensePlate?: string;
  vin?: string;
}

/** Output for verifyVehicleIdentity tool */
export interface VerifyVehicleOutput {
  verified: boolean;
  vehicle?: {
    ktypnr: number;
    brand: string;
    model: string;
    type: string;
    engineFamily?: string;
    yearFrom: number;
    yearTo?: number;
  };
  refusal?: {
    reason: string;
    code: 'NOT_FOUND' | 'AMBIGUOUS' | 'INCOMPLETE';
    suggestions?: string[];
  };
  source: 'tecdoc' | 'siv' | 'internal';
  verifiedAt: string;
}

/** Input for verifyPartCompatibility tool */
export interface VerifyCompatibilityInput {
  pieceId: number;
  pieceRef?: string;
  ktypnr: number;
  context?: 'browse' | 'cart' | 'checkout';
}

/** Output for verifyPartCompatibility tool */
export interface VerifyCompatibilityOutput {
  compatible: boolean | null;
  verification: {
    method: 'tecdoc_direct' | 'tecdoc_oe' | 'oem_cross' | 'none';
    confidence: number;
    linkageId?: number;
  };
  refusal?: {
    reason: string;
    code: 'NOT_VERIFIED' | 'INCOMPATIBLE' | 'PARTIAL_MATCH' | 'SAFETY_BLOCK';
    safetyGate?: 'warning' | 'stop_soon' | 'stop_immediate';
  };
  warnings?: string[];
  verifiedAt: string;
}

/** Input for getVerifiedStockAndPrice tool */
export interface GetStockPriceInput {
  pieceId: number;
  quantity?: number;
  context: 'browse' | 'cart' | 'checkout';
  includeConsigne?: boolean;
}

/** Output for getVerifiedStockAndPrice tool */
export interface GetStockPriceOutput {
  verified: boolean;
  data?: {
    stock: {
      available: number;
      status: 'in_stock' | 'low_stock' | 'out_of_stock';
      reorderDate?: string;
    };
    price: {
      unitPriceTTC: number;
      consigneTTC: number;
      totalTTC: number;
      currency: 'EUR';
    };
    formatted: {
      integer: number;
      decimals: string;
      display: string;
    };
  };
  refusal?: {
    reason: string;
    code: 'UNAVAILABLE' | 'PRICE_CHANGED' | 'OUT_OF_STOCK';
    previousPrice?: number;
  };
  cacheStatus: 'fresh' | 'cached' | 'force_refresh';
  verifiedAt: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// SHADOW MODE COMPARISON
// ═══════════════════════════════════════════════════════════════════════════

/** Shadow comparison result */
export interface McpShadowComparison {
  matchStatus: McpMatchStatus;
  discrepancies?: Array<{
    field: string;
    mcpValue: unknown;
    directValue: unknown;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>;
  similarity?: number; // 0-1
}

// ═══════════════════════════════════════════════════════════════════════════
// STATISTICS
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 4: ENFORCEMENT FALLBACK URLS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Fallback URLs for enforcement mode redirect
 * When MCP verification fails, redirect to diagnostic instead of blocking
 *
 * Principle: JAMAIS de blocage vente - redirection vers diagnostic
 */
export const MCP_FALLBACK_URL_MAP: Record<McpDataType, string> = {
  compatibility: '/api/diagnostic/compatibility-analysis',
  price: '/api/diagnostic/price-verification',
  stock: '/api/diagnostic/stock-check',
  safety: '/api/diagnostic/safety-analysis',
  reference: '/api/diagnostic/reference-lookup',
  vehicle: '/api/diagnostic/vehicle-resolution',
  diagnostic: '/api/diagnostic/deep-analysis',
  page_role: '/api/diagnostic/page-role-resolution',
  content: '/api/diagnostic/content-validation',
};

/**
 * Recommendations by data type for enforcement redirect
 */
export const MCP_ENFORCEMENT_RECOMMENDATIONS: Record<McpDataType, string[]> = {
  compatibility: [
    'Vérifiez les références OEM de votre véhicule',
    'Contactez notre support pour confirmation',
    "Utilisez l'outil de diagnostic pour une analyse approfondie",
  ],
  price: [
    'Rafraîchissez la page pour obtenir le prix actuel',
    'Contactez-nous pour une confirmation de prix',
  ],
  stock: [
    'Vérifiez la disponibilité en temps réel',
    'Contactez-nous pour connaître les délais',
  ],
  safety: [
    'Utilisez notre outil de diagnostic approfondi',
    'Consultez un mécanicien qualifié',
    'En cas de doute sur la sécurité, faites vérifier votre véhicule',
  ],
  reference: [
    "Vérifiez la référence OEM sur le carnet d'entretien",
    'Contactez le constructeur pour confirmation',
  ],
  vehicle: [
    'Précisez le modèle exact de votre véhicule',
    'Utilisez le numéro de série (VIN) pour identification exacte',
  ],
  diagnostic: [
    'Consultez un professionnel pour un diagnostic complet',
    'Les résultats sont fournis à titre indicatif',
  ],
  page_role: ['Cette page nécessite une vérification manuelle'],
  content: ["Le contenu n'a pas pu être validé automatiquement"],
};

// ═══════════════════════════════════════════════════════════════════════════
// STATISTICS
// ═══════════════════════════════════════════════════════════════════════════

/** MCP validation statistics */
export interface McpValidationStats {
  totalRequests: number;
  matchCount: number;
  mismatchCount: number;
  errorCount: number;
  matchRate: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  byDataType: Record<
    McpDataType,
    {
      count: number;
      matchRate: number;
      avgLatencyMs: number;
    }
  >;
  byEndpoint: Record<
    string,
    {
      count: number;
      matchRate: number;
      errorRate: number;
    }
  >;
  period: {
    from: string;
    to: string;
  };
}

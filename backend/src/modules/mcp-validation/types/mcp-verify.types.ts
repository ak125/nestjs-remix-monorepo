/**
 * MCP Verify Types - Phase 2: Verification Mode
 *
 * Types specific to the verification mode that adds synchronous
 * MCP validation with response enrichment and optional blocking.
 *
 * Principle: L'IA NE CREE PAS LA VERITE (AI-COS Axiome Zero)
 */

import { McpDataType, McpValidationMode } from '../mcp-validation.types';

// ═══════════════════════════════════════════════════════════════════════════
// DECORATOR OPTIONS
// ═══════════════════════════════════════════════════════════════════════════

/** Options for @McpVerify() decorator */
export interface McpVerifyOptions {
  /** Type of data being verified */
  dataType: McpDataType;

  /** Validation mode - determines behavior */
  mode: Exclude<McpValidationMode, 'shadow'>; // 'verification' | 'gatekeeper' | 'enforcement'

  /** Action on mismatch detection */
  onMismatch: 'warning' | 'block';

  /** Include verification metadata in response */
  includeInResponse?: boolean;

  /** Custom refusal message (overrides default) */
  customRefusalMessage?: {
    fr: string;
    en: string;
  };

  /** Bypass verification for specific conditions */
  bypassIf?: (context: McpVerifyContext) => boolean;

  /** Fallback handler when verification fails */
  fallbackHandler?: (context: McpVerifyContext) => unknown;

  /** Timeout for MCP verification in ms (default: 5000) */
  timeout?: number;

  /** Minimum confidence score to accept (default: 0.70) */
  minConfidence?: number;

  // ─────────────────────────────────────────────────────────────────────────
  // Phase 4: Enforcement with Redirect (JAMAIS de blocage vente)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Fallback URL for enforcement mode redirect
   * If not specified, uses MCP_FALLBACK_URL_MAP[dataType]
   */
  fallbackUrl?: string;

  /**
   * Whether to redirect instead of blocking in enforcement mode
   * Default: true (follows AI-COS rule: JAMAIS de blocage vente)
   *
   * When true and verification fails:
   * - Returns HTTP 200 with _mcp_redirect envelope
   * - Allows purchase with warning
   *
   * When false:
   * - Throws HTTP 422/503 (legacy behavior - NOT RECOMMENDED)
   */
  redirectOnEnforcement?: boolean;
}

/** Context passed to bypass/fallback functions */
export interface McpVerifyContext {
  requestId: string;
  endpoint: string;
  httpMethod: string;
  dataType: McpDataType;
  params: Record<string, unknown>;
  userId?: string;
  sessionId?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// RESPONSE ENVELOPE
// ═══════════════════════════════════════════════════════════════════════════

/** MCP verification metadata added to response */
export interface McpVerificationEnvelope {
  /** Overall verification status */
  status: McpVerifyStatus;

  /** Validation mode used */
  mode: McpValidationMode;

  /** Warning messages for discrepancies */
  warnings: string[];

  /** Request ID for tracing */
  requestId: string;

  /** Timestamp of verification */
  timestamp: string;

  /** Confidence score from MCP (0-1) */
  confidence?: number;

  /** MCP tool that was called */
  tool?: string;

  /** Latency of MCP call in ms */
  latency_ms?: number;

  /** If blocked, the refusal details */
  refusal?: McpRefusalDetails;
}

/** Simplified verification status for response */
export type McpVerifyStatus =
  | 'verified' // MCP confirmed the data
  | 'unverified' // MCP could not verify (but allowed through)
  | 'warning' // MCP detected discrepancy (warning mode)
  | 'blocked'; // MCP rejected (block mode)

/** Refusal details when verification fails in block mode */
export interface McpRefusalDetails {
  code: string;
  message_fr: string;
  message_en: string;
  suggested_action?: string;
  escalation?: 'human_review' | 'technical_support' | 'none';
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 4: ENFORCEMENT REDIRECT ENVELOPE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Redirect envelope for enforcement mode
 *
 * When MCP verification fails in enforcement mode, instead of blocking (HTTP 422),
 * we return HTTP 200 with this redirect envelope.
 *
 * Principle: JAMAIS de blocage vente - redirection vers diagnostic
 */
export interface McpRedirectEnvelope {
  /** Always true - indicates this is a redirect response */
  redirect: true;

  /** URL to redirect the user for diagnostic */
  url: string;

  /** Reason for the redirect (human-readable) */
  reason: string;

  /** Original request parameters (for diagnostic tool) */
  original_request: Record<string, unknown>;

  /** ALWAYS true - AI-COS rule: can_continue is always true */
  can_continue: true;

  /** Recommendations for the user */
  recommendations: string[];

  /** Optional: Query params to append to redirect URL */
  query_params?: Record<string, string>;
}

/**
 * Response structure when enforcement redirects to diagnostic
 */
export interface McpEnforcementRedirectResponse<T = unknown> {
  /** Original response data (may be partial or default) */
  data?: T;

  /** Redirect envelope */
  _mcp_redirect: McpRedirectEnvelope;

  /** Verification envelope */
  _mcp_verification: McpVerificationEnvelope;

  /** Purchase is ALWAYS allowed (with warning) */
  can_purchase: true;

  /** Warning message for user */
  purchase_warning?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// INTERCEPTOR TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** Result from MCP verify interceptor */
export interface McpVerifyInterceptorResult<T = unknown> {
  /** Original response data */
  data: T;

  /** Verification envelope (if includeInResponse) */
  verification?: McpVerificationEnvelope;

  /** Whether to proceed with response */
  proceed: boolean;

  /** If not proceeding, the error to throw */
  error?: McpVerifyError;
}

/** Error thrown when verification fails in block mode */
export class McpVerifyError extends Error {
  constructor(
    public readonly code: string,
    public readonly message_fr: string,
    public readonly message_en: string,
    public readonly dataType: McpDataType,
    public readonly requestId: string,
    public readonly httpStatus: number = 422,
  ) {
    super(`MCP Verification Failed: ${code}`);
    this.name = 'McpVerifyError';
  }

  toResponse(): McpVerifyErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message_en,
        message_fr: this.message_fr,
        dataType: this.dataType,
        requestId: this.requestId,
      },
      statusCode: this.httpStatus,
    };
  }
}

export interface McpVerifyErrorResponse {
  error: {
    code: string;
    message: string;
    message_fr: string;
    dataType: McpDataType;
    requestId: string;
  };
  statusCode: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// ALERTING TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** Alert severity levels */
export type McpAlertSeverity = 'info' | 'warning' | 'error' | 'critical';

/** Alert payload for mismatches */
export interface McpMismatchAlert {
  severity: McpAlertSeverity;
  dataType: McpDataType;
  endpoint: string;
  requestId: string;
  timestamp: string;

  /** Discrepancy details */
  discrepancy: {
    field: string;
    mcpValue: unknown;
    directValue: unknown;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }[];

  /** Context for debugging */
  context: {
    userId?: string;
    sessionId?: string;
    params?: Record<string, unknown>;
  };

  /** Whether this triggered a block */
  blocked: boolean;
}

/** Alert channel configuration */
export interface McpAlertChannel {
  type: 'database' | 'webhook' | 'email' | 'console';
  enabled: boolean;
  config?: {
    webhookUrl?: string;
    emailTo?: string[];
    minSeverity?: McpAlertSeverity;
  };
}

/** Alerting service configuration */
export interface McpAlertingConfig {
  channels: McpAlertChannel[];

  /** Minimum severity to trigger alerts */
  minSeverity: McpAlertSeverity;

  /** Rate limiting: max alerts per minute per endpoint */
  rateLimit: number;

  /** Aggregation window in seconds */
  aggregationWindow: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// QUERY SERVICE TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** Base interface for MCP query functions */
export interface McpQueryFunction<TInput, TOutput> {
  (input: TInput, context: McpVerifyContext): Promise<TOutput | null>;
}

/** Registry of MCP query functions by tool name */
export type McpQueryRegistry = {
  verifyPartCompatibility: McpQueryFunction<
    VerifyCompatibilityInput,
    VerifyCompatibilityOutput
  >;
  getVerifiedStockAndPrice: McpQueryFunction<
    GetStockPriceInput,
    GetStockPriceOutput
  >;
  verifyVehicleIdentity: McpQueryFunction<
    VerifyVehicleInput,
    VerifyVehicleOutput
  >;
  diagnose: McpQueryFunction<DiagnoseInput, DiagnoseOutput>;
  resolvePageRole: McpQueryFunction<
    ResolvePageRoleInput,
    ResolvePageRoleOutput
  >;
  verifyReference: McpQueryFunction<
    VerifyReferenceInput,
    VerifyReferenceOutput
  >;
  checkSafetyGate: McpQueryFunction<
    CheckSafetyGateInput,
    CheckSafetyGateOutput
  >;
};

// ─────────────────────────────────────────────────────────────────────────────
// MCP Tool Input/Output Types
// ─────────────────────────────────────────────────────────────────────────────

/** Compatibility verification */
export interface VerifyCompatibilityInput {
  pieceId?: number;
  pieceRef?: string;
  ktypnr?: number;
  vin?: string;
}

export interface VerifyCompatibilityOutput {
  compatible: boolean | null;
  linkageId?: string;
  confidence: number;
  source: 'tecdoc' | 'oem' | 'manual';
  verifiedAt: string;
  warnings?: string[];
}

/** Stock and price verification */
export interface GetStockPriceInput {
  pieceId: number;
  quantity?: number;
  context?: 'browsing' | 'cart' | 'checkout';
}

export interface GetStockPriceOutput {
  available: boolean;
  quantity: number;
  unitPriceHT: number;
  unitPriceTTC: number;
  consigneHT?: number;
  consigneTTC?: number;
  priceValidUntil: string;
  verifiedAt: string;
}

/** Vehicle identity verification */
export interface VerifyVehicleInput {
  brand?: string;
  model?: string;
  type?: string;
  year?: number;
  ktypnr?: number;
  vin?: string;
  plate?: string;
}

export interface VerifyVehicleOutput {
  ktypnr: number;
  brand: string;
  model: string;
  type: string;
  engineCode?: string;
  confidence: number;
  ambiguous: boolean;
  alternatives?: Array<{ ktypnr: number; label: string }>;
  verifiedAt: string;
}

/** Diagnostic verification */
export interface DiagnoseInput {
  observable_ids: string[];
  vehicle_context?: {
    ktypnr?: number;
    mileage_km?: number;
    vehicle_age_years?: number;
    vehicle_id?: string;
    engine_family_code?: string;
  };
}

export interface DiagnoseOutput {
  faults: Array<{
    fault_id: string;
    fault_label: string;
    probability_score: number;
    confidence_score: number;
  }>;
  safety_gate?: 'none' | 'warning' | 'stop_soon' | 'stop_immediate';
  verifiedAt: string;
}

/** Safety gate verification input */
export interface CheckSafetyGateInput {
  observable_ids: string[];
  vehicle_context?: {
    vehicle_id?: string;
    mileage_km?: number;
  };
}

/** Safety gate verification output */
export interface CheckSafetyGateOutput {
  has_safety_concern: boolean;
  highest_gate: 'none' | 'warning' | 'stop_soon' | 'stop_immediate';
  block_sales: boolean;
  can_continue_driving: boolean;
  safety_message: string | null;
  recommended_action: string | null;
  show_emergency_contact: boolean;
  emergency_contact: string | null;
  triggered_observables: Array<{
    node_id: string;
    label: string;
    gate: string;
  }> | null;
  verifiedAt: string;
}

/** Page role resolution */
export interface ResolvePageRoleInput {
  url: string;
  path?: string;
}

export interface ResolvePageRoleOutput {
  role:
    | 'R1_ROUTER'
    | 'R2_PRODUCT'
    | 'R3_BLOG'
    | 'R4_REFERENCE'
    | 'R5_DIAGNOSTIC'
    | 'R6_SUPPORT';
  canonical?: string;
  allowedLinks: string[];
  verifiedAt: string;
}

/** Reference verification */
export interface VerifyReferenceInput {
  reference: string;
  type?: 'oem' | 'ean' | 'internal';
}

export interface VerifyReferenceOutput {
  found: boolean;
  pieceId?: number;
  oemCodes?: string[];
  brandName?: string;
  confidence: number;
  verifiedAt: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/** Default configuration for @McpVerify() */
export const MCP_VERIFY_DEFAULTS: Partial<McpVerifyOptions> = {
  mode: 'verification',
  onMismatch: 'warning',
  includeInResponse: true,
  timeout: 5000,
  minConfidence: 0.7,
};

/** Metadata key for @McpVerify() decorator */
export const MCP_VERIFY_KEY = 'mcp_verify';

/** Alert severity thresholds by data type */
export const MCP_ALERT_SEVERITY_MAP: Record<McpDataType, McpAlertSeverity> = {
  compatibility: 'critical',
  price: 'critical',
  stock: 'critical',
  safety: 'critical', // Phase 3: Safety is critical
  reference: 'error',
  vehicle: 'error',
  diagnostic: 'warning',
  page_role: 'warning',
  content: 'info',
};

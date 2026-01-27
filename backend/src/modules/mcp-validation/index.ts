/**
 * MCP Validation Module - Public API
 *
 * Re-exports all public types, services, and decorators
 * for the MCP validation layer.
 *
 * Phase 1: Shadow Mode (parallel validation, no blocking)
 * Phase 2: Verification Mode (synchronous, with warnings/blocking)
 * Phase 3: Gatekeeper Mode (safety gates, fail-safe)
 * Phase 4: Full Enforcement with Redirect (JAMAIS de blocage vente)
 * Phase 5: External Compatibility Verification (Chrome DevTools MCP)
 */

// ═══════════════════════════════════════════════════════════════════════════
// MODULE
// ═══════════════════════════════════════════════════════════════════════════

export { McpValidationModule } from './mcp-validation.module';

// ═══════════════════════════════════════════════════════════════════════════
// SERVICES
// ═══════════════════════════════════════════════════════════════════════════

export { McpValidationService } from './mcp-validation.service';
export { McpQueryService } from './services/mcp-query.service';
export { McpAlertingService } from './services/mcp-alerting.service';

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 1: SHADOW MODE
// ═══════════════════════════════════════════════════════════════════════════

export {
  McpShadowInterceptor,
  McpValidate,
  MCP_VALIDATE_KEY,
} from './interceptors/mcp-shadow.interceptor';

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 2: VERIFICATION MODE
// ═══════════════════════════════════════════════════════════════════════════

export { McpVerifyInterceptor } from './interceptors/mcp-verify.interceptor';

export {
  // Decorator & Shortcuts
  McpVerify,
  McpVerifyCompatibility,
  McpVerifyPrice,
  McpVerifyStock,
  McpVerifyDiagnostic,
  McpVerifySafety,
  McpVerifySafetyGate, // Phase 3: Safety gate gatekeeper mode

  // Phase 4: Enforcement with Redirect (JAMAIS de blocage vente)
  McpVerifyEnforcement,
  McpVerifyEnforcementSafety,
  McpVerifyEnforcementCompatibility,
  McpVerifyEnforcementPrice,
  McpVerifyVehicle,
  McpVerifyReference,
  hasMcpVerify,
  getMcpVerifyOptions,
} from './decorators/mcp-verify.decorator';

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 1 TYPES
// ═══════════════════════════════════════════════════════════════════════════

export {
  // Modes & Status
  McpValidationMode,
  McpMatchStatus,
  McpVerificationStatus,
  McpDataType,
  McpCriticality,

  // Config
  MCP_DATA_TYPE_CONFIG,
  MCP_REFUSAL_MESSAGES,

  // Phase 4: Enforcement Redirect Config
  MCP_FALLBACK_URL_MAP,
  MCP_ENFORCEMENT_RECOMMENDATIONS,

  // Interfaces
  McpValidationLogEntry,
  McpVerificationResult,
  McpValidationContext,
  McpValidateOptions,
  McpShadowComparison,

  // Circuit Breaker
  CircuitBreakerState,
  CircuitBreakerConfig,
  CircuitBreakerStatus,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,

  // Statistics
  McpValidationStats,
} from './mcp-validation.types';

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 2 TYPES
// ═══════════════════════════════════════════════════════════════════════════

export {
  // Decorator Options
  McpVerifyOptions,
  McpVerifyContext,
  MCP_VERIFY_KEY,
  MCP_VERIFY_DEFAULTS,

  // Response Envelope
  McpVerificationEnvelope,
  McpVerifyStatus,
  McpRefusalDetails,

  // Phase 4: Enforcement Redirect Envelope
  McpRedirectEnvelope,
  McpEnforcementRedirectResponse,

  // Interceptor
  McpVerifyInterceptorResult,
  McpVerifyError,
  McpVerifyErrorResponse,

  // Alerting
  McpAlertSeverity,
  McpMismatchAlert,
  McpAlertChannel,
  McpAlertingConfig,
  MCP_ALERT_SEVERITY_MAP,

  // Query Functions
  McpQueryFunction,
  McpQueryRegistry,
  VerifyCompatibilityInput,
  VerifyCompatibilityOutput,
  GetStockPriceInput,
  GetStockPriceOutput,
  VerifyVehicleInput,
  VerifyVehicleOutput,
  DiagnoseInput,
  DiagnoseOutput,
  ResolvePageRoleInput,
  ResolvePageRoleOutput,
  VerifyReferenceInput,
  VerifyReferenceOutput,
  CheckSafetyGateInput,
  CheckSafetyGateOutput,
} from './types/mcp-verify.types';

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 5: EXTERNAL COMPATIBILITY VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════

export { ChromeDevToolsClientService } from './services/chrome-devtools-client.service';
export { ExternalCompatibilityService } from './services/external-compatibility.service';

export {
  // Main types
  VehicleInfo,
  ExternalVerificationResult,
  CompatibilityComparisonResult,
  ExternalVerifyOptions,

  // PartLink24 specific
  PartLink24OemPart,
  PartLink24NavigationPath,
  PartLink24CatalogResult,
} from './services/external-compatibility.service';

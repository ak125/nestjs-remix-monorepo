/**
 * MCP Verify Decorator - Phase 2: Verification Mode
 *
 * Decorator for synchronous MCP verification on endpoints.
 * Unlike @McpValidate() (shadow mode), this decorator:
 * - Runs verification synchronously
 * - Can block requests on mismatch
 * - Enriches response with verification metadata
 *
 * Principle: L'IA NE CREE PAS LA VERITE (AI-COS Axiome Zero)
 */

import { SetMetadata, applyDecorators } from '@nestjs/common';
import {
  McpVerifyOptions,
  MCP_VERIFY_KEY,
  MCP_VERIFY_DEFAULTS,
} from '../types/mcp-verify.types';
import {
  DomainValidationException,
  ErrorCodes,
} from '../../../common/exceptions';

/**
 * @McpVerify() Decorator
 *
 * Applies synchronous MCP verification to an endpoint.
 *
 * @example
 * // Basic usage - verification mode with warnings
 * @McpVerify({
 *   dataType: 'diagnostic',
 *   mode: 'verification',
 *   onMismatch: 'warning',
 * })
 * @Post('diagnose')
 * async diagnose(@Body() input: DiagnoseInput) { ... }
 *
 * @example
 * // Critical endpoint - block on mismatch
 * @McpVerify({
 *   dataType: 'compatibility',
 *   mode: 'gatekeeper',
 *   onMismatch: 'block',
 *   customRefusalMessage: {
 *     fr: 'Compatibilité non vérifiable',
 *     en: 'Compatibility cannot be verified',
 *   },
 * })
 * @Post('verify-compatibility')
 * async verifyCompatibility(@Body() input: VerifyCompatibilityInput) { ... }
 *
 * @example
 * // With bypass condition
 * @McpVerify({
 *   dataType: 'price',
 *   mode: 'verification',
 *   onMismatch: 'warning',
 *   bypassIf: (ctx) => ctx.params.skipVerification === true,
 * })
 * @Get('price/:pieceId')
 * async getPrice(@Param('pieceId') pieceId: number) { ... }
 */
export function McpVerify(options: McpVerifyOptions) {
  // Merge with defaults
  const mergedOptions: McpVerifyOptions = {
    ...MCP_VERIFY_DEFAULTS,
    ...options,
  };

  // Validate options
  if (!mergedOptions.dataType) {
    throw new DomainValidationException({
      code: ErrorCodes.VALIDATION.FAILED,
      message: '@McpVerify requires dataType option',
    });
  }

  if (
    !['verification', 'gatekeeper', 'enforcement'].includes(mergedOptions.mode)
  ) {
    throw new DomainValidationException({
      code: ErrorCodes.VALIDATION.FAILED,
      message: `@McpVerify mode must be 'verification', 'gatekeeper', or 'enforcement'`,
    });
  }

  if (!['warning', 'block'].includes(mergedOptions.onMismatch)) {
    throw new DomainValidationException({
      code: ErrorCodes.VALIDATION.FAILED,
      message: `@McpVerify onMismatch must be 'warning' or 'block'`,
    });
  }

  return applyDecorators(SetMetadata(MCP_VERIFY_KEY, mergedOptions));
}

/**
 * Shorthand decorators for common use cases
 */

/**
 * @McpVerifyCompatibility() - Pre-configured for compatibility verification
 *
 * @example
 * @McpVerifyCompatibility()
 * @Post('check-compatibility')
 * async checkCompatibility() { ... }
 */
export function McpVerifyCompatibility(overrides?: Partial<McpVerifyOptions>) {
  return McpVerify({
    dataType: 'compatibility',
    mode: 'gatekeeper',
    onMismatch: 'block',
    includeInResponse: true,
    minConfidence: 0.8, // Higher threshold for safety
    ...overrides,
  });
}

/**
 * @McpVerifyPrice() - Pre-configured for price verification
 *
 * @example
 * @McpVerifyPrice()
 * @Get('price/:pieceId')
 * async getPrice() { ... }
 */
export function McpVerifyPrice(overrides?: Partial<McpVerifyOptions>) {
  return McpVerify({
    dataType: 'price',
    mode: 'verification',
    onMismatch: 'warning', // Warning by default, block in checkout context
    includeInResponse: true,
    timeout: 3000, // Faster timeout for prices
    ...overrides,
  });
}

/**
 * @McpVerifyStock() - Pre-configured for stock verification
 *
 * @example
 * @McpVerifyStock()
 * @Get('availability/:pieceId')
 * async getAvailability() { ... }
 */
export function McpVerifyStock(overrides?: Partial<McpVerifyOptions>) {
  return McpVerify({
    dataType: 'stock',
    mode: 'verification',
    onMismatch: 'warning',
    includeInResponse: true,
    timeout: 3000,
    ...overrides,
  });
}

/**
 * @McpVerifyDiagnostic() - Pre-configured for diagnostic verification
 *
 * @example
 * @McpVerifyDiagnostic()
 * @Post('diagnose')
 * async diagnose() { ... }
 */
export function McpVerifyDiagnostic(overrides?: Partial<McpVerifyOptions>) {
  return McpVerify({
    dataType: 'diagnostic',
    mode: 'verification',
    onMismatch: 'warning',
    includeInResponse: true,
    minConfidence: 0.6, // Lower threshold for diagnostics (probabilistic)
    ...overrides,
  });
}

/**
 * @McpVerifySafety() - Pre-configured for safety-critical verification
 *
 * This is the strictest verification mode - always blocks on issues.
 *
 * @example
 * @McpVerifySafety()
 * @Post('safety/check')
 * async checkSafety() { ... }
 */
export function McpVerifySafety(overrides?: Partial<McpVerifyOptions>) {
  return McpVerify({
    dataType: 'diagnostic',
    mode: 'enforcement', // Strictest mode
    onMismatch: 'block',
    includeInResponse: true,
    minConfidence: 0.9, // Very high threshold for safety
    timeout: 10000, // Longer timeout - safety is worth waiting for
    ...overrides,
  });
}

/**
 * @McpVerifySafetyGate() - Pre-configured for safety gate verification (Phase 3)
 *
 * Uses the dedicated 'safety' dataType with 'gatekeeper' mode.
 * Calls checkSafetyGate() MCP tool for proper structure matching.
 *
 * Options:
 * - autoBlockLevel: Automatically block on this safety level or higher
 *   - 'stop_immediate': Block only on critical safety issues
 *   - 'stop_soon': Block on urgent + critical issues
 *
 * @example
 * @McpVerifySafetyGate({ autoBlockLevel: 'stop_immediate' })
 * @Post('safety/check')
 * async checkSafetyGate() { ... }
 */
export function McpVerifySafetyGate(
  overrides?: Partial<McpVerifyOptions> & {
    autoBlockLevel?: 'stop_soon' | 'stop_immediate';
  },
) {
  return McpVerify({
    dataType: 'safety',
    mode: 'gatekeeper',
    onMismatch: 'block',
    includeInResponse: true,
    minConfidence: 0.95, // Very high threshold for safety gate
    timeout: 3000, // Quick timeout for safety - fail-safe on timeout
    ...overrides,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 4: FULL ENFORCEMENT WITH REDIRECT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @McpVerifyEnforcement() - Phase 4: Full enforcement with redirect
 *
 * This decorator enables full enforcement mode that NEVER blocks sales.
 * Instead of returning HTTP 422, it returns HTTP 200 with:
 * - `_mcp_redirect` envelope pointing to diagnostic tool
 * - `can_purchase: true` ALWAYS
 * - `purchase_warning` message for the user
 *
 * Principle: JAMAIS de blocage vente - redirection vers diagnostic
 *
 * @example
 * @McpVerifyEnforcement({ dataType: 'safety' })
 * @Post('safety/check')
 * async checkSafety() { ... }
 *
 * @example
 * // With custom fallback URL
 * @McpVerifyEnforcement({
 *   dataType: 'compatibility',
 *   fallbackUrl: '/api/diagnostic/custom-compatibility-check',
 * })
 * @Post('verify-compatibility')
 * async verifyCompatibility() { ... }
 */
export function McpVerifyEnforcement(
  overrides: Partial<McpVerifyOptions> & {
    dataType: McpVerifyOptions['dataType'];
  },
) {
  return McpVerify({
    dataType: overrides.dataType,
    mode: 'enforcement',
    onMismatch: 'block', // Will be converted to redirect by interceptor
    includeInResponse: true,
    redirectOnEnforcement: true, // Enable redirect behavior (default)
    minConfidence: 0.8,
    timeout: 5000,
    ...overrides,
  });
}

/**
 * @McpVerifyEnforcementSafety() - Phase 4: Safety-specific enforcement with redirect
 *
 * Pre-configured enforcement for safety-critical endpoints.
 * Uses 'safety' dataType and checkSafetyGate() MCP tool.
 *
 * @example
 * @McpVerifyEnforcementSafety()
 * @Post('safety/check')
 * async checkSafety() { ... }
 */
export function McpVerifyEnforcementSafety(
  overrides?: Partial<McpVerifyOptions>,
) {
  return McpVerifyEnforcement({
    dataType: 'safety',
    minConfidence: 0.95,
    timeout: 3000,
    ...overrides,
  });
}

/**
 * @McpVerifyEnforcementCompatibility() - Phase 4: Compatibility enforcement with redirect
 *
 * Pre-configured enforcement for compatibility verification endpoints.
 *
 * @example
 * @McpVerifyEnforcementCompatibility()
 * @Post('check-compatibility')
 * async checkCompatibility() { ... }
 */
export function McpVerifyEnforcementCompatibility(
  overrides?: Partial<McpVerifyOptions>,
) {
  return McpVerifyEnforcement({
    dataType: 'compatibility',
    minConfidence: 0.8,
    ...overrides,
  });
}

/**
 * @McpVerifyEnforcementPrice() - Phase 4: Price enforcement with redirect
 *
 * Pre-configured enforcement for price verification (checkout context).
 *
 * @example
 * @McpVerifyEnforcementPrice()
 * @Post('checkout/verify-price')
 * async verifyCheckoutPrice() { ... }
 */
export function McpVerifyEnforcementPrice(
  overrides?: Partial<McpVerifyOptions>,
) {
  return McpVerifyEnforcement({
    dataType: 'price',
    timeout: 3000,
    ...overrides,
  });
}

/**
 * @McpVerifyVehicle() - Pre-configured for vehicle identity verification
 *
 * @example
 * @McpVerifyVehicle()
 * @Post('resolve-vehicle')
 * async resolveVehicle() { ... }
 */
export function McpVerifyVehicle(overrides?: Partial<McpVerifyOptions>) {
  return McpVerify({
    dataType: 'vehicle',
    mode: 'verification',
    onMismatch: 'warning',
    includeInResponse: true,
    ...overrides,
  });
}

/**
 * @McpVerifyReference() - Pre-configured for reference verification
 *
 * @example
 * @McpVerifyReference()
 * @Get('search/by-ref/:ref')
 * async searchByRef() { ... }
 */
export function McpVerifyReference(overrides?: Partial<McpVerifyOptions>) {
  return McpVerify({
    dataType: 'reference',
    mode: 'verification',
    onMismatch: 'warning',
    includeInResponse: true,
    ...overrides,
  });
}

/**
 * Helper to check if a handler has @McpVerify metadata
 */
export function hasMcpVerify(
  target: object,
  propertyKey?: string | symbol,
): boolean {
  if (propertyKey) {
    return Reflect.hasMetadata(MCP_VERIFY_KEY, target, propertyKey);
  }
  return Reflect.hasMetadata(MCP_VERIFY_KEY, target);
}

/**
 * Helper to get @McpVerify options from metadata
 */
export function getMcpVerifyOptions(
  target: object,
  propertyKey?: string | symbol,
): McpVerifyOptions | undefined {
  if (propertyKey) {
    return Reflect.getMetadata(MCP_VERIFY_KEY, target, propertyKey);
  }
  return Reflect.getMetadata(MCP_VERIFY_KEY, target);
}

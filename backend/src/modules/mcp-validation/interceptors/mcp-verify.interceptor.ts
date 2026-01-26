/**
 * MCP Verify Interceptor - Phase 2+4: Synchronous Verification with Redirect
 *
 * Intercepts requests with @McpVerify() decorator and performs
 * synchronous MCP verification. Unlike the shadow interceptor,
 * this one can block requests and enriches responses.
 *
 * Phase 4: Full Enforcement with Redirect
 * - NEVER block sales (HTTP 422) → Always redirect to diagnostic (HTTP 200)
 * - `_mcp_redirect` envelope instead of error response
 * - `can_continue: true` and `can_purchase: true` ALWAYS
 *
 * Principle: L'IA NE CREE PAS LA VERITE (AI-COS Axiome Zero)
 * Critical Rule: JAMAIS de blocage vente - redirection vers diagnostic
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, from, throwError, of } from 'rxjs';
import { mergeMap, catchError, timeout } from 'rxjs/operators';
import { Request } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { ConfigService } from '@nestjs/config';
import { McpValidationService } from '../mcp-validation.service';
import { McpQueryService } from '../services/mcp-query.service';
import { McpAlertingService } from '../services/mcp-alerting.service';
import {
  McpVerifyOptions,
  McpVerifyContext,
  McpVerificationEnvelope,
  McpVerifyStatus,
  McpVerifyError,
  McpRedirectEnvelope,
  McpEnforcementRedirectResponse,
  MCP_VERIFY_KEY,
  MCP_ALERT_SEVERITY_MAP,
} from '../types/mcp-verify.types';
import {
  McpDataType,
  MCP_DATA_TYPE_CONFIG,
  MCP_REFUSAL_MESSAGES,
  MCP_FALLBACK_URL_MAP,
  MCP_ENFORCEMENT_RECOMMENDATIONS,
} from '../mcp-validation.types';

@Injectable()
export class McpVerifyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(McpVerifyInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
    private readonly validationService: McpValidationService,
    private readonly queryService: McpQueryService,
    private readonly alertingService: McpAlertingService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const handler = context.getHandler();
    const controller = context.getClass();

    // Get @McpVerify options from metadata
    const options =
      this.reflector.get<McpVerifyOptions>(MCP_VERIFY_KEY, handler) ||
      this.reflector.get<McpVerifyOptions>(MCP_VERIFY_KEY, controller);

    // No @McpVerify decorator - pass through
    if (!options) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const startTime = Date.now();

    // Build verification context
    const verifyContext = this.buildContext(request, options);

    // Check bypass condition
    if (options.bypassIf && options.bypassIf(verifyContext)) {
      this.logger.debug(
        `MCP verification bypassed for ${verifyContext.endpoint}`,
      );
      return next.handle();
    }

    // Execute handler and then verify response
    return next.handle().pipe(
      // Apply timeout
      timeout(options.timeout || 5000),

      // Process response with verification
      mergeMap((response) =>
        from(this.verifyResponse(response, options, verifyContext, startTime)),
      ),

      // Handle errors
      catchError((error) => {
        // Phase 4: Enforcement mode with redirect (NEVER block sales)
        if (options.mode === 'enforcement') {
          // Check kill switch
          const enforcementEnabled = this.configService.get<string>('MCP_ENFORCEMENT_MODE') !== 'false';

          // If redirect is enabled (default) OR kill switch is off, redirect instead of block
          if (!enforcementEnabled || options.redirectOnEnforcement !== false) {
            this.logger.warn(
              `MCP enforcement redirect for ${verifyContext.endpoint}: ${error.message}`,
            );
            return of(this.createEnforcementRedirectResponse(
              null,
              options,
              verifyContext,
              startTime,
              error instanceof McpVerifyError ? error.message : (error as Error).message,
            ));
          }
        }

        if (error instanceof McpVerifyError) {
          // Rethrow as HTTP exception (legacy behavior, NOT RECOMMENDED)
          throw new HttpException(error.toResponse(), error.httpStatus);
        }

        // Log error but allow through for non-enforcement modes
        this.logger.warn(
          `MCP verification error (allowing through): ${error.message}`,
        );
        return throwError(() => error);
      }),
    );
  }

  /**
   * Build verification context from request
   */
  private buildContext(
    request: Request,
    options: McpVerifyOptions,
  ): McpVerifyContext {
    return {
      requestId: (request as any).requestId || uuidv4(),
      endpoint: `${request.method} ${request.path}`,
      httpMethod: request.method,
      dataType: options.dataType,
      params: {
        ...request.params,
        ...request.query,
        ...(request.body && typeof request.body === 'object' ? request.body : {}),
      },
      userId: (request as any).user?.id || (request as any).session?.userId,
      sessionId: (request as any).sessionID,
    };
  }

  /**
   * Verify response against MCP and enrich if needed
   *
   * Phase 4: Returns McpEnforcementRedirectResponse in enforcement mode
   */
  private async verifyResponse<T>(
    response: T,
    options: McpVerifyOptions,
    context: McpVerifyContext,
    startTime: number,
  ): Promise<T | (T & { _mcp_verification: McpVerificationEnvelope }) | McpEnforcementRedirectResponse<T>> {
    const { dataType, mode, onMismatch, includeInResponse, minConfidence } = options;

    try {
      // Get the appropriate MCP query function
      const toolName = this.getToolNameForDataType(dataType);
      const queryFn = toolName ? this.queryService.getQueryFunction(toolName as any) : null;

      if (!queryFn) {
        this.logger.warn(`No MCP query function for dataType: ${dataType}`);
        return this.enrichResponse(response, 'unverified', [], context, startTime, options);
      }

      // Execute MCP verification
      const mcpResult = await queryFn(context.params as any, context);

      if (!mcpResult) {
        // MCP returned null - handle based on mode
        if (mode === 'enforcement') {
          // Phase 4: Redirect instead of block
          const enforcementEnabled = this.configService.get<string>('MCP_ENFORCEMENT_MODE') !== 'false';
          if (!enforcementEnabled || options.redirectOnEnforcement !== false) {
            return this.createEnforcementRedirectResponse(
              response,
              options,
              context,
              startTime,
              'MCP verification unavailable - redirecting to diagnostic',
            );
          }
          throw this.createVerifyError(dataType, context, 'MCP_UNAVAILABLE');
        }

        return this.enrichResponse(
          response,
          'unverified',
          ['MCP verification unavailable'],
          context,
          startTime,
          options,
        );
      }

      // Compare MCP result with direct response
      const comparison = this.validationService.compareResults(
        response,
        mcpResult,
        dataType,
      );

      // Check confidence threshold
      const confidenceOk =
        !minConfidence ||
        (mcpResult as any).confidence >= minConfidence;

      // Determine status based on comparison and confidence
      let status: McpVerifyStatus = 'verified';
      const warnings: string[] = [];

      if (comparison.matchStatus !== 'match') {
        // Mismatch detected
        const discrepancies = comparison.discrepancies || [];

        // Build warning messages
        for (const disc of discrepancies) {
          warnings.push(
            `${disc.field} discrepancy: MCP=${JSON.stringify(disc.mcpValue)}, ` +
            `Direct=${JSON.stringify(disc.directValue)} (severity: ${disc.severity})`,
          );
        }

        // Alert on critical mismatches
        const hasCritical = discrepancies.some((d) => d.severity === 'critical');
        if (hasCritical) {
          await this.alertingService.alert({
            severity: MCP_ALERT_SEVERITY_MAP[dataType],
            dataType,
            endpoint: context.endpoint,
            requestId: context.requestId,
            timestamp: new Date().toISOString(),
            discrepancy: discrepancies,
            context: {
              userId: context.userId,
              sessionId: context.sessionId,
              params: context.params,
            },
            blocked: onMismatch === 'block',
          });
        }

        // Handle mismatch based on mode
        if (onMismatch === 'block' || mode === 'enforcement') {
          // Phase 4: Redirect instead of block in enforcement mode
          if (mode === 'enforcement') {
            const enforcementEnabled = this.configService.get<string>('MCP_ENFORCEMENT_MODE') !== 'false';
            if (!enforcementEnabled || options.redirectOnEnforcement !== false) {
              return this.createEnforcementRedirectResponse(
                response,
                options,
                context,
                startTime,
                `Data mismatch detected: ${warnings.join('; ')}`,
              );
            }
          }
          throw this.createVerifyError(
            dataType,
            context,
            'DATA_MISMATCH',
            options.customRefusalMessage,
          );
        }

        status = 'warning';
      } else if (!confidenceOk) {
        warnings.push(
          `Low confidence: ${(mcpResult as any).confidence} < ${minConfidence}`,
        );
        status = 'warning';
      }

      return this.enrichResponse(
        response,
        status,
        warnings,
        context,
        startTime,
        options,
        toolName,
        (mcpResult as any).confidence,
      );
    } catch (error) {
      if (error instanceof McpVerifyError) {
        throw error;
      }

      this.logger.error(`Verification failed: ${(error as Error).message}`);

      // Phase 4: In enforcement mode, redirect instead of block
      if (mode === 'enforcement') {
        const enforcementEnabled = this.configService.get<string>('MCP_ENFORCEMENT_MODE') !== 'false';
        if (!enforcementEnabled || options.redirectOnEnforcement !== false) {
          return this.createEnforcementRedirectResponse(
            response,
            options,
            context,
            startTime,
            `Verification failed: ${(error as Error).message}`,
          );
        }
        throw this.createVerifyError(dataType, context, 'VERIFICATION_FAILED');
      }

      return this.enrichResponse(
        response,
        'unverified',
        [`Verification error: ${(error as Error).message}`],
        context,
        startTime,
        options,
      );
    }
  }

  /**
   * Enrich response with MCP verification envelope
   */
  private enrichResponse<T>(
    response: T,
    status: McpVerifyStatus,
    warnings: string[],
    context: McpVerifyContext,
    startTime: number,
    options: McpVerifyOptions,
    tool?: string,
    confidence?: number,
  ): T | (T & { _mcp_verification: McpVerificationEnvelope }) {
    if (!options.includeInResponse) {
      return response;
    }

    const envelope: McpVerificationEnvelope = {
      status,
      mode: options.mode,
      warnings,
      requestId: context.requestId,
      timestamp: new Date().toISOString(),
      latency_ms: Date.now() - startTime,
    };

    if (tool) {
      envelope.tool = tool;
    }

    if (confidence !== undefined) {
      envelope.confidence = confidence;
    }

    // Handle array responses
    if (Array.isArray(response)) {
      return {
        data: response,
        _mcp_verification: envelope,
      } as any;
    }

    // Handle object responses
    if (response && typeof response === 'object') {
      return {
        ...response,
        _mcp_verification: envelope,
      } as T & { _mcp_verification: McpVerificationEnvelope };
    }

    // Primitive responses - wrap
    return {
      data: response,
      _mcp_verification: envelope,
    } as any;
  }

  /**
   * Create verification error
   */
  private createVerifyError(
    dataType: McpDataType,
    context: McpVerifyContext,
    errorCode: string,
    customMessage?: { fr: string; en: string },
  ): McpVerifyError {
    const defaultMessage = MCP_REFUSAL_MESSAGES[dataType] || {
      code: 'VERIFICATION_FAILED',
      fr: 'La vérification a échoué.',
      en: 'Verification failed.',
    };

    return new McpVerifyError(
      customMessage ? errorCode : defaultMessage.code,
      customMessage?.fr || defaultMessage.fr,
      customMessage?.en || defaultMessage.en,
      dataType,
      context.requestId,
      this.getHttpStatusForMode(dataType),
    );
  }

  /**
   * Get HTTP status code based on data type criticality
   */
  private getHttpStatusForMode(dataType: McpDataType): number {
    const config = MCP_DATA_TYPE_CONFIG[dataType];
    if (config.criticality === 'critical') {
      return HttpStatus.UNPROCESSABLE_ENTITY; // 422
    }
    if (config.criticality === 'high') {
      return HttpStatus.CONFLICT; // 409
    }
    return HttpStatus.BAD_REQUEST; // 400
  }

  /**
   * Map data type to MCP tool name
   */
  private getToolNameForDataType(
    dataType: McpDataType,
  ): keyof import('../types/mcp-verify.types').McpQueryRegistry | null {
    const mapping: Record<McpDataType, string | null> = {
      compatibility: 'verifyPartCompatibility',
      price: 'getVerifiedStockAndPrice',
      stock: 'getVerifiedStockAndPrice',
      reference: 'verifyReference',
      vehicle: 'verifyVehicleIdentity',
      diagnostic: 'diagnose',
      safety: 'checkSafetyGate', // Phase 3 - Safety gate verification
      page_role: 'resolvePageRole',
      content: null, // No verification for content
    };

    return mapping[dataType] as any;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 4: ENFORCEMENT REDIRECT (JAMAIS de blocage vente)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create enforcement redirect response instead of blocking
   *
   * Principle: JAMAIS de blocage vente - redirection vers diagnostic
   * Returns HTTP 200 with `_mcp_redirect` envelope
   */
  private createEnforcementRedirectResponse<T>(
    response: T | null,
    options: McpVerifyOptions,
    context: McpVerifyContext,
    startTime: number,
    reason: string,
  ): McpEnforcementRedirectResponse<T> {
    const redirectUrl = options.fallbackUrl || MCP_FALLBACK_URL_MAP[options.dataType];
    const recommendations = this.getRecommendations(options.dataType);

    // Build query params for redirect URL
    const queryParams: Record<string, string> = {
      requestId: context.requestId,
      dataType: options.dataType,
      reason: encodeURIComponent(reason.slice(0, 200)), // Limit reason length
    };

    // Add relevant context params
    if (context.params) {
      for (const [key, value] of Object.entries(context.params)) {
        if (value !== undefined && value !== null && typeof value !== 'object') {
          queryParams[key] = String(value);
        }
      }
    }

    const redirectEnvelope: McpRedirectEnvelope = {
      redirect: true,
      url: redirectUrl,
      reason,
      original_request: context.params,
      can_continue: true, // ALWAYS true - AI-COS rule
      recommendations,
      query_params: queryParams,
    };

    const verificationEnvelope: McpVerificationEnvelope = {
      status: 'blocked', // Status reflects what would have happened
      mode: options.mode,
      warnings: [reason],
      requestId: context.requestId,
      timestamp: new Date().toISOString(),
      latency_ms: Date.now() - startTime,
    };

    this.logger.log(
      `MCP Enforcement Redirect: ${options.dataType} → ${redirectUrl} (requestId: ${context.requestId})`,
    );

    // Return the redirect response structure
    const redirectResponse: McpEnforcementRedirectResponse<T> = {
      _mcp_redirect: redirectEnvelope,
      _mcp_verification: verificationEnvelope,
      can_purchase: true, // ALWAYS true - AI-COS rule: JAMAIS de blocage vente
      purchase_warning: this.getPurchaseWarning(options.dataType, reason),
    };

    // Include original response data if available
    if (response !== null && response !== undefined) {
      redirectResponse.data = response;
    }

    return redirectResponse;
  }

  /**
   * Get recommendations for a data type
   */
  private getRecommendations(dataType: McpDataType): string[] {
    return MCP_ENFORCEMENT_RECOMMENDATIONS[dataType] || [
      'Utilisez notre outil de diagnostic pour une analyse approfondie',
      'Contactez notre support si vous avez des questions',
    ];
  }

  /**
   * Get purchase warning message based on data type
   */
  private getPurchaseWarning(dataType: McpDataType, reason: string): string {
    const warningMap: Record<McpDataType, string> = {
      compatibility: '⚠️ La compatibilité n\'a pas pu être vérifiée automatiquement. Vérifiez les références OEM avant achat.',
      price: '⚠️ Le prix affiché peut ne pas être à jour. Vérifiez le prix final au moment du paiement.',
      stock: '⚠️ La disponibilité peut avoir changé. Confirmez avant de finaliser votre commande.',
      safety: '⚠️ Un diagnostic sécurité est recommandé avant achat. Consultez un professionnel si nécessaire.',
      reference: '⚠️ La référence n\'a pas pu être vérifiée. Assurez-vous qu\'elle correspond à votre véhicule.',
      vehicle: '⚠️ L\'identification du véhicule n\'est pas complète. Vérifiez les détails avant achat.',
      diagnostic: '⚠️ Le diagnostic automatique n\'est pas concluant. Consultez un professionnel.',
      page_role: '⚠️ Contenu non vérifié.',
      content: '⚠️ Contenu non vérifié.',
    };

    return warningMap[dataType] || '⚠️ Vérification non concluante. Veuillez vérifier les détails avant achat.';
  }
}

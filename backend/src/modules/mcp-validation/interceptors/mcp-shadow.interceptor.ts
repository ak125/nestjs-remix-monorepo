import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { McpValidationService } from '../mcp-validation.service';
import {
  McpValidationContext,
  McpValidateOptions,
  McpDataType,
} from '../mcp-validation.types';
import {
  findMatchingRoute,
  McpRouteMapping,
} from '../config/mcp-route-map.config';

export const MCP_VALIDATE_KEY = 'mcp_validate';

/**
 * Decorator to mark endpoints for MCP validation
 * @example
 * @McpValidate({ dataType: 'compatibility', mode: 'shadow' })
 * @Get('pieces/:id/compatibility')
 */
export function McpValidate(options: McpValidateOptions) {
  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) => {
    Reflect.defineMetadata(MCP_VALIDATE_KEY, options, target, propertyKey);
    return descriptor;
  };
}

/**
 * MCP Shadow Interceptor - Phase 1
 *
 * Runs MCP validation in parallel with the normal request flow.
 * Does NOT block or modify the response - only logs for analysis.
 *
 * Features:
 * - Uses req.requestId from RequestIdMiddleware (reliable tracing)
 * - Route-based tool selection via MCP_SHADOW_ROUTE_MAP
 * - Decorator-based validation via @McpValidate()
 *
 * Usage:
 * - Apply globally or per-controller
 * - Configure routes in mcp-route-map.config.ts
 * - Or use @McpValidate() decorator on endpoints
 */
@Injectable()
export class McpShadowInterceptor implements NestInterceptor {
  private readonly logger = new Logger(McpShadowInterceptor.name);

  constructor(
    private readonly mcpValidationService: McpValidationService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const handler = context.getHandler();
    const controller = context.getClass();

    // 1. Check for @McpValidate decorator (explicit annotation)
    const validateOptions = this.reflector.get<McpValidateOptions>(
      MCP_VALIDATE_KEY,
      handler,
    ) || this.reflector.get<McpValidateOptions>(MCP_VALIDATE_KEY, controller);

    // 2. Check route map (declarative config)
    const routeMatch = findMatchingRoute(request.method, request.path);

    // If neither decorator nor route map match, skip validation
    if (!validateOptions && !routeMatch) {
      return next.handle();
    }

    // Determine data type and tool from decorator or route map
    const dataType = validateOptions?.dataType || routeMatch?.mapping.dataType;
    const tool = routeMatch?.mapping.tool;

    if (!dataType) {
      return next.handle();
    }

    // Skip in dev if configured (decorator only)
    if (
      validateOptions?.bypassInDev &&
      process.env.NODE_ENV === 'development'
    ) {
      return next.handle();
    }

    // Check skipIf condition from route map
    if (routeMatch?.mapping.skipIf) {
      const shouldSkip = routeMatch.mapping.skipIf({
        checkoutContext: request.path.includes('checkout'),
        bypassCache: request.query.bypassCache === 'true',
      });
      if (shouldSkip) {
        return next.handle();
      }
    }

    // Create validation context
    const validationContext = this.createValidationContext(
      request,
      dataType,
      validateOptions?.mode || 'shadow',
      routeMatch,
    );

    // Execute handler and validate in parallel
    return next.handle().pipe(
      tap({
        next: (response) => {
          // Run shadow validation asynchronously (non-blocking)
          this.runShadowValidation(
            response,
            validationContext,
            tool || dataType,
            routeMatch?.mapping,
          ).catch((error) => {
            this.logger.warn(
              `Shadow validation failed for ${validationContext.endpoint}: ${error.message}`,
            );
          });
        },
        error: (error) => {
          this.logger.debug(
            `Request failed, skipping shadow validation: ${error.message}`,
          );
        },
      }),
    );
  }

  /**
   * Run shadow validation asynchronously
   */
  private async runShadowValidation(
    directResult: unknown,
    context: McpValidationContext,
    tool: string,
    routeMapping?: McpRouteMapping,
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Get MCP query function based on tool
      const mcpQueryFn = this.getMcpQueryFunction(context, tool);

      if (!mcpQueryFn) {
        this.logger.debug(`No MCP query function for tool '${tool}', skipping`);
        return;
      }

      // Run shadow comparison
      const comparison = await this.mcpValidationService.validateShadow(
        directResult,
        mcpQueryFn,
        context,
      );

      // Log metrics
      const duration = Date.now() - startTime;
      if (duration > 100) {
        this.logger.warn(
          `Shadow validation slow for ${context.endpoint}: ${duration}ms`,
        );
      }

      // Log mismatches for analysis
      if (comparison.matchStatus === 'mismatch') {
        this.logger.warn(
          `[MCP_MISMATCH] ${context.endpoint} | Tool: ${tool} | ` +
            `Similarity: ${comparison.similarity?.toFixed(2)} | ` +
            `Discrepancies: ${comparison.discrepancies?.length || 0}`,
        );
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Shadow validation error for ${context.endpoint}: ${err.message}`,
      );
    }
  }

  /**
   * Create validation context from request
   * Uses req.requestId from RequestIdMiddleware if available
   */
  private createValidationContext(
    request: Request,
    dataType: McpDataType,
    mode: 'shadow' | 'verification' | 'gatekeeper' | 'enforcement',
    routeMatch?: { mapping: McpRouteMapping; matches: RegExpMatchArray },
  ): McpValidationContext {
    // Extract IDs from request (route params, query, body)
    let pieceId = this.extractNumericParam(request, 'pieceId', 'id');
    let ktypnr = this.extractNumericParam(request, 'ktypnr');
    let vehicleId = this.extractStringParam(request, 'vehicleId');
    const gammeId = this.extractNumericParam(request, 'gammeId');

    // Override with extracted params from route regex if available
    if (routeMatch?.mapping.extractParams) {
      const extracted = routeMatch.mapping.extractParams(routeMatch.matches);
      if (extracted.pieceId) pieceId = extracted.pieceId as number;
      if (extracted.ktypnr) ktypnr = extracted.ktypnr as number;
      if (extracted.vehicleId) vehicleId = extracted.vehicleId as string;
    }

    return {
      // Use reliable requestId from middleware, fallback to uuid
      requestId: request.requestId || uuidv4(),
      endpoint: `${request.method} ${request.path}`,
      httpMethod: request.method,
      dataType,
      mode,
      userId: (request as { user?: { id?: string } }).user?.id,
      sessionId: request.sessionID,
      ipHash: this.hashIp(request.ip || ''),
      pieceId,
      ktypnr,
      vehicleId,
      gammeId,
      bypassCache: request.query.bypassCache === 'true',
      checkoutContext: request.path.includes('checkout'),
    };
  }

  /**
   * Get MCP query function based on tool name
   * Returns null if no MCP validation available for this tool
   */
  private getMcpQueryFunction(
    context: McpValidationContext,
    tool: string,
  ): (() => Promise<unknown>) | null {
    // Phase 1: Return placeholder functions for logging purposes
    // In Phase 2+, these will call actual MCP tools

    switch (tool) {
      case 'verifyPartCompatibility':
      case 'compatibility':
        return async () => {
          // TODO Phase 2: Call mcp-compatibility-gate.verifyPartCompatibility
          // Input: { pieceId: context.pieceId, ktypnr: context.ktypnr }
          return null;
        };

      case 'getVerifiedStockAndPrice':
      case 'price':
      case 'stock':
        return async () => {
          // TODO Phase 2: Call mcp-stock-price.getVerifiedStockAndPrice
          // Input: { pieceId: context.pieceId, context: context.checkoutContext ? 'checkout' : 'browse' }
          return null;
        };

      case 'verifyVehicleIdentity':
      case 'vehicle':
        return async () => {
          // TODO Phase 2: Call mcp-compatibility-gate.verifyVehicleIdentity
          // Input: { ktypnr: context.ktypnr, vehicleId: context.vehicleId }
          return null;
        };

      case 'diagnose':
      case 'diagnostic':
        return async () => {
          // TODO Phase 2: Call mcp-diagnostic-knowledge.diagnose
          return null;
        };

      case 'resolvePageRole':
      case 'page_role':
        return async () => {
          // TODO Phase 2: Call mcp-seo-router.resolvePageRole
          return null;
        };

      case 'verifyReference':
      case 'reference':
        return async () => {
          // TODO Phase 2: Call mcp-catalog-core.verifyReference
          return null;
        };

      default:
        this.logger.debug(`Unknown tool '${tool}', no MCP query function`);
        return null;
    }
  }

  /**
   * Extract numeric parameter from request
   */
  private extractNumericParam(
    request: Request,
    ...paramNames: string[]
  ): number | undefined {
    for (const name of paramNames) {
      const value =
        request.params[name] ||
        request.query[name] ||
        (request.body as Record<string, unknown>)?.[name];

      if (value !== undefined) {
        const num = parseInt(String(value), 10);
        if (!isNaN(num)) return num;
      }
    }
    return undefined;
  }

  /**
   * Extract string parameter from request
   */
  private extractStringParam(
    request: Request,
    ...paramNames: string[]
  ): string | undefined {
    for (const name of paramNames) {
      const value =
        request.params[name] ||
        request.query[name] ||
        (request.body as Record<string, unknown>)?.[name];

      if (value !== undefined && typeof value === 'string') {
        return value;
      }
    }
    return undefined;
  }

  /**
   * Hash IP address for privacy
   */
  private hashIp(ip: string): string {
    return createHash('sha256').update(ip).digest('hex').substring(0, 8);
  }
}
